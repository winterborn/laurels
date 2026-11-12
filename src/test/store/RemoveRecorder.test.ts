import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { Store } from '../../main/store/index.ts';

const folder = mkdtempSync(join(tmpdir(), 'laurels-store-'));
const path = join(folder, 'test.db');

// A database from version bc9e775, with plays from the old session recorder.
function oldDatabase(): void {
    new Store(path).close();
    const db = new DatabaseSync(path);
    db.exec('CREATE TABLE recorded_plays (id INTEGER PRIMARY KEY, json TEXT)');
    db.exec('CREATE TABLE live_sessions (session_key TEXT PRIMARY KEY, json TEXT)');
    const insertEvent = db.prepare(`INSERT INTO events
        (id, user_id, rating_key, kind, watched_at, started_at, play_seconds, source, partial)
        VALUES (?, '1', ?, 'movie', ?, ?, ?, ?, ?)`);
    insertEvent.run('plex:1', '7', 7000, 1000, 6000, 'plex', 0);
    insertEvent.run('plex:2', '8', 9000, 2000, 7000, 'plex', 0);
    insertEvent.run('recorder:5', '9', 20000, 14000, 6000, 'recorder', 0);
    const insertPlay = db.prepare(`INSERT INTO plays
        (id, user_id, json, stopped, play_seconds, watched, event_id)
        VALUES (?, '1', '{}', 0, 0, 1, ?)`);
    insertPlay.run('recorder:4', 'plex:1');
    insertPlay.run('recorder:5', 'recorder:5');
    insertPlay.run('tautulli:9', 'plex:2');
    db.close();
}

describe('Store after the session recorder', () => {

    after(() => rmSync(folder, {
        recursive: true,
        force: true,
    }));

    it('removes the recorder data and keeps Tautulli data', () => {
        oldDatabase();
        const store = new Store(path);
        const events = new Map(store.events().map((event) => [event.id, event]));
        assert.equal(events.has('recorder:5'), false);
        assert.equal(events.get('plex:1')?.startedAt, undefined);
        assert.equal(events.get('plex:2')?.startedAt, 2000);
        assert.deepEqual(store.plays().map((play) => play.eventId), ['plex:2']);
        store.close();
        const db = new DatabaseSync(path);
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
        db.close();
        const names = tables.map((table) => String(table.name));
        assert.equal(names.includes('recorded_plays'), false);
        assert.equal(names.includes('live_sessions'), false);
    });

});
