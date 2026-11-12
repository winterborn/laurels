import type {
    EventFilterSpec,
    GroupKey,
    Rule,
} from '../model/index.ts';

export interface Unit {
    one: string;
    many: string;
}

const UNITS: Record<string, Unit> = {
    awards: {
        one: 'award',
        many: 'awards',
    },
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
    inARow: {
        one: 'in a row',
        many: 'in a row',
    },
    returns: {
        one: 'return',
        many: 'returns',
    },
    years: {
        one: 'year',
        many: 'years',
    },
    times: {
        one: 'time',
        many: 'times',
    },
    kinds: {
        one: 'kind',
        many: 'kinds',
    },
};

// What a variety rule counts, for "5 of 8 decades".
const VARIETY_UNITS: Partial<Record<GroupKey, Unit>> = {
    collection: {
        one: 'collection',
        many: 'collections',
    },
    country: {
        one: 'country',
        many: 'countries',
    },
    decade: {
        one: 'decade',
        many: 'decades',
    },
    genre: {
        one: 'genre',
        many: 'genres',
    },
    letter: {
        one: 'letter',
        many: 'letters',
    },
    show: {
        one: 'show',
        many: 'shows',
    },
    weekday: {
        one: 'day of the week',
        many: 'days of the week',
    },
};

// What the progress of a rule counts, for "8 of 10 films".
export function unitOf(rule: Rule): Unit {
    switch (rule.type) {
        case 'awards':
            return UNITS.awards;
        case 'complete':
            return completeUnit(rule.set, rule.target);
        case 'count':
            return countUnit(rule.distinct, rule.groupBy, rule.filter);
        case 'hours':
            return UNITS.hours;
        case 'shared':
            return kindUnit(rule.filter);
        case 'streak':
            return UNITS.days;
        case 'window':
            return windowUnit(rule.distinct, rule.measure, rule.filter);
        case 'variety':
            return VARIETY_UNITS[rule.of] ?? UNITS.kinds;
        case 'chain':
            return UNITS.inARow;
        case 'comeback':
            return UNITS.returns;
        case 'anniversary':
            return UNITS.years;
        case 'outOfOrder':
            return UNITS.times;
        case 'backwards':
            return UNITS.episodes;
        case 'first':
            return kindUnit(rule.filter);
    }
}

function windowUnit(distinct?: string, measure?: string, filter?: EventFilterSpec): Unit {
    if (measure === 'hours') {
        return UNITS.hours;
    }
    return distinct === 'day' ? UNITS.days : kindUnit(filter);
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
