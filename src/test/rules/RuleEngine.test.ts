import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Achievement, Rule } from '../../main/model/index.ts';
import { RuleEngine } from '../../main/rules/index.ts';
import { HistoryBuilder } from './HistoryBuilder.ts';

const engine = new RuleEngine();

function achievement(rule: Rule): Achievement {
    return {
        id: 'test',
        title: 'Test',
        description: 'Test rule',
        tier: 'Common',
        section: 'both',
        rule,
    };
}

describe('count', () => {

    it('earns on the Nth distinct horror film', () => {
        const history = new HistoryBuilder()
            .film('1', { genres: ['Horror'] })
            .film('2', { genres: ['Horror'] })
            .film('3', { genres: ['Comedy'] })
            .watch('1', '2026-01-01T22:00:00Z')
            .watch('1', '2026-01-02T22:00:00Z')
            .watch('3', '2026-01-03T22:00:00Z')
            .watch('2', '2026-01-04T22:00:00Z')
            .build();
        const progress = engine.evaluate(history, achievement({
            type: 'count',
            filter: { genre: 'horror' },
            distinct: 'item',
            target: 2,
        }));
        assert.equal(progress.earned, true);
        assert.equal(progress.eventId, 'e4');
        assert.equal(progress.posterKey, '2');
    });

    it('groups by director and names the leader', () => {
        const history = new HistoryBuilder()
            .film('1', { directors: ['Keaton'] })
            .film('2', { directors: ['Keaton', 'Bruckman'] })
            .film('3', { directors: ['Lang'] })
            .watch('1', '2026-01-01T22:00:00Z')
            .watch('3', '2026-01-02T22:00:00Z')
            .watch('2', '2026-01-03T22:00:00Z')
            .build();
        const progress = engine.evaluate(history, achievement({
            type: 'count',
            distinct: 'item',
            groupBy: 'director',
            target: 3,
        }));
        assert.equal(progress.earned, false);
        assert.equal(progress.value, 2);
        assert.equal(progress.note, 'Keaton');
    });

    it('uses the start hour, worked back from the end', () => {
        // 90-minute film ending 02:30 started at 01:00.
        const history = new HistoryBuilder()
            .film('1')
            .watch('1', '2026-01-01T02:30:00Z')
            .build();
        const progress = engine.evaluate(history, achievement({
            type: 'count',
            filter: { hourFrom: 1, hourTo: 5 },
            target: 1,
        }));
        assert.equal(progress.earned, true);
    });

});

describe('hours', () => {

    it('earns on the watch that crosses the line', () => {
        const history = new HistoryBuilder()
            .film('1')
            .watch('1', '2026-01-01T22:00:00Z')
            .watch('1', '2026-01-02T22:00:00Z')
            .build();
        const progress = engine.evaluate(history, achievement({
            type: 'hours',
            target: 3,
        }));
        assert.equal(progress.earned, true);
        assert.equal(progress.eventId, 'e2');
    });

});

describe('streak', () => {

    it('counts consecutive days and keeps the best run', () => {
        const history = new HistoryBuilder()
            .film('1')
            .watch('1', '2026-01-01T22:00:00Z')
            .watch('1', '2026-01-02T22:00:00Z')
            .watch('1', '2026-01-05T22:00:00Z')
            .build();
        const progress = engine.evaluate(history, achievement({
            type: 'streak',
            target: 3,
        }));
        assert.equal(progress.earned, false);
        assert.equal(progress.value, 2);
        assert.equal(progress.posterKey, '1');
    });

});

describe('window', () => {

    it('finds 3 episodes of one show in 24 hours across midnight', () => {
        const history = new HistoryBuilder()
            .show('s', [3])
            .watch('s-s1-e1', '2026-01-01T22:30:00Z')
            .watch('s-s1-e2', '2026-01-01T23:30:00Z')
            .watch('s-s1-e3', '2026-01-02T00:30:00Z')
            .build();
        const progress = engine.evaluate(history, achievement({
            type: 'window',
            span: '24h',
            groupBy: 'show',
            target: 3,
        }));
        assert.equal(progress.earned, true);
        assert.equal(progress.eventId, 'e3');
        assert.equal(progress.posterKey, 's');
    });

    it('splits by local day', () => {
        const history = new HistoryBuilder()
            .film('1')
            .watch('1', '2026-01-01T23:00:00Z')
            .watch('1', '2026-01-02T03:00:00Z')
            .build();
        const progress = engine.evaluate(history, achievement({
            type: 'window',
            span: 'day',
            target: 2,
        }));
        assert.equal(progress.earned, false);
        assert.equal(progress.value, 1);
        assert.equal(progress.posterKey, '1');
    });

});

describe('complete', () => {

    it('earns when the last missing episode is watched', () => {
        const history = new HistoryBuilder()
            .show('s', [2, 1])
            .watch('s-s1-e2', '2026-01-01T22:00:00Z')
            .watch('s-s2-e1', '2026-01-02T22:00:00Z')
            .watch('s-s1-e2', '2026-01-03T22:00:00Z')
            .watch('s-s1-e1', '2026-01-04T22:00:00Z')
            .build();
        const progress = engine.evaluate(history, achievement({
            type: 'complete',
            set: 'show',
            target: 1,
        }));
        assert.equal(progress.earned, true);
        assert.equal(progress.eventId, 'e4');
        assert.equal(progress.note, 'Show s');
    });

    it('shows the nearest show while locked', () => {
        const history = new HistoryBuilder()
            .show('s', [4])
            .watch('s-s1-e1', '2026-01-01T22:00:00Z')
            .watch('s-s1-e3', '2026-01-02T22:00:00Z')
            .build();
        const progress = engine.evaluate(history, achievement({
            type: 'complete',
            set: 'show',
            target: 1,
        }));
        assert.equal(progress.earned, false);
        assert.equal(progress.value, 2);
        assert.equal(progress.target, 4);
    });

});

describe('a rule that fails', () => {

    it('marks the progress as failed, so a saved award stays', () => {
        const history = new HistoryBuilder().build();
        const progress = engine.evaluate(history, achievement({
            type: 'awards',
            target: 1,
        }));
        assert.equal(progress.earned, false);
        assert.equal(progress.failed, true);
    });

});
