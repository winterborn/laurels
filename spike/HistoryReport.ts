import type { Findings } from './Findings.ts';
import type { PlexItem } from './PlexClient.ts';
import { formatCounts, formatDate, formatShare } from './helpers/format.ts';
import { countBy, unique } from './helpers/lists.ts';

const SECTION = 'History';
const TWO_PART_TITLE = /\bpart\s*(1|one|i)\b/i;

export interface HistoryReportOptions {
    findings: Findings;
    rows: PlexItem[];
    accountIds: string[];
    devices: Map<string, PlexItem>;
}

// Answers P0 questions about Plex watch history.
export class HistoryReport {

    private readonly findings: Findings;
    private readonly rows: PlexItem[];
    private readonly accountIds: string[];
    private readonly devices: Map<string, PlexItem>;

    constructor(options: HistoryReportOptions) {
        this.findings = options.findings;
        this.rows = options.rows;
        this.accountIds = options.accountIds;
        this.devices = options.devices;
    }

    write(): void {
        this.noteRange();
        this.noteTypes();
        this.noteAccounts();
        this.noteDevices();
        this.noteShape();
        this.noteTimeOfDay();
    }

    hourCounts(): Record<string, number> {
        return countBy(this.rows, (row) => {
            const date = new Date(Number(row.viewedAt) * 1000);
            return String(date.getHours()).padStart(2, '0');
        });
    }

    yearCounts(): Record<string, number> {
        return countBy(this.rows, (row) => {
            return formatDate(Number(row.viewedAt)).slice(0, 4);
        });
    }

    private noteRange(): void {
        const times = this.rows
            .map((row) => Number(row.viewedAt))
            .filter((time) => time > 0);
        const oldest = times.reduce((min, time) => Math.min(min, time), Infinity);
        const newest = times.reduce((max, time) => Math.max(max, time), 0);
        this.note('Oldest watch', formatDate(oldest), 'info');
        this.note('Newest watch', formatDate(newest), 'info');
        this.note('Watches per year', formatCounts(this.yearCounts()), 'info');
    }

    private noteTypes(): void {
        const types = countBy(this.rows, (row) => String(row.type));
        this.note('Rows by type', formatCounts(types), 'info');
    }

    private noteAccounts(): void {
        const counts = countBy(this.rows, (row) => String(row.accountID));
        const inHistory = Object.keys(counts);
        const missing = this.accountIds.filter((id) => !inHistory.includes(id));
        const missingText = missing.length ? missing.join(', ') : 'none';
        const missingVerdict = missing.length ? 'check' : 'ok';
        const share = `${inHistory.length} ids in history, ${this.accountIds.length} on server`;
        this.note('Accounts with history', share, 'info');
        this.note('Rows per account id', formatCounts(counts), 'info');
        this.note('Server accounts with no history', missingText, missingVerdict);
    }

    private noteDevices(): void {
        const withDevice = this.rows.filter((row) => row.deviceID !== undefined);
        const known = withDevice.filter((row) => {
            return this.devices.has(String(row.deviceID));
        });
        const platforms = countBy(known, (row) => {
            const device = this.devices.get(String(row.deviceID));
            return String(device?.platform || 'unknown');
        });
        const knownShare = known.length / Math.max(1, this.rows.length);
        const knownVerdict = knownShare >= 0.9 ? 'ok' : 'check';
        this.note('Rows with a deviceID', formatShare(withDevice.length, this.rows.length), 'info');
        this.note('deviceID found in /devices', formatShare(known.length, this.rows.length), knownVerdict);
        this.note('Platforms (from /devices)', formatCounts(platforms), 'info');
    }

    private noteShape(): void {
        const keys = unique(this.rows.map((row) => String(row.ratingKey)));
        const episodes = this.rows.filter((row) => row.type === 'episode');
        const withShow = episodes.filter((row) => row.grandparentKey);
        const duplicates = this.rows.length - this.distinctWatches();
        const twoParts = episodes.filter((row) => TWO_PART_TITLE.test(String(row.title)));
        const duplicateVerdict = duplicates ? 'check' : 'ok';
        this.note('Distinct items watched', String(keys.length), 'info');
        this.note('Episodes with a show key', formatShare(withShow.length, episodes.length), 'info');
        this.note('Exact duplicate rows', String(duplicates), duplicateVerdict);
        this.note('Episodes titled "Part 1"', String(twoParts.length), 'info');
    }

    private noteTimeOfDay(): void {
        const hours = this.hourCounts();
        const lateNight = ['01', '02', '03', '04']
            .map((hour) => hours[hour] ?? 0)
            .reduce((sum, count) => sum + count, 0);
        this.note('Watches ending 1am–5am', formatShare(lateNight, this.rows.length), 'info');
    }

    private distinctWatches(): number {
        const keys = this.rows.map((row) => {
            return `${row.accountID}:${row.ratingKey}:${row.viewedAt}`;
        });
        return new Set(keys).size;
    }

    private note(
        question: string,
        answer: string,
        verdict: 'ok' | 'check' | 'info',
    ): void {
        this.findings.add(SECTION, question, answer, verdict);
    }

}
