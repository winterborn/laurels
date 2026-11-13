import type {
    WatchEvent,
    WindowRule,
} from '../../model/index.ts';
import {
    groupBy,
    lastOf,
    periodOfDay,
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

// N matching watches inside one local day, month or year, or any 24 hours.
export class WindowEvaluator implements Evaluator<WindowRule> {

    evaluate(history: UserHistory, rule: WindowRule): RuleResult {
        const events = history.select(rule.filter);
        switch (rule.span) {
            case 'day':
            case 'month':
            case 'year':
                return rule.measure === 'hours'
                    ? this.hoursByPeriod(history, rule)
                    : this.byPeriod(history, rule, events);
            case '24h':
                return this.bySlidingDay(history, rule, events);
        }
    }

    // Hours watched in one local day, month or year. Partial plays add their time too.
    private hoursByPeriod(history: UserHistory, rule: WindowRule): RuleResult {
        const events = history.selectTime(rule.filter);
        const seconds = new Map<string, number>();
        const targetSeconds = rule.target * 3600;
        const crossing = events.find((event) => {
            const group = this.periodGroupOf(history, rule, event);
            const total = (seconds.get(group) ?? 0) + history.secondsOf(event);
            seconds.set(group, total);
            return total >= targetSeconds;
        });
        const bestHours = Math.floor(Math.max(0, ...seconds.values()) / 3600);
        return {
            earned: crossing !== undefined,
            value: crossing ? rule.target : Math.min(bestHours, rule.target),
            target: rule.target,
            earnedAt: crossing?.watchedAt,
            eventId: crossing?.id,
            posterKey: crossing ? history.posterKeyOf(crossing) : undefined,
            note: crossing ? undefined : `Best ${bestHours} hours ${this.spanWords(rule)}`,
        };
    }

    private byPeriod(
        history: UserHistory,
        rule: WindowRule,
        events: WatchEvent[],
    ): RuleResult {
        const tally = new Tally(rule.target);
        for (const event of events) {
            tally.add(this.periodGroupOf(history, rule, event), this.memberOf(history, rule, event), event);
        }
        const leader = tally.leader;
        const busiest = events.filter((event) => this.periodGroupOf(history, rule, event) === leader.group);
        const shown = tally.crossing ?? lastOf(busiest);
        return this.result(history, rule, tally.crossing, leader.size, shown);
    }

    // "2026-11-12", "2026-11" or "2026", with the show when grouped by show.
    private periodGroupOf(history: UserHistory, rule: WindowRule, event: WatchEvent): string {
        const day = history.localStart(event).day;
        return `${periodOfDay(rule.span, day)}|${this.showOf(rule, event)}`;
    }

    // Each watch counts, or each local day or each item counts once.
    private memberOf(history: UserHistory, rule: WindowRule, event: WatchEvent): string {
        switch (rule.distinct) {
            case 'day':
                return history.localStart(event).day;
            case 'item':
                return event.ratingKey;
            default:
                return event.id;
        }
    }

    private bySlidingDay(
        history: UserHistory,
        rule: WindowRule,
        events: WatchEvent[],
    ): RuleResult {
        const groups = groupBy(events, (event) => this.showOf(rule, event));
        const hits = [...groups.values()].flatMap((group) => this.windowHits(history, rule, group));
        const best = hits.reduce((most, hit) => Math.max(most, hit.count), 0);
        const crossings = hits
            .filter((hit) => hit.count >= rule.target)
            .sort((a, b) => a.event.watchedAt - b.event.watchedAt);
        const busiest = hits.find((hit) => hit.count === best);
        const crossing = crossings[0]?.event;
        return this.result(history, rule, crossing, best, crossing ?? busiest?.event);
    }

    // For each watch: how many watches (or items) started in the 24 hours up to it.
    private windowHits(history: UserHistory, rule: WindowRule, events: WatchEvent[]): WindowHit[] {
        return events.map((event, index) => {
            const start = history.startOf(event);
            const earlier = events.slice(0, index + 1);
            const inWindow = earlier.filter((other) => history.startOf(other) > start - DAY_SECONDS);
            const members = new Set(inWindow.map((other) => this.memberOf(history, rule, other)));
            return {
                event,
                count: members.size,
            };
        });
    }

    private showOf(rule: WindowRule, event: WatchEvent): string {
        switch (rule.groupBy) {
            case 'show':
                return event.showKey ?? event.ratingKey;
            case 'item':
                return event.ratingKey;
            default:
                return 'all';
        }
    }

    private spanWords(rule: WindowRule): string {
        switch (rule.span) {
            case 'day':
                return 'in a day';
            case '24h':
                return 'in 24 hours';
            case 'month':
                return 'in a month';
            case 'year':
                return 'in a year';
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
