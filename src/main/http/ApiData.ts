import type {
    Achievement,
    Award,
    Item,
    User,
} from '../model/index.ts';
import type { App } from '../App.ts';
import {
    CATEGORY_NAMES,
    householdShare,
    TIER_COLOURS,
    TIER_POINTS,
    TIER_WORDS,
    unitOf,
} from '../helpers/index.ts';

type Json = Record<string, unknown>;

// Builds the JSON the dashboard reads.
export class ApiData {

    private readonly app: App;

    constructor(app: App) {
        this.app = app;
    }

    definitions(): Json[] {
        const holders = this.holderIds();
        const people = this.app.visibleUsers().length;
        return this.app.achievements.map((achievement) => {
            const ids = holders.get(achievement.id) ?? [];
            return {
                ...this.definition(achievement),
                holders: ids.length,
                holderIds: ids,
                people,
                householdShare: householdShare(ids.length, people),
            };
        });
    }

    // GET /api/awards[?user=id]: newest first. Same idea as the reference project.
    awards(userId?: string): Json[] {
        const names = new Map(this.app.visibleUsers().map((user) => [user.id, user.name]));
        const items = this.app.store.items();
        return this.knownAwards()
            .filter((award) => names.has(award.userId))
            .filter((award) => !userId || award.userId === userId)
            .map((award) => ({
                userId: award.userId,
                userName: names.get(award.userId),
                ...this.awardRow(award, items),
            }));
    }

    // GET /api/progress[?user=id]: progress on every achievement.
    progress(userId?: string): Json[] {
        const users = this.app.visibleUsers().filter((user) => !userId || user.id === userId);
        return users.map((user) => ({
            userId: user.id,
            userName: user.name,
            progress: this.app.scoreboard.progressOf(user.id),
        }));
    }

    // Users ranked by points, most first.
    users(): Json[] {
        const awards = this.knownAwards();
        const firstWatches = this.firstWatches();
        const watchCounts = this.watchCounts();
        const items = this.app.store.items();
        const rows = this.app.visibleUsers().map((user) => {
            return {
                ...this.userRow(user, awards, firstWatches, items),
                films: watchCounts.get(`${user.id}|movie`) ?? 0,
                episodes: watchCounts.get(`${user.id}|episode`) ?? 0,
            };
        });
        const ranked = rows.sort((a, b) => b.points - a.points);
        return ranked.map((row, index) => ({
            ...row,
            rank: index + 1,
        }));
    }

    cabinet(userId: string): Json | null {
        const user = this.users().find((row) => row.id === userId);
        if (!user) {
            return null;
        }
        const items = this.app.store.items();
        const awards = this.knownAwards()
            .filter((award) => award.userId === userId)
            .map((award) => this.awardRow(award, items));
        return {
            user,
            awards,
            progress: this.app.scoreboard.progressOf(userId),
        };
    }

    // One person's awards given after `since` (epoch seconds), for the popup.
    premieres(userId: string, since: number): Json[] {
        const items = this.app.store.items();
        return this.knownAwards()
            .filter((award) => award.userId === userId)
            .filter((award) => (award.grantedAt ?? 0) > since)
            .map((award) => this.awardRow(award, items));
    }

    // Latest awards across the household.
    latest(limit: number): Json[] {
        const names = new Map(this.app.visibleUsers().map((user) => [user.id, user.name]));
        const items = this.app.store.items();
        return this.knownAwards()
            .filter((award) => names.has(award.userId))
            .slice(0, limit)
            .map((award) => ({
                ...this.awardRow(award, items),
                userName: names.get(award.userId),
            }));
    }

    private definition(achievement: Achievement): Json {
        return {
            id: achievement.id,
            title: achievement.title,
            description: achievement.description,
            flavorText: achievement.flavorText ?? '',
            tier: achievement.tier,
            section: achievement.section,
            category: CATEGORY_NAMES[achievement.section],
            secret: achievement.secret ?? false,
            ruleType: achievement.rule.type,
            unit: unitOf(achievement.rule),
            points: TIER_POINTS[achievement.tier],
            laurel: TIER_WORDS[achievement.tier],
            colour: TIER_COLOURS[achievement.tier],
        };
    }

    private userRow(
        user: User,
        awards: Award[],
        firstWatches: Map<string, number>,
        items: Map<string, Item>,
    ) {
        // Awards come newest first.
        const own = awards.filter((award) => award.userId === user.id);
        const points = own.reduce((sum, award) => sum + this.pointsOf(award), 0);
        const latest = own[0];
        return {
            id: user.id,
            name: user.name,
            points,
            trophies: own.length,
            since: firstWatches.get(user.id) ?? null,
            latest: latest ? this.awardRow(latest, items) : null,
        };
    }

    private awardRow(award: Award, items: Map<string, Item>): Json {
        const item = items.get(award.posterKey);
        return {
            achievementId: award.achievementId,
            awardedAt: award.awardedAt,
            posterKey: award.posterKey,
            posterTitle: item?.title ?? '',
            hasArt: Boolean(item?.art),
            note: award.note,
            grantedAt: award.grantedAt,
        };
    }

    // Awards whose achievement is still in achievements.json.
    private knownAwards(): Award[] {
        return this.app.store
            .awards()
            .filter((award) => this.app.catalogue.byId(award.achievementId) !== undefined);
    }

    // Which visible people hold each award, oldest win first.
    private holderIds(): Map<string, string[]> {
        const visible = new Set(this.app.visibleUsers().map((user) => user.id));
        const holders = new Map<string, string[]>();
        const oldestFirst = [...this.knownAwards()].reverse();
        for (const award of oldestFirst) {
            if (visible.has(award.userId)) {
                const ids = holders.get(award.achievementId) ?? [];
                ids.push(award.userId);
                holders.set(award.achievementId, ids);
            }
        }
        return holders;
    }

    private pointsOf(award: Award): number {
        const achievement = this.app.catalogue.byId(award.achievementId);
        if (!achievement) {
            return 0;
        }
        return TIER_POINTS[achievement.tier];
    }

    // "userId|kind" -> number of watches.
    private watchCounts(): Map<string, number> {
        const counts = new Map<string, number>();
        for (const event of this.app.store.events()) {
            const key = `${event.userId}|${event.kind}`;
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        return counts;
    }

    // Events come oldest first, so the first one per user wins.
    private firstWatches(): Map<string, number> {
        const firsts = new Map<string, number>();
        for (const event of this.app.store.events()) {
            if (!firsts.has(event.userId)) {
                firsts.set(event.userId, event.watchedAt);
            }
        }
        return firsts;
    }

}
