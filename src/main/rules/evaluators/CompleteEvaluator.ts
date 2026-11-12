import type {
    CompleteRule,
    WatchEvent,
} from '../../model/index.ts';
import type { UserHistory } from '../UserHistory.ts';
import type {
    Evaluator,
    RuleResult,
} from './Evaluator.ts';

interface Completion {
    setKey: string;
    event: WatchEvent;
}

interface PartialSet {
    setKey: string;
    watched: number;
    size: number;
}

// Every episode of a show (or season) in your library.
export class CompleteEvaluator implements Evaluator<CompleteRule> {

    evaluate(history: UserHistory, rule: CompleteRule): RuleResult {
        const episodes = history.select({ kind: 'episode' });
        const watched = new Map<string, Set<string>>();
        const completions: Completion[] = [];
        for (const event of episodes) {
            this.addEpisode(history, rule, event, watched, completions);
        }
        const crossing = completions[rule.target - 1];
        if (crossing) {
            return this.earned(history, rule, crossing);
        }
        if (rule.target === 1) {
            return this.closest(history, rule, watched);
        }
        return this.counted(history, rule, completions);
    }

    private addEpisode(
        history: UserHistory,
        rule: CompleteRule,
        event: WatchEvent,
        watched: Map<string, Set<string>>,
        completions: Completion[],
    ): void {
        const setKey = this.setKeyOf(rule, event);
        const size = history.item(setKey)?.leafCount ?? 0;
        if (!setKey || !size) {
            return;
        }
        const members = watched.get(setKey) ?? new Set<string>();
        const isNewEpisode = !members.has(event.ratingKey);
        members.add(event.ratingKey);
        watched.set(setKey, members);
        const justFinished = isNewEpisode && members.size === size;
        if (justFinished) {
            completions.push({
                setKey,
                event,
            });
        }
    }

    private setKeyOf(rule: CompleteRule, event: WatchEvent): string | undefined {
        switch (rule.set) {
            case 'show':
                return event.showKey;
            case 'season':
                return event.seasonKey;
        }
    }

    private earned(
        history: UserHistory,
        rule: CompleteRule,
        crossing: Completion,
    ): RuleResult {
        return {
            earned: true,
            value: rule.target,
            target: rule.target,
            earnedAt: crossing.event.watchedAt,
            eventId: crossing.event.id,
            posterKey: history.posterKeyOf(crossing.event),
            note: this.titleOf(history, crossing.setKey),
        };
    }

    // One set wanted: show the nearest one, for example 38 of 40 episodes.
    private closest(
        history: UserHistory,
        rule: CompleteRule,
        watched: Map<string, Set<string>>,
    ): RuleResult {
        const partials = [...watched.entries()].map(([setKey, members]) => ({
            setKey,
            watched: members.size,
            size: history.item(setKey)?.leafCount ?? 1,
        }));
        const best = partials.reduce<PartialSet | undefined>((nearest, partial) => {
            const share = partial.watched / partial.size;
            const nearestShare = nearest ? nearest.watched / nearest.size : -1;
            return share > nearestShare ? partial : nearest;
        }, undefined);
        if (!best) {
            return {
                earned: false,
                value: 0,
                target: 1,
            };
        }
        return {
            earned: false,
            value: best.watched,
            target: best.size,
            posterKey: this.posterKeyOf(history, best.setKey),
            note: `${this.titleOf(history, best.setKey)} · episodes`,
        };
    }

    private counted(
        history: UserHistory,
        rule: CompleteRule,
        completions: Completion[],
    ): RuleResult {
        const last = completions[completions.length - 1];
        return {
            earned: false,
            value: completions.length,
            target: rule.target,
            posterKey: last ? history.posterKeyOf(last.event) : undefined,
            note: `${rule.set === 'show' ? 'Shows' : 'Seasons'} finished`,
        };
    }

    private posterKeyOf(history: UserHistory, setKey: string): string {
        const set = history.item(setKey);
        return set?.showKey ?? setKey;
    }

    private titleOf(history: UserHistory, setKey: string): string {
        const set = history.item(setKey);
        if (!set) {
            return '';
        }
        if (set.kind === 'season') {
            const show = history.item(set.showKey);
            return `${show?.title ?? ''} · season ${set.index ?? ''}`;
        }
        return set.title;
    }

}
