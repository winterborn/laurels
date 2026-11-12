// Checks the shape of an award rule. Returns the first problem, or ''.
// Used when Laurels loads awards.json and when the owner saves the awards editor.

export const RULE_TYPES = [
    'anniversary',
    'awards',
    'backwards',
    'chain',
    'comeback',
    'complete',
    'count',
    'first',
    'hours',
    'outOfOrder',
    'shared',
    'streak',
    'variety',
    'window',
];

export const GROUP_KEYS = [
    'actor',
    'collection',
    'country',
    'decade',
    'director',
    'genre',
    'hour',
    'item',
    'letter',
    'platform',
    'rating',
    'season',
    'show',
    'studio',
    'weekday',
];

const FILTER_KEYS = [
    'ageMax',
    'ageMin',
    'crossesMidnight',
    'dates',
    'durationMax',
    'durationMin',
    'episodeIndex',
    'genre',
    'hourFrom',
    'hourTo',
    'isFinale',
    'kind',
    'onReleaseDate',
    'pausedMin',
    'ratings',
    'seasonMin',
    'titleWords',
    'titleWordsMax',
    'titleWordsMin',
    'weekdays',
    'yearAfter',
    'yearBefore',
];

type Json = Record<string, any>;

export function ruleProblem(rule: Json | undefined): string {
    if (!rule || typeof rule !== 'object') {
        return 'needs a rule';
    }
    if (!RULE_TYPES.includes(rule.type)) {
        return `unknown rule type "${rule.type}"`;
    }
    if (!(Number(rule.target) > 0)) {
        return 'target must be above 0';
    }
    return filterProblem(rule.filter) || stepsProblem(rule.steps) || fieldsProblem(rule);
}

function filterProblem(filter: unknown): string {
    if (filter === undefined) {
        return '';
    }
    if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
        return 'filter must be an object';
    }
    const unknown = Object.keys(filter).find((key) => !FILTER_KEYS.includes(key));
    return unknown ? `unknown filter field "${unknown}"` : '';
}

function stepsProblem(steps: unknown): string {
    if (steps === undefined) {
        return '';
    }
    if (!Array.isArray(steps) || !steps.length) {
        return 'steps must be a list of filters';
    }
    return steps.map((step) => filterProblem(step)).find(Boolean) ?? '';
}

// The fields that each rule type needs.
function fieldsProblem(rule: Json): string {
    switch (rule.type) {
        case 'window':
            return oneOf(rule.span, ['day', '24h', 'month', 'year'], 'span');
        case 'complete':
            return oneOf(rule.set, ['show', 'season'], 'set');
        case 'outOfOrder':
            return oneOf(rule.set, ['season', 'collection'], 'set');
        case 'variety':
            return oneOf(rule.of, GROUP_KEYS, 'of');
        case 'comeback':
            return oneOf(rule.groupBy, ['item', 'show'], 'groupBy') || positive(rule.minDays, 'minDays');
        case 'shared':
            return positive(rule.withinDays, 'withinDays');
        case 'chain':
            return chainProblem(rule);
        default:
            return '';
    }
}

function chainProblem(rule: Json): string {
    const hasShape = rule.steps !== undefined || GROUP_KEYS.includes(rule.same);
    if (!hasShape) {
        return 'a chain needs steps, or same with one of: ' + GROUP_KEYS.join(', ');
    }
    return positive(rule.maxGapHours, 'maxGapHours');
}

function oneOf(value: unknown, allowed: string[], field: string): string {
    if (allowed.includes(String(value))) {
        return '';
    }
    return `${field} must be one of: ${allowed.join(', ')}`;
}

function positive(value: unknown, field: string): string {
    return Number(value) > 0 ? '' : `${field} must be above 0`;
}
