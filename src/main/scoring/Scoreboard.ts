import type {
    Achievement,
    Item,
    Progress,
    User,
    WatchEvent,
} from '../model/index.ts';
import { groupBy } from '../helpers/index.ts';
import {
    RuleEngine,
    UserHistory,
} from '../rules/index.ts';

// The latest progress of every user on every achievement.
export class Scoreboard {

    private readonly engine = new RuleEngine();
    private readonly timeZone: string;
    private progressByUser = new Map<string, Progress[]>();

    constructor(timeZone: string) {
        this.timeZone = timeZone;
    }

    refresh(
        users: User[],
        events: WatchEvent[],
        items: Map<string, Item>,
        achievements: Achievement[],
    ): void {
        const eventsByUser = groupBy(events, (event) => event.userId);
        const entries = users.map((user) => {
            const userEvents = eventsByUser.get(user.id) ?? [];
            const history = new UserHistory(user.id, userEvents, items, this.timeZone);
            const progress = this.engine.evaluateAll(history, achievements);
            return [user.id, progress] as [string, Progress[]];
        });
        this.progressByUser = new Map(entries);
    }

    progressOf(userId: string): Progress[] {
        return this.progressByUser.get(userId) ?? [];
    }

    earned(): Array<Progress & { userId: string }> {
        const entries = [...this.progressByUser.entries()];
        return entries.flatMap(([userId, progress]) => {
            return progress
                .filter((entry) => entry.earned)
                .map((entry) => ({
                    ...entry,
                    userId,
                }));
        });
    }

}
