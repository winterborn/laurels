import type {
    FirstRule,
    WatchEvent,
} from '../../model/index.ts';
import type { HouseholdWatches } from '../HouseholdWatches.ts';
import type { UserHistory } from '../UserHistory.ts';
import type { RuleResult } from './Evaluator.ts';

interface FirstWatch {
    event: WatchEvent;
    // When another person watched it after: the moment it became a "first".
    provenAt: number;
}

// Items that this person watched first in the household, before another person did.
export class FirstEvaluator {

    evaluate(history: UserHistory, rule: FirstRule, household: HouseholdWatches): RuleResult {
        const firsts = this.firsts(history, rule, household);
        const crossing = firsts[rule.target - 1];
        return {
            earned: crossing !== undefined,
            value: Math.min(firsts.length, rule.target),
            target: rule.target,
            earnedAt: crossing?.provenAt,
            eventId: crossing?.event.id,
            posterKey: crossing ? history.posterKeyOf(crossing.event) : undefined,
        };
    }

    private firsts(history: UserHistory, rule: FirstRule, household: HouseholdWatches): FirstWatch[] {
        const firsts = history
            .select(rule.filter)
            .map((event) => ({
                event,
                provenAt: household.otherAfterFirst(event),
            }))
            .filter((entry) => entry.provenAt !== undefined) as FirstWatch[];
        return firsts.sort((a, b) => a.provenAt - b.provenAt);
    }

}
