export function countBy<T>(
    items: T[],
    keyOf: (item: T) => string,
): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const item of items) {
        const key = keyOf(item);
        counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
}

export function unique(values: string[]): string[] {
    const set = new Set(values);
    return [...set];
}

// Picks `count` items evenly spread from first to last.
export function spread<T>(items: T[], count: number): T[] {
    if (items.length <= count) {
        return items;
    }
    const step = items.length / count;
    return Array.from({ length: count }, (_, index) => {
        return items[Math.floor(index * step)];
    });
}

export function median(values: number[]): number {
    if (!values.length) {
        return 0;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted[middle];
}
