import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import type { WatchEvent } from '../../main/model/index.ts';
import type { TautulliClient } from '../../main/sources/index.ts';
import { TautulliSource } from '../../main/sources/index.ts';
import { Store } from '../../main/store/index.ts';

const folder = mkdtempSync(join(tmpdir(), 'laurels-tautulli-'));

// A grouped history row, as Tautulli's get_history gives it.
function row(fields: Record<string, unknown>) {
    return {
        user_id: 5550001,
        media_type: 'movie',
        live: 0,
        state: null,
        paused_counter: 0,
        watched_status: 1,
        ...fields,
    };
}

const ROWS = [
    // Owner plays film 7 and Plex marks it watched: the Plex watch gets its times.
    row({
        reference_id: 100,
        rating_key: 7,
        title: 'Film 7',
        started: 1000,
        stopped: 8200,
        play_duration: 6600,
        paused_counter: 600,
        platform: 'Roku',
    }),
    // A shared user watches an episode that left the library: matched by title.
    row({
        reference_id: 101,
        user_id: 22,
        rating_key: 55,
        media_type: 'episode',
        title: 'Gone episode',
        started: 20000,
        stopped: 22000,
        play_duration: 2000,
    }),
    // Watched in Tautulli, but not in Plex history: a watch of its own.
    row({
        reference_id: 102,
        rating_key: 8,
        title: 'Film 8',
        started: 30000,
        stopped: 36000,
        play_duration: 6000,
    }),
    // Stopped halfway: time on screen only.
    row({
        reference_id: 103,
        rating_key: 9,
        title: 'Film 9',
        started: 40000,
        stopped: 42000,
        play_duration: 2000,
        watched_status: 0.5,
    }),
    // Live TV and a running play: Laurels skips both.
    row({
        reference_id: 104,
        rating_key: 10,
        live: 1,
        started: 50000,
        stopped: 51000,
    }),
    row({
        reference_id: 105,
        rating_key: 11,
        state: 'playing',
        started: 60000,
        stopped: 0,
    }),
];

const fakeClient = {
    users: async () => [
        {
            user_id: 5550001,
            is_admin: 1,
        },
        {
            user_id: 22,
            is_admin: 0,
        },
    ],
    history: async () => ({
        rows: ROWS,
        total: ROWS.length,
    }),
} as unknown as TautulliClient;

function plexWatch(id: string, userId: string, ratingKey: string, watchedAt: number): WatchEvent {
    return {
        id,
        userId,
        ratingKey,
        kind: ratingKey.startsWith('gone') ? 'episode' : 'movie',
        watchedAt,
        source: 'plex',
    };
}

describe('TautulliSource', () => {

    const store = new Store(join(folder, 'test.db'));
    const source = new TautulliSource(fakeClient, store);

    after(() => {
        store.close();
        rmSync(folder, {
            recursive: true,
            force: true,
        });
    });

    it('aligns watches, times and partial plays to Tautulli', async () => {
        store.saveItem({
            ratingKey: 'gone:9',
            kind: 'episode',
            title: 'Gone episode',
            genres: [],
            directors: [],
            actors: [],
            countries: [],
            collections: [],
            missing: true,
        });
        store.saveEvents([
            plexWatch('plex:1', '1', '7', 7900),
            plexWatch('plex:2', '22', 'gone:9', 21900),
            plexWatch('plex:3', '1', '7', 90000),
        ]);
        await source.sync();
        const watches = new Map(store.events().map((event) => [event.id, event]));
        assert.deepEqual([...watches.keys()].sort(), ['plex:1', 'plex:2', 'plex:3', 'tautulli:102']);
        assert.equal(watches.get('plex:1')?.startedAt, 1000);
        assert.equal(watches.get('plex:1')?.playSeconds, 6600);
        assert.equal(watches.get('plex:1')?.platform, 'Roku');
        assert.equal(watches.get('plex:2')?.startedAt, 20000);
        assert.equal(watches.get('plex:3')?.startedAt, undefined);
        assert.equal(watches.get('tautulli:102')?.watchedAt, 36000);
        const partial = store.partialPlays().map((event) => event.id);
        assert.deepEqual(partial, ['tautulli:103']);
        assert.equal(store.item('8')?.title, 'Film 8');
    });

    it('changes nothing when Tautulli has nothing new', async () => {
        const report = await source.sync();
        assert.equal(report.newPlays, 0);
        assert.equal(report.changedWatches, 0);
    });

    it('lets a late Plex watch replace the watch made from its play', async () => {
        store.saveEvents([plexWatch('plex:4', '1', '8', 35500)]);
        await source.sync();
        const ids = store.events().map((event) => event.id);
        assert.ok(ids.includes('plex:4'));
        assert.ok(!ids.includes('tautulli:102'));
    });

});
