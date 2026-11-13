import {
    existsSync,
    readdirSync,
    readFileSync,
    statSync,
} from 'node:fs';
import { join } from 'node:path';
import type {
    Achievement,
    Pack,
    PackFile,
} from '../model/index.ts';

export interface PackContents {
    packs: Pack[];
    awards: Achievement[];
}

// A pack id has small letters, digits and "_", for example "winter_2026".
const ID_PATTERN = /^[a-z0-9_]+$/;

// Reads the award packs: each .json file in each folder is one pack.
// A bad file or a bad award is logged and skipped. The other packs still load.
export class PackReader {

    private readonly folders: string[];

    constructor(folders: string[]) {
        this.folders = folders;
    }

    // The awards of all packs. An award id that another award has already is skipped.
    read(takenIds: Set<string>, isValid: (award: Partial<Achievement>) => boolean): PackContents {
        const packs: Pack[] = [];
        const awards: Achievement[] = [];
        const taken = new Set(takenIds);
        for (const path of this.files()) {
            const pack = this.readPack(path, taken, isValid);
            if (pack) {
                packs.push(pack.pack);
                awards.push(...pack.awards);
            }
        }
        return {
            packs,
            awards,
        };
    }

    // The times of the folders and the files. A new, changed or removed pack changes it.
    stamp(): string {
        const folders = this.folders.filter((folder) => existsSync(folder));
        const times = [
            ...folders.map((folder) => statSync(folder).mtimeMs),
            ...this.files().map((path) => statSync(path).mtimeMs),
        ];
        return times.join('|');
    }

    private files(): string[] {
        return this.folders
            .filter((folder) => existsSync(folder))
            .flatMap((folder) => this.jsonFilesIn(folder));
    }

    private jsonFilesIn(folder: string): string[] {
        return readdirSync(folder)
            .filter((name) => name.endsWith('.json'))
            .sort()
            .map((name) => join(folder, name));
    }

    private readPack(
        path: string,
        taken: Set<string>,
        isValid: (award: Partial<Achievement>) => boolean,
    ): { pack: Pack; awards: Achievement[] } | null {
        const file = this.parse(path);
        const problem = file ? this.problemWith(file, taken) : 'it is not valid JSON';
        if (problem) {
            console.warn(`Skipped the award pack ${path}: ${problem}`);
            return null;
        }
        const pack = file as Required<Pack> & PackFile;
        taken.add(`pack:${pack.id}`);
        const awards = this.awardsOf(pack, taken, isValid);
        return {
            pack: {
                id: pack.id,
                name: pack.name,
                description: pack.description ?? '',
                awardIds: awards.map((award) => award.id),
            },
            awards,
        };
    }

    private parse(path: string): PackFile | null {
        try {
            return JSON.parse(readFileSync(path, 'utf8'));
        } catch {
            return null;
        }
    }

    private problemWith(file: PackFile, taken: Set<string>): string {
        if (!file.id || !ID_PATTERN.test(file.id)) {
            return 'it needs an id with only small letters, digits and _';
        }
        if (taken.has(`pack:${file.id}`)) {
            return `another pack has the id "${file.id}"`;
        }
        if (!file.name) {
            return 'it needs a name';
        }
        if (!Array.isArray(file.awards)) {
            return 'it needs a list of awards';
        }
        return '';
    }

    private awardsOf(
        pack: PackFile & { id: string },
        taken: Set<string>,
        isValid: (award: Partial<Achievement>) => boolean,
    ): Achievement[] {
        const awards: Achievement[] = [];
        for (const entry of pack.awards ?? []) {
            const award = {
                ...entry,
                pack: pack.id,
                startsAt: undefined,
            };
            const isTaken = taken.has(String(award.id));
            if (isTaken) {
                console.warn(`Skipped award ${award.id} in pack ${pack.id}: another award has this id`);
            }
            if (!isTaken && isValid(award)) {
                taken.add(String(award.id));
                awards.push(award as Achievement);
            }
        }
        return awards;
    }

}
