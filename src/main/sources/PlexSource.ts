import { chunksOf } from '../helpers/index.ts';
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
// Raise this when PlexMapper keeps history rows that it skipped before.
// The next sync then reads all the history again.
const HISTORY_VERSION = '2';
const HISTORY_VERSION_KEY = 'plex.historyVersion';
// Metadata requests sent to Plex at the same time.
const METADATA_BATCH = 4;
// Items saved in one transaction.
const SAVE_BATCH = 100;

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
        const cursor = this.historyCursor();
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
        this.store.setState(HISTORY_VERSION_KEY, HISTORY_VERSION);
        return added;
    }

    private historyCursor(): string {
        const isCurrent = this.store.getState(HISTORY_VERSION_KEY) === HISTORY_VERSION;
        if (!isCurrent) {
            return '0';
        }
        return this.store.getState(CURSOR) ?? '0';
    }

    // Keeps a title for media that Plex may delete before we fetch it.
    private saveStubs(rows: PlexJson[]): void {
        const known = this.store.items();
        this.store.transaction(() => {
            for (const row of rows) {
                const event = this.mapper.event(row);
                if (event) {
                    this.saveStub(row, event, known);
                }
            }
        });
    }

    private saveStub(row: PlexJson, event: WatchEvent, known: Map<string, Item>): void {
        const items = this.isGone(event)
            ? this.removedItems(row, event)
            : [this.mapper.stub(row, event.ratingKey)];
        for (const item of items) {
            if (!known.has(item.ratingKey)) {
                this.store.saveItem(item);
                known.set(item.ratingKey, item);
            }
        }
    }

    private isGone(event: WatchEvent): boolean {
        return this.mapper.isGone(event.ratingKey);
    }

    // A removed watch, and its removed show if it is an episode.
    private removedItems(row: PlexJson, event: WatchEvent): Item[] {
        const watched = this.mapper.removed(row, event.ratingKey, event.showKey);
        const showKey = event.showKey;
        const hasRemovedShow = showKey !== undefined && this.mapper.isGone(showKey);
        if (!hasRemovedShow) {
            return [watched];
        }
        return [
            watched,
            this.mapper.removedShow(row, showKey),
        ];
    }

    private async syncMetadata(): Promise<number> {
        const items = this.store.items();
        const events = [...this.store.events(), ...this.store.partialPlays()];
        const wanted = this.wantedKeys(events, items);
        for (const group of chunksOf(wanted, SAVE_BATCH)) {
            const fetched = await this.fetchAll(group, items);
            this.store.transaction(() => fetched.forEach((item) => this.store.saveItem(item)));
        }
        return wanted.length;
    }

    // METADATA_BATCH requests at a time.
    private async fetchAll(keys: string[], items: Map<string, Item>): Promise<Item[]> {
        const fetched: Item[] = [];
        for (const batch of chunksOf(keys, METADATA_BATCH)) {
            const results = await Promise.all(batch.map((key) => this.fetchItem(key, items.get(key))));
            fetched.push(...results);
        }
        return fetched;
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

    // The item from Plex, or the known item marked as removed from Plex.
    private async fetchItem(ratingKey: string, known: Item | undefined): Promise<Item> {
        const container = await this.client.getJson(`/library/metadata/${ratingKey}`);
        const row = container?.Metadata?.[0];
        const item = row ? this.mapper.item(row) : null;
        if (item) {
            return item;
        }
        const thin = known ?? this.mapper.missing(ratingKey);
        return {
            ...thin,
            stub: false,
            missing: true,
        };
    }

}
