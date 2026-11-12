import type {
    Item,
    WatchEvent,
} from '../../main/model/index.ts';
import { UserHistory } from '../../main/rules/index.ts';

const BASE_ITEM = {
    genres: [],
    directors: [],
    actors: [],
    countries: [],
    collections: [],
};

// Builds a small UserHistory for rule tests. Times are UTC.
export class HistoryBuilder {

    private readonly items = new Map<string, Item>();
    private readonly events: WatchEvent[] = [];

    film(ratingKey: string, fields: Partial<Item> = {}): this {
        this.items.set(ratingKey, {
            ...BASE_ITEM,
            ratingKey,
            kind: 'movie',
            title: `Film ${ratingKey}`,
            durationMs: 90 * 60_000,
            ...fields,
        });
        return this;
    }

    show(showKey: string, seasons: number[]): this {
        const episodes = seasons.reduce((sum, count) => sum + count, 0);
        this.items.set(showKey, {
            ...BASE_ITEM,
            ratingKey: showKey,
            kind: 'show',
            title: `Show ${showKey}`,
            leafCount: episodes,
        });
        seasons.forEach((count, index) => this.season(showKey, index + 1, count));
        return this;
    }

    // Watch ends at `end` (ISO, UTC).
    watch(ratingKey: string, end: string): this {
        const item = this.items.get(ratingKey);
        this.events.push({
            id: `e${this.events.length + 1}`,
            userId: 'u1',
            ratingKey,
            kind: item?.kind === 'episode' ? 'episode' : 'movie',
            showKey: item?.showKey,
            seasonKey: item?.seasonKey,
            watchedAt: Date.parse(end) / 1000,
            source: 'plex',
        });
        return this;
    }

    build(): UserHistory {
        return new UserHistory('u1', this.events, this.items, 'UTC');
    }

    private season(showKey: string, season: number, count: number): void {
        const seasonKey = `${showKey}-s${season}`;
        this.items.set(seasonKey, {
            ...BASE_ITEM,
            ratingKey: seasonKey,
            kind: 'season',
            title: `Season ${season}`,
            index: season,
            showKey,
            leafCount: count,
        });
        for (const episode of Array.from({ length: count }, (_, index) => index + 1)) {
            const ratingKey = `${seasonKey}-e${episode}`;
            this.items.set(ratingKey, {
                ...BASE_ITEM,
                ratingKey,
                kind: 'episode',
                title: `Episode ${episode}`,
                index: episode,
                showKey,
                seasonKey,
                durationMs: 30 * 60_000,
            });
        }
    }

}
