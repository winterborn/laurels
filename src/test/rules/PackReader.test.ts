import assert from 'node:assert/strict';
import {
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import type {
    Achievement,
    PackFile,
} from '../../main/model/index.ts';
import { TIER_POINTS } from '../../main/helpers/index.ts';
import { Catalogue } from '../../main/rules/index.ts';

const folder = mkdtempSync(join(tmpdir(), 'laurels-pack-reader-'));
const builtInPath = join(folder, 'achievements.json');
const packsDir = join(folder, 'packs');

// Film and Television must stay near even in each pack, as in the built-in awards.
const MAX_SHARE = 0.6;

function award(id: string, section = 'film') {
    return {
        id,
        title: id,
        description: 'Test',
        flavorText: 'For a test.',
        tier: 'Common',
        section,
        rule: {
            type: 'count',
            target: 1,
        },
    };
}

function writePack(name: string, contents: unknown): void {
    mkdirSync(packsDir, { recursive: true });
    writeFileSync(join(packsDir, name), typeof contents === 'string' ? contents : JSON.stringify(contents));
}

// The pack files that ship with Laurels, and the sample pack of the demo.
function shippedPacks(): PackFile[] {
    const folders = [
        new URL('../../../achievements/packs/', import.meta.url),
        new URL('../../../dev/packs/', import.meta.url),
    ];
    return folders.flatMap((url) => {
        return readdirSync(url)
            .filter((name) => name.endsWith('.json'))
            .map((name) => JSON.parse(readFileSync(new URL(name, url), 'utf8')));
    });
}

function sharesOf(awards: Achievement[], measure: (list: Achievement[]) => number): number {
    const film = measure(awards.filter((entry) => entry.section === 'film'));
    const tv = measure(awards.filter((entry) => entry.section === 'tv'));
    return film / (film + tv);
}

describe('award packs in the catalogue', () => {

    after(() => rmSync(folder, {
        recursive: true,
        force: true,
    }));

    it('loads each pack and marks its awards with the pack id', () => {
        writeFileSync(builtInPath, JSON.stringify([award('base')]));
        writePack('a.json', {
            id: 'pack_a',
            name: 'Pack A',
            awards: [award('pack_a_one')],
        });
        const catalogue = Catalogue.fromFile(builtInPath, '', [packsDir]);
        assert.deepEqual(catalogue.packs.map((pack) => pack.id), ['pack_a']);
        assert.equal(catalogue.byId('pack_a_one')?.pack, 'pack_a');
        assert.equal(catalogue.byId('base')?.pack, undefined);
    });

    it('skips an award whose id another award has, and a broken pack file', () => {
        writePack('b.json', {
            id: 'pack_b',
            name: 'Pack B',
            awards: [
                award('base'),
                award('pack_b_one'),
            ],
        });
        writePack('c.json', '{ not json');
        const catalogue = Catalogue.fromFile(builtInPath, '', [packsDir]);
        assert.equal(catalogue.byId('base')?.pack, undefined);
        assert.equal(catalogue.byId('pack_b_one')?.pack, 'pack_b');
        assert.deepEqual(catalogue.packs.map((pack) => pack.id), ['pack_a', 'pack_b']);
    });

    it('keeps Film and Television even in each shipped pack', () => {
        for (const pack of shippedPacks()) {
            const awards = (pack.awards ?? []) as Achievement[];
            const countShare = sharesOf(awards, (list) => list.length);
            const pointShare = sharesOf(awards, (list) => list.reduce((sum, entry) => sum + TIER_POINTS[entry.tier], 0));
            assert.ok(countShare <= MAX_SHARE && 1 - countShare <= MAX_SHARE, `${pack.id}: award count`);
            assert.ok(pointShare <= MAX_SHARE && 1 - pointShare <= MAX_SHARE, `${pack.id}: points`);
        }
    });

    it('gives every shipped pack award a citation that starts with "For"', () => {
        const missing = shippedPacks()
            .flatMap((pack) => pack.awards ?? [])
            .filter((entry) => !entry.flavorText?.startsWith('For'))
            .map((entry) => entry.id);
        assert.deepEqual(missing, []);
    });

});
