import type {
    Achievement,
    Award,
    Progress,
    Settings,
    User,
    WatchEvent,
} from './model/index.ts';
import { PosterSigner } from './auth/index.ts';
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
    type CheckedWatches,
    HouseholdWatches,
    RuleEngine,
    UserHistory,
    WatchCheck,
} from './rules/index.ts';
import { Scoreboard } from './scoring/index.ts';
import { SettingsStore } from './settings/index.ts';
import {
    PlexClient,
    PlexSource,
    type SyncReport,
    TautulliClient,
    TautulliSource,
} from './sources/index.ts';
import { Store } from './store/index.ts';

export interface SyncStatus {
    at: number;
    ok: boolean;
    message: string;
}

const DAY_SECONDS = 86_400;
const INSTALLED_AT = 'app.installedAt';
// With awardsFrom "setup", only watches from this time win awards.
const AWARDS_START = 'awards.startsAt';

// Sync, score, award, notify. Repeats every pollMinutes.
export class App {

    readonly config: Config;
    readonly store: Store;
    readonly posterSigner: PosterSigner;
    readonly catalogue: Catalogue;
    readonly settingsStore: SettingsStore;
    plex: PlexClient | null = null;
    scoreboard: Scoreboard;
    lastSync: SyncStatus | null = null;
    private source: PlexSource | null = null;
    private tautulli: TautulliSource | null = null;
    private notifier: DiscordNotifier;
    private timer: NodeJS.Timeout | undefined;
    private isRunning = false;
    // False until a cycle scores and gives awards with the current settings.
    private isUpToDate = false;
    private watcherIds = new Set<string>();

    constructor(config: Config) {
        this.config = config;
        this.store = new Store(config.databasePath);
        this.posterSigner = new PosterSigner(this.store);
        this.catalogue = Catalogue.fromFile(config.achievementsPath, config.customAwardsPath);
        this.settingsStore = new SettingsStore(config.settingsPath, config.env);
        this.scoreboard = new Scoreboard(this.settings.timeZone);
        this.notifier = new DiscordNotifier('', '', this.posterSigner);
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

    // Ends the poll timer, so the process can exit.
    stop(): void {
        clearInterval(this.timer);
    }

    updateSettings(patch: Partial<Settings>): Settings {
        const settings = this.settingsStore.save(patch);
        this.isUpToDate = false;
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
            await this.syncAndScore();
        } finally {
            this.isRunning = false;
        }
    }

    // A failed sync can leave metadata half read, so it gives no awards.
    // A sync with no new data gives the same result, so it skips the work.
    private async syncAndScore(): Promise<void> {
        const hasNewRules = this.catalogue.reloadIfChanged();
        const report = await this.syncPlex();
        if (!report) {
            return;
        }
        const changedWatches = await this.syncTautulli();
        const hasNewData = report.newEvents > 0 || report.newItems > 0 || changedWatches > 0;
        const canSkip = this.isUpToDate && !hasNewRules && !hasNewData;
        if (canSkip) {
            return;
        }
        this.score();
        await this.grantAwards();
        this.isUpToDate = true;
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

    // The owner saved awards.json: score again now, and give awards at the next cycle.
    refreshAwards(): void {
        this.isUpToDate = false;
        this.score();
        this.runInBackground();
    }

    // Each person's progress on one award, for the awards editor. Nothing is saved.
    previewAward(achievement: Achievement): Array<Progress & { name: string }> {
        const engine = new RuleEngine();
        const users = this.visibleUsers();
        const shown = new Set(users.map((user) => user.id));
        const awarded = this.awardWatches();
        const events = awarded.watches.filter((event) => shown.has(event.userId));
        const household = new HouseholdWatches(events);
        const others = this.achievements.filter((entry) => entry.id !== achievement.id);
        return users.map((user) => {
            const history = this.awardHistoryOf(user.id, awarded);
            const all = engine.evaluateAll(history, [...others, achievement], household);
            const progress = all[all.length - 1];
            return {
                ...progress,
                name: user.name,
            };
        });
    }

    // All of one person's watches, for the Season review and the Ceremony.
    historyOf(userId: string): UserHistory {
        const events = this.store.events().filter((event) => event.userId === userId);
        const partial = this.store.partialPlays().filter((event) => event.userId === userId);
        return new UserHistory(userId, events, this.store.items(), this.settings.timeZone, partial);
    }

    // The watches of one person that can win awards.
    awardHistoryOf(userId: string, awarded = this.awardWatches()): UserHistory {
        const isMine = (event: WatchEvent) => event.userId === userId;
        const events = awarded.watches.filter(isMine);
        const partial = awarded.partialPlays.filter(isMine);
        return new UserHistory(userId, events, this.store.items(), this.settings.timeZone, partial);
    }

    private rebuild(): void {
        const settings = this.settings;
        this.plex = this.isConfigured ? new PlexClient(settings.plexUrl, settings.plexToken) : null;
        this.source = this.plex ? new PlexSource(this.plex, this.store) : null;
        this.tautulli = this.tautulliFor(settings);
        this.notifier = new DiscordNotifier(
            settings.discordWebhookUrl,
            settings.publicUrl,
            this.posterSigner,
        );
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

    private async syncPlex(): Promise<SyncReport | null> {
        if (!this.source || !this.plex) {
            return null;
        }
        const startedAt = Date.now();
        const requestsBefore = this.plex.requestCount;
        try {
            const report = await this.source.sync();
            const counts = `${report.users} users, ${report.newEvents} new watches, ${report.newItems} items`;
            this.recordSync(true, `${counts}${this.costOf(startedAt, requestsBefore)}`);
            return report;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.recordSync(false, `${message}${this.costOf(startedAt, requestsBefore)}`);
            return null;
        }
    }

    // Optional. A failure is logged and never stops the cycle.
    // Returns how many watches changed.
    private async syncTautulli(): Promise<number> {
        if (!this.tautulli) {
            return 0;
        }
        try {
            const report = await this.tautulli.sync();
            const hasNews = report.newPlays > 0 || report.changedWatches > 0;
            if (hasNews) {
                const counts = `${report.newPlays} new or changed plays, ${report.changedWatches} watches changed`;
                console.log(`Tautulli: ${counts}`);
            }
            return report.changedWatches;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Tautulli failed: ${message}`);
            return 0;
        }
    }

    private tautulliFor(settings: Settings): TautulliSource | null {
        const isSet = settings.tautulliUrl !== '' && settings.tautulliApiKey !== '';
        if (!isSet) {
            return null;
        }
        const client = new TautulliClient(settings.tautulliUrl, settings.tautulliApiKey);
        return new TautulliSource(client, this.store);
    }

    // " in 12.3 s, 45 Plex requests"
    private costOf(startedAt: number, requestsBefore: number): string {
        const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
        const requests = (this.plex?.requestCount ?? 0) - requestsBefore;
        return ` in ${seconds} s, ${requests} Plex requests`;
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
        const awarded = this.awardWatches();
        this.scoreboard.refresh(
            this.visibleUsers(),
            awarded.watches,
            this.store.items(),
            this.achievements,
            awarded.partialPlays,
        );
    }

    // The watches that pass the WatchCheck. With awardsFrom "setup", only watches from setup on.
    // The check reads all watches, so plays from before setup still add time on screen.
    private awardWatches(): CheckedWatches {
        const check = new WatchCheck(this.store.items());
        const checked = check.apply(this.store.events(), this.store.partialPlays());
        return {
            watches: this.awardEvents(checked.watches),
            partialPlays: this.awardEvents(checked.partialPlays),
        };
    }

    private awardEvents(events: WatchEvent[]): WatchEvent[] {
        if (this.settings.awardsFrom === 'all') {
            return events;
        }
        const startsAt = this.awardsStart();
        return events.filter((event) => event.watchedAt >= startsAt);
    }

    // The time of setup: the first time Laurels scores in "setup" mode.
    // It stays the same after that, also when the owner switches the setting back and forth.
    private awardsStart(): number {
        const saved = this.store.getState(AWARDS_START);
        if (saved) {
            return Number(saved);
        }
        const now = Math.floor(Date.now() / 1000);
        this.store.setState(AWARDS_START, String(now));
        return now;
    }

    // Saved awards keep the date, watch and poster of the current rules.
    private async grantAwards(): Promise<void> {
        const earned = this.scoreboard
            .earned()
            .map((progress) => this.awardFrom(progress));
        const fresh = this.store.transaction(() => earned.filter((award) => this.store.saveAward(award)));
        const dated = earned.filter((award) => award.eventId !== '');
        const changed = this.store.updateAwards(dated);
        const removed = this.removeStaleAwards(earned);
        if (fresh.length) {
            console.log(`New awards: ${fresh.length}`);
        }
        if (changed) {
            console.log(`Updated awards: ${changed}`);
        }
        if (removed) {
            console.log(`Removed awards: ${removed}`);
        }
        await this.notify(fresh);
    }

    // Awards follow the rules: Laurels removes a saved award that the rules no longer give.
    // It keeps the awards of people that it did not score (people hidden in Settings)
    // and the awards of rules that threw an error.
    private removeStaleAwards(earned: Award[]): number {
        const keyOf = (award: Award) => `${award.userId}|${award.achievementId}`;
        const kept = new Set(earned.map(keyOf));
        const scored = this.scoreboard.userIds();
        const failed = this.scoreboard.failedKeys();
        const stale = this.store.awards().filter((award) => {
            const key = keyOf(award);
            const isScored = scored.has(award.userId);
            return isScored && !kept.has(key) && !failed.has(key);
        });
        this.store.deleteAwards(stale);
        return stale.length;
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
            earnedWith: this.store.item(award.posterKey)?.title ?? '',
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
