import type {
    EventFilterSpec,
    GroupKey,
    Item,
    WatchEvent,
} from '../model/index.ts';
import { localParts } from '../helpers/index.ts';
import type { LocalParts } from '../helpers/index.ts';
import { EventFilter } from './EventFilter.ts';

// One user's watches, oldest first, with the item cache beside them.
// Partial plays (from Tautulli) are not watches. They count for time on screen only.
export class UserHistory {

    readonly userId: string;
    readonly events: WatchEvent[];
    readonly partialPlays: WatchEvent[];
    private readonly items: Map<string, Item>;
    private readonly timeZone: string;
    private readonly filter: EventFilter;
    // Many rules use the same filter, so each result is kept. Callers must not change it.
    private readonly selected = new Map<string, WatchEvent[]>();

    constructor(
        userId: string,
        events: WatchEvent[],
        items: Map<string, Item>,
        timeZone: string,
        partialPlays: WatchEvent[] = [],
    ) {
        this.userId = userId;
        this.events = [...events].sort((a, b) => a.watchedAt - b.watchedAt);
        this.partialPlays = [...partialPlays].sort((a, b) => a.watchedAt - b.watchedAt);
        this.items = items;
        this.timeZone = timeZone;
        this.filter = new EventFilter(this);
    }

    select(spec: EventFilterSpec = {}): WatchEvent[] {
        const key = JSON.stringify(spec);
        const kept = this.selected.get(key);
        if (kept) {
            return kept;
        }
        const events = this.events.filter((event) => this.filter.matches(event, spec));
        this.selected.set(key, events);
        return events;
    }

    // Watches and partial plays, oldest first: everything that adds time on screen.
    selectTime(spec: EventFilterSpec = {}): WatchEvent[] {
        const partial = this.partialPlays.filter((event) => this.filter.matches(event, spec));
        if (!partial.length) {
            return this.select(spec);
        }
        return [...this.select(spec), ...partial].sort((a, b) => a.watchedAt - b.watchedAt);
    }

    item(ratingKey: string | undefined): Item | undefined {
        if (!ratingKey) {
            return undefined;
        }
        return this.items.get(ratingKey);
    }

    itemOf(event: WatchEvent): Item | undefined {
        return this.item(event.ratingKey);
    }

    // Plex history has no start time: end time minus running time.
    startOf(event: WatchEvent): number {
        if (event.startedAt) {
            return event.startedAt;
        }
        return event.watchedAt - this.runtimeOf(event);
    }

    localStart(event: WatchEvent): LocalParts {
        return localParts(this.startOf(event), this.timeZone);
    }

    // Seconds watched: real play time when known, else running time.
    secondsOf(event: WatchEvent): number {
        if (event.playSeconds !== undefined) {
            return event.playSeconds;
        }
        return this.runtimeOf(event);
    }

    runtimeOf(event: WatchEvent): number {
        const durationMs = this.itemOf(event)?.durationMs ?? 0;
        return Math.round(durationMs / 1000);
    }

    // Episodes take genres from their show.
    genresOf(event: WatchEvent): string[] {
        const own = this.itemOf(event)?.genres ?? [];
        if (own.length) {
            return own;
        }
        return this.item(event.showKey)?.genres ?? [];
    }

    // Shows use the show poster, films their own.
    posterKeyOf(event: WatchEvent): string {
        return event.showKey ?? event.ratingKey;
    }

    titleOf(event: WatchEvent): string {
        const show = this.item(event.showKey);
        if (show) {
            return show.title;
        }
        return this.itemOf(event)?.title ?? 'Unknown title';
    }

    groupsOf(event: WatchEvent, key: GroupKey): string[] {
        const item = this.itemOf(event);
        switch (key) {
            case 'item':
                return [event.ratingKey];
            case 'show':
                return [event.showKey ?? event.ratingKey];
            case 'director':
                return item?.directors ?? [];
            case 'actor':
                return item?.actors ?? [];
            case 'studio':
                return item?.studio ? [item.studio] : [];
        }
    }

}
