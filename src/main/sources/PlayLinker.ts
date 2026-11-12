import type {
    Item,
    Play,
    WatchEvent,
    WatchSource,
} from '../model/index.ts';
import type { Store } from '../store/index.ts';

export interface PlayReport {
    newPlays: number;
    changedWatches: number;
}

// Plex marks a watch as played near the end of a play, so viewedAt falls
// inside the play. These margins allow for clocks and late scrobbles.
const BEFORE_START = 60;
const AFTER_STOP = 30 * 60;
const EMPTY_TAGS = {
    genres: [],
    directors: [],
    actors: [],
    countries: [],
    collections: [],
};

// Joins plays (from Tautulli or from the session recorder) to Plex watches:
// - A Plex watch inside a play takes the start, time on screen and device of that play.
// - A watched play with no Plex watch becomes a watch of its own.
// - A play that is not watched adds time on screen only (a partial play).
// - Plex watches from before the first play keep the times that Laurels calculates.
// A play id carries its source, for example "tautulli:123" or "recorder:45".
// The watch made from a play has the id of the play.
export class PlayLinker {

    private readonly store: Store;

    constructor(store: Store) {
        this.store = store;
    }

    // Returns how many watches changed.
    apply(changedIds: Set<string>): number {
        const saved = this.store.plays();
        if (!saved.length) {
            return 0;
        }
        const linked = this.linkPlexWatches(saved);
        const written = this.writePlayEvents(saved, changedIds);
        return linked + written;
    }

    // Gives each Plex watch inside the time of the plays the play around it.
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
        const open = plays.filter((play) => !play.eventId || this.hasOwnEvent(play));
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
            const isChangedOwn = this.hasOwnEvent(play) && changedIds.has(play.id);
            return !play.eventId || isChangedOwn;
        });
        this.store.transaction(() => {
            for (const play of plays) {
                this.saveItems(play);
            }
            this.store.replaceEvents(plays.map((play) => this.eventFrom(play)));
            for (const play of plays) {
                this.store.linkPlay(play.id, play.id);
            }
        });
        return plays.length;
    }

    private eventFrom(play: Play): WatchEvent {
        return {
            id: play.id,
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
            source: this.sourceOf(play),
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

    // The watch made from this play has the id of the play.
    private hasOwnEvent(play: Play): boolean {
        return play.eventId === play.id;
    }

    // "tautulli:123" -> tautulli, "recorder:45" -> recorder.
    private sourceOf(play: Play): WatchSource {
        return play.id.startsWith('recorder:') ? 'recorder' : 'tautulli';
    }

    private itemKey(userId: string, ratingKey: string): string {
        return `item|${userId}|${ratingKey}`;
    }

    private titleKey(userId: string, kind: string, title: string): string {
        return `title|${userId}|${kind}|${title.toLowerCase()}`;
    }

}
