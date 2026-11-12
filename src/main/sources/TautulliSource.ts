import type { Play } from '../model/index.ts';
import type { Store } from '../store/index.ts';
import { PlayLinker } from './PlayLinker.ts';
import type { PlayReport } from './PlayLinker.ts';
import type {
    TautulliClient,
    TautulliJson,
} from './TautulliClient.ts';

const PAGE = 1000;
const CURSOR = 'tautulli.started';
const DAY_SECONDS = 86_400;
// The Plex account id of the server owner. Tautulli uses the plex.tv id.
const OWNER_ACCOUNT_ID = '1';
const PLAY_PREFIX = 'tautulli:';

// Reads Tautulli history the way Tautulli reads it:
// - A play is one grouped history row (one reference_id). Tautulli does not
//   keep plays under its ignore interval (120 s by default).
// - A play is watched when Tautulli says watched_status = 1: watched to its
//   watched percent (85% by default) or to its credits marker.
// - Time on screen is play_duration: SUM(stopped - started) - SUM(paused_counter).
//   Every play adds its time, watched or not.
// - Laurels does not read live TV, or plays that are still running.
// PlayLinker then joins the plays to Plex watches.
export class TautulliSource {

    private readonly client: TautulliClient;
    private readonly store: Store;

    constructor(client: TautulliClient, store: Store) {
        this.client = client;
        this.store = store;
    }

    async sync(): Promise<PlayReport> {
        const userIds = await this.userIds();
        const plays = await this.readPlays(userIds);
        const changed = this.store.savePlays(plays);
        const changedIds = new Set(changed.map((play) => play.id));
        return {
            newPlays: changed.length,
            changedWatches: new PlayLinker(this.store).apply(changedIds),
        };
    }

    // Tautulli user id -> Plex account id.
    private async userIds(): Promise<Map<string, string>> {
        const users = await this.client.users();
        const pairs = users.map((user) => {
            const isOwner = Number(user.is_admin) === 1;
            return [String(user.user_id), isOwner ? OWNER_ACCOUNT_ID : String(user.user_id)];
        });
        return new Map(pairs as Array<[string, string]>);
    }

    // Reads from 2 days before the newest saved play, so resumed plays update.
    private async readPlays(userIds: Map<string, string>): Promise<Play[]> {
        const cursor = Number(this.store.getState(CURSOR) ?? '0');
        const after = this.dateOf(Math.max(0, cursor - 2 * DAY_SECONDS));
        const rows = await this.allRows(after);
        const plays = rows
            .map((row) => this.playFrom(row, userIds))
            .filter((play) => play !== null);
        const newest = plays.reduce((most, play) => Math.max(most, play.started), cursor);
        this.store.setState(CURSOR, String(newest));
        return plays;
    }

    private async allRows(after: string): Promise<TautulliJson[]> {
        const rows: TautulliJson[] = [];
        while (true) {
            const page = await this.client.history(after, rows.length, PAGE);
            rows.push(...page.rows);
            const isLastPage = page.rows.length < PAGE || rows.length >= page.total;
            if (isLastPage) {
                return rows;
            }
        }
    }

    // Films and episodes only. No live TV, and no play that is still running.
    private playFrom(row: TautulliJson, userIds: Map<string, string>): Play | null {
        const kind = row.media_type;
        const isVideo = kind === 'movie' || kind === 'episode';
        const isLive = Number(row.live) === 1;
        const isRunning = Boolean(row.state);
        const id = row.reference_id ?? row.row_id;
        const canUse = isVideo && !isLive && !isRunning && Boolean(row.stopped);
        if (!canUse || !id || !row.rating_key) {
            return null;
        }
        return {
            id: `${PLAY_PREFIX}${id}`,
            userId: userIds.get(String(row.user_id)) ?? String(row.user_id),
            ratingKey: String(row.rating_key),
            kind,
            title: String(row.title ?? ''),
            showKey: this.keyOrUndefined(row.grandparent_rating_key),
            seasonKey: this.keyOrUndefined(row.parent_rating_key),
            showTitle: row.grandparent_title || undefined,
            year: this.numberOrUndefined(row.year),
            index: this.numberOrUndefined(row.media_index),
            seasonIndex: this.numberOrUndefined(row.parent_media_index),
            thumb: row.thumb || undefined,
            started: Number(row.started),
            stopped: Number(row.stopped),
            playSeconds: Math.max(0, Number(row.play_duration ?? 0)),
            pausedSeconds: Math.max(0, Number(row.paused_counter ?? 0)),
            platform: row.platform || undefined,
            watched: Number(row.watched_status) === 1,
        };
    }

    private keyOrUndefined(value: unknown): string | undefined {
        return value ? String(value) : undefined;
    }

    private numberOrUndefined(value: unknown): number | undefined {
        const isEmpty = value === null || value === undefined || value === '';
        const number = Number(value);
        if (isEmpty || Number.isNaN(number)) {
            return undefined;
        }
        return number;
    }

    // "YYYY-MM-DD" in UTC. Tautulli reads it as a date on its own clock,
    // so the 2-day margin covers the time zone.
    private dateOf(epochSeconds: number): string {
        return new Date(epochSeconds * 1000).toISOString().slice(0, 10);
    }

}
