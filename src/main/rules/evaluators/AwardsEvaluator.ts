import type {
    AwardsRule,
    Progress,
} from '../../model/index.ts';
import type { RuleResult } from './Evaluator.ts';

// A number of other awards won. Reads the results of the other rules.
export class AwardsEvaluator {

    evaluate(others: Progress[], rule: AwardsRule): RuleResult {
        const won = others
            .filter((progress) => progress.earned)
            .sort((a, b) => (a.earnedAt ?? 0) - (b.earnedAt ?? 0));
        const crossing = won[rule.target - 1];
        return {
            earned: crossing !== undefined,
            value: Math.min(won.length, rule.target),
            target: rule.target,
            earnedAt: crossing?.earnedAt,
            eventId: crossing?.eventId,
            posterKey: crossing?.posterKey,
        };
    }

}
