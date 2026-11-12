import type { Tier } from '../model/index.ts';

export const TIER_ORDER: Tier[] = [
    'Common',
    'Uncommon',
    'Rare',
    'Epic',
    'Legendary',
];

export const TIER_POINTS: Record<Tier, number> = {
    Common: 10,
    Uncommon: 25,
    Rare: 50,
    Epic: 100,
    Legendary: 250,
};

// The word on the festival laurel.
export const TIER_WORDS: Record<Tier, string> = {
    Common: 'Official selection',
    Uncommon: 'Special mention',
    Rare: 'Winner',
    Epic: 'Grand prize',
    Legendary: 'Lifetime achievement',
};

export const TIER_COLOURS: Record<Tier, string> = {
    Common: '#d29a66',
    Uncommon: '#c9d1d9',
    Rare: '#e3b04b',
    Epic: '#ef8a76',
    Legendary: '#bfe6ff',
};
