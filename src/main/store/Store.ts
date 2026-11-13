import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
    Award,
    Item,
    Play,
    Session,
    User,
    WatchEvent,
} from '../model/index.ts';

type Row = Record<string, any>;

interface EventCache {
    watches: WatchEvent[];
    partial: WatchEvent[];
}

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
    source TEXT NOT NULL,
    partial INTEGER NOT NULL DEFAULT 0
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
CREATE TABLE IF NOT EXISTS plays (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    json TEXT NOT NULL,
    stopped INTEGER NOT NULL,
    play_seconds INTEGER NOT NULL,
    watched INTEGER NOT NULL,
    event_id TEXT
);
CREATE TABLE IF NOT EXISTS sync_state (
    name TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
`;

export class Store {

    private readonly db: DatabaseSync;
    // Parsed items and events, read once. A write updates or clears them.
    private itemCache: Map<string, Item> | null = null;
    private eventCache: EventCache | null = null;
    private isInTransaction = false;

    constructor(path: string) {
        mkdirSync(dirname(path), { recursive: true });
        this.db = new DatabaseSync(path);
        this.db.exec('PRAGMA journal_mode = WAL');
        this.db.exec(SCHEMA);
        this.migrate();
    }

    // Columns added after the first release.
    private migrate(): void {
        if (!this.hasColumn('awards', 'granted_at')) {
            this.db.exec('ALTER TABLE awards ADD COLUMN granted_at INTEGER');
            this.db.exec('UPDATE awards SET granted_at = awarded_at');
        }
        if (!this.hasColumn('events', 'partial')) {
            this.db.exec('ALTER TABLE events ADD COLUMN partial INTEGER NOT NULL DEFAULT 0');
        }
        if (this.hasTable('tautulli_plays')) {
            this.movePlays();
        }
        if (this.hasTable('recorded_plays')) {
            this.removeRecorder();
        }
    }

    // Version bc9e775 had a session recorder. Laurels now uses Tautulli only.
    // This removes the recorder's plays and watches, and the times that it gave
    // to Plex watches, so that Tautulli can give them again.
    private removeRecorder(): void {
        this.transaction(() => {
            this.db.exec(`UPDATE events
                SET started_at = NULL, play_seconds = NULL, paused_seconds = NULL, platform = NULL
                WHERE id IN (SELECT event_id FROM plays WHERE id LIKE 'recorder:%')`);
            this.db.exec(`UPDATE plays SET event_id = NULL
                WHERE event_id IN (SELECT event_id FROM plays WHERE id LIKE 'recorder:%')
                AND id NOT LIKE 'recorder:%'`);
            this.db.exec("DELETE FROM events WHERE source = 'recorder'");
            this.db.exec("DELETE FROM plays WHERE id LIKE 'recorder:%'");
            this.db.exec('DROP TABLE recorded_plays');
            this.db.exec('DROP TABLE IF EXISTS live_sessions');
        });
        this.eventCache = null;
    }

    // Version 10eea91 kept Tautulli plays without a source in the id.
    private movePlays(): void {
        const rows = this.db.prepare('SELECT * FROM tautulli_plays').all() as Row[];
        const insert = this.db.prepare(`INSERT OR IGNORE INTO plays
            (id, user_id, json, stopped, play_seconds, watched, event_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)`);
        this.transaction(() => {
            for (const row of rows) {
                const id = `tautulli:${row.id}`;
                const play = {
                    ...JSON.parse(row.json),
                    id,
                };
                insert.run(
                    id,
                    row.user_id,
                    JSON.stringify(play),
                    row.stopped,
                    row.play_seconds,
                    row.watched,
                    row.event_id,
                );
            }
            this.db.exec('DROP TABLE tautulli_plays');
        });
    }

    private hasTable(name: string): boolean {
        const row = this.db
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
            .get(name);
        return row !== undefined;
    }

    private hasColumn(table: string, column: string): boolean {
        const columns = this.db.prepare(`PRAGMA table_info(${table})`).all() as Row[];
        return columns.some((entry) => entry.name === column);
    }

    // Runs `run` in one transaction: one commit for many writes.
    // `run` must not await, so no other write joins the transaction.
    transaction<T>(run: () => T): T {
        if (this.isInTransaction) {
            return run();
        }
        this.db.exec('BEGIN');
        this.isInTransaction = true;
        try {
            const result = run();
            this.db.exec('COMMIT');
            return result;
        } catch (error) {
            this.db.exec('ROLLBACK');
            throw error;
        } finally {
            this.isInTransaction = false;
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

    // Adds new events. A saved event stays as it is. Returns how many were new.
    saveEvents(events: WatchEvent[]): number {
        return this.writeEvents(events, 'INSERT OR IGNORE');
    }

    // Adds events, or replaces saved events with the same id.
    replaceEvents(events: WatchEvent[]): number {
        return this.writeEvents(events, 'INSERT OR REPLACE');
    }

    // A saved watch keeps its times. Only its item key changes.
    saveRatingKeys(events: WatchEvent[]): void {
        const update = this.db.prepare('UPDATE events SET rating_key = ? WHERE id = ? AND rating_key != ?');
        const changes = this.transaction(() => events.map((event) => {
            const result = update.run(event.ratingKey, event.id, event.ratingKey);
            return Number(result.changes);
        }));
        if (changes.some((count) => count > 0)) {
            this.eventCache = null;
        }
    }

    deleteEvent(id: string): void {
        this.db.prepare('DELETE FROM events WHERE id = ?').run(id);
        this.eventCache = null;
    }

    // Watches, oldest first. Partial plays are not watches.
    // The list is shared: callers must not change it.
    events(): WatchEvent[] {
        return this.cachedEvents().watches;
    }

    // Partial plays: they count for time on screen only.
    partialPlays(): WatchEvent[] {
        return this.cachedEvents().partial;
    }

    private writeEvents(events: WatchEvent[], verb: string): number {
        const write = this.db.prepare(`${verb} INTO events
            (id, user_id, rating_key, kind, show_key, season_key, watched_at,
             started_at, play_seconds, paused_seconds, platform, source, partial)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        const changes = this.transaction(() => events.map((event) => {
            const result = write.run(
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
                event.partial ? 1 : 0,
            );
            return Number(result.changes);
        }));
        this.eventCache = null;
        return changes.reduce((sum, change) => sum + change, 0);
    }

    private cachedEvents(): EventCache {
        this.eventCache ??= this.readEvents();
        return this.eventCache;
    }

    private readEvents(): EventCache {
        const rows = this.db.prepare('SELECT * FROM events ORDER BY watched_at').all() as Row[];
        const all = rows.map((row) => this.eventFrom(row));
        return {
            watches: all.filter((event) => !event.partial),
            partial: all.filter((event) => event.partial),
        };
    }

    // Items

    saveItem(item: Item): void {
        this.db
            .prepare(`INSERT INTO items (rating_key, json, fetched_at) VALUES (?, ?, ?)
                ON CONFLICT (rating_key) DO UPDATE SET json = excluded.json, fetched_at = excluded.fetched_at`)
            .run(item.ratingKey, JSON.stringify(item), Math.floor(Date.now() / 1000));
        this.itemCache?.set(item.ratingKey, item);
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

    // Plays (Tautulli)

    // Saves new plays, and plays that changed since the last read
    // (a play grows when someone resumes it). Returns those plays.
    savePlays(plays: Play[]): Play[] {
        const upsert = this.db.prepare(`INSERT INTO plays
            (id, user_id, json, stopped, play_seconds, watched)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET
                json = excluded.json,
                stopped = excluded.stopped,
                play_seconds = excluded.play_seconds,
                watched = excluded.watched
            WHERE plays.stopped != excluded.stopped
                OR plays.play_seconds != excluded.play_seconds
                OR plays.watched != excluded.watched`);
        return this.transaction(() => plays.filter((play) => {
            const result = upsert.run(
                play.id,
                play.userId,
                JSON.stringify(play),
                play.stopped,
                play.playSeconds,
                play.watched ? 1 : 0,
            );
            return Number(result.changes) > 0;
        }));
    }

    plays(): Play[] {
        const rows = this.db.prepare('SELECT json, event_id FROM plays').all() as Row[];
        return rows.map((row) => ({
            ...JSON.parse(row.json),
            eventId: row.event_id ?? undefined,
        }));
    }

    linkPlay(playId: string, eventId: string): void {
        this.db
            .prepare('UPDATE plays SET event_id = ? WHERE id = ?')
            .run(eventId, playId);
    }

    // Gives a watch the start, time on screen and device of a play.
    saveTiming(eventId: string, play: Play): void {
        this.db
            .prepare(`UPDATE events
                SET started_at = ?, play_seconds = ?, paused_seconds = ?, platform = ?
                WHERE id = ?`)
            .run(play.started, play.playSeconds, play.pausedSeconds, play.platform ?? null, eventId);
        this.eventCache = null;
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
        const changes = this.transaction(() => awards.map((award) => {
            const details = [
                award.awardedAt,
                award.eventId,
                award.posterKey,
                award.note,
            ];
            const result = update.run(...details, award.userId, award.achievementId, ...details);
            return Number(result.changes);
        }));
        return changes.reduce((sum, count) => sum + count, 0);
    }

    deleteAwards(awards: Award[]): void {
        const remove = this.db.prepare('DELETE FROM awards WHERE user_id = ? AND achievement_id = ?');
        this.transaction(() => {
            for (const award of awards) {
                remove.run(award.userId, award.achievementId);
            }
        });
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
            partial: row.partial === 1 || undefined,
        };
    }

}
