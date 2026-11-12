export type PlexJson = Record<string, any>;

export interface PlexServerInfo {
    name: string;
    version: string;
    accounts: number;
}

export interface PlexImage {
    ok: boolean;
    status: number;
    contentType: string;
    bytes: Uint8Array;
}

// Stops paging if the server ignores X-Plex-Container-Start.
const MAX_ROWS = 2_000_000;

export class PlexClient {

    private readonly baseUrl: string;
    private readonly token: string;

    constructor(baseUrl: string, token: string) {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
        this.token = token;
    }

    // Returns null on 404, throws on other errors.
    async getJson(
        path: string,
        params: Record<string, string> = {},
    ): Promise<PlexJson | null> {
        const response = await this.request(path, params, 'application/json');
        if (response.status === 404) {
            return null;
        }
        if (response.status === 401) {
            throw new Error('Plex refused the token (401). Sign in again or check the token.');
        }
        if (!response.ok) {
            throw new Error(`Plex returned ${response.status} for ${path}. `
                + 'Check the server address, then try again.');
        }
        const body = await response.json();
        return body.MediaContainer ?? body;
    }

    // The server's id on plex.tv. /identity needs no token.
    async machineId(): Promise<string> {
        const identity = await this.getJson('/identity');
        return String(identity?.machineIdentifier ?? '');
    }

    // Checks the URL and the token. Throws with a plain reason.
    async serverInfo(): Promise<PlexServerInfo> {
        const root = await this.getJson('/');
        const accounts = await this.getJson('/accounts');
        return {
            name: root?.friendlyName ?? 'Plex server',
            version: root?.version ?? '',
            accounts: accounts?.Account?.length ?? 0,
        };
    }

    async getAllPages(
        path: string,
        params: Record<string, string>,
        pageSize: number,
    ): Promise<PlexJson[]> {
        const rows: PlexJson[] = [];
        while (rows.length < MAX_ROWS) {
            const page = await this.getPage(path, params, rows.length, pageSize);
            rows.push(...page);
            const isLastPage = page.length < pageSize;
            const ignoredPaging = page.length > pageSize;
            if (isLastPage || ignoredPaging) {
                return rows;
            }
        }
        return rows;
    }

    async getImage(
        path: string,
        width: number,
        height: number,
    ): Promise<PlexImage> {
        const response = await this.request('/photo/:/transcode', {
            url: path,
            width: String(width),
            height: String(height),
            minSize: '1',
            upscale: '1',
        }, 'image/*');
        const buffer = await response.arrayBuffer();
        return {
            ok: response.ok,
            status: response.status,
            contentType: response.headers.get('content-type') ?? 'image/jpeg',
            bytes: new Uint8Array(buffer),
        };
    }

    private async getPage(
        path: string,
        params: Record<string, string>,
        start: number,
        size: number,
    ): Promise<PlexJson[]> {
        const container = await this.getJson(path, {
            ...params,
            'X-Plex-Container-Start': String(start),
            'X-Plex-Container-Size': String(size),
        });
        return container?.Metadata ?? container?.Directory ?? [];
    }

    private async request(
        path: string,
        params: Record<string, string>,
        accept: string,
    ): Promise<Response> {
        const url = new URL(this.baseUrl + path);
        for (const [name, value] of Object.entries(params)) {
            url.searchParams.set(name, value);
        }
        try {
            return await fetch(url, {
                headers: this.headers(accept),
                signal: AbortSignal.timeout(60_000),
            });
        } catch (error) {
            throw new Error(`Cannot reach Plex at ${this.baseUrl}: ${this.reason(error)}`);
        }
    }

    private reason(error: unknown): string {
        const cause = error instanceof Error ? error.cause : undefined;
        const source = cause ?? error;
        return source instanceof Error ? source.message : String(source);
    }

    // The token goes in a header, never in a logged URL.
    private headers(accept: string): Record<string, string> {
        return {
            'Accept': accept,
            'X-Plex-Token': this.token,
            'X-Plex-Client-Identifier': 'laurels',
            'X-Plex-Product': 'Laurels',
        };
    }

}
