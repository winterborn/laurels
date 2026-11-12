import type {
    BackwardsRule,
    WatchEvent,
} from '../../model/index.ts';
import type { UserHistory } from '../UserHistory.ts';
import type { RuleResult } from './Evaluator.ts';

// From the end of one episode to the start of the next.
const MAX_GAP_SECONDS = 6 * 3600;

// Episodes of one season back to back, each one the episode before the last.
export class BackwardsEvaluator {

    evaluate(history: UserHistory, rule: BackwardsRule): RuleResult {
        const runs = this.runs(history);
        const crossingIndex = runs.findIndex((run) => run >= rule.target);
        const crossing = crossingIndex >= 0 ? history.events[crossingIndex] : undefined;
        const best = runs.reduce((most, run) => Math.max(most, run), 0);
        return {
            earned: crossing !== undefined,
            value: Math.min(best, rule.target),
            target: rule.target,
            earnedAt: crossing?.watchedAt,
            eventId: crossing?.id,
            posterKey: crossing ? history.posterKeyOf(crossing) : undefined,
        };
    }

    // runs[i]: episodes in reverse order up to watch i.
    private runs(history: UserHistory): number[] {
        const events = history.events;
        return events.reduce<number[]>((runs, event, index) => {
            const previous = index > 0 ? runs[index - 1] : 0;
            const isReverse = index > 0 && this.isStepBack(history, events[index - 1], event);
            const isEpisode = history.itemOf(event)?.index !== undefined && event.kind === 'episode';
            runs.push(isReverse ? previous + 1 : Number(isEpisode));
            return runs;
        }, []);
    }

    private isStepBack(history: UserHistory, before: WatchEvent, after: WatchEvent): boolean {
        const isSameSeason = before.seasonKey !== undefined && before.seasonKey === after.seasonKey;
        const beforeIndex = history.itemOf(before)?.index ?? -1;
        const afterIndex = history.itemOf(after)?.index ?? -1;
        const isClose = history.startOf(after) - before.watchedAt <= MAX_GAP_SECONDS;
        return isSameSeason && isClose && afterIndex === beforeIndex - 1;
    }

}
