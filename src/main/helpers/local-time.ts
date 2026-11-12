export interface LocalParts {
    // YYYY-MM-DD in the server's time zone.
    day: string;
    hour: number;
}

const SECONDS_PER_DAY = 86_400;

const formatters = new Map<string, Intl.DateTimeFormat>();

export function localParts(epochSeconds: number, timeZone: string): LocalParts {
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

// Whole days since 1970-01-01 for a YYYY-MM-DD string.
export function dayNumber(day: string): number {
    const [year, month, date] = day.split('-').map(Number);
    const epochMs = Date.UTC(year, month - 1, date);
    return Math.round(epochMs / 1000 / SECONDS_PER_DAY);
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
