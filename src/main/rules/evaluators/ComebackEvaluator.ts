import type {
    ComebackRule,
    WatchEvent,
} from '../../model/index.ts';
import type { UserHistory } from '../UserHistory.ts';
import type { RuleResult } from './Evaluator.ts';

const DAY_SECONDS = 86_400;

// Watches of an item (or a show) after at least minDays away from it.
export class ComebackEvaluator {

    evaluate(history: UserHistory, rule: ComebackRule): RuleResult {
        const returns = this.returns(history, rule);
        const crossing = returns[rule.target - 1];
        return {
            earned: crossing !== undefined,
            value: Math.min(returns.length, rule.target),
            target: rule.target,
            earnedAt: crossing?.watchedAt,
            eventId: crossing?.id,
            posterKey: crossing ? history.posterKeyOf(crossing) : undefined,
        };
    }

    private returns(history: UserHistory, rule: ComebackRule): WatchEvent[] {
        const lastSeen = new Map<string, number>();
        const gap = rule.minDays * DAY_SECONDS;
        return history.select(rule.filter).filter((event) => {
            const key = rule.groupBy === 'show' ? (event.showKey ?? event.ratingKey) : event.ratingKey;
            const before = lastSeen.get(key);
            lastSeen.set(key, event.watchedAt);
            return before !== undefined && event.watchedAt - before >= gap;
        });
    }

}
