import type {
    AnniversaryRule,
    WatchEvent,
} from '../../model/index.ts';
import { lastOf } from '../../helpers/index.ts';
import { Tally } from '../Tally.ts';
import type { UserHistory } from '../UserHistory.ts';
import type { RuleResult } from './Evaluator.ts';

// The same item on the same local date ("MM-DD") in `target` different years.
export class AnniversaryEvaluator {

    evaluate(history: UserHistory, rule: AnniversaryRule): RuleResult {
        const events = history.select(rule.filter);
        const tally = new Tally(rule.target);
        for (const event of events) {
            const day = history.localStart(event).day;
            tally.add(`${event.ratingKey}|${day.slice(5)}`, day.slice(0, 4), event);
        }
        const shown: WatchEvent | undefined = tally.crossing ?? lastOf(events);
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
