// Talks to the Tautulli API v2. The API key goes in the query, as Tautulli needs it,
// so this client never logs a URL.
export type TautulliJson = Record<string, any>;

export interface TautulliPage {
    rows: TautulliJson[];
    total: number;
}

export class TautulliClient {

    private readonly baseUrl: string;
    private readonly apiKey: string;
    // Requests sent so far. The sync log shows it.
    requestCount = 0;

    constructor(baseUrl: string, apiKey: string) {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
        this.apiKey = apiKey;
    }

    // One page of grouped history: one row for each play, with resumed parts joined.
    // include_activity 0: no play that is still running.
    async history(after: string, start: number, length: number): Promise<TautulliPage> {
        const data = await this.call('get_history', {
            grouping: '1',
            include_activity: '0',
            order_column: 'started',
            order_dir: 'asc',
            after,
            start: String(start),
            length: String(length),
        });
        return {
            rows: Array.isArray(data?.data) ? data.data : [],
            total: Number(data?.recordsFiltered ?? 0),
        };
    }

    async users(): Promise<TautulliJson[]> {
        const data = await this.call('get_users', {});
        return Array.isArray(data) ? data : [];
    }

    // Checks the address and the key. Throws with a plain reason.
    async serverName(): Promise<string> {
        const data = await this.call('get_server_friendly_name', {});
        return String(data ?? 'Tautulli');
    }

    private async call(cmd: string, params: Record<string, string>): Promise<any> {
        const url = new URL(`${this.baseUrl}/api/v2`);
        url.searchParams.set('apikey', this.apiKey);
        url.searchParams.set('cmd', cmd);
        for (const [name, value] of Object.entries(params)) {
            url.searchParams.set(name, value);
        }
        this.requestCount += 1;
        const response = await this.fetchOrThrow(url);
        if (!response.ok) {
            throw new Error(`Tautulli returned ${response.status}. `
                + 'Check the address and the API key.');
        }
        const body = await response.json();
        const result = body?.response;
        if (result?.result !== 'success') {
            const reason = result?.message ?? 'no reason given';
            throw new Error(`Tautulli refused the request: ${reason}. Check the API key.`);
        }
        return result.data;
    }

    private async fetchOrThrow(url: URL): Promise<Response> {
        try {
            return await fetch(url, {
                headers: { Accept: 'application/json' },
                signal: AbortSignal.timeout(60_000),
            });
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            throw new Error(`Cannot reach Tautulli at ${this.baseUrl}: ${reason}. `
                + 'Check the address, and check that Tautulli is running.');
        }
    }

}
