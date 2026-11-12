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

    // The time when `people` other people watched this item within the window, or undefined.
    // Each person counts once, at their earliest watch in the window.
    otherNear(event: WatchEvent, withinDays: number, people = 1): number | undefined {
        const limit = withinDays * DAY_SECONDS;
        const nearby = (this.byItem.get(event.ratingKey) ?? [])
            .filter((sighting) => sighting.userId !== event.userId)
            .filter((sighting) => Math.abs(sighting.watchedAt - event.watchedAt) <= limit);
        const firstTimes = this.firstTimeByPerson(nearby);
        return firstTimes[people - 1];
    }

    // If this is the first watch of the item in the household, the time when
    // another person first watched it after. Else undefined.
    otherAfterFirst(event: WatchEvent): number | undefined {
        const sightings = this.byItem.get(event.ratingKey) ?? [];
        const isFirst = sightings.every((sighting) => sighting.watchedAt >= event.watchedAt);
        if (!isFirst) {
            return undefined;
        }
        const others = sightings.filter((sighting) => sighting.userId !== event.userId);
        return this.firstTimeByPerson(others)[0];
    }

    // The earliest time of each person, oldest first.
    private firstTimeByPerson(sightings: Sighting[]): number[] {
        const earliest = new Map<string, number>();
        for (const sighting of sightings) {
            const known = earliest.get(sighting.userId) ?? Infinity;
            earliest.set(sighting.userId, Math.min(known, sighting.watchedAt));
        }
        return [...earliest.values()].sort((a, b) => a - b);
    }

}
