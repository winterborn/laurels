import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import type { Server as HttpServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { App } from '../../main/App.ts';
import { Config } from '../../main/Config.ts';
import { MockPlexServer } from '../../../dev/mock-plex/MockPlexServer.ts';

const folders: string[] = [];
const mocks: HttpServer[] = [];

async function newApp(settings: Record<string, unknown> = {}): Promise<{ app: App; mockUrl: string }> {
    const dataDir = mkdtempSync(join(tmpdir(), 'laurels-awards-from-'));
    folders.push(dataDir);
    writeFileSync(join(dataDir, 'settings.json'), JSON.stringify(settings));
    const mock = await new MockPlexServer().listen(0);
    mocks.push(mock);
    const mockUrl = `http://localhost:${(mock.address() as AddressInfo).port}`;
    const app = new App(new Config({
        DATA_DIR: dataDir,
        PLEX_URL: mockUrl,
        PLEX_TOKEN: 'mock-token',
        TZ: 'UTC',
    }));
    return {
        app,
        mockUrl,
    };
}

// A new film watch for the owner, now.
async function watchFilm(app: App, mockUrl: string): Promise<void> {
    const film = [...app.store.items().values()].find((item) => item.kind === 'movie');
    await fetch(`${mockUrl}/mock/watch`, {
        method: 'POST',
        headers: { 'X-Plex-Token': 'mock-token' },
        body: JSON.stringify({
            ratingKey: film?.ratingKey,
            accountID: 1,
        }),
    });
}

describe('awards from setup or from all watches', () => {

    after(() => {
        mocks.forEach((mock) => {
            mock.closeAllConnections();
            mock.close();
        });
        folders.forEach((folder) => rmSync(folder, {
            recursive: true,
            force: true,
        }));
    });

    it('gives no awards for past watches on the first sync by default', async () => {
        const { app, mockUrl } = await newApp();
        await app.runCycle();
        assert.equal(app.settings.awardsFrom, 'setup');
        assert.equal(app.store.awards().length, 0);
        await watchFilm(app, mockUrl);
        await app.runCycle();
        const won = app.store.awards().map((award) => award.achievementId);
        assert.ok(won.includes('film_first'));
        app.stop();
        app.store.close();
    });

    it('gives awards for past watches when the owner chooses all', async () => {
        const { app } = await newApp({ awardsFrom: 'all' });
        await app.runCycle();
        assert.ok(app.store.awards().length > 0);
        app.stop();
        app.store.close();
    });

});
