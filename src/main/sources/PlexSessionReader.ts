import type {
    SessionInfo,
    WatchKind,
} from '../model/index.ts';
import type {
    PlexClient,
    PlexJson,
} from './PlexClient.ts';

// Reads what Plex is playing now (/status/sessions) and the credits markers of an item.
export class PlexSessionReader {

    private readonly client: PlexClient;

    constructor(client: PlexClient) {
        this.client = client;
    }

    async currentSessions(): Promise<SessionInfo[]> {
        const container = await this.client.getJson('/status/sessions');
        const rows: PlexJson[] = container?.Metadata ?? [];
        return rows
            .map((row) => this.sessionFrom(row))
            .filter((session) => session !== null);
    }

    // The start of the first credits marker, in milliseconds.
    async creditsStart(ratingKey: string): Promise<number | undefined> {
        const container = await this.client.getJson(`/library/metadata/${ratingKey}`, {
            includeMarkers: '1',
        });
        const markers: PlexJson[] = container?.Metadata?.[0]?.Marker ?? [];
        const starts = markers
            .filter((marker) => marker.type === 'credits')
            .map((marker) => Number(marker.startTimeOffset))
            .filter((start) => start > 0);
        return starts.length ? Math.min(...starts) : undefined;
    }

    private sessionFrom(row: PlexJson): SessionInfo | null {
        const kind = row.type as WatchKind;
        const isVideo = kind === 'movie' || kind === 'episode';
        if (!isVideo || !row.sessionKey) {
            return null;
        }
        return {
            sessionKey: String(row.sessionKey),
            ratingKey: String(row.ratingKey ?? ''),
            userId: String(row.User?.id ?? ''),
            kind,
            title: String(row.title ?? ''),
            showTitle: row.grandparentTitle || undefined,
            showKey: this.textOrUndefined(row.grandparentRatingKey),
            seasonKey: this.textOrUndefined(row.parentRatingKey),
            year: this.numberOrUndefined(row.year),
            index: this.numberOrUndefined(row.index),
            seasonIndex: this.numberOrUndefined(row.parentIndex),
            thumb: row.thumb || undefined,
            guid: String(row.guid ?? ''),
            durationMs: Number(row.duration ?? 0),
            viewOffsetMs: Number(row.viewOffset ?? 0),
            state: String(row.Player?.state ?? 'playing'),
            platform: row.Player?.platform || undefined,
            isLive: String(row.live ?? '') === '1',
        };
    }

    private textOrUndefined(value: unknown): string | undefined {
        return value ? String(value) : undefined;
    }

    private numberOrUndefined(value: unknown): number | undefined {
        const number = Number(value);
        const isEmpty = value === undefined || value === null || value === '';
        if (isEmpty || Number.isNaN(number)) {
            return undefined;
        }
        return number;
    }

}
