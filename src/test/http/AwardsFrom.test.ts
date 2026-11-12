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
const apps: App[] = [];

// updateSettings starts a cycle in the background. This waits for it to end.
async function settle(app: App): Promise<void> {
    while (app.isSyncing) {
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
    await app.runCycle();
}

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
    apps.push(app);
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
        apps.forEach((app) => {
            app.stop();
            app.store.close();
        });
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
    });

    it('gives awards for past watches when the owner chooses all', async () => {
        const { app } = await newApp({ awardsFrom: 'all' });
        await app.runCycle();
        assert.ok(app.store.awards().length > 0);
    });


    it('removes awards for past watches when the owner switches to setup', async () => {
        const { app } = await newApp({ awardsFrom: 'all' });
        await app.runCycle();
        assert.ok(app.store.awards().length > 0);
        app.updateSettings({ awardsFrom: 'setup' });
        await settle(app);
        assert.equal(app.store.awards().length, 0);
    });

    it('keeps the awards of people hidden in Settings', async () => {
        const { app } = await newApp({ awardsFrom: 'all' });
        await app.runCycle();
        const samAwards = app.store.awards().filter((award) => award.userId === '2').length;
        assert.ok(samAwards > 0);
        app.updateSettings({ allowedUsers: '1' });
        await settle(app);
        const kept = app.store.awards().filter((award) => award.userId === '2').length;
        assert.equal(kept, samAwards);
    });

});
