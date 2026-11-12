import { randomBytes } from 'node:crypto';
import type {
    IncomingMessage,
    ServerResponse,
} from 'node:http';
import type { PlexJson } from './MockLibrary.ts';

interface MockAccount {
    id: number;
    name: string;
    token: string;
    // owner, member (shared), or none (no access)
    access: 'owner' | 'member' | 'none';
}

interface MockPin {
    code: string;
    token: string | null;
}

export const MOCK_MACHINE_ID = 'mock-machine';

const ACCOUNTS: MockAccount[] = [
    {
        id: 1,
        name: 'Alex',
        token: 'mock-token',
        access: 'owner',
    },
    {
        id: 2,
        name: 'Sam',
        token: 'mock-token-sam',
        access: 'member',
    },
    {
        id: 99,
        name: 'Stranger',
        token: 'mock-token-stranger',
        access: 'none',
    },
];

// A tiny plex.tv: PIN sign-in, user lookup and server list. Test use only.
export class MockPlexTv {

    private readonly pins = new Map<number, MockPin>();
    private readonly serverUri: string;
    private nextPinId = 1000;

    constructor(serverUri: string) {
        this.serverUri = serverUri;
    }

    handles(path: string): boolean {
        const isApi = path.startsWith('/api/v2/');
        const isAuthPage = path === '/auth' || path === '/mock-auth';
        return isApi || isAuthPage;
    }

    async handle(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
        const token = String(request.headers['x-plex-token'] ?? '');
        const route = `${request.method} ${url.pathname.replace(/\/\d+$/, '/:id')}`;
        switch (route) {
            case 'POST /api/v2/pins':
                this.json(response, 201, this.createPin());
                return;
            case 'GET /api/v2/pins/:id':
                this.json(response, 200, this.pinStatus(url.pathname));
                return;
            case 'GET /api/v2/user':
                this.sendUser(response, token);
                return;
            case 'GET /api/v2/resources':
                this.json(response, 200, this.resourcesFor(token));
                return;
            case 'GET /auth':
                this.sendAuthPage(response);
                return;
            case 'POST /mock-auth':
                await this.authorise(request, response);
                return;
            default:
                this.json(response, 404, {});
        }
    }

    private createPin(): PlexJson {
        this.nextPinId += 1;
        const code = randomBytes(4).toString('hex');
        this.pins.set(this.nextPinId, {
            code,
            token: null,
        });
        return {
            id: this.nextPinId,
            code,
        };
    }

    private pinStatus(path: string): PlexJson {
        const id = Number(path.split('/').pop());
        const pin = this.pins.get(id);
        return {
            id,
            code: pin?.code ?? '',
            authToken: pin?.token ?? null,
        };
    }

    private sendUser(response: ServerResponse, token: string): void {
        const account = ACCOUNTS.find((candidate) => candidate.token === token);
        if (!account) {
            this.json(response, 401, {});
            return;
        }
        this.json(response, 200, {
            id: account.id,
            username: account.name.toLowerCase(),
            friendlyName: account.name,
        });
    }

    private resourcesFor(token: string): PlexJson[] {
        const account = ACCOUNTS.find((candidate) => candidate.token === token);
        if (!account || account.access === 'none') {
            return [];
        }
        return [{
            name: 'Mock Plex',
            provides: 'server',
            clientIdentifier: MOCK_MACHINE_ID,
            owned: account.access === 'owner',
            connections: [{
                uri: this.serverUri,
                local: true,
                relay: false,
            }],
        }];
    }

    // The page plex.tv would show. Pick who signs in.
    private sendAuthPage(response: ServerResponse): void {
        const buttons = ACCOUNTS.map((account) => {
            return `<button data-token="${account.token}">Sign in as ${account.name} (${account.access})</button>`;
        });
        response.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
        });
        response.end(`<!doctype html><meta charset="utf-8"><title>Mock Plex sign-in</title>
<body style="font-family: sans-serif; background: #1f1f1f; color: #eee; padding: 32px">
<h1>Mock Plex sign-in</h1><p>Test page. Pick an account.</p>
<div style="display: flex; flex-direction: column; gap: 12px; max-width: 320px">${buttons.join('')}</div>
<p id="done"></p>
<script>
const params = new URLSearchParams(location.hash.slice(2));
const code = params.get('code');
const forwardUrl = params.get('forwardUrl');
for (const button of document.querySelectorAll('button')) {
    button.addEventListener('click', async () => {
        await fetch('/mock-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, token: button.dataset.token }),
        });
        document.getElementById('done').textContent = 'Signed in. You can close this window.';
        if (forwardUrl) {
            location.href = forwardUrl;
        }
    });
}
</script></body>`);
    }

    private async authorise(request: IncomingMessage, response: ServerResponse): Promise<void> {
        const chunks: Buffer[] = [];
        for await (const chunk of request) {
            chunks.push(chunk as Buffer);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const pin = [...this.pins.values()].find((candidate) => candidate.code === body.code);
        if (pin) {
            pin.token = String(body.token);
        }
        this.json(response, pin ? 200 : 404, {});
    }

    private json(response: ServerResponse, status: number, body: unknown): void {
        response.writeHead(status, {
            'Content-Type': 'application/json',
        });
        response.end(JSON.stringify(body));
    }

}
