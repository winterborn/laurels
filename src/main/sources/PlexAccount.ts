import type { PlexJson } from './PlexClient.ts';

export interface PlexPin {
    id: number;
    code: string;
    authUrl: string;
}

export interface ServerConnection {
    uri: string;
    local: boolean;
    relay: boolean;
}

export interface PlexUser {
    id: string;
    name: string;
}

export interface ServerChoice {
    name: string;
    owned: boolean;
    connections: ServerConnection[];
}

export interface PlexTvUrls {
    // Test use only: point at the mock plex.tv.
    api: string;
    auth: string;
}

export const PLEX_TV_URLS: PlexTvUrls = {
    api: 'https://plex.tv',
    auth: 'https://app.plex.tv/auth',
};

// "Sign in with Plex": the PIN flow that Plex apps use.
// The token goes from plex.tv to this server only, never to the browser.
export class PlexAccount {

    private readonly clientId: string;
    private readonly urls: PlexTvUrls;

    constructor(clientId: string, urls: PlexTvUrls = PLEX_TV_URLS) {
        this.clientId = clientId;
        this.urls = urls;
    }

    async createPin(): Promise<PlexPin> {
        const pin = await this.request('/api/v2/pins?strong=true', 'POST');
        const params = new URLSearchParams({
            'clientID': this.clientId,
            'code': pin.code,
            'context[device][product]': 'Laurels',
        });
        return {
            id: pin.id,
            code: pin.code,
            authUrl: `${this.urls.auth}#?${params.toString()}`,
        };
    }

    // Returns the token once the person has signed in, else null.
    async tokenFor(pinId: number): Promise<string | null> {
        const pin = await this.request(`/api/v2/pins/${pinId}`, 'GET');
        return pin.authToken || null;
    }

    async whoAmI(token: string): Promise<PlexUser> {
        const user = await this.request('/api/v2/user', 'GET', token);
        return {
            id: String(user.id),
            name: String(user.friendlyName || user.username || user.title || 'Plex user'),
        };
    }

    // True if this account can open the server with this machine id.
    async canReach(token: string, machineId: string): Promise<boolean> {
        const resources = await this.request('/api/v2/resources', 'GET', token);
        const list: PlexJson[] = Array.isArray(resources) ? resources : [];
        return list.some((resource) => resource.clientIdentifier === machineId);
    }

    // Servers this account can reach, owned ones first.
    async servers(token: string): Promise<ServerChoice[]> {
        const resources = await this.request('/api/v2/resources?includeHttps=1&includeRelay=1', 'GET', token);
        const list: PlexJson[] = Array.isArray(resources) ? resources : [];
        const servers = list
            .filter((resource) => String(resource.provides ?? '').includes('server'))
            .map((resource) => this.choiceFrom(resource));
        return servers.sort((a, b) => Number(b.owned) - Number(a.owned));
    }

    private choiceFrom(resource: PlexJson): ServerChoice {
        const connections: PlexJson[] = resource.connections ?? [];
        const mapped = connections.map((connection) => ({
            uri: String(connection.uri),
            local: Boolean(connection.local),
            relay: Boolean(connection.relay),
        }));
        return {
            name: String(resource.name ?? 'Plex server'),
            owned: Boolean(resource.owned),
            connections: mapped.sort((a, b) => this.connectionRank(a) - this.connectionRank(b)),
        };
    }

    // Local first, relay last.
    private connectionRank(connection: ServerConnection): number {
        if (connection.relay) {
            return 2;
        }
        return connection.local ? 0 : 1;
    }

    private async request(path: string, method: string, token?: string): Promise<PlexJson> {
        const headers: Record<string, string> = {
            'Accept': 'application/json',
            'X-Plex-Product': 'Laurels',
            'X-Plex-Client-Identifier': this.clientId,
        };
        if (token) {
            headers['X-Plex-Token'] = token;
        }
        const response = await fetch(this.urls.api + path, {
            method,
            headers,
            signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
            throw new Error(`plex.tv returned ${response.status}`);
        }
        return response.json();
    }

}
