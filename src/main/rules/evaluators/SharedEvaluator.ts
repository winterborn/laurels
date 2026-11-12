import type {
    SharedRule,
    WatchEvent,
} from '../../model/index.ts';
import { lastOf } from '../../helpers/index.ts';
import type { HouseholdWatches } from '../HouseholdWatches.ts';
import type { UserHistory } from '../UserHistory.ts';
import type { RuleResult } from './Evaluator.ts';

interface SharedWatch {
    event: WatchEvent;
    // The later of the two watches: the moment the watch became shared.
    sharedAt: number;
}

// Items that this person and another person watched within a few days.
// Each item counts once.
export class SharedEvaluator {

    evaluate(history: UserHistory, rule: SharedRule, household: HouseholdWatches): RuleResult {
        const shared = this.sharedWatches(history, rule, household);
        const crossing = shared[rule.target - 1];
        const shown = crossing?.event ?? lastOf(shared)?.event;
        return {
            earned: crossing !== undefined,
            value: Math.min(shared.length, rule.target),
            target: rule.target,
            earnedAt: crossing?.sharedAt,
            eventId: crossing?.event.id,
            posterKey: shown ? history.posterKeyOf(shown) : undefined,
        };
    }

    private sharedWatches(history: UserHistory, rule: SharedRule, household: HouseholdWatches): SharedWatch[] {
        const seen = new Set<string>();
        const shared: SharedWatch[] = [];
        for (const event of history.select(rule.filter)) {
            const otherAt = household.otherNear(event, rule.withinDays);
            const isNew = otherAt !== undefined && !seen.has(event.ratingKey);
            if (isNew) {
                seen.add(event.ratingKey);
                shared.push({
                    event,
                    sharedAt: Math.max(event.watchedAt, otherAt),
                });
            }
        }
        return shared.sort((a, b) => a.sharedAt - b.sharedAt);
    }

}
