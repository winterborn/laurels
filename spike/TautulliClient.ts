import type { PlexItem } from './PlexClient.ts';

export class TautulliClient {

    private readonly baseUrl: string;
    private readonly apiKey: string;

    constructor(baseUrl: string, apiKey: string) {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
        this.apiKey = apiKey;
    }

    async call(
        command: string,
        params: Record<string, string> = {},
    ): Promise<PlexItem> {
        const response = await fetch(this.buildUrl(command, params), {
            signal: AbortSignal.timeout(60_000),
        });
        if (!response.ok) {
            throw new Error(`Tautulli returned ${response.status} for ${command}`);
        }
        const body = await response.json();
        const result = body.response ?? {};
        if (result.result !== 'success') {
            throw new Error(`Tautulli ${command}: ${result.message}`);
        }
        return result.data ?? {};
    }

    private buildUrl(
        command: string,
        params: Record<string, string>,
    ): URL {
        const url = new URL(this.baseUrl + '/api/v2');
        url.searchParams.set('apikey', this.apiKey);
        url.searchParams.set('cmd', command);
        for (const [name, value] of Object.entries(params)) {
            url.searchParams.set(name, value);
        }
        return url;
    }

}
