import { readFile } from 'node:fs/promises';
import {
    createServer,
    type IncomingMessage,
    type Server,
    type ServerResponse,
} from 'node:http';
import { join } from 'node:path';
import { ACCOUNTS } from './data/shows.ts';
import { MockHistory } from './MockHistory.ts';
import {
    MockLibrary,
    type PlexJson,
} from './MockLibrary.ts';
import {
    MOCK_MACHINE_ID,
    MockPlexTv,
} from './MockPlexTv.ts';
import { PosterPainter } from './PosterPainter.ts';

export const MOCK_TOKEN = 'mock-token';

const POSTER_DIR = join(import.meta.dirname, 'posters');

// Answers the few Plex endpoints Laurels reads. Test use only.
export class MockPlexServer {

    private readonly library = new MockLibrary();
    private readonly history: PlexJson[];
    private readonly painter = new PosterPainter();
    private readonly plexTv: MockPlexTv;

    constructor(serverUri = 'http://localhost:32401') {
        this.history = new MockHistory(this.library).build();
        this.plexTv = new MockPlexTv(serverUri);
    }

    get historySize(): number {
        return this.history.length;
    }

    listen(port: number): Promise<Server> {
        const server = createServer((request, response) => {
            this.handle(request, response).catch((error) => {
                console.error('Mock Plex failed:', error);
                this.sendJson(response, 500, {});
            });
        });
        return new Promise((resolve) => {
            server.listen(port, () => resolve(server));
        });
    }

    private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
        const url = new URL(request.url ?? '/', 'http://localhost');
        if (this.plexTv.handles(url.pathname)) {
            await this.plexTv.handle(request, response, url);
            return;
        }
        if (url.pathname === '/identity') {
            this.sendContainer(response, { machineIdentifier: MOCK_MACHINE_ID });
            return;
        }
        const token = request.headers['x-plex-token'] ?? url.searchParams.get('X-Plex-Token');
        if (token !== MOCK_TOKEN) {
            this.sendJson(response, 401, {});
            return;
        }
        if (request.method === 'POST' && url.pathname === '/mock/watch') {
            await this.addWatch(request, response);
            return;
        }
        await this.route(url, response);
    }

    private async route(url: URL, response: ServerResponse): Promise<void> {
        const path = url.pathname;
        const metadataMatch = path.match(/^\/library\/metadata\/(\d+)(\/children)?$/);
        if (path === '/') {
            this.sendContainer(response, {
                friendlyName: 'Mock Plex',
                version: '1.41.0-mock',
            });
        } else if (path === '/accounts') {
            this.sendContainer(response, { Account: ACCOUNTS });
        } else if (path === '/status/sessions/history/all') {
            this.sendHistory(url, response);
        } else if (path === '/photo/:/transcode') {
            await this.sendPoster(url, response);
        } else if (metadataMatch) {
            this.sendMetadata(metadataMatch[1], Boolean(metadataMatch[2]), response);
        } else {
            this.sendJson(response, 404, {});
        }
    }

    // Demo: one more watch, ending now.
    private async addWatch(request: IncomingMessage, response: ServerResponse): Promise<void> {
        const chunks: Buffer[] = [];
        for await (const chunk of request) {
            chunks.push(chunk as Buffer);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        const item = this.library.get(String(body.ratingKey));
        if (!item) {
            this.sendJson(response, 404, {});
            return;
        }
        const row = this.historyRow(item, Number(body.accountID));
        this.history.push(row);
        this.sendJson(response, 200, row);
    }

    private historyRow(item: PlexJson, accountID: number): PlexJson {
        const isEpisode = item.type === 'episode';
        return {
            historyKey: `/status/sessions/history/${this.history.length + 1}`,
            ratingKey: item.ratingKey,
            key: `/library/metadata/${item.ratingKey}`,
            parentKey: isEpisode ? `/library/metadata/${item.parentRatingKey}` : undefined,
            grandparentKey: isEpisode ? `/library/metadata/${item.grandparentRatingKey}` : undefined,
            title: item.title,
            grandparentTitle: item.grandparentTitle,
            type: item.type,
            index: item.index,
            parentIndex: item.parentIndex,
            thumb: item.thumb,
            viewedAt: Math.floor(Date.now() / 1000),
            accountID,
            deviceID: 1,
        };
    }

    private sendHistory(url: URL, response: ServerResponse): void {
        const params = url.searchParams;
        const since = Number(params.get('viewedAt>') ?? '0');
        const account = params.get('accountID');
        const isDescending = params.get('sort') === 'viewedAt:desc';
        const matching = this.history
            .filter((row) => row.viewedAt > since)
            .filter((row) => !account || String(row.accountID) === account);
        const ordered = isDescending ? [...matching].reverse() : matching;
        const start = Number(params.get('X-Plex-Container-Start') ?? '0');
        const size = Number(params.get('X-Plex-Container-Size') ?? '100');
        this.sendContainer(response, {
            totalSize: ordered.length,
            Metadata: ordered.slice(start, start + size),
        });
    }

    private sendMetadata(ratingKey: string, wantsChildren: boolean, response: ServerResponse): void {
        const item = this.library.get(ratingKey);
        if (!item) {
            this.sendJson(response, 404, {});
            return;
        }
        const list = wantsChildren ? this.library.children(ratingKey) : [item];
        this.sendContainer(response, { Metadata: list });
    }

    // url=/library/metadata/101/thumb/1
    private async sendPoster(url: URL, response: ServerResponse): Promise<void> {
        const thumb = url.searchParams.get('url') ?? '';
        const ratingKey = thumb.split('/')[3] ?? '';
        const source = this.library.posterOf(ratingKey);
        if (!source) {
            this.sendJson(response, 404, {});
            return;
        }
        if (source.file) {
            const bytes = await readFile(join(POSTER_DIR, source.file));
            this.sendImage(response, this.typeOf(source.file), bytes);
            return;
        }
        this.sendImage(response, 'image/svg+xml', this.painter.paint(source));
    }

    private typeOf(file: string): string {
        if (file.endsWith('.svg')) {
            return 'image/svg+xml';
        }
        if (file.endsWith('.png')) {
            return 'image/png';
        }
        return 'image/jpeg';
    }

    private sendImage(response: ServerResponse, type: string, body: string | Uint8Array): void {
        response.writeHead(200, {
            'Content-Type': type,
        });
        response.end(body);
    }

    private sendContainer(response: ServerResponse, fields: PlexJson): void {
        const list = fields.Metadata ?? fields.Account ?? [];
        this.sendJson(response, 200, {
            MediaContainer: {
                size: list.length,
                ...fields,
            },
        });
    }

    private sendJson(response: ServerResponse, status: number, body: unknown): void {
        response.writeHead(status, {
            'Content-Type': 'application/json',
        });
        response.end(JSON.stringify(body));
    }

}
