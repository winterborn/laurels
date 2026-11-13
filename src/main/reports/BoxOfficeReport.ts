import type { App } from '../App.ts';
import {
    dayNumber,
    groupBy,
    localParts,
    maxOf,
    TIER_ORDER,
    TIER_POINTS,
} from '../helpers/index.ts';
import type {
    Award,
    Item,
    User,
} from '../model/index.ts';
import type { UserHistory } from '../rules/index.ts';

type Json = Record<string, unknown>;

export type Range = 'all' | 'year' | 'month';

const RACE_MIN_SHARE = 0.5;
const LATE_HOUR_END = 5;

interface PersonStats {
    user: User;
    films: number;
    episodes: number;
    hours: number;
    lateWatches: number;
    longestStreak: number;
}

// The household chart, the closest race and the household titles.
export class BoxOfficeReport {

    private readonly app: App;

    constructor(app: App) {
        this.app = app;
    }

    build(range: Range): Json {
        const users = this.app.visibleUsers();
        const awards = this.knownAwards(users);
        const since = this.startOf(range);
        const items = this.app.store.items();
        const people = users.map((user) => this.personRow(user, awards, since, items));
        const lastRanks = this.lastRanks(users, awards, range);
        const ranked = people
            .sort((a, b) => b.points - a.points)
            .map((row, index) => ({
                ...row,
                rank: index + 1,
                lastRank: lastRanks.get(row.id) ?? null,
            }));
        return {
            range,
            people: ranked,
            totalTrophies: awards.filter((award) => award.awardedAt >= since).length,
            race: this.closestRace(users),
            titles: this.titles(users, since),
        };
    }

    private knownAwards(users: User[]): Award[] {
        const visible = new Set(users.map((user) => user.id));
        return this.app.store.awards().filter((award) => {
            const isKnown = this.app.catalogue.byId(award.achievementId) !== undefined;
            return isKnown && visible.has(award.userId);
        });
    }

    // Start of the year or month that holds `at`, in the server time zone.
    private startOf(range: Range, at = Math.floor(Date.now() / 1000)): number {
        if (range === 'all') {
            return 0;
        }
        const today = localParts(at, this.app.settings.timeZone).day;
        const [year, month] = today.split('-');
        const firstDay = range === 'year' ? `${year}-01-01` : `${year}-${month}-01`;
        const daysBack = dayNumber(today) - dayNumber(firstDay);
        const midnight = at - (at % 86_400);
        return midnight - daysBack * 86_400;
    }

    // Rank at the end of last month, as on a trade-paper chart.
    // Null when the person had no points then (shown as "New").
    private lastRanks(users: User[], awards: Award[], range: Range): Map<string, number> {
        const monthStart = this.startOf('month');
        const from = range === 'month' ? this.startOf('month', monthStart - 1) : this.startOf(range);
        const before = awards.filter((award) => award.awardedAt >= from && award.awardedAt < monthStart);
        const rows = users
            .map((user) => ({
                id: user.id,
                points: this.pointsOf(before.filter((award) => award.userId === user.id)),
            }))
            .filter((row) => row.points > 0)
            .sort((a, b) => b.points - a.points);
        return new Map(rows.map((row, index) => [row.id, index + 1]));
    }

    private personRow(user: User, awards: Award[], since: number, items: Map<string, Item>) {
        const own = awards.filter((award) => award.userId === user.id);
        const inRange = own.filter((award) => award.awardedAt >= since);
        const thisMonth = own.filter((award) => award.awardedAt >= this.startOf('month'));
        const latest = own[0];
        const rarest = this.rarestOf(own, awards);
        return {
            id: user.id,
            name: user.name,
            points: this.pointsOf(inRange),
            trophies: inRange.length,
            monthPoints: this.pointsOf(thisMonth),
            lastWin: latest ? {
                achievementId: latest.achievementId,
                awardedAt: latest.awardedAt,
            } : null,
            rarest: rarest ? {
                achievementId: rarest.achievementId,
                posterKey: rarest.posterKey,
                posterTitle: items.get(rarest.posterKey)?.title ?? '',
            } : null,
        };
    }

    private pointsOf(awards: Award[]): number {
        return awards.reduce((sum, award) => {
            const achievement = this.app.catalogue.byId(award.achievementId);
            return sum + (achievement ? TIER_POINTS[achievement.tier] : 0);
        }, 0);
    }

    // Fewest people have it; a higher tier wins a tie.
    private rarestOf(own: Award[], all: Award[]): Award | undefined {
        const holders = groupBy(all, (award) => award.achievementId);
        const scored = own.map((award) => {
            const achievement = this.app.catalogue.byId(award.achievementId);
            const tierRank = achievement ? TIER_ORDER.indexOf(achievement.tier) : 0;
            const count = holders.get(award.achievementId)?.length ?? 0;
            return {
                award,
                score: count * 10 - tierRank,
            };
        });
        const sorted = scored.sort((a, b) => a.score - b.score);
        return sorted[0]?.award;
    }

    // The locked trophy where two people are closest to each other, both past half way.
    private closestRace(users: User[]): Json | null {
        const races = this.app.achievements
            .filter((achievement) => !achievement.secret)
            .map((achievement) => this.raceFor(achievement.id, users))
            .filter((race) => race !== null);
        const sorted = races.sort((a, b) => b.closeness - a.closeness);
        const best = sorted[0];
        if (!best) {
            return null;
        }
        return {
            achievementId: best.achievementId,
            entries: best.entries,
        };
    }

    private raceFor(achievementId: string, users: User[]) {
        const runners = users
            .map((user) => {
                const progress = this.app.scoreboard.progressOf(user.id).find((entry) => entry.achievementId === achievementId);
                return {
                    name: user.name,
                    value: progress?.value ?? 0,
                    target: progress?.target ?? 1,
                    earned: progress?.earned ?? false,
                };
            })
            .filter((runner) => !runner.earned && runner.value / runner.target >= RACE_MIN_SHARE)
            .sort((a, b) => b.value / b.target - a.value / a.target);
        if (runners.length < 2) {
            return null;
        }
        const [first, second] = runners;
        const gap = first.value / first.target - second.value / second.target;
        return {
            achievementId,
            entries: [first, second],
            closeness: second.value / second.target - gap,
        };
    }

    private titles(users: User[], since: number): Json[] {
        const stats = users.map((user) => this.statsOf(user, this.app.historyOf(user.id), since));
        const titles = [
            this.title('Most film watches', stats, (entry) => entry.films, (value) => `${value} watches`),
            this.title('Most episode watches', stats, (entry) => entry.episodes, (value) => `${value} watches`),
            this.title('Most hours watched', stats, (entry) => entry.hours, (value) => `${value} hours`),
            this.title('Household night owl', stats, (entry) => entry.lateWatches, (value) => `${value} watches after 1am`),
            this.title('Longest run', stats, (entry) => entry.longestStreak, (value) => `${value} days in a row`),
        ];
        return titles.filter((title) => title !== null);
    }

    private title(
        name: string,
        stats: PersonStats[],
        valueOf: (entry: PersonStats) => number,
        textOf: (value: number) => string,
    ): Json | null {
        const sorted = [...stats].sort((a, b) => valueOf(b) - valueOf(a));
        const winner = sorted[0];
        if (!winner || !valueOf(winner)) {
            return null;
        }
        return {
            title: name,
            who: winner.user.name,
            value: textOf(valueOf(winner)),
        };
    }

    private statsOf(user: User, history: UserHistory, since: number): PersonStats {
        const events = history.events.filter((event) => event.watchedAt >= since);
        const timed = history.selectTime().filter((event) => event.watchedAt >= since);
        const seconds = timed.reduce((sum, event) => sum + history.secondsOf(event), 0);
        const late = events.filter((event) => {
            const hour = history.localStart(event).hour;
            return hour >= 1 && hour < LATE_HOUR_END;
        });
        return {
            user,
            films: events.filter((event) => event.kind === 'movie').length,
            episodes: events.filter((event) => event.kind === 'episode').length,
            hours: Math.round(seconds / 3600),
            lateWatches: late.length,
            longestStreak: this.longestStreak(events.map((event) => history.localStart(event).day)),
        };
    }

    private longestStreak(days: string[]): number {
        const numbers = [...new Set(days)].map(dayNumber).sort((a, b) => a - b);
        const runs = numbers.reduce<number[]>((list, day, index) => {
            const isNext = index > 0 && day - numbers[index - 1] === 1;
            list.push(isNext ? list[index - 1] + 1 : 1);
            return list;
        }, []);
        return maxOf(runs);
    }

}
