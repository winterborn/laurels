import { join } from 'node:path';

import { Collector } from './Collector.ts';
import type { Config } from './Config.ts';
import { Findings } from './Findings.ts';
import { MarkCheck } from './MarkCheck.ts';
import { Output } from './Output.ts';
import { PlexClient } from './PlexClient.ts';
import { SessionListener } from './SessionListener.ts';
import { TautulliClient } from './TautulliClient.ts';

interface Runner {
    run(): Promise<void>;
}

export class SpikeApp {

    private readonly config: Config;
    private readonly findings = new Findings();

    constructor(config: Config) {
        this.config = config;
    }

    async run(): Promise<void> {
        const output = new Output(this.config.outDir, this.config.secrets);
        await output.init();
        const isOk = await this.runSafely(output);
        await output.report(this.findings.toMarkdown(this.title(), this.context()));
        console.log('');
        console.log(`Send back: ${join(output.dir, 'findings.md')}`);
        console.log(`Keep private: ${join(output.dir, 'raw')} and ${join(output.dir, 'images')}`);
        if (!isOk) {
            process.exitCode = 1;
        }
    }

    private async runSafely(output: Output): Promise<boolean> {
        try {
            await this.createRunner(output).run();
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.findings.add('Run', 'Error', message, 'fail');
            console.error(message);
            return false;
        }
    }

    private createRunner(output: Output): Runner {
        const plex = new PlexClient(this.config.plexUrl, this.config.plexToken);
        const findings = this.findings;
        switch (this.config.mode) {
            case 'listen':
                return new SessionListener({
                    plex,
                    output,
                    findings,
                    minutes: this.config.listenMinutes,
                });
            case 'mark-check':
                return new MarkCheck({
                    plex,
                    output,
                    findings,
                    ratingKey: this.config.argument,
                });
            default:
                return new Collector({
                    plex,
                    output,
                    findings,
                    sampleSize: this.config.sampleSize,
                    tautulli: this.createTautulli(),
                });
        }
    }

    private createTautulli(): TautulliClient | null {
        if (!this.config.hasTautulli) {
            return null;
        }
        return new TautulliClient(this.config.tautulliUrl, this.config.tautulliKey);
    }

    private title(): string {
        return `Laurels spike: ${this.config.mode}`;
    }

    private context(): string[] {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return [
            `- Run at: ${this.config.startedAt.toISOString()}`,
            `- Node: ${process.version}`,
            `- Time zone of this machine: ${timeZone}`,
            `- Sample size: ${this.config.sampleSize}`,
            '- Verdicts: ok = as hoped, check = look at it, fail = blocks the plan',
        ];
    }

}
