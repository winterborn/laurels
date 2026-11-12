import { join } from 'node:path';

type Env = Record<string, string | undefined>;

const MODES = ['collect', 'listen', 'mark-check'];

export class Config {

    readonly mode: string;
    readonly argument: string;
    readonly plexUrl: string;
    readonly plexToken: string;
    readonly tautulliUrl: string;
    readonly tautulliKey: string;
    readonly sampleSize: number;
    readonly startedAt: Date;
    readonly outDir: string;

    static fromProcess(): Config {
        const args = process.argv.slice(2);
        return new Config(args, process.env);
    }

    constructor(args: string[], env: Env) {
        this.mode = args[0] ?? 'collect';
        if (!MODES.includes(this.mode)) {
            throw new Error(`Unknown mode "${this.mode}". Use: ${MODES.join(', ')}`);
        }
        this.argument = args[1] ?? '';
        this.plexUrl = Config.required(env, 'PLEX_URL');
        this.plexToken = Config.required(env, 'PLEX_TOKEN');
        this.tautulliUrl = env.TAUTULLI_URL ?? '';
        this.tautulliKey = env.TAUTULLI_KEY ?? '';
        this.sampleSize = Number(env.SPIKE_SAMPLE ?? '40');
        this.startedAt = new Date();
        this.outDir = join('spike-output', this.folderName());
    }

    get listenMinutes(): number {
        const text = this.argument || '15';
        return Number(text);
    }

    get secrets(): string[] {
        return [
            this.plexToken,
            this.tautulliKey,
        ];
    }

    get hasTautulli(): boolean {
        const hasUrl = this.tautulliUrl !== '';
        const hasKey = this.tautulliKey !== '';
        return hasUrl && hasKey;
    }

    private folderName(): string {
        const stamp = this.startedAt
            .toISOString()
            .slice(0, 23)
            .replaceAll(':', '-')
            .replace('.', '-');
        return `${stamp}-${this.mode}`;
    }

    private static required(env: Env, name: string): string {
        const value = env[name] ?? '';
        if (!value) {
            throw new Error(`Set ${name} (copy spike/.env.example to spike/.env)`);
        }
        return value;
    }

}
