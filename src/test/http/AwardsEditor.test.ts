import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { App } from '../../main/App.ts';
import { Config } from '../../main/Config.ts';
import { ruleProblem } from '../../main/helpers/index.ts';
import { SettingsRoutes } from '../../main/http/index.ts';

const dataDir = mkdtempSync(join(tmpdir(), 'laurels-editor-'));
const app = new App(new Config({
    DATA_DIR: dataDir,
    TZ: 'UTC',
}));
const routes = new SettingsRoutes(app);

const GOOD = {
    id: 'my_westerns',
    title: 'High noon',
    description: 'Watch 10 different westerns.',
    flavorText: 'For ten showdowns.',
    tier: 'Uncommon',
    section: 'film',
    rule: {
        type: 'count',
        filter: {
            kind: 'movie',
            genre: 'Western',
        },
        distinct: 'item',
        target: 10,
    },
};

describe('awards editor', () => {

    after(() => {
        app.stop();
        app.store.close();
        rmSync(dataDir, {
            recursive: true,
            force: true,
        });
    });

    it('has built-in awards that all pass the rule checks', () => {
        const problems = app.catalogue.builtIn()
            .map((award) => `${award.id}: ${ruleProblem(award.rule as never)}`)
            .filter((text) => !text.endsWith(': '));
        assert.deepEqual(problems, []);
        assert.equal(app.catalogue.builtIn().length, 109);
    });

    it('refuses entries with a problem and says which', () => {
        const bad = {
            ...GOOD,
            rule: {
                type: 'chain',
                target: 1,
            },
        };
        const result = routes.saveAwards({
            entries: [GOOD, bad, { id: 'nope_award', remove: true }],
        });
        const body = result.body as { problems: Array<{ index: number; problem: string }> };
        assert.equal(result.status, 400);
        assert.deepEqual(body.problems.map((problem) => problem.index), [1, 2]);
        assert.equal(existsSync(join(dataDir, 'awards.json')), false);
    });

    it('saves awards.json and loads it at once', () => {
        const result = routes.saveAwards({
            entries: [
                GOOD,
                {
                    id: 'film_10',
                    title: 'Regular customer',
                },
                {
                    id: 'tv_graveyard',
                    remove: true,
                },
            ],
        });
        assert.equal(result.status, 200);
        const saved = JSON.parse(readFileSync(join(dataDir, 'awards.json'), 'utf8'));
        assert.equal(saved.length, 3);
        assert.equal(app.catalogue.byId('my_westerns')?.title, 'High noon');
        assert.equal(app.catalogue.byId('film_10')?.title, 'Regular customer');
        assert.equal(app.catalogue.byId('tv_graveyard'), undefined);
    });

    it('checks one award and names an unknown filter field', () => {
        const result = routes.checkAward({
            entry: {
                ...GOOD,
                rule: {
                    type: 'count',
                    filter: {
                        genra: 'Western',
                    },
                    target: 1,
                },
            },
        });
        assert.equal(result.status, 400);
        assert.match(String((result.body as { error: string }).error), /genra/);
    });

});
