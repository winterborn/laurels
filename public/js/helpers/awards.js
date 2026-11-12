import { formatNumber } from './format.js';

// The three award categories, in Ballot order.
export const CATEGORIES = [
    {
        id: 'film',
        name: 'Film',
        ballot: 'Best in Film',
    },
    {
        id: 'tv',
        name: 'Television',
        ballot: 'Best in Television',
    },
    {
        id: 'both',
        name: 'Screen',
        ballot: 'Best on Screen',
    },
];

// "Winner, Rare, 50 points": the laurel's text for screen readers.
export function laurelLabel(definition) {
    return `${definition.laurel}, ${definition.tier}, ${definition.points} points`;
}

// "8 of 10", "12 of 100 hours", "3 of 30 days".
export function progressText(progress, definition) {
    const counted = `${formatNumber(progress.value)} of ${formatNumber(progress.target)}`;
    switch (definition.ruleType) {
        case 'hours':
            return `${counted} hours`;
        case 'streak':
            return `${counted} days`;
        default:
            return counted;
    }
}

// Share of the target, from 0 to 1.
export function shareOf(progress) {
    if (!progress.target) {
        return 0;
    }
    return Math.min(progress.value / progress.target, 1);
}

// "Alex", "Alex and Sam", "Alex, Sam and Tess".
export function joinNames(names) {
    if (names.length < 2) {
        return names.join('');
    }
    const head = names.slice(0, -1).join(', ');
    return `${head} and ${names[names.length - 1]}`;
}
