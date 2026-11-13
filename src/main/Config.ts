import { join } from 'node:path';
import {
    PLEX_TV_URLS,
    type PlexTvUrls,
} from './sources/index.ts';

export type Env = Record<string, string | undefined>;

// Start-up options. Everything else lives in settings.json.
export class Config {

    readonly env: Env;
    readonly port: number;
    readonly dataDir: string;
    readonly achievementsPath: string;
    // The award packs that ship with Laurels.
    readonly builtInPacksDir: string;
    readonly publicDir: string;
    readonly plexTv: PlexTvUrls;
    // Demo only: the mock server that can add a watch.
    readonly demoMockUrl: string;
    // Demo only: the sample award pack that the owner can add.
    readonly demoPackPath: string;

    static fromProcess(): Config {
        return new Config(process.env);
    }

    constructor(env: Env) {
        this.env = env;
        this.port = Number(env.PORT ?? '8484');
        this.dataDir = env.DATA_DIR ?? 'data';
        this.achievementsPath = env.ACHIEVEMENTS_PATH ?? join('achievements', 'achievements.json');
        this.builtInPacksDir = env.PACKS_DIR ?? join('achievements', 'packs');
        this.publicDir = env.PUBLIC_DIR ?? 'public';
        this.plexTv = {
            api: env.PLEX_TV_URL ?? PLEX_TV_URLS.api,
            auth: env.PLEX_AUTH_URL ?? PLEX_TV_URLS.auth,
        };
        this.demoMockUrl = env.DEMO_MOCK_URL ?? '';
        this.demoPackPath = env.DEMO_PACK_PATH ?? '';
    }

    get databasePath(): string {
        return join(this.dataDir, 'trophies.db');
    }

    // The owner's own awards, next to the settings.
    get customAwardsPath(): string {
        return join(this.dataDir, 'awards.json');
    }

    // The owner's own award packs, next to the settings.
    get customPacksDir(): string {
        return join(this.dataDir, 'packs');
    }

    // The built-in packs first, so a built-in pack keeps its id.
    get packFolders(): string[] {
        return [
            this.builtInPacksDir,
            this.customPacksDir,
        ];
    }

    get settingsPath(): string {
        return join(this.dataDir, 'settings.json');
    }

}
