export type PlexItem = Record<string, any>;

export interface JsonResult {
    status: number;
    data: PlexItem | null;
}

export interface ImageResult {
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

    async fetchJson(
        path: string,
        params: Record<string, string> = {},
    ): Promise<JsonResult> {
        const response = await this.request(path, params, 'application/json');
        if (!response.ok) {
            return {
                status: response.status,
                data: null,
            };
        }
        const body = await response.json();
        return {
            status: response.status,
            data: body.MediaContainer ?? body,
        };
    }

    async getJson(
        path: string,
        params: Record<string, string> = {},
    ): Promise<PlexItem> {
        const result = await this.fetchJson(path, params);
        if (!result.data) {
            throw new Error(`Plex returned ${result.status} for ${path}`);
        }
        return result.data;
    }

    async getPage(
        path: string,
        params: Record<string, string>,
        start: number,
        size: number,
    ): Promise<PlexItem[]> {
        const container = await this.getJson(path, {
            ...params,
            'X-Plex-Container-Start': String(start),
            'X-Plex-Container-Size': String(size),
        });
        return container.Metadata ?? container.Directory ?? [];
    }

    async getAllPages(
        path: string,
        params: Record<string, string>,
        pageSize: number,
    ): Promise<PlexItem[]> {
        const items: PlexItem[] = [];
        while (items.length < MAX_ROWS) {
            const page = await this.getPage(path, params, items.length, pageSize);
            for (const item of page) {
                items.push(item);
            }
            const isLastPage = page.length < pageSize;
            const ignoredPaging = page.length > pageSize;
            if (isLastPage || ignoredPaging) {
                return items;
            }
        }
        return items;
    }

    async getTotal(
        path: string,
        params: Record<string, string> = {},
    ): Promise<number | null> {
        const container = await this.getJson(path, {
            ...params,
            'X-Plex-Container-Start': '0',
            'X-Plex-Container-Size': '1',
        });
        const total = container.totalSize;
        if (total === undefined) {
            return null;
        }
        return Number(total);
    }

    async getImage(
        path: string,
        width: number,
        height: number,
    ): Promise<ImageResult> {
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
            contentType: response.headers.get('content-type') ?? '',
            bytes: new Uint8Array(buffer),
        };
    }

    // Holds the token: use it to connect, never print or save it.
    websocketUrl(): string {
        const url = new URL(this.baseUrl + '/:/websockets/notifications');
        const isSecure = url.protocol === 'https:';
        url.protocol = isSecure ? 'wss:' : 'ws:';
        url.searchParams.set('X-Plex-Token', this.token);
        return url.toString();
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

    private headers(accept: string): Record<string, string> {
        return {
            'Accept': accept,
            'X-Plex-Token': this.token,
            'X-Plex-Client-Identifier': 'laurels-spike',
            'X-Plex-Product': 'Laurels spike',
        };
    }

}
