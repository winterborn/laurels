import type { WatchEvent } from '../model/index.ts';

interface Sighting {
    userId: string;
    watchedAt: number;
}

const DAY_SECONDS = 86_400;

// Who watched each item, and when. Rules that compare people read it.
export class HouseholdWatches {

    private readonly byItem = new Map<string, Sighting[]>();

    constructor(events: WatchEvent[]) {
        for (const event of events) {
            const sightings = this.byItem.get(event.ratingKey) ?? [];
            sightings.push({
                userId: event.userId,
                watchedAt: event.watchedAt,
            });
            this.byItem.set(event.ratingKey, sightings);
        }
    }

    // The earliest watch of this item by another person within the window, or undefined.
    otherNear(event: WatchEvent, withinDays: number): number | undefined {
        const limit = withinDays * DAY_SECONDS;
        const times = (this.byItem.get(event.ratingKey) ?? [])
            .filter((sighting) => sighting.userId !== event.userId)
            .filter((sighting) => Math.abs(sighting.watchedAt - event.watchedAt) <= limit)
            .map((sighting) => sighting.watchedAt);
        if (!times.length) {
            return undefined;
        }
        return Math.min(...times);
    }

}
