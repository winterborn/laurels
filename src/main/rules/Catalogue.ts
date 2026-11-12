import {
    readFileSync,
    statSync,
} from 'node:fs';
import type { Achievement } from '../model/index.ts';
import { TIER_ORDER } from '../helpers/index.ts';

const RULE_TYPES = [
    'count',
    'hours',
    'complete',
    'streak',
    'window',
];

const SECTIONS = [
    'film',
    'tv',
    'both',
];

// Loads achievements.json, and loads it again when the file changes.
// Bad entries are logged and skipped. A broken file keeps the last good list.
export class Catalogue {

    private readonly path: string;
    private list: Achievement[] = [];
    private loadedAt = 0;

    static fromFile(path: string): Catalogue {
        const catalogue = new Catalogue(path);
        catalogue.load();
        return catalogue;
    }

    constructor(path: string) {
        this.path = path;
    }

    get achievements(): Achievement[] {
        return this.list;
    }

    byId(id: string): Achievement | undefined {
        return this.list.find((achievement) => achievement.id === id);
    }

    // Called each cycle. Returns true if the list changed.
    reloadIfChanged(): boolean {
        const modifiedAt = statSync(this.path).mtimeMs;
        if (modifiedAt === this.loadedAt) {
            return false;
        }
        try {
            this.load();
            console.log(`Loaded ${this.list.length} achievements from ${this.path}`);
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Kept the old achievements. ${this.path} has a problem: ${message}`);
            this.loadedAt = modifiedAt;
            return false;
        }
    }

    private load(): void {
        const modifiedAt = statSync(this.path).mtimeMs;
        const entries = JSON.parse(readFileSync(this.path, 'utf8'));
        if (!Array.isArray(entries)) {
            throw new Error(`${this.path} must hold a list of achievements`);
        }
        this.list = entries.filter((entry) => this.isValid(entry)) as Achievement[];
        this.loadedAt = modifiedAt;
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
