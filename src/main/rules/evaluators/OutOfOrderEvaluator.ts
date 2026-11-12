import type {
    OutOfOrderRule,
    WatchEvent,
} from '../../model/index.ts';
import { groupBy } from '../../helpers/index.ts';
import type { UserHistory } from '../UserHistory.ts';
import type { RuleResult } from './Evaluator.ts';

// Sets watched out of order, each set once:
// - season: the season finale before episode 1 of the season,
// - collection: a later film of a collection before an earlier one.
// Only the first watch of each item counts.
export class OutOfOrderEvaluator {

    evaluate(history: UserHistory, rule: OutOfOrderRule): RuleResult {
        const hits = rule.set === 'season' ? this.seasonHits(history) : this.collectionHits(history);
        const sorted = hits.sort((a, b) => a.watchedAt - b.watchedAt);
        const crossing = sorted[rule.target - 1];
        return {
            earned: crossing !== undefined,
            value: Math.min(sorted.length, rule.target),
            target: rule.target,
            earnedAt: crossing?.watchedAt,
            eventId: crossing?.id,
            posterKey: crossing ? history.posterKeyOf(crossing) : undefined,
        };
    }

    // The watch of episode 1 that came after the finale.
    private seasonHits(history: UserHistory): WatchEvent[] {
        const firsts = this.firstWatches(history.select({ kind: 'episode' }));
        const bySeason = groupBy(firsts, (event) => event.seasonKey ?? '');
        return [...bySeason.entries()]
            .filter(([seasonKey]) => seasonKey !== '')
            .map(([, episodes]) => this.seasonHit(history, episodes))
            .filter((hit) => hit !== undefined);
    }

    private seasonHit(history: UserHistory, episodes: WatchEvent[]): WatchEvent | undefined {
        const finale = episodes.find((event) => history.matches(event, { isFinale: true }));
        const opener = episodes.find((event) => history.itemOf(event)?.index === 1);
        const isBackwards = finale !== undefined && opener !== undefined && finale.watchedAt < opener.watchedAt;
        return isBackwards ? opener : undefined;
    }

    // The first film of a collection that is older than a film watched before it.
    private collectionHits(history: UserHistory): WatchEvent[] {
        const firsts = this.firstWatches(history.select({ kind: 'movie' }));
        const collections = new Set(firsts.flatMap((event) => history.groupsOf(event, 'collection')));
        return [...collections]
            .map((name) => this.collectionHit(history, firsts, name))
            .filter((hit) => hit !== undefined);
    }

    private collectionHit(history: UserHistory, firsts: WatchEvent[], name: string): WatchEvent | undefined {
        const films = firsts.filter((event) => history.groupsOf(event, 'collection').includes(name));
        const years = films.map((event) => history.itemOf(event)?.year ?? 0);
        return films.find((_, index) => {
            const newestBefore = Math.max(0, ...years.slice(0, index));
            return years[index] > 0 && years[index] < newestBefore;
        });
    }

    private firstWatches(events: WatchEvent[]): WatchEvent[] {
        const seen = new Set<string>();
        return events.filter((event) => {
            const isNew = !seen.has(event.ratingKey);
            seen.add(event.ratingKey);
            return isNew;
        });
    }

}
