import type { VarietyRule } from '../../model/index.ts';
import {
    lastOf,
    periodOfDay,
} from '../../helpers/index.ts';
import { Tally } from '../Tally.ts';
import type { UserHistory } from '../UserHistory.ts';
import type { RuleResult } from './Evaluator.ts';

// Different values of one thing, for example 8 decades or 26 first letters.
// With span, they must all fall in one local day, month or year.
export class VarietyEvaluator {

    evaluate(history: UserHistory, rule: VarietyRule): RuleResult {
        const events = history.select(rule.filter);
        const tally = new Tally(rule.target);
        for (const event of events) {
            const period = rule.span ? periodOfDay(rule.span, history.localStart(event).day) : 'all';
            for (const value of history.groupsOf(event, rule.of)) {
                tally.add(period, value, event);
            }
        }
        const shown = tally.crossing ?? lastOf(events);
        return {
            earned: tally.crossing !== undefined,
            value: tally.leader.size,
            target: rule.target,
            earnedAt: tally.crossing?.watchedAt,
            eventId: tally.crossing?.id,
            posterKey: shown ? history.posterKeyOf(shown) : undefined,
        };
    }

}
