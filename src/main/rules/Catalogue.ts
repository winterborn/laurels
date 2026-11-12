import {
    existsSync,
    readFileSync,
    statSync,
} from 'node:fs';
import type { Achievement } from '../model/index.ts';
import { TIER_ORDER } from '../helpers/index.ts';

// Fields that only awards.json uses.
interface CustomFields {
    remove: boolean;
}

const RULE_TYPES = [
    'awards',
    'complete',
    'count',
    'hours',
    'shared',
    'streak',
    'window',
];

const SECTIONS = [
    'film',
    'tv',
    'both',
];

// Loads the built-in achievements.json and the owner's own awards.json,
// and loads them again when either file changes.
// An entry in awards.json adds an award, changes the fields of a built-in award
// with the same id, or removes it with "remove": true.
// Bad entries are logged and skipped. A broken file keeps the last good list.
export class Catalogue {

    private readonly path: string;
    private readonly customPath: string;
    private list: Achievement[] = [];
    private loadedStamp = '';

    static fromFile(path: string, customPath = ''): Catalogue {
        const catalogue = new Catalogue(path, customPath);
        catalogue.load();
        return catalogue;
    }

    constructor(path: string, customPath = '') {
        this.path = path;
        this.customPath = customPath;
    }

    get achievements(): Achievement[] {
        return this.list;
    }

    byId(id: string): Achievement | undefined {
        return this.list.find((achievement) => achievement.id === id);
    }

    // Called each cycle. Returns true if the list changed.
    reloadIfChanged(): boolean {
        const stamp = this.stampNow();
        if (stamp === this.loadedStamp) {
            return false;
        }
        try {
            this.load();
            console.log(`Loaded ${this.list.length} achievements`);
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Kept the old achievements. ${message}`);
            this.loadedStamp = stamp;
            return false;
        }
    }

    private load(): void {
        const stamp = this.stampNow();
        const base = this.readList(this.path).filter((entry) => this.isValid(entry));
        const custom = this.hasCustomFile() ? this.readList(this.customPath) : [];
        this.list = this.merge(base as Achievement[], custom);
        this.loadedStamp = stamp;
    }

    // The times of both files. A change in either one means a reload.
    private stampNow(): string {
        const customTime = this.hasCustomFile() ? statSync(this.customPath).mtimeMs : 0;
        return `${statSync(this.path).mtimeMs}|${customTime}`;
    }

    private hasCustomFile(): boolean {
        return this.customPath !== '' && existsSync(this.customPath);
    }

    private readList(path: string): Partial<Achievement & CustomFields>[] {
        const entries = JSON.parse(readFileSync(path, 'utf8'));
        if (!Array.isArray(entries)) {
            throw new Error(`${path} must hold a list of achievements`);
        }
        return entries;
    }

    private merge(base: Achievement[], custom: Partial<Achievement & CustomFields>[]): Achievement[] {
        const byId = new Map(base.map((achievement) => [achievement.id, achievement]));
        for (const entry of custom) {
            this.applyCustom(byId, entry);
        }
        return [...byId.values()];
    }

    private applyCustom(
        byId: Map<string, Achievement>,
        entry: Partial<Achievement & CustomFields>,
    ): void {
        if (!entry.id) {
            console.warn('Skipped an entry in awards.json: it needs an id', entry);
            return;
        }
        if (entry.remove) {
            byId.delete(entry.id);
            return;
        }
        const merged = {
            ...byId.get(entry.id),
            ...entry,
        };
        if (this.isValid(merged)) {
            byId.set(entry.id, merged as Achievement);
        }
    }

    private isValid(entry: unknown): boolean {
        const problem = this.problemWith(entry as Partial<Achievement>);
        if (problem) {
            console.warn(`Skipped achievement: ${problem}`, entry);
        }
        return !problem;
    }

    private problemWith(entry: Partial<Achievement>): string {
        if (!entry.id || !entry.title || !entry.description) {
            return 'needs id, title and description';
        }
        if (!entry.tier || !TIER_ORDER.includes(entry.tier)) {
            return `${entry.id}: unknown tier "${entry.tier}"`;
        }
        if (!entry.section || !SECTIONS.includes(entry.section)) {
            return `${entry.id}: unknown section "${entry.section}"`;
        }
        if (!entry.rule || !RULE_TYPES.includes(entry.rule.type)) {
            return `${entry.id}: unknown rule type`;
        }
        if (!(entry.rule.target > 0)) {
            return `${entry.id}: target must be above 0`;
        }
        return '';
    }

}
