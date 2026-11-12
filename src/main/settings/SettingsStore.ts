import { randomUUID } from 'node:crypto';
import {
    chmodSync,
    existsSync,
    mkdirSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import type { Env } from '../Config.ts';
import type {
    SettingName,
    Settings,
} from '../model/index.ts';

// Environment variable for each setting. A set variable wins over the file
// and locks the field on the Settings page.
const ENV_NAMES: Record<Exclude<SettingName, 'clientId' | 'ownerId'>, string> = {
    plexUrl: 'PLEX_URL',
    plexToken: 'PLEX_TOKEN',
    tautulliUrl: 'TAUTULLI_URL',
    tautulliApiKey: 'TAUTULLI_API_KEY',
    recordSessions: 'RECORD_SESSIONS',
    pollMinutes: 'POLL_MINUTES',
    timeZone: 'TZ',
    discordWebhookUrl: 'DISCORD_WEBHOOK_URL',
    publicUrl: 'PUBLIC_URL',
    notifyBackfillDays: 'NOTIFY_BACKFILL_DAYS',
    userAliases: 'USER_ALIASES',
    allowedUsers: 'ALLOWED_USERS',
    authMode: 'AUTH',
    lanGuests: 'LAN_GUESTS',
};

const AUTH_MODES = [
    'plex',
    'off',
];

const NUMBER_FIELDS: SettingName[] = [
    'pollMinutes',
    'notifyBackfillDays',
];

const MIN_POLL_MINUTES = 1;

export class SettingsStore {

    private readonly path: string;
    private readonly env: Env;
    private saved: Partial<Settings>;
    // Environment values never change while Laurels runs.
    private readonly envValues: Partial<Settings>;
    // The merged settings. A save clears it.
    private merged: Settings | null = null;

    constructor(path: string, env: Env) {
        this.path = path;
        this.env = env;
        this.envValues = this.fromEnv();
        this.saved = this.readFile();
        this.ensureClientId();
    }

    // File values, then environment values on top.
    get current(): Settings {
        this.merged ??= {
            ...this.defaults(),
            ...this.saved,
            ...this.envValues,
        };
        return this.merged;
    }

    get locked(): SettingName[] {
        return Object.keys(this.envValues) as SettingName[];
    }

    // Internal fields that no form or variable may set.
    saveOwner(ownerId: string): void {
        this.merged = null;
        this.saved = {
            ...this.saved,
            ownerId,
        };
        this.writeFile();
    }

    // Ignores locked and unknown fields. Returns the new settings.
    save(patch: Partial<Settings>): Settings {
        const allowed = this.allowedPatch(patch);
        this.merged = null;
        this.saved = {
            ...this.saved,
            ...allowed,
        };
        this.writeFile();
        return this.current;
    }

    private allowedPatch(patch: Partial<Settings>): Partial<Settings> {
        const editable = Object.keys(ENV_NAMES) as SettingName[];
        const entries = Object.entries(patch).filter(([name]) => {
            const field = name as SettingName;
            return editable.includes(field) && !this.locked.includes(field);
        });
        const cleaned = entries.map(([name, value]) => [name, this.clean(name as SettingName, value)]);
        return Object.fromEntries(cleaned);
    }

    private clean(name: SettingName, value: unknown): string | number | boolean {
        if (NUMBER_FIELDS.includes(name)) {
            return this.cleanNumber(name, value);
        }
        const isSwitch = name === 'lanGuests' || name === 'recordSessions';
        if (isSwitch) {
            return value === true || value === 'true' || value === 'on';
        }
        if (name === 'authMode') {
            const mode = String(value);
            return AUTH_MODES.includes(mode) ? mode : 'plex';
        }
        const text = String(value ?? '').trim();
        const isAddress = name === 'plexUrl' || name === 'publicUrl' || name === 'tautulliUrl';
        if (isAddress) {
            return text.replace(/\/+$/, '');
        }
        return text;
    }

    private cleanNumber(name: SettingName, value: unknown): number {
        const number = Math.max(0, Math.round(Number(value) || 0));
        if (name === 'pollMinutes') {
            return Math.max(MIN_POLL_MINUTES, number);
        }
        return number;
    }

    private defaults(): Settings {
        return {
            plexUrl: '',
            plexToken: '',
            clientId: '',
            tautulliUrl: '',
            tautulliApiKey: '',
            recordSessions: true,
            pollMinutes: 5,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            discordWebhookUrl: '',
            publicUrl: '',
            notifyBackfillDays: 0,
            userAliases: '',
            allowedUsers: '',
            authMode: 'plex',
            lanGuests: false,
            ownerId: '',
        };
    }

    private fromEnv(): Partial<Settings> {
        const names = Object.entries(ENV_NAMES) as Array<[SettingName, string]>;
        const present = names.filter(([, envName]) => Boolean(this.env[envName]));
        const values = present.map(([name, envName]) => [name, this.clean(name, this.env[envName])]);
        return Object.fromEntries(values);
    }

    private ensureClientId(): void {
        if (this.saved.clientId) {
            return;
        }
        this.merged = null;
        this.saved = {
            ...this.saved,
            clientId: `laurels-${randomUUID()}`,
        };
        this.writeFile();
    }

    private readFile(): Partial<Settings> {
        if (!existsSync(this.path)) {
            return {};
        }
        const text = readFileSync(this.path, 'utf8');
        return JSON.parse(text);
    }

    // The file holds the Plex token: owner read and write only.
    private writeFile(): void {
        mkdirSync(dirname(this.path), { recursive: true });
        const text = JSON.stringify(this.saved, null, 4) + '\n';
        writeFileSync(this.path, text, { mode: 0o600 });
        chmodSync(this.path, 0o600);
    }

}
