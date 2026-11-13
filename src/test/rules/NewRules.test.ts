import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Achievement, Rule } from '../../main/model/index.ts';
import { HouseholdWatches, RuleEngine, UserHistory } from '../../main/rules/index.ts';
import { HistoryBuilder } from './HistoryBuilder.ts';

const engine = new RuleEngine();

function achievement(id: string, rule: Rule): Achievement {
    return {
        id,
        title: id,
        description: 'Test rule',
        tier: 'Common',
        section: 'both',
        rule,
    };
}

describe('window by month and year', () => {

    it('counts films in one calendar year', () => {
        const history = new HistoryBuilder()
            .film('1')
            .film('2')
            .film('3')
            .watch('1', '2025-12-31T20:00:00Z')
            .watch('2', '2026-01-02T20:00:00Z')
            .watch('3', '2026-06-02T20:00:00Z')
            .build();
        const progress = engine.evaluate(history, achievement('year', {
            type: 'window',
            span: 'year',
            target: 2,
        }));
        assert.equal(progress.earned, true);
        assert.equal(progress.eventId, 'e3');
    });

    it('counts each day once with distinct day', () => {
        const history = new HistoryBuilder()
            .film('1')
            .watch('1', '2026-03-01T20:00:00Z')
            .watch('1', '2026-03-01T23:00:00Z')
            .watch('1', '2026-03-02T20:00:00Z')
            .build();
        const progress = engine.evaluate(history, achievement('days', {
            type: 'window',
            span: 'month',
            distinct: 'day',
            target: 3,
        }));
        assert.equal(progress.earned, false);
        assert.equal(progress.value, 2);
    });

});

describe('complete within days', () => {

    it('needs the first and last episode within the limit', () => {
        const slow = new HistoryBuilder()
            .show('s', [3])
            .watch('s-s1-e1', '2026-01-01T20:00:00Z')
            .watch('s-s1-e2', '2026-01-02T20:00:00Z')
            .watch('s-s1-e3', '2026-01-20T20:00:00Z')
            .build();
        const quick = new HistoryBuilder()
            .show('s', [3])
            .watch('s-s1-e1', '2026-01-01T20:00:00Z')
            .watch('s-s1-e2', '2026-01-02T20:00:00Z')
            .watch('s-s1-e3', '2026-01-05T20:00:00Z')
            .build();
        const rule: Rule = {
            type: 'complete',
            set: 'show',
            withinDays: 7,
            target: 1,
        };
        assert.equal(engine.evaluate(slow, achievement('week', rule)).earned, false);
        assert.equal(engine.evaluate(quick, achievement('week', rule)).earned, true);
    });

});

describe('shared', () => {

    it('earns when another person watched the same item in the window', () => {
        const history = new HistoryBuilder()
            .film('1')
            .watch('1', '2026-02-01T20:00:00Z')
            .build();
        const household = new HouseholdWatches([
            ...history.events,
            {
                ...history.events[0],
                id: 'other',
                userId: 'u2',
                watchedAt: Date.parse('2026-02-05T20:00:00Z') / 1000,
            },
        ]);
        const progress = engine.evaluate(history, achievement('party', {
            type: 'shared',
            withinDays: 7,
            target: 1,
        }), household);
        assert.equal(progress.earned, true);
        assert.equal(progress.earnedAt, Date.parse('2026-02-05T20:00:00Z') / 1000);
    });

    it('does not count the same person twice', () => {
        const history = new HistoryBuilder()
            .film('1')
            .watch('1', '2026-02-01T20:00:00Z')
            .watch('1', '2026-02-02T20:00:00Z')
            .build();
        const progress = engine.evaluate(history, achievement('party', {
            type: 'shared',
            withinDays: 7,
            target: 1,
        }));
        assert.equal(progress.earned, false);
    });

});

describe('awards', () => {

    it('counts the other awards and takes the date of the Nth', () => {
        const history = new HistoryBuilder()
            .film('1')
            .film('2')
            .watch('1', '2026-01-01T20:00:00Z')
            .watch('2', '2026-01-03T20:00:00Z')
            .build();
        const list = [
            achievement('meta', {
                type: 'awards',
                target: 2,
            }),
            achievement('one', {
                type: 'count',
                target: 1,
            }),
            achievement('two', {
                type: 'count',
                target: 2,
            }),
        ];
        const [meta] = engine.evaluateAll(history, list);
        assert.equal(meta.earned, true);
        assert.equal(meta.eventId, 'e2');
    });

});

describe('hours with partial plays', () => {

    it('adds the time of plays that were not watched to the end', () => {
        const watch = {
            id: 'w1',
            userId: 'u1',
            ratingKey: '1',
            kind: 'movie' as const,
            watchedAt: 10_000,
            playSeconds: 3600,
            source: 'tautulli' as const,
        };
        const partial = {
            ...watch,
            id: 'p1',
            watchedAt: 20_000,
            playSeconds: 3600,
            partial: true,
        };
        const history = new UserHistory('u1', [watch], new Map(), 'UTC', [partial]);
        const progress = engine.evaluate(history, achievement('hours', {
            type: 'hours',
            target: 2,
        }));
        assert.equal(progress.earned, true);
        assert.equal(progress.eventId, 'p1');
        assert.equal(history.events.length, 1);
    });

});
