import type {
    Item,
    Play,
    WatchEvent,
} from '../model/index.ts';
import type { Store } from '../store/index.ts';
import type {
    TautulliClient,
    TautulliJson,
} from './TautulliClient.ts';

export interface TautulliReport {
    newPlays: number;
    changedWatches: number;
}

const PAGE = 1000;
const CURSOR = 'tautulli.started';
const DAY_SECONDS = 86_400;
// Plex marks a watch as played near the end of a play, so viewedAt falls
// inside the play. These margins allow for clocks and late scrobbles.
const BEFORE_START = 60;
const AFTER_STOP = 30 * 60;
// The Plex account id of the server owner. Tautulli uses the plex.tv id.
const OWNER_ACCOUNT_ID = '1';
const EVENT_PREFIX = 'tautulli:';
const EMPTY_TAGS = {
    genres: [],
    directors: [],
    actors: [],
    countries: [],
    collections: [],
};

// Reads Tautulli history the way Tautulli reads it, and makes Laurels agree:
// - A play is one grouped history row (one reference_id). Tautulli does not
//   keep plays under its ignore interval (120 s by default).
// - A play is watched when Tautulli says watched_status = 1: watched to its
//   watched percent (85% by default) or to its credits marker.
// - Time on screen is play_duration: SUM(stopped - started) - SUM(paused_counter).
//   Every play adds its time, watched or not.
// A Plex watch inside a play takes the times of that play.
// A watched play with no Plex watch becomes a watch of its own.
// A play that is not watched adds time on screen only.
// Plex watches from before Tautulli keep the times that Laurels calculates.
export class TautulliSource {

    private readonly client: TautulliClient;
    private readonly store: Store;

    constructor(client: TautulliClient, store: Store) {
        this.client = client;
        this.store = store;
    }

    async sync(): Promise<TautulliReport> {
        const userIds = await this.userIds();
        const plays = await this.readPlays(userIds);
        const changed = this.store.savePlays(plays);
        const saved = this.store.plays();
        const linked = this.linkPlexWatches(saved);
        const written = this.writePlayEvents(saved, new Set(changed.map((play) => play.id)));
        return {
            newPlays: changed.length,
            changedWatches: linked + written,
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
            id: String(id),
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

    // Gives each Plex watch inside Tautulli's time the play around it.
    // If that play already became a watch of its own, the Plex watch replaces it.
    private linkPlexWatches(plays: Play[]): number {
        const firstStart = plays.reduce((first, play) => Math.min(first, play.started), Infinity);
        const untimed = this.store.events().filter((event) => {
            const isPlex = event.source === 'plex' && event.startedAt === undefined;
            return isPlex && event.watchedAt >= firstStart - BEFORE_START;
        });
        if (!untimed.length) {
            return 0;
        }
        const open = plays.filter((play) => !play.eventId || this.isPlayEvent(play.eventId));
        const index = this.playsByKey(open);
        const used = new Set<string>();
        const matches = untimed
            .map((event) => ({
                event,
                play: this.playFor(event, index, used),
            }))
            .filter((match) => match.play !== undefined);
        this.store.transaction(() => {
            for (const match of matches) {
                this.link(match.event, match.play as Play);
            }
        });
        return matches.length;
    }

    private link(event: WatchEvent, play: Play): void {
        this.store.saveTiming(event.id, play);
        if (play.eventId) {
            this.store.deleteEvent(play.eventId);
        }
        this.store.linkPlay(play.id, event.id);
        play.eventId = event.id;
    }

    // Plays with no Plex watch become watches (or partial plays) of their own.
    // A play that changed since the last read updates its watch.
    private writePlayEvents(saved: Play[], changedIds: Set<string>): number {
        const plays = saved.filter((play) => {
            const isOwnEvent = play.eventId !== undefined && this.isPlayEvent(play.eventId);
            return !play.eventId || (isOwnEvent && changedIds.has(play.id));
        });
        this.store.transaction(() => {
            for (const play of plays) {
                this.saveItems(play);
            }
            this.store.replaceEvents(plays.map((play) => this.eventFrom(play)));
            for (const play of plays) {
                this.store.linkPlay(play.id, `${EVENT_PREFIX}${play.id}`);
            }
        });
        return plays.length;
    }

    private eventFrom(play: Play): WatchEvent {
        return {
            id: `${EVENT_PREFIX}${play.id}`,
            userId: play.userId,
            ratingKey: play.ratingKey,
            kind: play.kind,
            showKey: play.showKey,
            seasonKey: play.seasonKey,
            watchedAt: play.stopped,
            startedAt: play.started,
            playSeconds: play.playSeconds,
            pausedSeconds: play.pausedSeconds,
            platform: play.platform,
            source: 'tautulli',
            partial: !play.watched,
        };
    }

    // Stubs from the play, so the watch has a title before Plex metadata arrives.
    // Plex fills them in, or marks them as removed.
    private saveItems(play: Play): void {
        const stubs = [
            this.itemStub(play),
            this.showStub(play),
            this.seasonStub(play),
        ];
        for (const stub of stubs) {
            const isNew = stub !== null && !this.store.item(stub.ratingKey);
            if (isNew) {
                this.store.saveItem(stub);
            }
        }
    }

    private itemStub(play: Play): Item {
        return {
            ...EMPTY_TAGS,
            ratingKey: play.ratingKey,
            kind: play.kind,
            title: play.title || 'Unknown title',
            year: play.year,
            index: play.index,
            seasonIndex: play.seasonIndex,
            showKey: play.showKey,
            seasonKey: play.seasonKey,
            thumb: play.thumb,
            stub: true,
        };
    }

    private showStub(play: Play): Item | null {
        if (!play.showKey) {
            return null;
        }
        return {
            ...EMPTY_TAGS,
            ratingKey: play.showKey,
            kind: 'show',
            title: play.showTitle ?? 'Unknown show',
            stub: true,
        };
    }

    private seasonStub(play: Play): Item | null {
        if (!play.seasonKey) {
            return null;
        }
        return {
            ...EMPTY_TAGS,
            ratingKey: play.seasonKey,
            kind: 'season',
            title: `Season ${play.seasonIndex ?? ''}`.trim(),
            index: play.seasonIndex,
            showKey: play.showKey,
            stub: true,
        };
    }

    // Plays by person and item, and by person, kind and title for removed items.
    private playsByKey(plays: Play[]): Map<string, Play[]> {
        const byKey = new Map<string, Play[]>();
        for (const play of plays) {
            const keys = [
                this.itemKey(play.userId, play.ratingKey),
                this.titleKey(play.userId, play.kind, play.title),
            ];
            for (const key of keys) {
                const list = byKey.get(key) ?? [];
                list.push(play);
                byKey.set(key, list);
            }
        }
        return byKey;
    }

    // The unused play nearest to the watch, if the watch falls inside it.
    private playFor(event: WatchEvent, plays: Map<string, Play[]>, used: Set<string>): Play | undefined {
        const candidates = plays.get(this.keyOf(event)) ?? [];
        const fitting = candidates
            .filter((play) => !used.has(play.id))
            .filter((play) => this.fits(event, play))
            .sort((a, b) => this.gapOf(event, a) - this.gapOf(event, b));
        const best = fitting[0];
        if (best) {
            used.add(best.id);
        }
        return best;
    }

    // A removed item has no Plex key, so its title finds the play.
    private keyOf(event: WatchEvent): string {
        if (!event.ratingKey.startsWith('gone:')) {
            return this.itemKey(event.userId, event.ratingKey);
        }
        const title = this.store.item(event.ratingKey)?.title ?? '';
        return this.titleKey(event.userId, event.kind, title);
    }

    private fits(event: WatchEvent, play: Play): boolean {
        const isAfterStart = event.watchedAt >= play.started - BEFORE_START;
        const isBeforeStop = event.watchedAt <= play.stopped + AFTER_STOP;
        return isAfterStart && isBeforeStop;
    }

    private gapOf(event: WatchEvent, play: Play): number {
        return Math.abs(play.stopped - event.watchedAt);
    }

    private isPlayEvent(eventId: string): boolean {
        return eventId.startsWith(EVENT_PREFIX);
    }

    private itemKey(userId: string, ratingKey: string): string {
        return `item|${userId}|${ratingKey}`;
    }

    private titleKey(userId: string, kind: string, title: string): string {
        return `title|${userId}|${kind}|${title.toLowerCase()}`;
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
