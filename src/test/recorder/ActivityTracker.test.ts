import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, beforeEach, describe, it } from 'node:test';
import type { SessionInfo } from '../../main/model/index.ts';
import { ActivityTracker } from '../../main/recorder/index.ts';
import { RecorderSource } from '../../main/sources/index.ts';
import { Store } from '../../main/store/index.ts';

const folder = mkdtempSync(join(tmpdir(), 'laurels-recorder-'));
const DURATION = 6_000_000;

// A fake Plex: the sessions that it plays now, and a clock that the test moves.
const plex = {
    sessions: [] as SessionInfo[],
    credits: undefined as number | undefined,
    time: 0,
};

function session(sessionKey: string, ratingKey: string, viewOffsetMs = 0): SessionInfo {
    return {
        sessionKey,
        ratingKey,
        userId: '1',
        kind: 'movie',
        title: `Film ${ratingKey}`,
        guid: `plex://movie/${ratingKey}`,
        durationMs: DURATION,
        viewOffsetMs,
        state: 'playing',
        platform: 'Roku',
        isLive: false,
    };
}

describe('ActivityTracker', () => {

    const store = new Store(join(folder, 'test.db'));
    const reader = {
        currentSessions: async () => plex.sessions,
        creditsStart: async () => plex.credits,
    };
    const tracker = new ActivityTracker(store, reader, () => plex.time);

    // Sends one websocket event at a time on the fake clock.
    async function event(time: number, state: string, viewOffset: number, ratingKey = '7', sessionKey = '1') {
        plex.time = time;
        await tracker.process({
            sessionKey,
            ratingKey,
            state,
            viewOffset,
        });
    }

    beforeEach(() => {
        plex.sessions = [session('1', '7')];
        plex.credits = undefined;
    });

    after(() => {
        store.close();
        rmSync(folder, {
            recursive: true,
            force: true,
        });
    });

    it('records start, pauses and stop like Tautulli', async () => {
        await event(1000, 'playing', 0);
        await event(1600, 'paused', 600_000);
        await event(1660, 'playing', 600_000);
        await event(7000, 'stopped', DURATION - 5_000);
        const [play] = store.recordedPlays();
        assert.equal(play.started, 1000);
        assert.equal(play.stopped, 7000);
        assert.equal(play.pausedSeconds, 60);
        assert.equal(play.viewOffsetMs, DURATION);
        assert.equal(store.liveSessions().length, 0);
    });

    it('does not keep a play under 120 seconds', async () => {
        const before = store.recordedPlays().length;
        await event(10_000, 'playing', 0, '8', '2');
        await event(10_100, 'stopped', 100_000, '8', '2');
        assert.equal(store.recordedPlays().length, before);
    });

    it('joins a resumed play to the play before it', async () => {
        plex.sessions = [session('3', '9')];
        await event(20_000, 'playing', 0, '9', '3');
        await event(22_000, 'stopped', 2_400_000, '9', '3');
        await event(30_000, 'playing', 2_400_000, '9', '3');
        await event(34_000, 'stopped', 5_800_000, '9', '3');
        const rows = store.lastRecordedPlays('1', '9', 2);
        assert.equal(rows[0].referenceId, rows[1].id);
        await new RecorderSource(store).sync();
        const play = store.plays().find((entry) => entry.id === `recorder:${rows[1].id}`);
        assert.equal(play?.started, 20_000);
        assert.equal(play?.stopped, 34_000);
        assert.equal(play?.playSeconds, 6000);
        assert.equal(play?.watched, true);
    });

    it('starts a new group after a play that was watched', async () => {
        plex.sessions = [session('4', '9')];
        await event(40_000, 'playing', 0, '9', '4');
        await event(46_000, 'stopped', DURATION, '9', '4');
        const [latest] = store.lastRecordedPlays('1', '9', 1);
        assert.equal(latest.referenceId, latest.id);
    });

    it('counts the first credits marker as watched', async () => {
        plex.sessions = [session('5', '10')];
        plex.credits = 4_800_000;
        await event(50_000, 'playing', 0, '10', '5');
        await event(55_000, 'stopped', 4_900_000, '10', '5');
        await new RecorderSource(store).sync();
        const [latest] = store.lastRecordedPlays('1', '10', 1);
        const play = store.plays().find((entry) => entry.id === `recorder:${latest.referenceId}`);
        assert.equal(play?.watched, true);
    });

    it('stops a stale session at its last update', async () => {
        plex.sessions = [session('6', '11')];
        await event(60_000, 'playing', 0, '11', '6');
        await event(60_070, 'playing', 70_000, '11', '6');
        await event(60_140, 'playing', 140_000, '11', '6');
        plex.time = 60_440;
        tracker.stopStale();
        const [latest] = store.lastRecordedPlays('1', '11', 1);
        assert.equal(latest.stopped, 60_140);
    });

    it('stops the old play when a session moves to a new item', async () => {
        plex.sessions = [session('7', '12')];
        await event(70_000, 'playing', 0, '12', '7');
        await event(70_070, 'playing', 70_000, '12', '7');
        await event(70_200, 'playing', 130_000, '12', '7');
        plex.sessions = [session('7', '13')];
        await event(70_300, 'playing', 0, '13', '7');
        const [old] = store.lastRecordedPlays('1', '12', 1);
        assert.equal(old.stopped, 70_200);
        assert.equal(store.liveSession('7')?.ratingKey, '13');
    });

    it('stops saved sessions that Plex no longer plays, on connect', async () => {
        plex.sessions = [];
        plex.time = 80_000;
        await tracker.reconcile();
        assert.equal(store.liveSessions().length, 0);
    });

});
