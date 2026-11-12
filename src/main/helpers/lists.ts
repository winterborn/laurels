export function maxOf(values: number[]): number {
    return values.reduce((best, value) => Math.max(best, value), 0);
}

export function lastOf<T>(items: T[]): T | undefined {
    return items[items.length - 1];
}

export function groupBy<T>(
    items: T[],
    keyOf: (item: T) => string,
): Map<string, T[]> {
    const groups = new Map<string, T[]>();
    for (const item of items) {
        const key = keyOf(item);
        const group = groups.get(key) ?? [];
        group.push(item);
        groups.set(key, group);
    }
    return groups;
}

// [1, 2, 3, 4, 5] in chunks of 2: [[1, 2], [3, 4], [5]].
export function chunksOf<T>(items: T[], size: number): T[][] {
    const count = Math.ceil(items.length / size);
    return Array.from({ length: count }, (_, index) => {
        const start = index * size;
        return items.slice(start, start + size);
    });
}
