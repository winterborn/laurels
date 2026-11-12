import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
    Award,
    Item,
    Session,
    User,
    WatchEvent,
} from '../model/index.ts';

type Row = Record<string, any>;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    rating_key TEXT NOT NULL,
    kind TEXT NOT NULL,
    show_key TEXT,
    season_key TEXT,
    watched_at INTEGER NOT NULL,
    started_at INTEGER,
    play_seconds INTEGER,
    paused_seconds INTEGER,
    platform TEXT,
    source TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_user ON events (user_id, watched_at);
CREATE TABLE IF NOT EXISTS items (
    rating_key TEXT PRIMARY KEY,
    json TEXT NOT NULL,
    fetched_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    thumb TEXT
);
CREATE TABLE IF NOT EXISTS awards (
    user_id TEXT NOT NULL,
    achievement_id TEXT NOT NULL,
    awarded_at INTEGER NOT NULL,
    event_id TEXT NOT NULL,
    poster_key TEXT NOT NULL,
    note TEXT NOT NULL,
    notified_at INTEGER,
    PRIMARY KEY (user_id, achievement_id)
);
CREATE TABLE IF NOT EXISTS sessions (
    id_hash TEXT PRIMARY KEY,
    plex_user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_state (
    name TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
`;

export class Store {

    private readonly db: DatabaseSync;
    // Parsed items, read once. saveItem clears it.
    private itemCache: Map<string, Item> | null = null;

    constructor(path: string) {
        mkdirSync(dirname(path), { recursive: true });
        this.db = new DatabaseSync(path);
        this.db.exec('PRAGMA journal_mode = WAL');
        this.db.exec(SCHEMA);
        this.migrate();
    }

    // Columns added after the first release.
    private migrate(): void {
        const columns = this.db.prepare('PRAGMA table_info(awards)').all() as Row[];
        const hasGrantedAt = columns.some((column) => column.name === 'granted_at');
        if (!hasGrantedAt) {
            this.db.exec('ALTER TABLE awards ADD COLUMN granted_at INTEGER');
            this.db.exec('UPDATE awards SET granted_at = awarded_at');
        }
    }

    // Users

    saveUser(user: User): void {
        this.db
            .prepare(`INSERT INTO users (id, name, thumb) VALUES (?, ?, ?)
                ON CONFLICT (id) DO UPDATE SET name = excluded.name, thumb = excluded.thumb`)
            .run(user.id, user.name, user.thumb ?? null);
    }

    users(): User[] {
        const rows = this.db.prepare('SELECT * FROM users ORDER BY name').all() as Row[];
        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            thumb: row.thumb ?? undefined,
        }));
    }

    // Events

    saveEvents(events: WatchEvent[]): number {
        const insert = this.db.prepare(`INSERT OR IGNORE INTO events
            (id, user_id, rating_key, kind, show_key, season_key, watched_at,
             started_at, play_seconds, paused_seconds, platform, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        const changes = events.map((event) => {
            const result = insert.run(
                event.id,
                event.userId,
                event.ratingKey,
                event.kind,
                event.showKey ?? null,
                event.seasonKey ?? null,
                event.watchedAt,
                event.startedAt ?? null,
                event.playSeconds ?? null,
                event.pausedSeconds ?? null,
                event.platform ?? null,
                event.source,
            );
            return Number(result.changes);
        });
        return changes.reduce((sum, change) => sum + change, 0);
    }

    events(): WatchEvent[] {
        const rows = this.db.prepare('SELECT * FROM events ORDER BY watched_at').all() as Row[];
        return rows.map((row) => this.eventFrom(row));
    }

    // Items

    saveItem(item: Item): void {
        this.db
            .prepare(`INSERT INTO items (rating_key, json, fetched_at) VALUES (?, ?, ?)
                ON CONFLICT (rating_key) DO UPDATE SET json = excluded.json, fetched_at = excluded.fetched_at`)
            .run(item.ratingKey, JSON.stringify(item), Math.floor(Date.now() / 1000));
        this.itemCache = null;
    }

    // A copy, so a caller cannot change the cache.
    items(): Map<string, Item> {
        this.itemCache ??= this.readItems();
        return new Map(this.itemCache);
    }

    item(ratingKey: string): Item | undefined {
        this.itemCache ??= this.readItems();
        return this.itemCache.get(ratingKey);
    }

    // Awards

    saveAward(award: Award): boolean {
        const result = this.db
            .prepare(`INSERT OR IGNORE INTO awards
                (user_id, achievement_id, awarded_at, event_id, poster_key, note, granted_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)`)
            .run(
                award.userId,
                award.achievementId,
                award.awardedAt,
                award.eventId,
                award.posterKey,
                award.note,
                award.grantedAt ?? Math.floor(Date.now() / 1000),
            );
        return Number(result.changes) > 0;
    }

    markNotified(award: Award, at: number): void {
        this.db
            .prepare('UPDATE awards SET notified_at = ? WHERE user_id = ? AND achievement_id = ?')
            .run(at, award.userId, award.achievementId);
    }

    // Gives saved awards the details in the list. Returns how many changed.
    updateAwards(awards: Award[]): number {
        const update = this.db.prepare(`UPDATE awards
            SET awarded_at = ?, event_id = ?, poster_key = ?, note = ?
            WHERE user_id = ? AND achievement_id = ?
            AND (awarded_at != ? OR event_id != ? OR poster_key != ? OR note != ?)`);
        const changes = awards.map((award) => {
            const details = [
                award.awardedAt,
                award.eventId,
                award.posterKey,
                award.note,
            ];
            const result = update.run(...details, award.userId, award.achievementId, ...details);
            return Number(result.changes);
        });
        return changes.reduce((sum, count) => sum + count, 0);
    }

    awards(): Award[] {
        const rows = this.db.prepare('SELECT * FROM awards ORDER BY awarded_at DESC').all() as Row[];
        return rows.map((row) => ({
            userId: row.user_id,
            achievementId: row.achievement_id,
            awardedAt: row.awarded_at,
            eventId: row.event_id,
            posterKey: row.poster_key,
            note: row.note,
            notifiedAt: row.notified_at ?? undefined,
            grantedAt: row.granted_at ?? row.awarded_at,
        }));
    }

    // Sessions

    saveSession(session: Session): void {
        this.db
            .prepare(`INSERT INTO sessions
                (id_hash, plex_user_id, name, role, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?, ?)`)
            .run(
                session.idHash,
                session.plexUserId,
                session.name,
                session.role,
                session.createdAt,
                session.expiresAt,
            );
    }

    findSession(idHash: string, now: number): Session | null {
        const row = this.db
            .prepare('SELECT * FROM sessions WHERE id_hash = ? AND expires_at > ?')
            .get(idHash, now) as Row | undefined;
        if (!row) {
            return null;
        }
        return {
            idHash: row.id_hash,
            plexUserId: row.plex_user_id,
            name: row.name,
            role: row.role,
            createdAt: row.created_at,
            expiresAt: row.expires_at,
        };
    }

    deleteSession(idHash: string): void {
        this.db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(idHash);
    }

    // Signs everyone out, for example when sign-in is switched on.
    deleteAllSessions(): void {
        this.db.exec('DELETE FROM sessions');
    }

    deleteExpiredSessions(now: number): void {
        this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
    }

    // Sync state

    getState(name: string): string | undefined {
        const row = this.db.prepare('SELECT value FROM sync_state WHERE name = ?').get(name) as Row | undefined;
        return row?.value;
    }

    setState(name: string, value: string): void {
        this.db
            .prepare(`INSERT INTO sync_state (name, value) VALUES (?, ?)
                ON CONFLICT (name) DO UPDATE SET value = excluded.value`)
            .run(name, value);
    }

    close(): void {
        this.db.close();
    }

    private readItems(): Map<string, Item> {
        const rows = this.db.prepare('SELECT json FROM items').all() as Row[];
        const items = rows.map((row) => JSON.parse(row.json) as Item);
        return new Map(items.map((item) => [item.ratingKey, item]));
    }

    private eventFrom(row: Row): WatchEvent {
        return {
            id: row.id,
            userId: row.user_id,
            ratingKey: row.rating_key,
            kind: row.kind,
            showKey: row.show_key ?? undefined,
            seasonKey: row.season_key ?? undefined,
            watchedAt: row.watched_at,
            startedAt: row.started_at ?? undefined,
            playSeconds: row.play_seconds ?? undefined,
            pausedSeconds: row.paused_seconds ?? undefined,
            platform: row.platform ?? undefined,
            source: row.source,
        };
    }

}
