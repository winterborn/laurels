import {
    existsSync,
    readFileSync,
    renameSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import {
    ruleProblem,
    TIER_ORDER,
} from '../helpers/index.ts';
import type {
    Achievement,
    Pack,
} from '../model/index.ts';
import { PackReader } from './PackReader.ts';

// One entry of awards.json: a whole award, some fields of a built-in award,
// or a built-in award to remove.
export type CustomEntry = Partial<Achievement> & {
    remove?: boolean;
};

export interface EntryProblem {
    index: number;
    id: string;
    problem: string;
}

// An id has small letters, digits and "_", for example "my_westerns".
const ID_PATTERN = /^[a-z0-9_]+$/;

const SECTIONS = [
    'film',
    'tv',
    'both',
];

// Loads the built-in achievements.json, the award packs and the owner's own awards.json,
// and loads them again when one of them changes.
// The awards of the packs count as built-in awards.
// An entry in awards.json adds an award, changes the fields of a built-in award
// with the same id, or removes it with "remove": true.
// Bad entries are logged and skipped. A broken file keeps the last good list.
export class Catalogue {

    private readonly path: string;
    private readonly customPath: string;
    private readonly packReader: PackReader;
    private list: Achievement[] = [];
    // The built-in awards and the pack awards, before awards.json.
    private base: Achievement[] = [];
    private packList: Pack[] = [];
    private loadedStamp = '';

    static fromFile(path: string, customPath = '', packFolders: string[] = []): Catalogue {
        const catalogue = new Catalogue(path, customPath, packFolders);
        catalogue.load();
        return catalogue;
    }

    constructor(path: string, customPath = '', packFolders: string[] = []) {
        this.path = path;
        this.customPath = customPath;
        this.packReader = new PackReader(packFolders);
    }

    get achievements(): Achievement[] {
        return this.list;
    }

    // The award packs that loaded, with the ids of their awards.
    get packs(): Pack[] {
        return this.packList;
    }

    byId(id: string): Achievement | undefined {
        return this.list.find((achievement) => achievement.id === id);
    }

    builtIn(): Achievement[] {
        return this.base;
    }

    // The entries of awards.json, as the owner wrote them. Throws if the file is not valid JSON.
    customEntries(): CustomEntry[] {
        return this.hasCustomFile() ? this.readList(this.customPath) : [];
    }

    // The award that an entry gives: a built-in award with the entry on top.
    resolve(entry: CustomEntry): Achievement {
        const builtIn = this.base.find((award) => award.id === entry.id);
        return {
            ...builtIn,
            ...entry,
        } as Achievement;
    }

    problemsIn(entries: CustomEntry[]): EntryProblem[] {
        const seen = new Set<string>();
        return entries
            .map((entry, index) => {
                const problem = this.entryProblem(entry, seen);
                seen.add(String(entry?.id ?? ''));
                return {
                    index,
                    id: String(entry?.id ?? ''),
                    problem,
                };
            })
            .filter((entry) => entry.problem !== '');
    }

    // Writes awards.json, then loads the awards again.
    // The write goes to a new file first, so a crash never leaves half a file.
    saveCustom(entries: CustomEntry[]): void {
        if (!this.customPath) {
            throw new Error('Laurels has no place for awards.json.');
        }
        const draft = `${this.customPath}.new`;
        writeFileSync(draft, `${JSON.stringify(entries, null, 4)}\n`);
        renameSync(draft, this.customPath);
        this.load();
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
        const builtIn = this.readList(this.path).filter((entry) => this.isValid(entry)) as Achievement[];
        const ids = new Set(builtIn.map((award) => award.id));
        const packed = this.packReader.read(ids, (award) => this.isValid(award));
        const base = [...builtIn, ...packed.awards];
        const custom = this.hasCustomFile() ? this.readList(this.customPath) : [];
        this.list = this.merge(base, custom);
        this.base = base;
        this.packList = packed.packs;
        this.loadedStamp = stamp;
    }

    // The times of the files and the pack folders. A change in one of them means a reload.
    private stampNow(): string {
        const customTime = this.hasCustomFile() ? statSync(this.customPath).mtimeMs : 0;
        return `${statSync(this.path).mtimeMs}|${customTime}|${this.packReader.stamp()}`;
    }

    private hasCustomFile(): boolean {
        return this.customPath !== '' && existsSync(this.customPath);
    }

    private readList(path: string): CustomEntry[] {
        const entries = JSON.parse(readFileSync(path, 'utf8'));
        if (!Array.isArray(entries)) {
            throw new Error(`${path} must hold a list of achievements`);
        }
        return entries;
    }

    private merge(base: Achievement[], custom: CustomEntry[]): Achievement[] {
        const byId = new Map(base.map((achievement) => [achievement.id, achievement]));
        for (const entry of custom) {
            this.applyCustom(byId, entry);
        }
        return [...byId.values()];
    }

    private applyCustom(
        byId: Map<string, Achievement>,
        entry: CustomEntry,
    ): void {
        if (!entry.id) {
            console.warn('Skipped an entry in awards.json: it needs an id', entry);
            return;
        }
        if (entry.remove) {
            byId.delete(entry.id);
            return;
        }
        const base = byId.get(entry.id);
        const merged = {
            ...base,
            ...entry,
            pack: base?.pack,
            startsAt: undefined,
        };
        if (this.isValid(merged)) {
            byId.set(entry.id, merged as Achievement);
        }
    }

    private isValid(entry: unknown): boolean {
        const award = entry as Partial<Achievement>;
        const problem = this.problemWith(award);
        if (problem) {
            console.warn(`Skipped achievement ${award.id ?? '(no id)'}: ${problem}`);
        }
        return !problem;
    }

    private problemWith(entry: Partial<Achievement>): string {
        if (!entry.id || !entry.title || !entry.description) {
            return 'needs an id, a title and a description';
        }
        if (!entry.tier || !TIER_ORDER.includes(entry.tier)) {
            return `unknown tier "${entry.tier}"`;
        }
        if (!entry.section || !SECTIONS.includes(entry.section)) {
            return `unknown section "${entry.section}"`;
        }
        return ruleProblem(entry.rule as unknown as Record<string, unknown>);
    }

    // The problem of one editor entry, as Laurels would load it.
    private entryProblem(entry: CustomEntry, seen: Set<string>): string {
        if (!entry || typeof entry !== 'object' || !entry.id) {
            return 'needs an id';
        }
        if (!ID_PATTERN.test(entry.id)) {
            return 'the id can have only small letters, digits and _';
        }
        if (seen.has(entry.id)) {
            return 'another entry has the same id';
        }
        const builtIn = this.base.find((award) => award.id === entry.id);
        if (entry.remove) {
            return builtIn ? '' : 'there is no built-in award with this id to remove';
        }
        return this.problemWith({
            ...builtIn,
            ...entry,
        });
    }

}
