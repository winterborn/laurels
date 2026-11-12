import type {
    StreakRule,
    WatchEvent,
} from '../../model/index.ts';
import {
    dayNumber,
    groupBy,
    lastOf,
    maxOf,
} from '../../helpers/index.ts';
import type { UserHistory } from '../UserHistory.ts';
import type {
    Evaluator,
    RuleResult,
} from './Evaluator.ts';

// Consecutive local days with at least one matching watch.
export class StreakEvaluator implements Evaluator<StreakRule> {

    evaluate(history: UserHistory, rule: StreakRule): RuleResult {
        const events = history.select(rule.filter);
        const byDay = groupBy(events, (event) => history.localStart(event).day);
        const days = [...byDay.keys()].sort();
        const runs = this.runLengths(days);
        const crossingIndex = runs.findIndex((run) => run >= rule.target);
        const crossing = this.firstEventOn(byDay, days[crossingIndex]);
        const best = maxOf(runs);
        const shown = crossing ?? lastOf(events);
        return {
            earned: crossing !== undefined,
            value: Math.min(best, rule.target),
            target: rule.target,
            earnedAt: crossing?.watchedAt,
            eventId: crossing?.id,
            posterKey: shown ? history.posterKeyOf(shown) : undefined,
            note: crossing ? undefined : `Best run ${best} days`,
        };
    }

    // runs[i] = length of the streak that ends on days[i].
    private runLengths(days: string[]): number[] {
        return days.reduce<number[]>((runs, day, index) => {
            const isNextDay = index > 0 && dayNumber(day) - dayNumber(days[index - 1]) === 1;
            const previous = runs[index - 1] ?? 0;
            runs.push(isNextDay ? previous + 1 : 1);
            return runs;
        }, []);
    }

    private firstEventOn(
        byDay: Map<string, WatchEvent[]>,
        day: string | undefined,
    ): WatchEvent | undefined {
        if (!day) {
            return undefined;
        }
        return byDay.get(day)?.[0];
    }

}
