import type {
    HoursRule,
    WatchEvent,
} from '../../model/index.ts';
import { lastOf } from '../../helpers/index.ts';
import type { UserHistory } from '../UserHistory.ts';
import type {
    Evaluator,
    RuleResult,
} from './Evaluator.ts';

export class HoursEvaluator implements Evaluator<HoursRule> {

    evaluate(history: UserHistory, rule: HoursRule): RuleResult {
        const events = history.selectTime(rule.filter);
        const totals = this.runningTotals(history, events);
        const targetSeconds = rule.target * 3600;
        const crossingIndex = totals.findIndex((total) => total >= targetSeconds);
        const crossing = events[crossingIndex];
        const shown = crossing ?? lastOf(events);
        const totalSeconds = lastOf(totals) ?? 0;
        const hours = Math.floor(totalSeconds / 3600);
        return {
            earned: crossing !== undefined,
            value: Math.min(hours, rule.target),
            target: rule.target,
            earnedAt: crossing?.watchedAt,
            eventId: crossing?.id,
            posterKey: shown ? history.posterKeyOf(shown) : undefined,
            note: crossing ? undefined : `${hours.toLocaleString('en-GB')} hours`,
        };
    }

    private runningTotals(history: UserHistory, events: WatchEvent[]): number[] {
        return events.reduce<number[]>((totals, event) => {
            const previous = lastOf(totals) ?? 0;
            totals.push(previous + history.secondsOf(event));
            return totals;
        }, []);
    }

}
