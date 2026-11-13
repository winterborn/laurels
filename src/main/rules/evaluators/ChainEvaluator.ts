import type {
    ChainRule,
    WatchEvent,
} from '../../model/index.ts';
import type { UserHistory } from '../UserHistory.ts';
import type { RuleResult } from './Evaluator.ts';

interface Link {
    // Watches in the run so far, up to this watch.
    length: number;
    // With `same`: the values that every watch in the run shares.
    shared: Set<string>;
    // The films and episodes in the run. A run never uses one twice.
    items: Set<string>;
}

const NO_LINK: Link = {
    length: 0,
    shared: new Set(),
    items: new Set(),
};

// Watches back to back. Each run that reaches the length counts once,
// and the next run starts again from zero. A run never uses one film or episode twice.
// steps: each watch in the run matches its step, in order.
// same: each watch matches the filter and shares a value of this key with the run.
export class ChainEvaluator {

    evaluate(history: UserHistory, rule: ChainRule): RuleResult {
        const length = this.lengthOf(rule);
        const links = this.links(history, rule, length);
        const ends = history.events.filter((_, index) => links[index].length === length);
        const crossing = ends[rule.target - 1];
        const best = links.reduce((most, link) => Math.max(most, link.length), 0);
        const showsRun = rule.target === 1;
        return {
            earned: crossing !== undefined,
            value: showsRun ? Math.min(best, length) : Math.min(ends.length, rule.target),
            target: showsRun ? length : rule.target,
            earnedAt: crossing?.watchedAt,
            eventId: crossing?.id,
            posterKey: crossing ? history.posterKeyOf(crossing) : undefined,
        };
    }

    private lengthOf(rule: ChainRule): number {
        return rule.steps?.length ?? rule.length ?? 2;
    }

    // links[i]: the run that ends at watch i.
    private links(history: UserHistory, rule: ChainRule, length: number): Link[] {
        const events = history.events;
        return events.reduce<Link[]>((links, event, index) => {
            const previous = index > 0 ? links[index - 1] : NO_LINK;
            const isFinished = previous.length >= length;
            const canContinue = index > 0 && !isFinished && this.isClose(history, rule, events[index - 1], event);
            const base = canContinue ? previous : NO_LINK;
            links.push(this.extend(history, rule, base, event));
            return links;
        }, []);
    }

    // The run with this watch added, or a new run that starts here.
    private extend(history: UserHistory, rule: ChainRule, base: Link, event: WatchEvent): Link {
        const continued = this.tryAdd(history, rule, base, event);
        if (continued) {
            return continued;
        }
        return this.tryAdd(history, rule, NO_LINK, event) ?? NO_LINK;
    }

    private tryAdd(history: UserHistory, rule: ChainRule, base: Link, event: WatchEvent): Link | null {
        if (base.items.has(event.ratingKey)) {
            return null;
        }
        if (rule.steps) {
            const step = rule.steps[base.length];
            const matches = step !== undefined && history.matches(event, step);
            return matches ? this.link(base, event, new Set()) : null;
        }
        if (!history.matches(event, rule.filter ?? {})) {
            return null;
        }
        return this.addShared(history, rule, base, event);
    }

    private addShared(history: UserHistory, rule: ChainRule, base: Link, event: WatchEvent): Link | null {
        const values = history.groupsOf(event, rule.same ?? 'item');
        if (base.length === 0) {
            return values.length ? this.link(base, event, new Set(values)) : null;
        }
        const shared = new Set(values.filter((value) => base.shared.has(value)));
        return shared.size ? this.link(base, event, shared) : null;
    }

    // The run of base with this watch added.
    private link(base: Link, event: WatchEvent, shared: Set<string>): Link {
        return {
            length: base.length + 1,
            shared,
            items: new Set([...base.items, event.ratingKey]),
        };
    }

    // From the end of one watch to the start of the next.
    private isClose(history: UserHistory, rule: ChainRule, before: WatchEvent, after: WatchEvent): boolean {
        const gapSeconds = history.startOf(after) - before.watchedAt;
        return gapSeconds <= rule.maxGapHours * 3600;
    }

}
