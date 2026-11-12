export function formatDate(epochSeconds: number): string {
    if (!(epochSeconds > 0)) {
        return 'unknown';
    }
    const date = new Date(epochSeconds * 1000);
    return date.toISOString().slice(0, 10);
}

export function formatTime(epochSeconds: number): string {
    if (!(epochSeconds > 0)) {
        return 'unknown';
    }
    const date = new Date(epochSeconds * 1000);
    return date.toISOString();
}

export function formatShare(part: number, whole: number): string {
    if (whole === 0) {
        return `${part} of 0`;
    }
    const percent = Math.round(100 * part / whole);
    return `${part} of ${whole} (${percent}%)`;
}

export function formatCounts(counts: Record<string, number>): string {
    const entries = Object.entries(counts);
    if (!entries.length) {
        return 'none';
    }
    return entries
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `${name}: ${count}`)
        .join(', ');
}
