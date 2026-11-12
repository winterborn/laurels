import { readFile } from 'node:fs/promises';
import {
    createServer,
    type IncomingMessage,
    type Server as HttpServer,
    type ServerResponse,
} from 'node:http';
import {
    extname,
    join,
    normalize,
} from 'node:path';
import type { App } from '../App.ts';
import { AuthService } from '../auth/index.ts';
import type { Role } from '../model/index.ts';
import {
    BoxOfficeReport,
    type Range,
    RecapReport,
    TrophyReport,
} from '../reports/index.ts';
import { ApiData } from './ApiData.ts';
import { AuthRoutes } from './AuthRoutes.ts';
import {
    type PictureKind,
    PosterCache,
} from './PosterCache.ts';
import {
    type RouteResult,
    SettingsRoutes,
} from './SettingsRoutes.ts';

const CONTENT_TYPES: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
};

// none: anyone. viewer: signed in, or a home-network guest. owner: settings.
type Need = 'none' | 'viewer' | 'owner';

const LATEST_LIMIT = 8;
const MAX_BODY_BYTES = 64 * 1024;

export class Server {

    private readonly app: App;
    private readonly data: ApiData;
    private readonly posters: PosterCache;
    private readonly settings: SettingsRoutes;
    private readonly auth: AuthService;
    private readonly authRoutes: AuthRoutes;
    private readonly trophyReport: TrophyReport;
    private readonly boxOffice: BoxOfficeReport;
    private readonly recap: RecapReport;
    private httpServer: HttpServer | null = null;

    constructor(app: App) {
        this.app = app;
        this.data = new ApiData(app);
        this.posters = new PosterCache(app);
        this.settings = new SettingsRoutes(app);
        this.auth = new AuthService(app);
        this.authRoutes = new AuthRoutes(app, this.auth);
        this.trophyReport = new TrophyReport(app);
        this.boxOffice = new BoxOfficeReport(app);
        this.recap = new RecapReport(app);
    }

    // Resolves to the port it listens on (useful with port 0 in tests).
    listen(port: number): Promise<number> {
        const server = createServer((request, response) => {
            this.handle(request, response).catch((error) => {
                console.error('Request failed:', error);
                this.sendJson(response, 500, { error: 'Laurels had an error. Look at the container log for details.' });
            });
        });
        this.httpServer = server;
        return new Promise((resolve) => {
            server.listen(port, () => {
                const address = server.address();
                resolve(typeof address === 'object' && address ? address.port : port);
            });
        });
    }

    close(): void {
        this.httpServer?.closeAllConnections();
        this.httpServer?.close();
    }

    private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
        const url = new URL(request.url ?? '/', 'http://localhost');
        const path = url.pathname;
        const role = this.auth.accessFor(request).role;
        const need = this.needFor(path);
        if (!this.allows(role, need)) {
            this.refuse(response, role);
            return;
        }
        const isPost = request.method === 'POST';
        const isJson = (request.headers['content-type'] ?? '').startsWith('application/json');
        if (isPost && !isJson) {
            this.sendJson(response, 415, { error: 'Send JSON' });
            return;
        }
        if (path.startsWith('/api/auth/')) {
            await this.handleAuth(path, request, response);
            return;
        }
        switch (request.method) {
            case 'GET':
                await this.handleGet(url, response);
                return;
            case 'POST':
                await this.handlePost(path, request, response);
                return;
            default:
                this.sendJson(response, 405, { error: 'Use GET or POST' });
        }
    }

    // The signed-in person's account id. With sign-in off, the owner (1).
    private ownAccount(request: IncomingMessage): string {
        return this.auth.accessFor(request).accountId || '1';
    }

    private refuse(response: ServerResponse, role: Role | null): void {
        if (role) {
            this.sendJson(response, 403, { error: 'Only the server owner can do this.' });
        } else {
            this.sendJson(response, 401, { error: 'Sign in with Plex first.' });
        }
    }

    private needFor(path: string): Need {
        const isApi = path.startsWith('/api/');
        const isOpen = !isApi || path.startsWith('/api/auth/');
        if (isOpen) {
            return 'none';
        }
        const isOwnerOnly = path.startsWith('/api/settings') || path.startsWith('/api/plex/');
        return isOwnerOnly ? 'owner' : 'viewer';
    }

    private allows(role: Role | null, need: Need): boolean {
        switch (need) {
            case 'none':
                return true;
            case 'viewer':
                return role !== null;
            case 'owner':
                return role === 'owner';
        }
    }

    // GET me, POST sign-in, GET sign-in/:id, POST sign-out.
    private async handleAuth(
        path: string,
        request: IncomingMessage,
        response: ServerResponse,
    ): Promise<void> {
        const parts = path.split('/').filter(Boolean);
        const action = `${request.method} ${parts[2] ?? ''}`;
        switch (action) {
            case 'GET me':
                this.sendResult(response, this.authRoutes.me(request));
                return;
            case 'POST sign-in':
                this.sendResult(response, await this.authRoutes.startSignIn());
                return;
            case 'GET sign-in':
                this.sendResult(response, await this.authRoutes.finishSignIn(parts[3] ?? '', request, response));
                return;
            case 'POST sign-out':
                this.sendResult(response, this.authRoutes.signOut(request, response));
                return;
            default:
                this.sendJson(response, 404, { error: 'Laurels cannot find this page.' });
        }
    }

    private async handleGet(url: URL, response: ServerResponse): Promise<void> {
        const path = url.pathname;
        const isApi = path.startsWith('/api/') || path === '/health';
        if (isApi) {
            await this.handleApi(url, response);
        } else {
            await this.sendStatic(path, response);
        }
    }

    private async handleApi(url: URL, response: ServerResponse): Promise<void> {
        const parts = url.pathname.split('/').filter(Boolean);
        const userId = url.searchParams.get('user') ?? undefined;
        const route = parts.slice(0, 2).join('/');
        switch (route) {
            case 'health':
                this.sendJson(response, 200, { ok: true });
                return;
            case 'api/status':
                this.sendJson(response, 200, this.settings.status());
                return;
            case 'api/settings':
                this.sendJson(response, 200, this.settings.settings());
                return;
            case 'api/plex':
                await this.handlePlexGet(parts, response);
                return;
            case 'api/definitions':
                this.sendJson(response, 200, this.data.definitions());
                return;
            case 'api/users':
                this.sendUsers(parts[2], response);
                return;
            case 'api/awards':
                this.sendJson(response, 200, this.data.awards(userId));
                return;
            case 'api/progress':
                this.sendJson(response, 200, this.data.progress(userId));
                return;
            case 'api/award':
                this.sendReport(response, this.trophyReport.build(parts[2] ?? '', userId ?? ''));
                return;
            case 'api/ceremony':
                this.sendJson(response, 200, this.boxOffice.build(this.rangeOf(url)));
                return;
            case 'api/season':
                this.sendReport(response, this.recap.build(parts[2] ?? '', url.searchParams.get('year') ?? undefined));
                return;
            case 'api/premieres':
                this.sendJson(response, 200, this.data.premieres(userId ?? '', Number(url.searchParams.get('since') ?? '0')));
                return;
            case 'api/latest':
                this.sendJson(response, 200, this.data.latest(LATEST_LIMIT));
                return;
            case 'api/poster':
                await this.sendPoster(parts[2] ?? '', 'poster', response);
                return;
            case 'api/art':
                await this.sendPoster(parts[2] ?? '', 'art', response);
                return;
            default:
                this.sendJson(response, 404, { error: 'Laurels cannot find this page.' });
        }
    }

    // /api/plex/servers
    private async handlePlexGet(parts: string[], response: ServerResponse): Promise<void> {
        if (parts[2] !== 'servers') {
            this.sendJson(response, 404, { error: 'Laurels cannot find this page.' });
            return;
        }
        this.sendResult(response, await this.settings.servers());
    }

    // JSON only (checked in handle): a plain cross-site form cannot send it.
    private async handlePost(
        path: string,
        request: IncomingMessage,
        response: ServerResponse,
    ): Promise<void> {
        const body = await this.readBody(request);
        switch (path) {
            case '/api/settings':
                this.sendResult(response, this.settings.save(body));
                return;
            case '/api/settings/test-plex':
                this.sendResult(response, await this.settings.testPlex(body));
                return;
            case '/api/settings/test-tautulli':
                this.sendResult(response, await this.settings.testTautulli(body));
                return;
            case '/api/settings/test-discord':
                this.sendResult(response, await this.settings.testDiscord(body));
                return;
            case '/api/settings/check-now':
                this.sendResult(response, await this.settings.checkNow());
                return;
            case '/api/settings/demo-watch':
                this.sendResult(response, await this.settings.demoWatch(this.ownAccount(request)));
                return;
            default:
                this.sendJson(response, 404, { error: 'Laurels cannot find this page.' });
        }
    }

    private async readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
        const chunks: Buffer[] = [];
        for await (const chunk of request) {
            chunks.push(chunk as Buffer);
            const size = chunks.reduce((sum, part) => sum + part.length, 0);
            if (size > MAX_BODY_BYTES) {
                throw new Error('Request body too large');
            }
        }
        const text = Buffer.concat(chunks).toString('utf8');
        if (!text) {
            return {};
        }
        return JSON.parse(text);
    }

    // /api/users or /api/users/:id
    private sendUsers(userId: string | undefined, response: ServerResponse): void {
        if (!userId) {
            this.sendJson(response, 200, this.data.users());
            return;
        }
        const cabinet = this.data.cabinet(userId);
        if (!cabinet) {
            this.sendJson(response, 404, { error: 'Laurels does not know this person.' });
            return;
        }
        this.sendJson(response, 200, cabinet);
    }

    private async sendPoster(
        ratingKey: string,
        kind: PictureKind,
        response: ServerResponse,
    ): Promise<void> {
        const poster = await this.posters.get(ratingKey, kind);
        if (!poster) {
            this.sendJson(response, 404, { error: 'No poster' });
            return;
        }
        // A title card is short-lived: Plex may have the poster later.
        const isTitleCard = poster.contentType === 'image/svg+xml';
        response.writeHead(200, {
            'Content-Type': poster.contentType,
            'Cache-Control': isTitleCard ? 'public, max-age=3600' : 'public, max-age=86400',
        });
        response.end(poster.bytes);
    }

    private async sendStatic(path: string, response: ServerResponse): Promise<void> {
        const file = path === '/' ? '/index.html' : path;
        const safePath = normalize(file).replace(/^(\.\.[/\\])+/, '');
        const fullPath = join(this.app.config.publicDir, safePath);
        try {
            const body = await readFile(fullPath);
            const type = CONTENT_TYPES[extname(fullPath)] ?? 'application/octet-stream';
            response.writeHead(200, {
                'Content-Type': type,
                'Cache-Control': 'no-cache',
            });
            response.end(body);
        } catch {
            this.sendJson(response, 404, { error: 'Laurels cannot find this page.' });
        }
    }

    private rangeOf(url: URL): Range {
        const range = url.searchParams.get('range');
        const isKnown = range === 'year' || range === 'month';
        return isKnown ? range : 'all';
    }

    private sendReport(response: ServerResponse, report: unknown): void {
        if (!report) {
            this.sendJson(response, 404, { error: 'Laurels cannot find this page.' });
            return;
        }
        this.sendJson(response, 200, report);
    }

    private sendResult(response: ServerResponse, result: RouteResult): void {
        this.sendJson(response, result.status, result.body);
    }

    private sendJson(response: ServerResponse, status: number, body: unknown): void {
        response.writeHead(status, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
        });
        response.end(JSON.stringify(body));
    }

}
