export type Tier = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

export type Section = 'film' | 'tv' | 'both';

export type GroupKey = 'item' | 'show' | 'director' | 'actor' | 'studio';

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
    span: 'day' | '24h';
    groupBy?: 'show';
    target: number;
}

export type Rule = CountRule | HoursRule | CompleteRule | StreakRule | WindowRule;

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
