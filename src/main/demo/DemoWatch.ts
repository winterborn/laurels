import type { App } from '../App.ts';
import type {
    Item,
    WatchEvent,
} from '../model/index.ts';
import {
    RuleEngine,
    UserHistory,
} from '../rules/index.ts';

export interface DemoResult {
    title: string;
    trophies: string[];
}

interface Candidate {
    item: Item;
    newTrophies: string[];
}

// Demo only: adds a watch on the mock server that wins a new trophy, then syncs.
// It tries each film and episode "now" and keeps the one with the fewest new trophies.
export class DemoWatch {

    private readonly app: App;
    private readonly mockUrl: string;
    private readonly engine = new RuleEngine();

    constructor(app: App, mockUrl: string) {
        this.app = app;
        this.mockUrl = mockUrl.replace(/\/+$/, '');
    }

    async run(userId: string): Promise<DemoResult> {
        const best = this.bestCandidate(userId);
        if (!best) {
            throw new Error('No single watch gives this person a new trophy now. Restart the demo to start again.');
        }
        await this.addWatch(userId, best.item.ratingKey);
        await this.app.runCycle();
        return {
            title: this.titleOf(best.item),
            trophies: best.newTrophies,
        };
    }

    private bestCandidate(userId: string): Candidate | undefined {
        const history = this.app.historyOf(userId);
        const items = this.app.store.items();
        const earned = this.earnedIds(history);
        const watchable = [...items.values()].filter((item) => {
            const isVideo = item.kind === 'movie' || item.kind === 'episode';
            return isVideo && !item.missing;
        });
        const candidates = watchable
            .map((item) => ({
                item,
                newTrophies: this.newTrophies(history, items, item, earned),
            }))
            .filter((candidate) => candidate.newTrophies.length > 0);
        return candidates.sort((a, b) => a.newTrophies.length - b.newTrophies.length)[0];
    }

    private newTrophies(
        history: UserHistory,
        items: Map<string, Item>,
        item: Item,
        earned: Set<string>,
    ): string[] {
        const watch: WatchEvent = {
            id: 'demo:candidate',
            userId: history.userId,
            ratingKey: item.ratingKey,
            kind: item.kind === 'episode' ? 'episode' : 'movie',
            showKey: item.showKey,
            seasonKey: item.seasonKey,
            watchedAt: Math.floor(Date.now() / 1000),
            source: 'plex',
        };
        const timeZone = this.app.settings.timeZone;
        const trial = new UserHistory(history.userId, [...history.events, watch], items, timeZone);
        return [...this.earnedIds(trial)].filter((id) => !earned.has(id));
    }

    private earnedIds(history: UserHistory): Set<string> {
        const progress = this.engine.evaluateAll(history, this.app.achievements);
        return new Set(progress.filter((entry) => entry.earned).map((entry) => entry.achievementId));
    }

    private async addWatch(userId: string, ratingKey: string): Promise<void> {
        const response = await fetch(`${this.mockUrl}/mock/watch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Plex-Token': this.app.settings.plexToken,
            },
            body: JSON.stringify({
                accountID: Number(userId),
                ratingKey,
            }),
        });
        if (!response.ok) {
            throw new Error(`The mock server returned ${response.status}`);
        }
    }

    private titleOf(item: Item): string {
        if (item.kind !== 'episode') {
            return item.title;
        }
        const show = this.app.store.items().get(item.showKey ?? '');
        return `${show?.title ?? 'A show'}, episode ${item.index ?? ''}`;
    }

}
