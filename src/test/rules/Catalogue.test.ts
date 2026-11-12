import assert from 'node:assert/strict';
import {
    mkdtempSync,
    rmSync,
    utimesSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { Catalogue } from '../../main/rules/index.ts';

const folder = mkdtempSync(join(tmpdir(), 'laurels-catalogue-'));
const path = join(folder, 'achievements.json');

function achievement(id: string) {
    return {
        id,
        title: id,
        description: 'Test',
        tier: 'Common',
        section: 'film',
        rule: {
            type: 'count',
            target: 1,
        },
    };
}

// Changes the file and moves its time forward, so the change is seen.
function writeList(list: unknown, seconds: number): void {
    writeFileSync(path, typeof list === 'string' ? list : JSON.stringify(list));
    utimesSync(path, seconds, seconds);
}

describe('Catalogue', () => {

    after(() => rmSync(folder, {
        recursive: true,
        force: true,
    }));

    it('loads the file again when it changes', () => {
        writeList([achievement('a')], 1000);
        const catalogue = Catalogue.fromFile(path);
        assert.equal(catalogue.achievements.length, 1);
        assert.equal(catalogue.reloadIfChanged(), false);
        writeList([achievement('a'), achievement('b')], 2000);
        assert.equal(catalogue.reloadIfChanged(), true);
        assert.equal(catalogue.achievements.length, 2);
    });

    it('keeps the last good list when the file breaks', () => {
        writeList([achievement('a')], 3000);
        const catalogue = Catalogue.fromFile(path);
        writeList('{ not json', 4000);
        assert.equal(catalogue.reloadIfChanged(), false);
        assert.equal(catalogue.achievements.length, 1);
    });

});
