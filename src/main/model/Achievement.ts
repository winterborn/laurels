export type Tier = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

export type Section = 'film' | 'tv' | 'both';

// The things that watches can share. Episodes use their show for genre, country and decade.
export type GroupKey =
    | 'actor'
    | 'collection'
    | 'country'
    | 'decade'
    | 'director'
    | 'genre'
    | 'hour'
    | 'item'
    | 'letter'
    | 'platform'
    | 'rating'
    | 'season'
    | 'show'
    | 'studio'
    | 'weekday';

export interface EventFilterSpec {
    kind?: 'movie' | 'episode';
    genre?: string;
    yearBefore?: number;
    yearAfter?: number;
    // Minutes. durationMin is inclusive, durationMax is exclusive.
    durationMin?: number;
    durationMax?: number;
    // Local hour the watch started, 0-23. hourTo is exclusive.
    hourFrom?: number;
    hourTo?: number;
    episodeIndex?: number;
    // Local day of the week that the watch started: 0 is Sunday, 6 is Saturday.
    weekdays?: number[];
    // Local dates that the watch started on, as "MM-DD", for example "12-25".
    dates?: string[];
    // The start date is the release date of the item ("MM-DD"), in any year.
    onReleaseDate?: boolean;
    // Whole words in the title (any of them), not case-sensitive.
    titleWords?: string[];
    // The number of words in the title.
    titleWordsMin?: number;
    titleWordsMax?: number;
    // Content ratings (any of them), for example "R" or "18". "gb/18" matches "18".
    ratings?: string[];
    // Years from the release year to the year of the watch. 0 is the same year.
    ageMin?: number;
    ageMax?: number;
    // The season number of an episode is this number or higher.
    seasonMin?: number;
    // The episode is the last episode of its season.
    isFinale?: boolean;
    // The watch started on one local day and ended on the next.
    crossesMidnight?: boolean;
    // Seconds paused during the watch (needs Tautulli).
    pausedMin?: number;
}

export interface CountRule {
    type: 'count';
    filter?: EventFilterSpec;
    // Count each item (or show) once.
    distinct?: 'item' | 'show';
    // Earn when one director, actor, ... reaches the target.
    groupBy?: GroupKey;
    target: number;
}

export interface HoursRule {
    type: 'hours';
    filter?: EventFilterSpec;
    target: number;
}

export interface CompleteRule {
    type: 'complete';
    set: 'show' | 'season';
    // Only count a set when its first and last watch are this many days apart or less.
    withinDays?: number;
    // Only count a set with this many episodes in the library, or more (or fewer).
    minEpisodes?: number;
    maxEpisodes?: number;
    target: number;
}

export interface StreakRule {
    type: 'streak';
    filter?: EventFilterSpec;
    target: number;
}

export interface WindowRule {
    type: 'window';
    filter?: EventFilterSpec;
    // A local calendar day, month or year, or any 24 hours.
    span: 'day' | '24h' | 'month' | 'year';
    groupBy?: 'show' | 'item';
    // Count each local day once, for example "20 days in one month",
    // or each film or episode once.
    distinct?: 'day' | 'item';
    // Count hours watched, not watches.
    measure?: 'hours';
    target: number;
}

// Watches of an item that another person also watched within withinDays.
export interface SharedRule {
    type: 'shared';
    filter?: EventFilterSpec;
    withinDays: number;
    // How many other people must watch it. Default 1.
    people?: number;
    target: number;
}

// Different values of one thing, for example films from 8 decades.
// With span, all of them in one local day, month or year.
export interface VarietyRule {
    type: 'variety';
    of: GroupKey;
    filter?: EventFilterSpec;
    span?: 'day' | 'month' | 'year';
    target: number;
}

// Watches back to back, with at most maxGapHours from the end of one to the start of the next.
// steps: each watch matches its step, in order. same: each watch shares one value of this key.
export interface ChainRule {
    type: 'chain';
    steps?: EventFilterSpec[];
    same?: GroupKey;
    filter?: EventFilterSpec;
    length?: number;
    maxGapHours: number;
    target: number;
}

// Watches of an item (or a show) after at least minDays away from it.
export interface ComebackRule {
    type: 'comeback';
    groupBy: 'item' | 'show';
    minDays: number;
    filter?: EventFilterSpec;
    target: number;
}

// The same item on the same local date in this many different years.
export interface AnniversaryRule {
    type: 'anniversary';
    filter?: EventFilterSpec;
    target: number;
}

// A season finale before episode 1 of the season, or a later film of a
// collection before an earlier one.
export interface OutOfOrderRule {
    type: 'outOfOrder';
    set: 'season' | 'collection';
    target: number;
}

// Episodes of one season back to back, each one the episode before the last.
export interface BackwardsRule {
    type: 'backwards';
    target: number;
}

// Items that this person watched first in the household, before another person.
export interface FirstRule {
    type: 'first';
    filter?: EventFilterSpec;
    target: number;
}

// A number of other awards won.
export interface AwardsRule {
    type: 'awards';
    target: number;
}

export type Rule =
    | AnniversaryRule
    | AwardsRule
    | BackwardsRule
    | ChainRule
    | ComebackRule
    | CompleteRule
    | CountRule
    | FirstRule
    | HoursRule
    | OutOfOrderRule
    | SharedRule
    | StreakRule
    | VarietyRule
    | WindowRule;

export interface Achievement {
    id: string;
    title: string;
    description: string;
    flavorText?: string;
    tier: Tier;
    section: Section;
    secret?: boolean;
    rule: Rule;
}
