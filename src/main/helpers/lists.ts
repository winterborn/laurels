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
