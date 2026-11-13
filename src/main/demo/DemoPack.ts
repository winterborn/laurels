import {
    copyFileSync,
    existsSync,
    mkdirSync,
} from 'node:fs';
import {
    basename,
    join,
} from 'node:path';
import type { App } from '../App.ts';

export interface DemoPackResult {
    name: string;
    awards: number;
}

// Demo only: copies the sample award pack into the packs folder, as an owner would.
// Laurels then reads the packs again, and the pack arrives now.
export class DemoPack {

    private readonly app: App;
    private readonly source: string;

    constructor(app: App, source: string) {
        this.app = app;
        this.source = source;
    }

    run(): DemoPackResult {
        const folder = this.app.config.customPacksDir;
        const target = join(folder, basename(this.source));
        if (existsSync(target)) {
            throw new Error('The sample pack is already here. Restart the demo to add it again.');
        }
        mkdirSync(folder, { recursive: true });
        copyFileSync(this.source, target);
        this.app.reloadPacks();
        return this.resultFor(target);
    }

    private resultFor(target: string): DemoPackResult {
        const pack = this.app.packs.find((entry) => target.endsWith(`${entry.id}.json`));
        if (!pack) {
            throw new Error('Laurels could not read the sample pack. Look at the log for the reason.');
        }
        return {
            name: pack.name,
            awards: pack.awardIds.length,
        };
    }

}
