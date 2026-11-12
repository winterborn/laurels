import { weekdayOf } from '../helpers/index.ts';
import type {
    EventFilterSpec,
    WatchEvent,
} from '../model/index.ts';
import type { UserHistory } from './UserHistory.ts';

// The calendar, title, rating, age and episode checks of a filter.
// Every set field must match. Unset fields match anything.
export class DetailFilter {

    private readonly history: UserHistory;
    // The first check that fails stops the rest.
    private readonly checks: Array<(event: WatchEvent, spec: EventFilterSpec) => boolean>;
    // Title words of each item, worked out once.
    private readonly words = new Map<string, string[]>();

    constructor(history: UserHistory) {
        this.history = history;
        this.checks = [
            (event, spec) => this.matchesSeason(event, spec),
            (event, spec) => this.matchesPause(event, spec),
            (event, spec) => this.matchesRating(event, spec),
            (event, spec) => this.matchesFinale(event, spec),
            (event, spec) => this.matchesTitleWords(event, spec),
            (event, spec) => this.matchesTitleLength(event, spec),
            (event, spec) => this.matchesWeekday(event, spec),
            (event, spec) => this.matchesDate(event, spec),
            (event, spec) => this.matchesReleaseDate(event, spec),
            (event, spec) => this.matchesAge(event, spec),
            (event, spec) => this.matchesMidnight(event, spec),
        ];
    }

    matches(event: WatchEvent, spec: EventFilterSpec): boolean {
        return this.checks.every((check) => check(event, spec));
    }

    private matchesWeekday(event: WatchEvent, spec: EventFilterSpec): boolean {
        if (!spec.weekdays) {
            return true;
        }
        const weekday = weekdayOf(this.history.localStart(event).day);
        return spec.weekdays.includes(weekday);
    }

    // "12-25" from "2026-12-25".
    private matchesDate(event: WatchEvent, spec: EventFilterSpec): boolean {
        if (!spec.dates) {
            return true;
        }
        const monthDay = this.history.localStart(event).day.slice(5);
        return spec.dates.includes(monthDay);
    }

    private matchesReleaseDate(event: WatchEvent, spec: EventFilterSpec): boolean {
        if (!spec.onReleaseDate) {
            return true;
        }
        const released = this.history.itemOf(event)?.releasedAt ?? '';
        const monthDay = this.history.localStart(event).day.slice(5);
        return released.length === 10 && released.slice(5) === monthDay;
    }

    private matchesTitleWords(event: WatchEvent, spec: EventFilterSpec): boolean {
        if (!spec.titleWords) {
            return true;
        }
        const words = new Set(this.wordsOf(event));
        return spec.titleWords.some((word) => words.has(word.toLowerCase()));
    }

    private matchesTitleLength(event: WatchEvent, spec: EventFilterSpec): boolean {
        const hasLimit = spec.titleWordsMin !== undefined || spec.titleWordsMax !== undefined;
        if (!hasLimit) {
            return true;
        }
        const count = this.wordsOf(event).length;
        const isLongEnough = spec.titleWordsMin === undefined || count >= spec.titleWordsMin;
        const isShortEnough = spec.titleWordsMax === undefined || count <= spec.titleWordsMax;
        return count > 0 && isLongEnough && isShortEnough;
    }

    // "gb/18" and "18" are the same rating.
    private matchesRating(event: WatchEvent, spec: EventFilterSpec): boolean {
        if (!spec.ratings) {
            return true;
        }
        const rating = this.history.itemOf(event)?.contentRating ?? '';
        const short = rating.split('/').pop()?.toLowerCase() ?? '';
        return spec.ratings.some((wanted) => wanted.toLowerCase() === short);
    }

    // Years from release to the watch. 0 is the same year.
    private matchesAge(event: WatchEvent, spec: EventFilterSpec): boolean {
        const hasLimit = spec.ageMin !== undefined || spec.ageMax !== undefined;
        if (!hasLimit) {
            return true;
        }
        const year = this.history.itemOf(event)?.year;
        if (year === undefined) {
            return false;
        }
        const age = Number(this.history.localStart(event).day.slice(0, 4)) - year;
        const isOldEnough = spec.ageMin === undefined || age >= spec.ageMin;
        const isNewEnough = spec.ageMax === undefined || age <= spec.ageMax;
        return isOldEnough && isNewEnough;
    }

    private matchesSeason(event: WatchEvent, spec: EventFilterSpec): boolean {
        if (spec.seasonMin === undefined) {
            return true;
        }
        const season = this.history.itemOf(event)?.seasonIndex ?? 0;
        return season >= spec.seasonMin;
    }

    // The episode number is the number of episodes in its season.
    private matchesFinale(event: WatchEvent, spec: EventFilterSpec): boolean {
        if (!spec.isFinale) {
            return true;
        }
        const index = this.history.itemOf(event)?.index;
        const size = this.history.item(event.seasonKey)?.leafCount;
        return index !== undefined && index === size;
    }

    private matchesMidnight(event: WatchEvent, spec: EventFilterSpec): boolean {
        if (!spec.crossesMidnight) {
            return true;
        }
        return this.history.localStart(event).day !== this.history.localEnd(event).day;
    }

    private matchesPause(event: WatchEvent, spec: EventFilterSpec): boolean {
        if (spec.pausedMin === undefined) {
            return true;
        }
        return (event.pausedSeconds ?? 0) >= spec.pausedMin;
    }

    // "The Man Who Knew Too Much" -> the, man, who, knew, too, much.
    private wordsOf(event: WatchEvent): string[] {
        const known = this.words.get(event.ratingKey);
        if (known) {
            return known;
        }
        const title = this.history.itemOf(event)?.title ?? '';
        const words = title
            .toLowerCase()
            .split(/[^\p{L}\p{N}']+/u)
            .filter(Boolean);
        this.words.set(event.ratingKey, words);
        return words;
    }

}
