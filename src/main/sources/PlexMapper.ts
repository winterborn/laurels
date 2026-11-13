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

// Plex keeps the history row of an item that left the library, but drops its key.
// Laurels gives such a row a key from its title, so all watches of the item share it:
// "gone:movie:<title>:<year>" or "gone:episode:<show>:<season>:<episode>".
// A row with no title gets a key from its history id.
const GONE_PREFIX = 'gone:';

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
        const ratingKey = this.ratingKeyOf(row) ?? this.goneKeyOf(row);
        if (!isVideo || !ratingKey || !row.viewedAt) {
            return null;
        }
        return {
            id: this.eventId(row, ratingKey),
            userId: String(row.accountID),
            ratingKey,
            kind,
            showKey: this.showKeyOf(row),
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

    isGone(ratingKey: string): boolean {
        return ratingKey.startsWith(GONE_PREFIX);
    }

    // A film or episode that left the library. Only the history row knows it.
    removed(row: PlexJson, ratingKey: string, showKey: string | undefined): Item {
        return {
            ...this.stub(row, ratingKey),
            showKey,
            index: this.numberOf(row.index),
            seasonIndex: this.numberOf(row.parentIndex),
            stub: false,
            missing: true,
        };
    }

    // The show of a removed episode, named from the history row.
    removedShow(row: PlexJson, showKey: string): Item {
        return {
            ...this.missing(showKey),
            kind: 'show',
            title: row.grandparentTitle ?? 'Unknown show',
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
            showKey: this.itemShowKey(row, kind),
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

    // A removed episode has no show key, so its show title groups it.
    private showKeyOf(row: PlexJson): string | undefined {
        const key = this.keyFrom(row.grandparentKey);
        const title = this.stringOf(row.grandparentTitle);
        if (key || !title) {
            return key;
        }
        return `${GONE_PREFIX}show:${title}`;
    }

    private goneKeyOf(row: PlexJson): string | undefined {
        const titleKey = row.type === 'episode' ? this.goneEpisodeKey(row) : this.goneMovieKey(row);
        if (titleKey) {
            return `${GONE_PREFIX}${titleKey}`;
        }
        const historyId = this.keyFrom(row.historyKey);
        if (!historyId) {
            return undefined;
        }
        return `${GONE_PREFIX}${historyId}`;
    }

    private goneMovieKey(row: PlexJson): string | undefined {
        const title = this.stringOf(row.title)?.trim().toLowerCase();
        if (!title) {
            return undefined;
        }
        const year = this.numberOf(row.year) ?? '';
        return `movie:${title}:${year}`;
    }

    private goneEpisodeKey(row: PlexJson): string | undefined {
        const show = this.stringOf(row.grandparentTitle)?.trim().toLowerCase();
        const season = this.numberOf(row.parentIndex);
        const episode = this.numberOf(row.index);
        const isKnown = show !== undefined && season !== undefined && episode !== undefined;
        if (!isKnown) {
            return undefined;
        }
        return `episode:${show}:${season}:${episode}`;
    }

    private itemShowKey(row: PlexJson, kind: ItemKind): string | undefined {
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
