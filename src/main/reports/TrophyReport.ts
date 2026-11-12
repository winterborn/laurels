import type { App } from '../App.ts';
import type {
    Achievement,
    Award,
    Progress,
    User,
    WatchEvent,
} from '../model/index.ts';
import { CreditsBuilder } from '../rules/index.ts';
import type { UserHistory } from '../rules/index.ts';

type Json = Record<string, unknown>;

const CREDITS_LIMIT = 40;
const RELATED_LIMIT = 3;

// One achievement for one person: the credits, the household and related awards.
export class TrophyReport {

    private readonly app: App;
    private readonly credits = new CreditsBuilder();

    constructor(app: App) {
        this.app = app;
    }

    build(achievementId: string, userId: string): Json | null {
        const achievement = this.app.catalogue.byId(achievementId);
        const users = this.app.visibleUsers();
        const user = users.find((candidate) => candidate.id === userId);
        if (!achievement || !user) {
            return null;
        }
        const awards = this.app.store.awards().filter((award) => award.achievementId === achievementId);
        const progress = this.progressOf(user.id, achievementId);
        const history = this.app.historyOf(user.id);
        const credits = this.credits.build(history, achievement, progress);
        const award = awards.find((candidate) => candidate.userId === user.id);
        return {
            achievementId,
            user: this.person(user),
            progress,
            award: award ? this.awardFacts(history, award) : null,
            credits: this.creditRows(history, credits),
            creditCount: credits.length,
            household: users.map((person) => this.householdRow(person, achievementId, awards)),
            related: this.related(achievement, user.id),
        };
    }

    private progressOf(userId: string, achievementId: string): Progress | undefined {
        const progress = this.app.scoreboard.progressOf(userId);
        return progress.find((entry) => entry.achievementId === achievementId);
    }

    private person(user: User): Json {
        return {
            id: user.id,
            name: user.name,
        };
    }

    private awardFacts(history: UserHistory, award: Award): Json {
        const event = history.events.find((candidate) => candidate.id === award.eventId);
        return {
            awardedAt: award.awardedAt,
            posterKey: award.posterKey,
            earnedWith: event ? this.watchTitle(history, event) : '',
            note: award.note,
        };
    }

    // Newest first, numbered from the first watch that counted.
    private creditRows(history: UserHistory, events: WatchEvent[]): Json[] {
        const rows = events.map((event, index) => ({
            number: index + 1,
            title: this.watchTitle(history, event),
            posterKey: history.posterKeyOf(event),
            watchedAt: event.watchedAt,
        }));
        return rows.reverse().slice(0, CREDITS_LIMIT);
    }

    // "Harbour Lights · S2 E4" for episodes, the title for films.
    private watchTitle(history: UserHistory, event: WatchEvent): string {
        const item = history.itemOf(event);
        if (event.kind !== 'episode') {
            return item?.title ?? 'Unknown title';
        }
        const show = history.titleOf(event);
        const season = item?.seasonIndex ?? '?';
        const episode = item?.index ?? '?';
        return `${show} · S${season} E${episode}`;
    }

    private householdRow(user: User, achievementId: string, awards: Award[]): Json {
        const progress = this.progressOf(user.id, achievementId);
        const award = awards.find((candidate) => candidate.userId === user.id);
        return {
            id: user.id,
            name: user.name,
            earned: Boolean(award),
            awardedAt: award?.awardedAt ?? null,
            value: progress?.value ?? 0,
            target: progress?.target ?? 1,
        };
    }

    // Other awards of the same kind, not secret.
    private related(achievement: Achievement, userId: string): Json[] {
        const candidates = this.app.achievements.filter((other) => {
            const isOther = other.id !== achievement.id;
            const isSameKind = other.section === achievement.section || other.rule.type === achievement.rule.type;
            return isOther && isSameKind && !other.secret;
        });
        return candidates.slice(0, RELATED_LIMIT).map((other) => {
            const progress = this.progressOf(userId, other.id);
            return {
                id: other.id,
                earned: progress?.earned ?? false,
                value: progress?.value ?? 0,
                target: progress?.target ?? 1,
            };
        });
    }

}
