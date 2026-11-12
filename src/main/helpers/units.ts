import type {
    EventFilterSpec,
    Rule,
} from '../model/index.ts';

export interface Unit {
    one: string;
    many: string;
}

const UNITS: Record<string, Unit> = {
    days: {
        one: 'day',
        many: 'days',
    },
    episodes: {
        one: 'episode',
        many: 'episodes',
    },
    films: {
        one: 'film',
        many: 'films',
    },
    hours: {
        one: 'hour',
        many: 'hours',
    },
    seasons: {
        one: 'season',
        many: 'seasons',
    },
    shows: {
        one: 'show',
        many: 'shows',
    },
    watches: {
        one: 'watch',
        many: 'watches',
    },
};

// What the progress of a rule counts, for "8 of 10 films".
export function unitOf(rule: Rule): Unit {
    switch (rule.type) {
        case 'hours':
            return UNITS.hours;
        case 'streak':
            return UNITS.days;
        case 'complete':
            return completeUnit(rule.set, rule.target);
        case 'window':
            return kindUnit(rule.filter);
        case 'count':
            return countUnit(rule.distinct, rule.groupBy, rule.filter);
    }
}

// One set wanted: progress counts the episodes of the nearest set.
function completeUnit(set: 'show' | 'season', target: number): Unit {
    if (target === 1) {
        return UNITS.episodes;
    }
    return set === 'show' ? UNITS.shows : UNITS.seasons;
}

function countUnit(
    distinct: string | undefined,
    groupBy: string | undefined,
    filter: EventFilterSpec | undefined,
): Unit {
    if (distinct === 'show') {
        return UNITS.shows;
    }
    if (groupBy === 'item') {
        return UNITS.watches;
    }
    return kindUnit(filter);
}

function kindUnit(filter: EventFilterSpec | undefined): Unit {
    switch (filter?.kind) {
        case 'movie':
            return UNITS.films;
        case 'episode':
            return UNITS.episodes;
        default:
            return UNITS.watches;
    }
}
