import { createHash } from 'node:crypto';
import {
    mkdir,
    readdir,
    readFile,
    stat,
    unlink,
    utimes,
    writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import type { App } from '../App.ts';
import type { PlexImage } from '../sources/index.ts';

export type PictureKind = 'poster' | 'art';

// Images kept in memory: the ones that people open most.
const MEMORY_ENTRIES = 150;
// Images kept on disk, in DATA_DIR/posters. Old files go first.
const DISK_BYTES = 300 * 1024 * 1024;
// After a prune, the folder is this share of the limit.
const PRUNE_TO = 0.8;
// Check the folder size after this many new files.
const PRUNE_EVERY = 50;

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
// Order of lookup: memory, then disk, then Plex.
// A poster that Plex cannot give becomes a title card, so no page shows a broken image.
export class PosterCache {

    private readonly app: App;
    private readonly folder: string;
    private readonly memory = new Map<string, PlexImage>();
    private readonly inFlight = new Map<string, Promise<PlexImage | null>>();
    private writesSincePrune = 0;

    constructor(app: App) {
        this.app = app;
        this.folder = join(app.config.dataDir, 'posters');
    }

    // Only items we already know about can be fetched.
    async get(ratingKey: string, kind: PictureKind = 'poster'): Promise<PlexImage | null> {
        const item = this.app.store.item(ratingKey);
        const path = kind === 'art' ? item?.art : item?.thumb;
        const image = path ? await this.cached(kind, ratingKey, path) : null;
        if (image || kind === 'art' || !item) {
            return image;
        }
        return this.titleCard(item.title);
    }

    // The thumb path is in the key, so a new poster in Plex gets a new file.
    private async cached(kind: PictureKind, ratingKey: string, path: string): Promise<PlexImage | null> {
        const key = createHash('sha1')
            .update(`${kind}|${ratingKey}|${path}`)
            .digest('hex')
            .slice(0, 20);
        const remembered = this.memory.get(key);
        if (remembered) {
            this.remember(key, remembered);
            return remembered;
        }
        const running = this.inFlight.get(key) ?? this.load(key, kind, path);
        this.inFlight.set(key, running);
        try {
            return await running;
        } finally {
            this.inFlight.delete(key);
        }
    }

    private async load(key: string, kind: PictureKind, path: string): Promise<PlexImage | null> {
        const image = await this.fromDisk(key) ?? await this.fromPlex(key, kind, path);
        if (image) {
            this.remember(key, image);
        }
        return image;
    }

    private async fromDisk(key: string): Promise<PlexImage | null> {
        const file = join(this.folder, key);
        try {
            const bytes = new Uint8Array(await readFile(file));
            const now = new Date();
            await utimes(file, now, now);
            return {
                ok: true,
                status: 200,
                contentType: this.typeOf(bytes),
                bytes,
            };
        } catch {
            return null;
        }
    }

    private async fromPlex(key: string, kind: PictureKind, path: string): Promise<PlexImage | null> {
        const plex = this.app.plex;
        if (!plex) {
            return null;
        }
        const size = SIZES[kind];
        const image = await plex.getImage(path, size.width, size.height);
        if (!image.ok) {
            return null;
        }
        await this.toDisk(key, image.bytes);
        return image;
    }

    // A full disk or a read-only folder only loses the disk copy.
    private async toDisk(key: string, bytes: Uint8Array): Promise<void> {
        try {
            await mkdir(this.folder, { recursive: true });
            await writeFile(join(this.folder, key), bytes);
            this.writesSincePrune += 1;
            if (this.writesSincePrune >= PRUNE_EVERY) {
                this.writesSincePrune = 0;
                await this.prune();
            }
        } catch (error) {
            console.error('Poster cache write failed:', error);
        }
    }

    // Deletes the files that nobody opened for the longest time.
    private async prune(): Promise<void> {
        const names = await readdir(this.folder);
        const files = await Promise.all(names.map(async (name) => {
            const info = await stat(join(this.folder, name));
            return {
                name,
                size: info.size,
                usedAt: info.mtimeMs,
            };
        }));
        const total = files.reduce((sum, file) => sum + file.size, 0);
        if (total <= DISK_BYTES) {
            return;
        }
        const oldestFirst = files.sort((a, b) => a.usedAt - b.usedAt);
        const excess = total - DISK_BYTES * PRUNE_TO;
        const victims = this.firstFilesOver(oldestFirst, excess);
        await Promise.all(victims.map((file) => unlink(join(this.folder, file.name))));
    }

    // The first files in the list that together hold at least `bytes`.
    private firstFilesOver<T extends { size: number }>(files: T[], bytes: number): T[] {
        const empty = {
            files: [] as T[],
            bytes: 0,
        };
        const picked = files.reduce((chosen, file) => {
            if (chosen.bytes >= bytes) {
                return chosen;
            }
            return {
                files: [...chosen.files, file],
                bytes: chosen.bytes + file.size,
            };
        }, empty);
        return picked.files;
    }

    // The newest use goes to the end. The first entry is the oldest.
    private remember(key: string, image: PlexImage): void {
        this.memory.delete(key);
        this.memory.set(key, image);
        if (this.memory.size > MEMORY_ENTRIES) {
            const oldest = this.memory.keys().next().value ?? '';
            this.memory.delete(oldest);
        }
    }

    private typeOf(bytes: Uint8Array): string {
        const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
        const isWebp = bytes[8] === 0x57 && bytes[9] === 0x45;
        if (isPng) {
            return 'image/png';
        }
        return isWebp ? 'image/webp' : 'image/jpeg';
    }

    // A plain card with the title, in the colours of the app.
    private titleCard(title: string): PlexImage {
        const lines = this.wrap(title, 14).slice(0, 5);
        const top = 225 - (lines.length - 1) * 17;
        const text = lines
            .map((line, index) => `<tspan x="150" y="${top + index * 34}">${this.escapeXml(line)}</tspan>`)
            .join('');
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 450" width="300" height="450">`
            + `<rect width="300" height="450" fill="#1c2228"/>`
            + `<rect x="12" y="12" width="276" height="426" fill="none" stroke="#e3b04b" stroke-opacity="0.5"/>`
            + `<text font-family="Georgia, serif" font-size="28" fill="#c9d1d9" text-anchor="middle">${text}</text>`
            + `</svg>`;
        return {
            ok: true,
            status: 200,
            contentType: 'image/svg+xml',
            bytes: new TextEncoder().encode(svg),
        };
    }

    // Splits a title into lines of about `width` characters, at spaces.
    private wrap(title: string, width: number): string[] {
        const words = title.split(/\s+/).filter(Boolean);
        return words.reduce<string[]>((lines, word) => {
            const last = lines[lines.length - 1];
            const fits = last !== undefined && `${last} ${word}`.length <= width;
            if (fits) {
                lines[lines.length - 1] = `${last} ${word}`;
            } else {
                lines.push(word);
            }
            return lines;
        }, []);
    }

    private escapeXml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

}
