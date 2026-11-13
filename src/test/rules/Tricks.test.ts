import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type {
    Achievement,
    Item,
    WatchEvent,
} from '../../main/model/index.ts';
import {
    type CheckedWatches,
    HouseholdWatches,
    RuleEngine,
    UserHistory,
    WatchCheck,
} from '../../main/rules/index.ts';
import { HistoryBuilder } from './HistoryBuilder.ts';

// Each test is a trick that a person can try. The engine must not give the award.

const engine = new RuleEngine();
const HOUR = 3600;
// 2026-12-01 20:00 UTC.
const EVENING = Date.parse('2026-12-01T20:00:00Z') / 1000;

const catalogue: Achievement[] = JSON.parse(
    readFileSync(new URL('../../../achievements/achievements.json', import.meta.url), 'utf8'),
);

function award(id: string): Achievement {
    return catalogue.find((achievement) => achievement.id === id) as Achievement;
}

function wins(history: UserHistory, id: string, household?: HouseholdWatches): boolean {
    return engine.evaluate(history, award(id), household).earned;
}

function film(ratingKey: string, minutes = 120): Item {
    return {
        ratingKey,
        kind: 'movie',
        title: `Film ${ratingKey}`,
        durationMs: minutes * 60_000,
        genres: [],
        directors: [],
        actors: [],
        countries: [],
        collections: [],
    };
}

// A watch that ends at `end`. With `play`, a Tautulli play gives its start and time on screen.
function watch(
    id: string,
    ratingKey: string,
    end: number,
    play?: { started: number; seconds: number },
    userId = 'u1',
): WatchEvent {
    return {
        id,
        userId,
        ratingKey,
        kind: 'movie',
        watchedAt: end,
        startedAt: play?.started,
        playSeconds: play?.seconds,
        source: 'plex',
    };
}

function checked(items: Item[], watches: WatchEvent[], partialPlays: WatchEvent[] = []): CheckedWatches {
    const byKey = new Map(items.map((item) => [item.ratingKey, item]));
    return new WatchCheck(byKey).apply(watches, partialPlays);
}

function historyOf(items: Item[], result: CheckedWatches, userId = 'u1'): UserHistory {
    const byKey = new Map(items.map((item) => [item.ratingKey, item]));
    const isMine = (event: WatchEvent) => event.userId === userId;
    const watches = result.watches.filter(isMine);
    const partial = result.partialPlays.filter(isMine);
    return new UserHistory(userId, watches, byKey, 'UTC', partial);
}

describe('trick 1: rewatch to fill a count', () => {

    it('does not give Popcorn habit for one film 10 times', () => {
        const builder = new HistoryBuilder().film('1');
        for (const day of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
            builder.watch('1', `2026-12-${String(day).padStart(2, '0')}T20:00:00Z`);
        }
        assert.equal(wins(builder.build(), 'film_10'), false);
    });

    it('does not give Binge mode for one episode 6 times', () => {
        const builder = new HistoryBuilder().show('s', [6]);
        for (const hour of [10, 11, 12, 13, 14, 15]) {
            builder.watch('s-s1-e1', `2026-12-01T${hour}:00:00Z`);
        }
        assert.equal(wins(builder.build(), 'tv_binge'), false);
    });

    it('gives Binge mode for 6 different episodes', () => {
        const builder = new HistoryBuilder().show('s', [6]);
        for (const episode of [1, 2, 3, 4, 5, 6]) {
            builder.watch(`s-s1-e${episode}`, `2026-12-01T${String(9 + episode).padStart(2, '0')}:00:00Z`);
        }
        assert.equal(wins(builder.build(), 'tv_binge'), true);
    });

    it('does not give Marathon for one film 4 times in a day', () => {
        const history = new HistoryBuilder()
            .film('1')
            .watch('1', '2026-12-01T09:30:00Z')
            .watch('1', '2026-12-01T11:30:00Z')
            .watch('1', '2026-12-01T13:30:00Z')
            .watch('1', '2026-12-01T15:30:00Z')
            .build();
        assert.equal(wins(history, 'film_marathon'), false);
    });

    it('does not give Two for one for one film twice', () => {
        const history = new HistoryBuilder()
            .film('1', { directors: ['Ann'] })
            .watch('1', '2026-12-01T20:00:00Z')
            .watch('1', '2026-12-01T21:40:00Z')
            .build();
        assert.equal(wins(history, 'film_two_for_one'), false);
    });

});

describe('trick 2: skip to the end', () => {

    it('does not count a watch with 5 minutes on screen of a 2-hour film', () => {
        const items = [film('1')];
        const skipped = watch('w1', '1', EVENING, {
            started: EVENING - 600,
            seconds: 300,
        });
        const history = historyOf(items, checked(items, [skipped]));
        assert.equal(wins(history, 'film_first'), false);
        assert.equal(history.partialPlays.length, 1);
        assert.equal(history.secondsOf(history.partialPlays[0]), 300);
    });

    it('does not give Midnight crossing for a jump to the end at 00:05', () => {
        const items = [film('1')];
        const end = Date.parse('2026-12-02T00:05:00Z') / 1000;
        const skipped = watch('w1', '1', end, {
            started: end - 300,
            seconds: 240,
        });
        const history = historyOf(items, checked(items, [skipped]));
        assert.equal(wins(history, 'film_midnight'), false);
    });

    it('adds plays of the item until the watch counts', () => {
        const items = [film('1')];
        const firstPart: WatchEvent = {
            ...watch('p1', '1', EVENING - 20 * HOUR, {
                started: EVENING - 21 * HOUR,
                seconds: HOUR,
            }),
            partial: true,
        };
        const lastPart = watch('w1', '1', EVENING, {
            started: EVENING - HOUR,
            seconds: HOUR,
        });
        const history = historyOf(items, checked(items, [lastPart], [firstPart]));
        assert.equal(wins(history, 'film_first'), true);
    });

});

describe('trick 3: mark as watched', () => {

    it('does not count a Plex watch that Tautulli did not see', () => {
        const items = [film('1'), film('2')];
        const real = watch('w1', '1', EVENING, {
            started: EVENING - 2 * HOUR,
            seconds: 2 * HOUR,
        });
        const marked = watch('w2', '2', EVENING - HOUR);
        const history = historyOf(items, checked(items, [real, marked]));
        assert.deepEqual(history.events.map((event) => event.id), ['w1']);
    });

    it('counts one episode when Plex marks a whole show in one second, without Tautulli', () => {
        const builder = new HistoryBuilder().show('s', [10]);
        for (const episode of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
            builder.watch(`s-s1-e${episode}`, '2026-12-01T20:00:00Z');
        }
        const plain = builder.build();
        const items = [...new Set(plain.events.map((event) => event.ratingKey))]
            .map((key) => plain.itemOf({ ratingKey: key } as WatchEvent) as Item);
        const history = historyOf(items, checked(items, plain.events));
        assert.equal(history.events.length, 1);
        assert.equal(wins(history, 'tv_mini'), false);
    });

});

describe('trick 4: two at once', () => {

    it('does not give Double feature for two films at the same time', () => {
        const items = [film('1'), film('2')];
        const start = EVENING - 2 * HOUR;
        const first = watch('w1', '1', EVENING, {
            started: start,
            seconds: 2 * HOUR,
        });
        const second = watch('w2', '2', EVENING + 60, {
            started: start + 60,
            seconds: 2 * HOUR,
        });
        const history = historyOf(items, checked(items, [first, second]));
        assert.equal(wins(history, 'film_double'), false);
    });

    it('keeps two films back to back, also without Tautulli', () => {
        const items = [film('1'), film('2')];
        const first = watch('w1', '1', EVENING);
        const second = watch('w2', '2', EVENING + 2 * HOUR);
        const history = historyOf(items, checked(items, [first, second]));
        assert.equal(history.events.length, 2);
    });

});

describe('trick 5: fast playback', () => {

    it('does not count a 2-hour film watched in 1 hour', () => {
        const items = [film('1')];
        const fast = watch('w1', '1', EVENING, {
            started: EVENING - HOUR,
            seconds: HOUR,
        });
        const history = historyOf(items, checked(items, [fast]));
        assert.equal(history.events.length, 0);
    });

    it('counts a film with 80% of its running time on screen', () => {
        const items = [film('1', 100)];
        const normal = watch('w1', '1', EVENING, {
            started: EVENING - 80 * 60,
            seconds: 80 * 60,
        });
        const history = historyOf(items, checked(items, [normal]));
        assert.equal(history.events.length, 1);
    });

});

describe('trick 6: short items', () => {

    it('does not count a film of 2 minutes', () => {
        const items = [film('1', 2)];
        const history = historyOf(items, checked(items, [watch('w1', '1', EVENING)]));
        assert.equal(wins(history, 'film_bitesize'), false);
    });

    it('does not give Season in a day for a season of 1 episode', () => {
        const history = new HistoryBuilder()
            .show('s', [1])
            .watch('s-s1-e1', '2026-12-01T20:00:00Z')
            .build();
        assert.equal(wins(history, 'tv_season_day'), false);
    });

});

describe('trick 10: household helpers', () => {

    it('does not give Full house when 3 helpers mark the film as watched', () => {
        const items = [film('1')];
        const real = watch('w1', '1', EVENING, {
            started: EVENING - 2 * HOUR,
            seconds: 2 * HOUR,
        });
        const helpers = ['u2', 'u3', 'u4'].map((userId, index) => {
            return watch(`h${index}`, '1', EVENING - HOUR, undefined, userId);
        });
        const result = checked(items, [real, ...helpers]);
        const household = new HouseholdWatches(result.watches);
        assert.equal(wins(historyOf(items, result), 'film_full_house', household), false);
    });

});
