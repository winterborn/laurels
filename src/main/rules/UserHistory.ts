import {
    type LocalParts,
    localParts,
    weekdayOf,
} from '../helpers/index.ts';
import type {
    EventFilterSpec,
    GroupKey,
    Item,
    WatchEvent,
} from '../model/index.ts';
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
    // The local start of each watch, worked out once.
    private readonly starts = new Map<string, LocalParts>();
    // The same history from a later time, kept for the awards of each pack.
    private readonly later = new Map<number, UserHistory>();

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

    // The same person, with only the watches from this time on. Pack awards read it.
    since(time: number): UserHistory {
        const kept = this.later.get(time);
        if (kept) {
            return kept;
        }
        const isLater = (event: WatchEvent) => event.watchedAt >= time;
        const history = new UserHistory(
            this.userId,
            this.events.filter(isLater),
            this.items,
            this.timeZone,
            this.partialPlays.filter(isLater),
        );
        this.later.set(time, history);
        return history;
    }

    matches(event: WatchEvent, spec: EventFilterSpec): boolean {
        return this.filter.matches(event, spec);
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
        const known = this.starts.get(event.id);
        if (known) {
            return known;
        }
        const parts = localParts(this.startOf(event), this.timeZone);
        this.starts.set(event.id, parts);
        return parts;
    }

    localEnd(event: WatchEvent): LocalParts {
        return localParts(event.watchedAt, this.timeZone);
    }

    // Shows give their genres, countries and year to their episodes.
    showOrItem(event: WatchEvent): Item | undefined {
        return this.item(event.showKey) ?? this.itemOf(event);
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
            case 'season':
                return event.seasonKey ? [event.seasonKey] : [];
            case 'director':
                return item?.directors ?? [];
            case 'actor':
                return item?.actors ?? [];
            case 'studio':
                return item?.studio ? [item.studio] : [];
            case 'collection':
                return item?.collections ?? [];
            case 'genre':
                return this.genresOf(event);
            case 'country':
                return this.showOrItem(event)?.countries ?? [];
            default:
                return this.valuesOf(event, key);
        }
    }

    // Keys with one value or none.
    private valuesOf(event: WatchEvent, key: GroupKey): string[] {
        const value = this.valueOf(event, key);
        return value ? [value] : [];
    }

    private valueOf(event: WatchEvent, key: GroupKey): string | undefined {
        switch (key) {
            case 'decade':
                return this.decadeOf(event);
            case 'letter':
                return this.letterOf(event);
            case 'hour':
                return String(this.localStart(event).hour);
            case 'weekday':
                return String(weekdayOf(this.localStart(event).day));
            case 'platform':
                return event.platform;
            case 'rating':
                return this.itemOf(event)?.contentRating;
            default:
                return undefined;
        }
    }

    // "1990s" from the release year of the film, or of the show.
    private decadeOf(event: WatchEvent): string | undefined {
        const year = this.showOrItem(event)?.year;
        return year ? `${Math.floor(year / 10) * 10}s` : undefined;
    }

    // The first letter of the title, A to Z. A title that starts with a digit has none.
    private letterOf(event: WatchEvent): string | undefined {
        const title = this.itemOf(event)?.title ?? '';
        const first = title.trim().charAt(0).toUpperCase();
        return /[A-Z]/.test(first) ? first : undefined;
    }

}
