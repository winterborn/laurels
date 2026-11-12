import type {
    Item,
    ItemKind,
    User,
    WatchEvent,
} from '../model/index.ts';
import type { PlexJson } from './PlexClient.ts';

const ITEM_KINDS: ItemKind[] = [
    'movie',
    'episode',
    'show',
    'season',
];

const MAX_ACTORS = 10;

// Raise this when PlexMapper reads a new field, so old items are read again.
export const META_VERSION = 2;

// Turns Plex JSON into our model. No network here.
export class PlexMapper {

    user(row: PlexJson): User | null {
        const id = String(row.id ?? '');
        const hasName = Boolean(row.name);
        if (!id || !hasName) {
            return null;
        }
        return {
            id,
            name: row.name,
            thumb: row.thumb || undefined,
        };
    }

    // Only films and episodes; music and photos are skipped.
    event(row: PlexJson): WatchEvent | null {
        const kind = row.type;
        const isVideo = kind === 'movie' || kind === 'episode';
        const ratingKey = this.ratingKeyOf(row);
        if (!isVideo || !ratingKey || !row.viewedAt) {
            return null;
        }
        return {
            id: this.eventId(row, ratingKey),
            userId: String(row.accountID),
            ratingKey,
            kind,
            showKey: this.keyFrom(row.grandparentKey),
            seasonKey: this.keyFrom(row.parentKey),
            watchedAt: Number(row.viewedAt),
            source: 'plex',
        };
    }

    // A thin item from a history row, until metadata arrives.
    stub(row: PlexJson, ratingKey: string): Item {
        return {
            ratingKey,
            kind: row.type,
            title: row.title ?? 'Unknown title',
            genres: [],
            directors: [],
            actors: [],
            countries: [],
            collections: [],
            thumb: row.thumb || undefined,
            stub: true,
        };
    }

    // Plex has no metadata and no history row told us the title.
    missing(ratingKey: string): Item {
        return {
            ratingKey,
            kind: 'movie',
            title: 'Removed from Plex',
            genres: [],
            directors: [],
            actors: [],
            countries: [],
            collections: [],
            missing: true,
        };
    }

    item(row: PlexJson): Item | null {
        const kind = row.type as ItemKind;
        if (!ITEM_KINDS.includes(kind)) {
            return null;
        }
        return {
            ratingKey: String(row.ratingKey),
            kind,
            title: row.title ?? 'Unknown title',
            year: this.numberOf(row.year),
            durationMs: this.numberOf(row.duration),
            genres: this.tags(row.Genre),
            directors: this.tags(row.Director),
            actors: this.tags(row.Role).slice(0, MAX_ACTORS),
            studio: row.studio || undefined,
            countries: this.tags(row.Country),
            contentRating: row.contentRating || undefined,
            releasedAt: row.originallyAvailableAt || undefined,
            showKey: this.showKeyOf(row, kind),
            seasonKey: kind === 'episode' ? this.stringOf(row.parentRatingKey) : undefined,
            index: this.numberOf(row.index),
            seasonIndex: this.numberOf(row.parentIndex),
            leafCount: this.numberOf(row.leafCount),
            thumb: row.thumb || undefined,
            art: row.art || row.grandparentArt || undefined,
            collections: this.tags(row.Collection),
            metaVersion: META_VERSION,
        };
    }

    private showKeyOf(row: PlexJson, kind: ItemKind): string | undefined {
        switch (kind) {
            case 'episode':
                return this.stringOf(row.grandparentRatingKey);
            case 'season':
                return this.stringOf(row.parentRatingKey);
            default:
                return undefined;
        }
    }

    private eventId(row: PlexJson, ratingKey: string): string {
        const historyId = this.keyFrom(row.historyKey);
        if (historyId) {
            return `plex:${historyId}`;
        }
        return `plex:${row.accountID}:${ratingKey}:${row.viewedAt}`;
    }

    private ratingKeyOf(row: PlexJson): string | undefined {
        return this.stringOf(row.ratingKey) ?? this.keyFrom(row.key);
    }

    // "/library/metadata/123" -> "123"
    private keyFrom(path: unknown): string | undefined {
        if (typeof path !== 'string' || !path) {
            return undefined;
        }
        return path.split('/').filter(Boolean).pop();
    }

    private tags(list: unknown): string[] {
        if (!Array.isArray(list)) {
            return [];
        }
        return list
            .map((entry) => String(entry.tag ?? ''))
            .filter(Boolean);
    }

    private numberOf(value: unknown): number | undefined {
        const number = Number(value);
        if (value === undefined || Number.isNaN(number)) {
            return undefined;
        }
        return number;
    }

    private stringOf(value: unknown): string | undefined {
        if (value === undefined || value === null || value === '') {
            return undefined;
        }
        return String(value);
    }

}
