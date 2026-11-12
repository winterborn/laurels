import type { Findings, Verdict } from './Findings.ts';
import type { Output } from './Output.ts';
import type { PlexClient, PlexItem } from './PlexClient.ts';
import { formatTime } from './helpers/format.ts';

const SECTION = 'Mark as watched';
const DAY_SECONDS = 24 * 60 * 60;

export interface MarkCheckOptions {
    plex: PlexClient;
    output: Output;
    findings: Findings;
    ratingKey: string;
}

// Does "Mark as watched" in Plex create a history row?
// Run once before marking and once after (see SPIKE.md).
export class MarkCheck {

    private readonly plex: PlexClient;
    private readonly output: Output;
    private readonly findings: Findings;
    private readonly ratingKey: string;

    constructor(options: MarkCheckOptions) {
        this.plex = options.plex;
        this.output = options.output;
        this.findings = options.findings;
        this.ratingKey = options.ratingKey;
    }

    async run(): Promise<void> {
        if (!this.ratingKey) {
            throw new Error('Usage: mark-check <ratingKey> (see SPIKE.md)');
        }
        const item = await this.fetchItem();
        const rows = await this.fetchHistory();
        await this.output.json('mark-check', {
            item,
            rows,
        });
        this.noteItem(item);
        this.noteHistory(rows);
    }

    private async fetchItem(): Promise<PlexItem> {
        const container = await this.plex.getJson(`/library/metadata/${this.ratingKey}`);
        const items: PlexItem[] = container.Metadata ?? [];
        if (!items[0]) {
            throw new Error(`No item with ratingKey ${this.ratingKey}`);
        }
        return items[0];
    }

    // Filters on our side too, in case Plex ignores metadataItemID.
    private async fetchHistory(): Promise<PlexItem[]> {
        const rows = await this.plex.getPage('/status/sessions/history/all', {
            metadataItemID: this.ratingKey,
            sort: 'viewedAt:desc',
        }, 0, 1000);
        return rows.filter((row) => String(row.ratingKey) === this.ratingKey);
    }

    private noteItem(item: PlexItem): void {
        this.note('Item type', String(item.type), 'info');
        this.note('viewCount on item', String(item.viewCount ?? 0), 'info');
        this.note('lastViewedAt on item', formatTime(Number(item.lastViewedAt)), 'info');
    }

    private noteHistory(rows: PlexItem[]): void {
        const now = Date.now() / 1000;
        const recent = rows.filter((row) => now - Number(row.viewedAt) < DAY_SECONDS);
        const newest = rows[0];
        this.note('History rows for item', String(rows.length), 'info');
        this.note('Newest history row', formatTime(Number(newest?.viewedAt)), 'info');
        if (recent.length) {
            const answer = 'yes: a row appeared in the last 24 hours';
            this.note('Marking writes history', answer, 'check');
        } else {
            const answer = 'no row in the last 24 hours';
            this.note('Marking writes history', answer, 'info');
        }
    }

    private note(question: string, answer: string, verdict: Verdict): void {
        this.findings.add(SECTION, question, answer, verdict);
    }

}
