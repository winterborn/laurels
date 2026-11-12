// Saved in DATA_DIR/settings.json. Edited on the Settings page.
export interface Settings {
    plexUrl: string;
    plexToken: string;
    // Identifies this install to Plex. Made once, never changes.
    clientId: string;
    pollMinutes: number;
    timeZone: string;
    discordWebhookUrl: string;
    publicUrl: string;
    notifyBackfillDays: number;
    // "1:Alex,2:Sam"
    userAliases: string;
    // "Alex,Sam" or account ids. Empty means everyone.
    allowedUsers: string;
    // "plex": Sign in with Plex. "off": no sign-in (behind a proxy login).
    authMode: 'plex' | 'off';
    // Home-network visitors can view without signing in.
    lanGuests: boolean;
    // Plex account id of the server owner. Set on the first sign-in.
    ownerId: string;
}

export type SettingName = keyof Settings;
