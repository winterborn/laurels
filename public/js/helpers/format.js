export function formatDay(epochSeconds) {
    const date = new Date(epochSeconds * 1000);
    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

export function formatClock(epochSeconds) {
    const date = new Date(epochSeconds * 1000);
    return date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function formatNumber(value) {
    return Number(value).toLocaleString('en-GB');
}

export function yearOf(epochSeconds) {
    return new Date(epochSeconds * 1000).getFullYear();
}

export function initialOf(name) {
    return String(name).slice(0, 1).toUpperCase();
}

// 1 -> 1st, 2 -> 2nd, 11 -> 11th
export function ordinal(rank) {
    const lastTwo = rank % 100;
    const isTeen = lastTwo >= 11 && lastTwo <= 13;
    if (isTeen) {
        return `${rank}th`;
    }
    const suffixes = {
        1: 'st',
        2: 'nd',
        3: 'rd',
    };
    return `${rank}${suffixes[rank % 10] ?? 'th'}`;
}

// "an Alex production", "a Sam production"
export function articleFor(name) {
    const startsWithVowel = /^[aeiou]/i.test(name);
    return startsWithVowel ? 'an' : 'a';
}
