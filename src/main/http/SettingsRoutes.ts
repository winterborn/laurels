import type { App } from '../App.ts';
import type { Settings } from '../model/index.ts';
import { DemoWatch } from '../demo/index.ts';
import { DiscordNotifier } from '../notify/index.ts';
import {
    PlexAccount,
    PlexClient,
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
        };
    }

    settings(): Json {
        const { plexToken, clientId, ownerId, ...shown } = this.app.settings;
        return {
            values: shown,
            plexTokenSet: plexToken !== '',
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
            return this.fail('Add the Plex URL and sign in first.');
        }
        try {
            const info = await new PlexClient(url, token).serverInfo();
            return this.ok(info);
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
            return this.fail('This is not the demo.');
        }
        try {
            const result = await new DemoWatch(this.app, mockUrl).run(userId);
            return this.ok(result);
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
