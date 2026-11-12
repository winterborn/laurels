import type {
    CountRule,
    WatchEvent,
} from '../../model/index.ts';
import { lastOf } from '../../helpers/index.ts';
import { Tally } from '../Tally.ts';
import type { UserHistory } from '../UserHistory.ts';
import type {
    Evaluator,
    RuleResult,
} from './Evaluator.ts';

export class CountEvaluator implements Evaluator<CountRule> {

    evaluate(history: UserHistory, rule: CountRule): RuleResult {
        const events = history.select(rule.filter);
        const tally = new Tally(rule.target);
        for (const event of events) {
            this.addEvent(tally, history, rule, event);
        }
        const leader = tally.leader;
        const shown = tally.crossing ?? lastOf(events);
        return {
            earned: tally.crossing !== undefined,
            value: leader.size,
            target: rule.target,
            earnedAt: tally.crossing?.watchedAt,
            eventId: tally.crossing?.id,
            posterKey: shown ? history.posterKeyOf(shown) : undefined,
            note: rule.groupBy ? this.noteFor(history, rule, leader.group) : undefined,
        };
    }

    private addEvent(
        tally: Tally,
        history: UserHistory,
        rule: CountRule,
        event: WatchEvent,
    ): void {
        const member = this.memberOf(rule, event);
        const groups = rule.groupBy ? history.groupsOf(event, rule.groupBy) : ['all'];
        for (const group of groups) {
            tally.add(group, member, event);
        }
    }

    private memberOf(rule: CountRule, event: WatchEvent): string {
        switch (rule.distinct) {
            case 'item':
                return event.ratingKey;
            case 'show':
                return event.showKey ?? event.ratingKey;
            default:
                return event.id;
        }
    }

    // Group "item" holds a ratingKey: show its title instead.
    private noteFor(history: UserHistory, rule: CountRule, group: string): string {
        const isKeyGroup = rule.groupBy === 'item' || rule.groupBy === 'show';
        if (!isKeyGroup) {
            return group;
        }
        return history.item(group)?.title ?? '';
    }

}
