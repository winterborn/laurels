import type {
    EventFilterSpec,
    WatchEvent,
} from '../model/index.ts';
import { DetailFilter } from './DetailFilter.ts';
import type { UserHistory } from './UserHistory.ts';

// Every set field must match. Unset fields match anything.
export class EventFilter {

    private readonly history: UserHistory;
    private readonly details: DetailFilter;
    // Cheap checks first. The first check that fails stops the rest.
    private readonly checks: Array<(event: WatchEvent, spec: EventFilterSpec) => boolean>;

    constructor(history: UserHistory) {
        this.history = history;
        this.details = new DetailFilter(history);
        this.checks = [
            (event, spec) => this.matchesKind(event, spec),
            (event, spec) => this.matchesEpisode(event, spec),
            (event, spec) => this.matchesGenre(event, spec),
            (event, spec) => this.matchesYear(event, spec),
            (event, spec) => this.matchesDuration(event, spec),
            (event, spec) => this.matchesHour(event, spec),
            (event, spec) => this.details.matches(event, spec),
        ];
    }

    matches(event: WatchEvent, spec: EventFilterSpec): boolean {
        return this.checks.every((check) => check(event, spec));
    }

    private matchesKind(event: WatchEvent, spec: EventFilterSpec): boolean {
        if (!spec.kind) {
            return true;
        }
        return event.kind === spec.kind;
    }

    private matchesGenre(event: WatchEvent, spec: EventFilterSpec): boolean {
        if (!spec.genre) {
            return true;
        }
        const wanted = spec.genre.toLowerCase();
        const genres = this.history.genresOf(event);
        return genres.some((genre) => genre.toLowerCase() === wanted);
    }

    private matchesYear(event: WatchEvent, spec: EventFilterSpec): boolean {
        const year = this.history.itemOf(event)?.year;
        const hasLimit = spec.yearBefore !== undefined || spec.yearAfter !== undefined;
        if (!hasLimit) {
            return true;
        }
        if (year === undefined) {
            return false;
        }
        const isAfterStart = spec.yearAfter === undefined || year > spec.yearAfter;
        const isBeforeEnd = spec.yearBefore === undefined || year < spec.yearBefore;
        return isAfterStart && isBeforeEnd;
    }

    // Limits are in minutes.
    private matchesDuration(event: WatchEvent, spec: EventFilterSpec): boolean {
        const hasLimit = spec.durationMin !== undefined || spec.durationMax !== undefined;
        if (!hasLimit) {
            return true;
        }
        const minutes = this.history.runtimeOf(event) / 60;
        if (!minutes) {
            return false;
        }
        const isLongEnough = spec.durationMin === undefined || minutes >= spec.durationMin;
        const isShortEnough = spec.durationMax === undefined || minutes < spec.durationMax;
        return isLongEnough && isShortEnough;
    }

    // hourFrom 22, hourTo 2 means 22:00 to 01:59.
    private matchesHour(event: WatchEvent, spec: EventFilterSpec): boolean {
        const hasLimit = spec.hourFrom !== undefined || spec.hourTo !== undefined;
        if (!hasLimit) {
            return true;
        }
        const hour = this.history.localStart(event).hour;
        const from = spec.hourFrom ?? 0;
        const to = spec.hourTo ?? 24;
        if (from <= to) {
            return hour >= from && hour < to;
        }
        return hour >= from || hour < to;
    }

    private matchesEpisode(event: WatchEvent, spec: EventFilterSpec): boolean {
        if (spec.episodeIndex === undefined) {
            return true;
        }
        const index = this.history.itemOf(event)?.index;
        return index === spec.episodeIndex;
    }

}
