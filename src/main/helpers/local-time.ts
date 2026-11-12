export interface LocalParts {
    // YYYY-MM-DD in the server's time zone.
    day: string;
    hour: number;
}

const SECONDS_PER_DAY = 86_400;

const formatters = new Map<string, Intl.DateTimeFormat>();

// Every time zone offset is a whole number of quarter hours, so the local
// day and hour are the same for all times in one quarter hour.
const QUARTER_HOUR = 900;
// Parts already worked out. Intl formatting is slow, and the rules ask for
// the same watch many times. The cache starts again when it is this big.
const MAX_CACHED = 200_000;
const cachedParts = new Map<string, LocalParts>();

export function localParts(epochSeconds: number, timeZone: string): LocalParts {
    const quarter = Math.floor(epochSeconds / QUARTER_HOUR);
    const key = `${timeZone}|${quarter}`;
    const cached = cachedParts.get(key);
    if (cached) {
        return cached;
    }
    if (cachedParts.size >= MAX_CACHED) {
        cachedParts.clear();
    }
    const parts = formatParts(quarter * QUARTER_HOUR, timeZone);
    cachedParts.set(key, parts);
    return parts;
}

// 0 (Sunday) to 6 (Saturday) for a YYYY-MM-DD string.
export function weekdayOf(day: string): number {
    return new Date(`${day}T12:00:00Z`).getUTCDay();
}

// Whole days since 1970-01-01 for a YYYY-MM-DD string.
export function dayNumber(day: string): number {
    const [year, month, date] = day.split('-').map(Number);
    const epochMs = Date.UTC(year, month - 1, date);
    return Math.round(epochMs / 1000 / SECONDS_PER_DAY);
}

function formatParts(epochSeconds: number, timeZone: string): LocalParts {
    const date = new Date(epochSeconds * 1000);
    const parts = formatterFor(timeZone).formatToParts(date);
    const valueOf = (type: string) => {
        const part = parts.find((candidate) => candidate.type === type);
        return part?.value ?? '';
    };
    const hour = Number(valueOf('hour')) % 24;
    return {
        day: `${valueOf('year')}-${valueOf('month')}-${valueOf('day')}`,
        hour,
    };
}

function formatterFor(timeZone: string): Intl.DateTimeFormat {
    const cached = formatters.get(timeZone);
    if (cached) {
        return cached;
    }
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hourCycle: 'h23',
    });
    formatters.set(timeZone, formatter);
    return formatter;
}

// "2026-11-12" as a period: the day, "2026-11" or "2026".
export function periodOfDay(span: string, day: string): string {
    switch (span) {
        case 'month':
            return day.slice(0, 7);
        case 'year':
            return day.slice(0, 4);
        default:
            return day;
    }
}
