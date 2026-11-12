import type { App } from '../App.ts';
import type { PlexImage } from '../sources/index.ts';

export type PictureKind = 'poster' | 'art';

const MAX_ENTRIES = 400;

const SIZES: Record<PictureKind, { width: number; height: number }> = {
    poster: {
        width: 300,
        height: 450,
    },
    art: {
        width: 1600,
        height: 900,
    },
};

// Proxies Plex posters so the token never reaches the browser.
export class PosterCache {

    private readonly app: App;
    private readonly entries = new Map<string, PlexImage>();

    constructor(app: App) {
        this.app = app;
    }

    // Only items we already know about can be fetched.
    async get(ratingKey: string, kind: PictureKind = 'poster'): Promise<PlexImage | null> {
        const cacheKey = `${kind}:${ratingKey}`;
        const cached = this.entries.get(cacheKey);
        if (cached) {
            return cached;
        }
        const item = this.app.store.items().get(ratingKey);
        const path = kind === 'art' ? item?.art : item?.thumb;
        const plex = this.app.plex;
        if (!path || !plex) {
            return null;
        }
        const size = SIZES[kind];
        const image = await plex.getImage(path, size.width, size.height);
        if (!image.ok) {
            return null;
        }
        this.remember(cacheKey, image);
        return image;
    }

    private remember(ratingKey: string, image: PlexImage): void {
        if (this.entries.size >= MAX_ENTRIES) {
            const oldest = this.entries.keys().next().value;
            this.entries.delete(oldest ?? '');
        }
        this.entries.set(ratingKey, image);
    }

}
