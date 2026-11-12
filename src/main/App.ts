import type {
    Achievement,
    Award,
    Progress,
    Settings,
    User,
} from './model/index.ts';
import type { Config } from './Config.ts';
import {
    parseAliases,
    parseList,
} from './helpers/index.ts';
import {
    type AwardNotice,
    DiscordNotifier,
} from './notify/index.ts';
import {
    Catalogue,
    UserHistory,
} from './rules/index.ts';
import { Scoreboard } from './scoring/index.ts';
import { SettingsStore } from './settings/index.ts';
import {
    PlexClient,
    PlexSource,
} from './sources/index.ts';
import { Store } from './store/index.ts';

export interface SyncStatus {
    at: number;
    ok: boolean;
    message: string;
}

const DAY_SECONDS = 86_400;
const INSTALLED_AT = 'app.installedAt';

// Sync, score, award, notify. Repeats every pollMinutes.
export class App {

    readonly config: Config;
    readonly store: Store;
    readonly catalogue: Catalogue;
    readonly settingsStore: SettingsStore;
    plex: PlexClient | null = null;
    scoreboard: Scoreboard;
    lastSync: SyncStatus | null = null;
    private source: PlexSource | null = null;
    private notifier: DiscordNotifier;
    private timer: NodeJS.Timeout | undefined;
    private isRunning = false;
    private watcherIds = new Set<string>();

    constructor(config: Config) {
        this.config = config;
        this.store = new Store(config.databasePath);
        this.catalogue = Catalogue.fromFile(config.achievementsPath);
        this.settingsStore = new SettingsStore(config.settingsPath, config.env);
        this.scoreboard = new Scoreboard(this.settings.timeZone);
        this.notifier = new DiscordNotifier('', '');
        this.rebuild();
    }

    get settings(): Settings {
        return this.settingsStore.current;
    }

    get isConfigured(): boolean {
        const hasUrl = this.settings.plexUrl !== '';
        const hasToken = this.settings.plexToken !== '';
        return hasUrl && hasToken;
    }

    get achievements(): Achievement[] {
        return this.catalogue.achievements;
    }

    get isSyncing(): boolean {
        return this.isRunning;
    }

    // Scores what is stored, then syncs in the background.
    start(): void {
        this.score();
        this.schedule();
        this.runInBackground();
    }

    updateSettings(patch: Partial<Settings>): Settings {
        const settings = this.settingsStore.save(patch);
        this.rebuild();
        this.schedule();
        this.runInBackground();
        return settings;
    }

    async runCycle(): Promise<void> {
        if (this.isRunning || !this.isConfigured) {
            return;
        }
        this.isRunning = true;
        try {
            this.catalogue.reloadIfChanged();
            await this.syncPlex();
            this.score();
            await this.grantAwards();
        } finally {
            this.isRunning = false;
        }
    }

    // Users with at least one watch, renamed by the aliases setting.
    visibleUsers(): User[] {
        const aliases = parseAliases(this.settings.userAliases);
        return this.store
            .users()
            .filter((user) => this.watcherIds.has(user.id))
            .filter((user) => this.isAllowed(user))
            .map((user) => ({
                ...user,
                name: aliases.get(user.id) ?? user.name,
            }));
    }

    historyOf(userId: string): UserHistory {
        const events = this.store.events().filter((event) => event.userId === userId);
        return new UserHistory(userId, events, this.store.items(), this.settings.timeZone);
    }

    private rebuild(): void {
        const settings = this.settings;
        this.plex = this.isConfigured ? new PlexClient(settings.plexUrl, settings.plexToken) : null;
        this.source = this.plex ? new PlexSource(this.plex, this.store) : null;
        this.notifier = new DiscordNotifier(settings.discordWebhookUrl, settings.publicUrl);
        this.scoreboard = new Scoreboard(settings.timeZone);
        this.score();
    }

    private schedule(): void {
        clearInterval(this.timer);
        const everyMs = this.settings.pollMinutes * 60_000;
        this.timer = setInterval(() => this.runInBackground(), everyMs);
    }

    private runInBackground(): void {
        this.runCycle().catch((error) => console.error('Cycle failed:', error));
    }

    private isAllowed(user: User): boolean {
        const allowed = parseList(this.settings.allowedUsers);
        if (!allowed.length) {
            return true;
        }
        return allowed.includes(user.id) || allowed.includes(user.name);
    }

    private async syncPlex(): Promise<void> {
        if (!this.source) {
            return;
        }
        try {
            const report = await this.source.sync();
            const message = `${report.users} users, ${report.newEvents} new watches, ${report.newItems} items`;
            this.recordSync(true, message);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.recordSync(false, message);
        }
    }

    private recordSync(ok: boolean, message: string): void {
        this.lastSync = {
            at: Math.floor(Date.now() / 1000),
            ok,
            message,
        };
        const prefix = ok ? 'Synced' : 'Sync failed';
        console.log(`${prefix}: ${message}`);
    }

    private score(): void {
        const events = this.store.events();
        this.watcherIds = new Set(events.map((event) => event.userId));
        this.scoreboard.refresh(
            this.visibleUsers(),
            events,
            this.store.items(),
            this.achievements,
        );
    }

    private async grantAwards(): Promise<void> {
        const earned = this.scoreboard.earned();
        const fresh = earned
            .map((progress) => this.awardFrom(progress))
            .filter((award) => this.store.saveAward(award));
        if (fresh.length) {
            console.log(`New awards: ${fresh.length}`);
        }
        await this.notify(fresh);
    }

    private awardFrom(progress: Progress & { userId: string }): Award {
        return {
            userId: progress.userId,
            achievementId: progress.achievementId,
            awardedAt: progress.earnedAt ?? Math.floor(Date.now() / 1000),
            eventId: progress.eventId ?? '',
            posterKey: progress.posterKey ?? '',
            note: progress.note ?? '',
        };
    }

    // Old awards found on the first sync are not announced.
    private async notify(fresh: Award[]): Promise<void> {
        if (!this.notifier.isEnabled) {
            return;
        }
        const since = this.notifySince();
        const notices = fresh
            .filter((award) => award.awardedAt >= since)
            .map((award) => this.noticeFor(award))
            .filter((notice) => notice !== null);
        try {
            await this.notifier.sendAll(notices);
            const now = Math.floor(Date.now() / 1000);
            for (const notice of notices) {
                this.store.markNotified(notice.award, now);
            }
        } catch (error) {
            console.error('Discord notify failed:', error);
        }
    }

    private noticeFor(award: Award): AwardNotice | null {
        const achievement = this.catalogue.byId(award.achievementId);
        const user = this.visibleUsers().find((candidate) => candidate.id === award.userId);
        if (!achievement || !user) {
            return null;
        }
        return {
            award,
            achievement,
            user,
            earnedWith: this.store.items().get(award.posterKey)?.title ?? '',
        };
    }

    private notifySince(): number {
        const now = String(Math.floor(Date.now() / 1000));
        const saved = this.store.getState(INSTALLED_AT);
        if (!saved) {
            this.store.setState(INSTALLED_AT, now);
        }
        const installedAt = Number(saved ?? now);
        return installedAt - this.settings.notifyBackfillDays * DAY_SECONDS;
    }

}
