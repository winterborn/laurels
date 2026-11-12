import type {
    WatchEvent,
    WindowRule,
} from '../../model/index.ts';
import {
    groupBy,
    lastOf,
} from '../../helpers/index.ts';
import { Tally } from '../Tally.ts';
import type { UserHistory } from '../UserHistory.ts';
import type {
    Evaluator,
    RuleResult,
} from './Evaluator.ts';

const DAY_SECONDS = 86_400;

interface WindowHit {
    event: WatchEvent;
    count: number;
}

// N matching watches inside one local day, or any 24 hours.
export class WindowEvaluator implements Evaluator<WindowRule> {

    evaluate(history: UserHistory, rule: WindowRule): RuleResult {
        const events = history.select(rule.filter);
        switch (rule.span) {
            case 'day':
                return this.byDay(history, rule, events);
            case '24h':
                return this.bySlidingDay(history, rule, events);
        }
    }

    private byDay(
        history: UserHistory,
        rule: WindowRule,
        events: WatchEvent[],
    ): RuleResult {
        const tally = new Tally(rule.target);
        for (const event of events) {
            tally.add(this.dayGroupOf(history, rule, event), event.id, event);
        }
        const leader = tally.leader;
        const busiest = events.filter((event) => this.dayGroupOf(history, rule, event) === leader.group);
        const shown = tally.crossing ?? lastOf(busiest);
        return this.result(history, rule, tally.crossing, leader.size, shown);
    }

    private dayGroupOf(history: UserHistory, rule: WindowRule, event: WatchEvent): string {
        const day = history.localStart(event).day;
        return `${day}|${this.showOf(rule, event)}`;
    }

    private bySlidingDay(
        history: UserHistory,
        rule: WindowRule,
        events: WatchEvent[],
    ): RuleResult {
        const groups = groupBy(events, (event) => this.showOf(rule, event));
        const hits = [...groups.values()].flatMap((group) => this.windowHits(history, group));
        const best = hits.reduce((most, hit) => Math.max(most, hit.count), 0);
        const crossings = hits
            .filter((hit) => hit.count >= rule.target)
            .sort((a, b) => a.event.watchedAt - b.event.watchedAt);
        const busiest = hits.find((hit) => hit.count === best);
        const crossing = crossings[0]?.event;
        return this.result(history, rule, crossing, best, crossing ?? busiest?.event);
    }

    // For each watch: how many watches started in the 24 hours up to it.
    private windowHits(history: UserHistory, events: WatchEvent[]): WindowHit[] {
        return events.map((event, index) => {
            const start = history.startOf(event);
            const earlier = events.slice(0, index + 1);
            const inWindow = earlier.filter((other) => history.startOf(other) > start - DAY_SECONDS);
            return {
                event,
                count: inWindow.length,
            };
        });
    }

    private showOf(rule: WindowRule, event: WatchEvent): string {
        if (!rule.groupBy) {
            return 'all';
        }
        return event.showKey ?? event.ratingKey;
    }

    private spanWords(rule: WindowRule): string {
        switch (rule.span) {
            case 'day':
                return 'in a day';
            case '24h':
                return 'in 24 hours';
        }
    }

    private result(
        history: UserHistory,
        rule: WindowRule,
        crossing: WatchEvent | undefined,
        best: number,
        shown: WatchEvent | undefined,
    ): RuleResult {
        return {
            earned: crossing !== undefined,
            value: Math.min(best, rule.target),
            target: rule.target,
            earnedAt: crossing?.watchedAt,
            eventId: crossing?.id,
            posterKey: shown ? history.posterKeyOf(shown) : undefined,
            note: crossing ? undefined : `Best ${best} ${this.spanWords(rule)}`,
        };
    }

}
