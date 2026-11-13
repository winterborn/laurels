import type { App } from '../App.ts';
import {
    DemoPack,
    DemoWatch,
} from '../demo/index.ts';
import { unitOf } from '../helpers/index.ts';
import type { Settings } from '../model/index.ts';
import type { CustomEntry } from '../rules/index.ts';
import { DiscordNotifier } from '../notify/index.ts';
import {
    PlexAccount,
    PlexClient,
    TautulliClient,
} from '../sources/index.ts';

type Json = Record<string, unknown>;

export interface RouteResult {
    status: number;
    body: unknown;
}

// Settings page. The owner only. Tokens never go back to the browser.
export class SettingsRoutes {

    private readonly app: App;

    constructor(app: App) {
        this.app = app;
    }

    status(): Json {
        return {
            configured: this.app.isConfigured,
            syncing: this.app.isSyncing,
            lastSync: this.app.lastSync,
            users: this.app.visibleUsers().length,
            watches: this.app.store.events().length,
            awards: this.app.store.awards().length,
            awardsBegin: this.app.isConfigured ? this.app.awardsBegin() : null,
            tautulli: this.app.settings.tautulliUrl !== '',
        };
    }

    settings(): Json {
        const { plexToken, tautulliApiKey, clientId, ownerId, ...shown } = this.app.settings;
        return {
            values: shown,
            plexTokenSet: plexToken !== '',
            tautulliKeySet: tautulliApiKey !== '',
            locked: this.app.settingsStore.locked,
            timeZones: Intl.supportedValuesOf('timeZone'),
            demo: this.app.config.demoMockUrl !== '',
        };
    }

    save(body: Json): RouteResult {
        this.app.updateSettings(body as Partial<Settings>);
        return this.ok(this.settings());
    }

    // Tests the URL in the form, with the typed token or the saved one.
    async testPlex(body: Json): Promise<RouteResult> {
        const url = String(body.plexUrl ?? this.app.settings.plexUrl).replace(/\/+$/, '');
        const token = String(body.plexToken || this.app.settings.plexToken);
        if (!url || !token) {
            return this.fail('Add the server address and sign in with Plex first.');
        }
        try {
            const info = await new PlexClient(url, token).serverInfo();
            return this.ok(info);
        } catch (error) {
            return this.fail(this.messageOf(error));
        }
    }

    // Your awards: the entries of awards.json and the built-in awards.
    customAwards(): RouteResult {
        const catalogue = this.app.catalogue;
        const builtIn = catalogue.builtIn();
        try {
            return this.ok({
                entries: catalogue.customEntries(),
                builtIn,
                fileError: '',
            });
        } catch (error) {
            return this.ok({
                entries: [],
                builtIn,
                fileError: `awards.json is not valid JSON: ${this.messageOf(error)}. Fix the file, or save here to replace it.`,
            });
        }
    }

    saveAwards(body: Json): RouteResult {
        const entries = Array.isArray(body.entries) ? body.entries as CustomEntry[] : null;
        if (!entries) {
            return this.fail('Send a list of awards.');
        }
        const problems = this.app.catalogue.problemsIn(entries);
        if (problems.length) {
            return {
                status: 400,
                body: {
                    error: 'Some awards have a problem. Fix them, then save again.',
                    problems,
                },
            };
        }
        try {
            this.app.catalogue.saveCustom(entries);
        } catch (error) {
            return this.fail(`Laurels cannot write awards.json: ${this.messageOf(error)}`);
        }
        this.app.refreshAwards();
        return this.customAwards();
    }

    // Checks one award and shows each person's progress. Nothing is saved.
    checkAward(body: Json): RouteResult {
        const entry = body.entry as CustomEntry | undefined;
        if (!entry) {
            return this.fail('Send one award to check.');
        }
        const [problem] = this.app.catalogue.problemsIn([entry]);
        if (problem) {
            return this.fail(problem.problem);
        }
        if (entry.remove) {
            return this.ok({ people: [] });
        }
        const achievement = this.app.catalogue.resolve(entry);
        const unit = unitOf(achievement.rule);
        const people = this.app.previewAward(achievement).map((progress) => ({
            name: progress.name,
            value: progress.value,
            target: progress.target,
            earned: progress.earned,
            unit: progress.target === 1 ? unit.one : unit.many,
        }));
        return this.ok({ people });
    }

    // Tests the address in the form, with the typed key or the saved one.
    async testTautulli(body: Json): Promise<RouteResult> {
        const url = String(body.tautulliUrl ?? this.app.settings.tautulliUrl).trim();
        const key = String(body.tautulliApiKey || this.app.settings.tautulliApiKey);
        if (!url || !key) {
            return this.fail('Add the Tautulli address and the API key first.');
        }
        try {
            const name = await new TautulliClient(url, key).serverName();
            return this.ok({ name });
        } catch (error) {
            return this.fail(this.messageOf(error));
        }
    }

    async testDiscord(body: Json): Promise<RouteResult> {
        const webhook = String(body.discordWebhookUrl || this.app.settings.discordWebhookUrl);
        try {
            await new DiscordNotifier(webhook, '').sendTest();
            return this.ok({ sent: true });
        } catch (error) {
            return this.fail(this.messageOf(error));
        }
    }

    // "Check now": sync without waiting for the next scheduled check.
    async checkNow(): Promise<RouteResult> {
        await this.app.runCycle();
        return this.ok(this.status());
    }

    async demoWatch(userId: string): Promise<RouteResult> {
        const mockUrl = this.app.config.demoMockUrl;
        if (!mockUrl) {
            return this.fail('This works only in the demo.');
        }
        try {
            const result = await new DemoWatch(this.app, mockUrl).run(userId);
            return this.ok(result);
        } catch (error) {
            return this.fail(this.messageOf(error));
        }
    }

    demoPack(): RouteResult {
        const source = this.app.config.demoPackPath;
        if (!source) {
            return this.fail('This works only in the demo.');
        }
        try {
            return this.ok(new DemoPack(this.app, source).run());
        } catch (error) {
            return this.fail(this.messageOf(error));
        }
    }

    async servers(): Promise<RouteResult> {
        const token = this.app.settings.plexToken;
        if (!token) {
            return this.fail('Sign in with Plex first.');
        }
        try {
            const servers = await this.account().servers(token);
            return this.ok(servers);
        } catch (error) {
            return this.fail(this.messageOf(error));
        }
    }

    private account(): PlexAccount {
        return new PlexAccount(this.app.settings.clientId, this.app.config.plexTv);
    }

    private ok(body: unknown): RouteResult {
        return {
            status: 200,
            body,
        };
    }

    private fail(message: string): RouteResult {
        return {
            status: 400,
            body: {
                error: message,
            },
        };
    }

    private messageOf(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }

}
