import type { Findings, Verdict } from './Findings.ts';
import { HistoryReport } from './HistoryReport.ts';
import { ItemProbe } from './ItemProbe.ts';
import type { Presence } from './ItemProbe.ts';
import type { Output } from './Output.ts';
import type { PlexClient, PlexItem } from './PlexClient.ts';
import type { TautulliClient } from './TautulliClient.ts';
import { formatCounts, formatDate, formatShare } from './helpers/format.ts';
import { countBy, spread, unique } from './helpers/lists.ts';

const HISTORY_PATH = '/status/sessions/history/all';
const HISTORY_PAGE = 1000;
const IMAGE_WIDTH = 600;
const IMAGE_HEIGHT = 338;

export interface CollectorOptions {
    plex: PlexClient;
    tautulli: TautulliClient | null;
    output: Output;
    findings: Findings;
    sampleSize: number;
}

interface FetchedItems {
    found: PlexItem[];
    missing: string[];
}

interface ImageJob {
    name: string;
    path: string;
}

// Read-only: every call here is a GET.
export class Collector {

    private readonly plex: PlexClient;
    private readonly tautulli: TautulliClient | null;
    private readonly output: Output;
    private readonly findings: Findings;
    private readonly sampleSize: number;

    private readonly accountIds: string[] = [];
    private readonly devices = new Map<string, PlexItem>();
    private readonly history: PlexItem[] = [];
    private readonly movies: PlexItem[] = [];
    private readonly episodes: PlexItem[] = [];

    constructor(options: CollectorOptions) {
        this.plex = options.plex;
        this.tautulli = options.tautulli;
        this.output = options.output;
        this.findings = options.findings;
        this.sampleSize = options.sampleSize;
    }

    async run(): Promise<void> {
        // No server means nothing else can run, so this one may throw.
        await this.collectServer();
        await this.step('Accounts', () => this.collectAccounts());
        await this.step('Devices', () => this.collectDevices());
        await this.step('Libraries', () => this.collectLibraries());
        await this.step('History', () => this.collectHistory());
        await this.step('Film metadata', () => this.collectMovies());
        await this.step('Episode metadata', () => this.collectEpisodes());
        await this.step('Show metadata', () => this.collectShows());
        await this.step('Artwork', () => this.collectArtwork());
        await this.step('Live sessions', () => this.collectSessions());
        await this.step('Tautulli', () => this.collectTautulli());
    }

    private async step(name: string, work: () => Promise<void>): Promise<void> {
        console.log(`• ${name}`);
        try {
            await work();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.note(name, 'Step failed', message, 'fail');
        }
    }

    private async collectServer(): Promise<void> {
        console.log('• Server');
        const server = await this.plex.getJson('/');
        await this.output.json('server', server);
        const plexPass = server.myPlexSubscription ? 'yes' : 'no';
        this.note('Server', 'Plex version', server.version);
        this.note('Server', 'Platform', `${server.platform} ${server.platformVersion}`);
        this.note('Server', 'Plex Pass on owner account', plexPass);
        this.note('Server', 'Signed in to plex.tv', server.myPlexSigninState);
    }

    private async collectAccounts(): Promise<void> {
        const result = await this.plex.fetchJson('/accounts');
        if (!result.data) {
            const answer = `no (HTTP ${result.status}); use the server owner's token`;
            this.note('Accounts', 'Token can list accounts', answer, 'fail');
            return;
        }
        await this.output.json('accounts', result.data);
        const accounts: PlexItem[] = result.data.Account ?? [];
        const people = accounts.filter((account) => Number(account.id) > 0);
        for (const account of people) {
            this.accountIds.push(String(account.id));
        }
        this.note('Accounts', 'Token can list accounts', 'yes', 'ok');
        this.note('Accounts', 'Accounts on server (id > 0)', String(people.length));
    }

    private async collectDevices(): Promise<void> {
        const container = await this.plex.getJson('/devices');
        await this.output.json('devices', container);
        const devices: PlexItem[] = container.Device ?? [];
        for (const device of devices) {
            this.devices.set(String(device.id), device);
        }
        this.note('Devices', 'Devices known to server', String(devices.length));
    }

    private async collectLibraries(): Promise<void> {
        const container = await this.plex.getJson('/library/sections');
        const sections: PlexItem[] = container.Directory ?? [];
        const summaries: PlexItem[] = [];
        for (const section of sections) {
            summaries.push(await this.summariseSection(section));
        }
        await this.output.json('libraries', summaries);
    }

    private async summariseSection(section: PlexItem): Promise<PlexItem> {
        const key = String(section.key);
        const counts = await this.countSection(key, String(section.type));
        const collections = await this.countCollections(key);
        const label = `${section.title} (${section.type}, ${section.agent})`;
        const parts = Object.entries(counts).map(([name, value]) => {
            return `${value ?? '?'} ${name}`;
        });
        parts.push(`${collections} collections`);
        this.note('Libraries', label, parts.join(', '));
        return {
            key,
            type: section.type,
            agent: section.agent,
            scanner: section.scanner,
            language: section.language,
            counts,
            collections,
        };
    }

    private async countSection(
        key: string,
        type: string,
    ): Promise<Record<string, number | null>> {
        const path = `/library/sections/${key}/all`;
        switch (type) {
            case 'movie':
                return {
                    films: await this.plex.getTotal(path, { type: '1' }),
                };
            case 'show':
                return {
                    shows: await this.plex.getTotal(path, { type: '2' }),
                    seasons: await this.plex.getTotal(path, { type: '3' }),
                    episodes: await this.plex.getTotal(path, { type: '4' }),
                };
            default:
                return {};
        }
    }

    private async countCollections(key: string): Promise<number> {
        const path = `/library/sections/${key}/collections`;
        const result = await this.plex.fetchJson(path);
        const items: PlexItem[] = result.data?.Metadata ?? [];
        return items.length;
    }

    private async collectHistory(): Promise<void> {
        const params = {
            sort: 'viewedAt:desc',
        };
        const total = await this.plex.getTotal(HISTORY_PATH, params);
        const rows = await this.plex.getAllPages(HISTORY_PATH, params, HISTORY_PAGE);
        for (const row of rows) {
            this.history.push(row);
        }
        await this.output.json('history', rows);
        this.notePaging(total, rows.length);
        if (!rows.length) {
            this.note('History', 'Rows', 'none returned', 'fail');
            return;
        }
        const report = new HistoryReport({
            findings: this.findings,
            rows,
            accountIds: this.accountIds,
            devices: this.devices,
        });
        report.write();
        await this.output.json('history-by-hour', report.hourCounts());
    }

    private notePaging(total: number | null, fetched: number): void {
        const pages = Math.ceil(fetched / HISTORY_PAGE);
        const totalText = total === null ? 'not given' : String(total);
        const matches = total === null || total === fetched;
        const verdict = matches ? 'ok' : 'check';
        const answer = `${fetched} rows in ${pages} pages; server total ${totalText}`;
        this.note('History', 'Paging', answer, verdict);
    }

    private async collectMovies(): Promise<void> {
        const keys = this.sampleKeys('movie');
        const fetched = await this.fetchItems(keys);
        for (const item of fetched.found) {
            this.movies.push(item);
        }
        await this.output.json('metadata-films', fetched.found);
        this.noteRemoved('Film metadata', fetched, keys.length);
        this.noteCoverage('Film metadata', this.movies.map(ItemProbe.movie));
        this.noteRatings();
        this.noteLanguages();
    }

    private async collectEpisodes(): Promise<void> {
        const keys = this.sampleKeys('episode');
        const fetched = await this.fetchItems(keys);
        for (const item of fetched.found) {
            this.episodes.push(item);
        }
        await this.output.json('metadata-episodes', fetched.found);
        this.noteRemoved('Episode metadata', fetched, keys.length);
        this.noteCoverage('Episode metadata', this.episodes.map(ItemProbe.episode));
    }

    private async collectShows(): Promise<void> {
        const showKeys = unique(this.episodes
            .map((episode) => String(episode.grandparentRatingKey ?? ''))
            .filter((key) => key !== ''));
        const sampled = spread(showKeys, Math.ceil(this.sampleSize / 4));
        const shows = await this.fetchItems(sampled);
        await this.output.json('metadata-shows', shows.found);
        this.noteCoverage('Show metadata', shows.found.map(ItemProbe.show));
        const seasons = await this.fetchSeasons(shows.found.slice(0, 3));
        await this.output.json('metadata-seasons', seasons);
        this.noteCoverage('Season metadata', seasons.map(ItemProbe.season));
    }

    private async fetchSeasons(shows: PlexItem[]): Promise<PlexItem[]> {
        const seasons: PlexItem[] = [];
        for (const show of shows) {
            const path = `/library/metadata/${show.ratingKey}/children`;
            const container = await this.plex.getJson(path);
            const children: PlexItem[] = container.Metadata ?? [];
            seasons.push(...children);
        }
        return seasons;
    }

    private sampleKeys(type: string): string[] {
        const rows = this.history.filter((row) => row.type === type);
        const keys = unique(rows.map((row) => String(row.ratingKey)));
        return spread(keys, this.sampleSize);
    }

    private async fetchItems(keys: string[]): Promise<FetchedItems> {
        const found: PlexItem[] = [];
        const missing: string[] = [];
        for (const key of keys) {
            const item = await this.fetchItem(key);
            if (item) {
                found.push(item);
            } else {
                missing.push(key);
            }
        }
        return {
            found,
            missing,
        };
    }

    private async fetchItem(key: string): Promise<PlexItem | null> {
        const result = await this.plex.fetchJson(`/library/metadata/${key}`, {
            includeGuids: '1',
            includeMarkers: '1',
            includeChapters: '1',
        });
        const items: PlexItem[] = result.data?.Metadata ?? [];
        return items[0] ?? null;
    }

    private noteRemoved(section: string, fetched: FetchedItems, total: number): void {
        const missing = fetched.missing.length;
        const verdict = missing ? 'check' : 'ok';
        const answer = formatShare(missing, total);
        this.note(section, 'Watched items no longer in library', answer, verdict);
    }

    private noteCoverage(section: string, records: Presence[]): void {
        if (!records.length) {
            this.note(section, 'Items sampled', 'none', 'check');
            return;
        }
        this.note(section, 'Items sampled', String(records.length));
        for (const row of ItemProbe.coverage(records)) {
            const verdict = row.percent >= 90 ? 'ok' : 'check';
            const answer = formatShare(row.present, row.total);
            this.note(section, row.field, answer, verdict);
        }
    }

    private noteRatings(): void {
        const critics = countBy(this.movies, (movie) => {
            return String(movie.ratingImage ?? 'none');
        });
        const audiences = countBy(this.movies, (movie) => {
            return String(movie.audienceRatingImage ?? 'none');
        });
        this.note('Film metadata', 'Critic rating source', formatCounts(critics));
        this.note('Film metadata', 'Audience rating source', formatCounts(audiences));
    }

    private noteLanguages(): void {
        const languages = countBy(this.movies, (movie) => {
            return ItemProbe.audioLanguage(movie) || 'unknown';
        });
        this.note('Film metadata', 'First audio language', formatCounts(languages));
    }

    private async collectArtwork(): Promise<void> {
        const jobs = this.imageJobs();
        const results: PlexItem[] = [];
        for (const job of jobs) {
            results.push(await this.saveImage(job));
        }
        await this.output.json('artwork', results);
        this.noteImages('Film backdrop (art)', results, 'film-art');
        this.noteImages('Episode frame (thumb)', results, 'episode-frame');
        this.noteImages('Film chapter frame', results, 'chapter-frame');
    }

    private imageJobs(): ImageJob[] {
        const filmArt = this.movies
            .filter((movie) => movie.art)
            .slice(0, 3)
            .map((movie, index) => this.imageJob('film-art', index, movie.art));
        const episodeFrames = this.episodes
            .filter((episode) => episode.thumb)
            .slice(0, 3)
            .map((episode, index) => this.imageJob('episode-frame', index, episode.thumb));
        const chapterFrames = this.movies
            .map((movie) => ItemProbe.chapterThumb(movie))
            .filter((path) => path !== '')
            .slice(0, 2)
            .map((path, index) => this.imageJob('chapter-frame', index, path));
        return [...filmArt, ...episodeFrames, ...chapterFrames];
    }

    private imageJob(prefix: string, index: number, path: string): ImageJob {
        return {
            name: `${prefix}-${index + 1}`,
            path: String(path),
        };
    }

    private async saveImage(job: ImageJob): Promise<PlexItem> {
        const image = await this.plex.getImage(job.path, IMAGE_WIDTH, IMAGE_HEIGHT);
        if (image.ok) {
            await this.output.image(`${job.name}.jpg`, image.bytes);
        }
        return {
            name: job.name,
            status: image.status,
            contentType: image.contentType,
            bytes: image.bytes.length,
        };
    }

    private noteImages(label: string, results: PlexItem[], prefix: string): void {
        const tried = results.filter((result) => result.name.startsWith(prefix));
        const saved = tried.filter((result) => result.status === 200);
        if (!tried.length) {
            this.note('Artwork', label, 'none to try', 'check');
            return;
        }
        const allSaved = saved.length === tried.length;
        const answer = formatShare(saved.length, tried.length);
        this.note('Artwork', label, answer, allSaved ? 'ok' : 'check');
    }

    private async collectSessions(): Promise<void> {
        const container = await this.plex.getJson('/status/sessions');
        await this.output.json('sessions-now', container);
        const sessions: PlexItem[] = container.Metadata ?? [];
        if (!sessions.length) {
            const answer = 'nothing playing; listen mode covers this';
            this.note('Live sessions', 'Playing right now', answer);
            return;
        }
        this.noteCoverage('Live sessions', sessions.map(ItemProbe.session));
    }

    private async collectTautulli(): Promise<void> {
        if (!this.tautulli) {
            const answer = 'not configured (set TAUTULLI_URL and TAUTULLI_KEY)';
            this.note('Tautulli', 'Configured', answer);
            return;
        }
        const info = await this.tautulli.call('get_tautulli_info');
        const oldest = await this.tautulli.call('get_history', {
            length: '1',
            order_column: 'date',
            order_dir: 'asc',
        });
        const newest = await this.tautulli.call('get_history', {
            length: '5',
            order_column: 'date',
            order_dir: 'desc',
        });
        await this.output.json('tautulli', {
            info,
            oldest,
            newest,
        });
        this.noteTautulli(info, oldest, newest);
    }

    private noteTautulli(info: PlexItem, oldest: PlexItem, newest: PlexItem): void {
        const first: PlexItem = oldest.data?.[0] ?? {};
        const sample: PlexItem = newest.data?.[0] ?? {};
        const wanted = [
            'started',
            'stopped',
            'paused_counter',
            'play_duration',
            'percent_complete',
            'watched_status',
            'platform',
            'reference_id',
        ];
        const missing = wanted.filter((field) => !(field in sample));
        const fieldsText = missing.length ? `missing: ${missing.join(', ')}` : 'all present';
        const fieldsVerdict = missing.length ? 'check' : 'ok';
        this.note('Tautulli', 'Version', info.tautulli_version);
        this.note('Tautulli', 'History rows', String(oldest.recordsTotal));
        this.note('Tautulli', 'Oldest session', formatDate(Number(first.started ?? first.date)));
        this.note('Tautulli', 'Session fields', fieldsText, fieldsVerdict);
    }

    private note(
        section: string,
        question: string,
        answer: unknown,
        verdict: Verdict = 'info',
    ): void {
        const text = answer === undefined ? 'missing' : String(answer);
        this.findings.add(section, question, text, verdict);
    }

}
