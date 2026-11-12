import type {
    Achievement,
    CompleteRule,
    CountRule,
    Progress,
    Rule,
    StreakRule,
    WatchEvent,
    WindowRule,
} from '../model/index.ts';
import {
    dayNumber,
    periodOfDay,
} from '../helpers/index.ts';
import type { UserHistory } from './UserHistory.ts';

const DAY_SECONDS = 86_400;

// "The credits": the watches that count toward one achievement,
// oldest first, up to the watch that earned it.
export class CreditsBuilder {

    build(history: UserHistory, achievement: Achievement, progress: Progress | undefined): WatchEvent[] {
        const rule = achievement.rule;
        const counted = this.countedFor(history, rule, progress);
        return this.untilEarned(counted, progress);
    }

    private countedFor(history: UserHistory, rule: Rule, progress: Progress | undefined): WatchEvent[] {
        switch (rule.type) {
            case 'awards':
                return [];
            case 'shared':
                return history.events.filter((event) => event.id === progress?.eventId);
            case 'count':
                return this.forCount(history, rule, progress);
            case 'hours':
                return history.selectTime(rule.filter);
            case 'complete':
                return this.forComplete(history, rule, progress);
            case 'streak':
                return this.forStreak(history, rule, progress);
            case 'window':
                return this.forWindow(history, rule, progress);
        }
    }

    // Only the leading group (one director, one actor ...), each item once if distinct.
    private forCount(history: UserHistory, rule: CountRule, progress: Progress | undefined): WatchEvent[] {
        const events = history.select(rule.filter);
        const group = this.leadingGroup(history, rule, progress);
        const inGroup = group === null
            ? events
            : events.filter((event) => history.groupsOf(event, rule.groupBy ?? 'item').includes(group));
        if (!rule.distinct) {
            return inGroup;
        }
        const seen = new Set<string>();
        return inGroup.filter((event) => {
            const member = rule.distinct === 'show' ? (event.showKey ?? event.ratingKey) : event.ratingKey;
            const isNew = !seen.has(member);
            seen.add(member);
            return isNew;
        });
    }

    private leadingGroup(history: UserHistory, rule: CountRule, progress: Progress | undefined): string | null {
        if (!rule.groupBy || !progress) {
            return null;
        }
        const isKeyGroup = rule.groupBy === 'item' || rule.groupBy === 'show';
        if (isKeyGroup) {
            return progress.posterKey ?? null;
        }
        return progress.note ?? null;
    }

    // The episodes of the show or season that the trophy is about.
    private forComplete(history: UserHistory, rule: CompleteRule, progress: Progress | undefined): WatchEvent[] {
        const anchor = history.events.find((event) => event.id === progress?.eventId);
        const episodes = history.select({ kind: 'episode' });
        const setKey = rule.set === 'show'
            ? (anchor?.showKey ?? progress?.posterKey)
            : anchor?.seasonKey;
        if (!setKey) {
            return [];
        }
        const inSet = episodes.filter((event) => event.showKey === setKey || event.seasonKey === setKey);
        const seen = new Set<string>();
        return inSet.filter((event) => {
            const isNew = !seen.has(event.ratingKey);
            seen.add(event.ratingKey);
            return isNew;
        });
    }

    // The days of the run that earned it.
    private forStreak(history: UserHistory, rule: StreakRule, progress: Progress | undefined): WatchEvent[] {
        const events = history.select(rule.filter);
        const anchor = events.find((event) => event.id === progress?.eventId);
        if (!anchor) {
            return events;
        }
        const lastDay = dayNumber(history.localStart(anchor).day);
        const firstDay = lastDay - rule.target + 1;
        return events.filter((event) => {
            const day = dayNumber(history.localStart(event).day);
            return day >= firstDay && day <= lastDay;
        });
    }

    // The watches in the day, month, year or 24 hours that earned it.
    private forWindow(history: UserHistory, rule: WindowRule, progress: Progress | undefined): WatchEvent[] {
        const events = history.select(rule.filter);
        const anchor = events.find((event) => event.id === progress?.eventId);
        if (!anchor) {
            return events;
        }
        const sameShow = (event: WatchEvent) => !rule.groupBy || event.showKey === anchor.showKey;
        if (rule.span !== '24h') {
            const period = periodOfDay(rule.span, history.localStart(anchor).day);
            return events.filter((event) => {
                const isSamePeriod = periodOfDay(rule.span, history.localStart(event).day) === period;
                return sameShow(event) && isSamePeriod;
            });
        }
        const end = history.startOf(anchor);
        return events.filter((event) => {
            const start = history.startOf(event);
            return sameShow(event) && start > end - DAY_SECONDS && start <= end;
        });
    }

    private untilEarned(events: WatchEvent[], progress: Progress | undefined): WatchEvent[] {
        const index = events.findIndex((event) => event.id === progress?.eventId);
        if (index < 0) {
            return events;
        }
        return events.slice(0, index + 1);
    }

}
