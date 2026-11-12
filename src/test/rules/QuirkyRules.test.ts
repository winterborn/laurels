import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Achievement, Rule } from '../../main/model/index.ts';
import { HouseholdWatches, RuleEngine } from '../../main/rules/index.ts';
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

function count(filter: Record<string, unknown>): Rule {
    return {
        type: 'count',
        filter,
        target: 1,
    };
}

describe('new filters', () => {

    it('matches a calendar date and a weekday', () => {
        const history = new HistoryBuilder()
            .film('1')
            .watch('1', '2026-12-25T22:00:00Z')
            .build();
        assert.equal(engine.evaluate(history, achievement(count({ dates: ['12-25'] }))).earned, true);
        assert.equal(engine.evaluate(history, achievement(count({ dates: ['10-31'] }))).earned, false);
        assert.equal(engine.evaluate(history, achievement(count({ weekdays: [5] }))).earned, true);
    });

    it('matches title words, title length and ratings', () => {
        const history = new HistoryBuilder()
            .film('1', { title: 'Night of the Shark', contentRating: 'gb/18' })
            .watch('1', '2026-01-01T22:00:00Z')
            .build();
        assert.equal(engine.evaluate(history, achievement(count({ titleWords: ['shark'] }))).earned, true);
        assert.equal(engine.evaluate(history, achievement(count({ titleWordsMin: 4 }))).earned, true);
        assert.equal(engine.evaluate(history, achievement(count({ titleWordsMax: 1 }))).earned, false);
        assert.equal(engine.evaluate(history, achievement(count({ ratings: ['18'] }))).earned, true);
    });

    it('matches the age of a film and its release date', () => {
        const history = new HistoryBuilder()
            .film('1', { year: 1966, releasedAt: '1966-03-04' })
            .watch('1', '2026-03-04T22:00:00Z')
            .build();
        assert.equal(engine.evaluate(history, achievement(count({ ageMin: 50 }))).earned, true);
        assert.equal(engine.evaluate(history, achievement(count({ ageMax: 0 }))).earned, false);
        assert.equal(engine.evaluate(history, achievement(count({ onReleaseDate: true }))).earned, true);
    });

    it('matches a watch that crosses midnight', () => {
        const history = new HistoryBuilder()
            .film('1')
            .watch('1', '2026-01-02T00:30:00Z')
            .build();
        assert.equal(engine.evaluate(history, achievement(count({ crossesMidnight: true }))).earned, true);
    });

    it('matches a season finale', () => {
        const history = new HistoryBuilder()
            .show('s', [3])
            .watch('s-s1-e3', '2026-01-01T22:00:00Z')
            .build();
        assert.equal(engine.evaluate(history, achievement(count({ isFinale: true }))).earned, true);
    });

});

describe('variety', () => {

    it('counts different decades', () => {
        const history = new HistoryBuilder()
            .film('1', { year: 1955 })
            .film('2', { year: 1958 })
            .film('3', { year: 1971 })
            .watch('1', '2026-01-01T22:00:00Z')
            .watch('2', '2026-01-02T22:00:00Z')
            .watch('3', '2026-01-03T22:00:00Z')
            .build();
        const progress = engine.evaluate(history, achievement({
            type: 'variety',
            of: 'decade',
            target: 2,
        }));
        assert.equal(progress.earned, true);
        assert.equal(progress.eventId, 'e3');
    });

});

describe('chain', () => {

    it('finds a horror film then a comedy, back to back', () => {
        const history = new HistoryBuilder()
            .film('1', { genres: ['Horror'] })
            .film('2', { genres: ['Comedy'] })
            .watch('1', '2026-01-01T21:00:00Z')
            .watch('2', '2026-01-01T23:00:00Z')
            .build();
        const progress = engine.evaluate(history, achievement({
            type: 'chain',
            steps: [{ genre: 'Horror' }, { genre: 'Comedy' }],
            maxGapHours: 2,
            target: 1,
        }));
        assert.equal(progress.earned, true);
    });

    it('needs the same director in every watch of the run', () => {
        const history = new HistoryBuilder()
            .film('1', { directors: ['Ada'] })
            .film('2', { directors: ['Ada', 'Bo'] })
            .film('3', { directors: ['Bo'] })
            .watch('1', '2026-01-01T18:00:00Z')
            .watch('2', '2026-01-01T20:00:00Z')
            .watch('3', '2026-01-01T22:00:00Z')
            .build();
        const rule: Rule = {
            type: 'chain',
            same: 'director',
            length: 3,
            maxGapHours: 3,
            target: 1,
        };
        assert.equal(engine.evaluate(history, achievement(rule)).earned, false);
    });

});

describe('comeback and anniversary', () => {

    it('counts a return after a long gap', () => {
        const history = new HistoryBuilder()
            .film('1')
            .watch('1', '2020-01-01T22:00:00Z')
            .watch('1', '2026-01-01T22:00:00Z')
            .build();
        const progress = engine.evaluate(history, achievement({
            type: 'comeback',
            groupBy: 'item',
            minDays: 1825,
            target: 1,
        }));
        assert.equal(progress.earned, true);
    });

    it('counts the same date in different years', () => {
        const history = new HistoryBuilder()
            .film('1')
            .watch('1', '2024-12-24T22:00:00Z')
            .watch('1', '2025-12-24T22:00:00Z')
            .build();
        const progress = engine.evaluate(history, achievement({
            type: 'anniversary',
            target: 2,
        }));
        assert.equal(progress.earned, true);
    });

});

describe('order', () => {

    it('finds a finale watched before episode 1', () => {
        const history = new HistoryBuilder()
            .show('s', [3])
            .watch('s-s1-e3', '2026-01-01T20:00:00Z')
            .watch('s-s1-e1', '2026-01-02T20:00:00Z')
            .build();
        const progress = engine.evaluate(history, achievement({
            type: 'outOfOrder',
            set: 'season',
            target: 1,
        }));
        assert.equal(progress.earned, true);
    });

    it('finds a sequel watched before the first film', () => {
        const history = new HistoryBuilder()
            .film('1', { year: 1984, collections: ['Saga'] })
            .film('2', { year: 1989, collections: ['Saga'] })
            .watch('2', '2026-01-01T20:00:00Z')
            .watch('1', '2026-01-02T20:00:00Z')
            .build();
        const progress = engine.evaluate(history, achievement({
            type: 'outOfOrder',
            set: 'collection',
            target: 1,
        }));
        assert.equal(progress.earned, true);
        assert.equal(progress.eventId, 'e2');
    });

    it('finds episodes in reverse order', () => {
        const history = new HistoryBuilder()
            .show('s', [4])
            .watch('s-s1-e4', '2026-01-01T20:00:00Z')
            .watch('s-s1-e3', '2026-01-01T21:00:00Z')
            .watch('s-s1-e2', '2026-01-01T22:00:00Z')
            .build();
        const progress = engine.evaluate(history, achievement({
            type: 'backwards',
            target: 3,
        }));
        assert.equal(progress.earned, true);
    });

});

describe('household', () => {

    it('counts items that this person watched first', () => {
        const history = new HistoryBuilder()
            .film('1')
            .watch('1', '2026-01-01T20:00:00Z')
            .build();
        const household = new HouseholdWatches([
            ...history.events,
            {
                ...history.events[0],
                id: 'other',
                userId: 'u2',
                watchedAt: Date.parse('2026-01-05T20:00:00Z') / 1000,
            },
        ]);
        const progress = engine.evaluate(history, achievement({
            type: 'first',
            target: 1,
        }), household);
        assert.equal(progress.earned, true);
        assert.equal(progress.earnedAt, Date.parse('2026-01-05T20:00:00Z') / 1000);
    });

    it('needs the number of people for a shared watch', () => {
        const history = new HistoryBuilder()
            .film('1')
            .watch('1', '2026-01-01T20:00:00Z')
            .build();
        const other = (userId: string, day: string) => ({
            ...history.events[0],
            id: `e-${userId}`,
            userId,
            watchedAt: Date.parse(day) / 1000,
        });
        const household = new HouseholdWatches([
            ...history.events,
            other('u2', '2026-01-02T20:00:00Z'),
        ]);
        const rule: Rule = {
            type: 'shared',
            withinDays: 7,
            people: 2,
            target: 1,
        };
        assert.equal(engine.evaluate(history, achievement(rule), household).earned, false);
    });

});

describe('window hours and complete size', () => {

    it('counts hours in one day', () => {
        const history = new HistoryBuilder()
            .film('1', { durationMs: 3 * 3600_000 })
            .film('2', { durationMs: 3 * 3600_000 })
            .watch('1', '2026-01-01T13:00:00Z')
            .watch('2', '2026-01-01T17:00:00Z')
            .build();
        const progress = engine.evaluate(history, achievement({
            type: 'window',
            span: 'day',
            measure: 'hours',
            target: 6,
        }));
        assert.equal(progress.earned, true);
    });

    it('skips shows that are too big for maxEpisodes', () => {
        const history = new HistoryBuilder()
            .show('s', [3])
            .watch('s-s1-e1', '2026-01-01T20:00:00Z')
            .watch('s-s1-e2', '2026-01-01T21:00:00Z')
            .watch('s-s1-e3', '2026-01-01T22:00:00Z')
            .build();
        const small: Rule = {
            type: 'complete',
            set: 'show',
            maxEpisodes: 2,
            target: 1,
        };
        assert.equal(engine.evaluate(history, achievement(small)).earned, false);
    });

});
