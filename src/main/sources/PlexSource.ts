import type {
    Item,
    WatchEvent,
} from '../model/index.ts';
import type { Store } from '../store/index.ts';
import type {
    PlexClient,
    PlexJson,
} from './PlexClient.ts';
import {
    META_VERSION,
    PlexMapper,
} from './PlexMapper.ts';

export interface SyncReport {
    users: number;
    newEvents: number;
    newItems: number;
}

const HISTORY_PAGE = 500;
const CURSOR = 'plex.viewedAt';

export class PlexSource {

    private readonly client: PlexClient;
    private readonly store: Store;
    private readonly mapper = new PlexMapper();

    constructor(client: PlexClient, store: Store) {
        this.client = client;
        this.store = store;
    }

    async sync(): Promise<SyncReport> {
        const users = await this.syncUsers();
        const newEvents = await this.syncHistory();
        const newItems = await this.syncMetadata();
        return {
            users,
            newEvents,
            newItems,
        };
    }

    private async syncUsers(): Promise<number> {
        const container = await this.client.getJson('/accounts');
        const rows: PlexJson[] = container?.Account ?? [];
        const users = rows
            .map((row) => this.mapper.user(row))
            .filter((user) => user !== null);
        for (const user of users) {
            this.store.saveUser(user);
        }
        return users.length;
    }

    // First run reads everything. Later runs read from the last viewedAt.
    private async syncHistory(): Promise<number> {
        const cursor = this.store.getState(CURSOR) ?? '0';
        const rows = await this.client.getAllPages('/status/sessions/history/all', {
            'sort': 'viewedAt:asc',
            'viewedAt>': cursor,
        }, HISTORY_PAGE);
        const events = rows
            .map((row) => this.mapper.event(row))
            .filter((event) => event !== null);
        this.saveStubs(rows);
        const added = this.store.saveEvents(events);
        const latest = events.reduce((most, event) => Math.max(most, event.watchedAt), Number(cursor));
        this.store.setState(CURSOR, String(latest));
        return added;
    }

    // Keeps a title for media that Plex may delete before we fetch it.
    private saveStubs(rows: PlexJson[]): void {
        const known = this.store.items();
        for (const row of rows) {
            const event = this.mapper.event(row);
            const isKnown = !event || known.has(event.ratingKey);
            if (isKnown) {
                continue;
            }
            const stub = this.mapper.stub(row, event.ratingKey);
            this.store.saveItem(stub);
            known.set(stub.ratingKey, stub);
        }
    }

    private async syncMetadata(): Promise<number> {
        const items = this.store.items();
        const wanted = this.wantedKeys(this.store.events(), items);
        for (const ratingKey of wanted) {
            await this.fetchItem(ratingKey, items.get(ratingKey));
        }
        return wanted.length;
    }

    private wantedKeys(events: WatchEvent[], items: Map<string, Item>): string[] {
        const keys = new Set<string>();
        for (const event of events) {
            keys.add(event.ratingKey);
            this.addIfPresent(keys, event.showKey);
            this.addIfPresent(keys, event.seasonKey);
        }
        return [...keys].filter((key) => this.needsFetch(items.get(key)));
    }

    // New, still a stub, or read by an older version of PlexMapper.
    private needsFetch(item: Item | undefined): boolean {
        if (!item || item.stub) {
            return true;
        }
        const isOld = (item.metaVersion ?? 1) < META_VERSION;
        return isOld && !item.missing;
    }

    private addIfPresent(keys: Set<string>, key: string | undefined): void {
        if (key) {
            keys.add(key);
        }
    }

    private async fetchItem(ratingKey: string, known: Item | undefined): Promise<void> {
        const container = await this.client.getJson(`/library/metadata/${ratingKey}`);
        const row = container?.Metadata?.[0];
        const item = row ? this.mapper.item(row) : null;
        if (item) {
            this.store.saveItem(item);
        } else {
            const thin = known ?? this.mapper.missing(ratingKey);
            this.store.saveItem({
                ...thin,
                stub: false,
                missing: true,
            });
        }
    }

}
