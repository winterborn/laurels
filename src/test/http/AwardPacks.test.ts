import assert from 'node:assert/strict';
import {
    mkdirSync,
    mkdtempSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import {
    createServer,
    type Server as HttpServer,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { App } from '../../main/App.ts';
import { Config } from '../../main/Config.ts';
import { MockPlexServer } from '../../../dev/mock-plex/MockPlexServer.ts';

const folders: string[] = [];
const mocks: HttpServer[] = [];
const apps: App[] = [];

const PACK = {
    id: 'test_pack',
    name: 'Test pack',
    description: 'One award for a test.',
    awards: [
        {
            id: 'test_pack_film',
            title: 'Test reel',
            description: 'Watch a film.',
            flavorText: 'For a test.',
            tier: 'Common',
            section: 'film',
            rule: {
                type: 'count',
                filter: {
                    kind: 'movie',
                },
                target: 1,
            },
        },
    ],
};

function newFolder(): string {
    const folder = mkdtempSync(join(tmpdir(), 'laurels-packs-'));
    folders.push(folder);
    return folder;
}

// Writes the pack file into the packs folder of /config, as an owner would.
function addPack(dataDir: string): void {
    const packsDir = join(dataDir, 'packs');
    mkdirSync(packsDir, { recursive: true });
    writeFileSync(join(packsDir, 'test_pack.json'), JSON.stringify(PACK));
}

async function newApp(dataDir: string, settings: Record<string, unknown> = {}): Promise<{ app: App; mockUrl: string }> {
    writeFileSync(join(dataDir, 'settings.json'), JSON.stringify({
        awardsFrom: 'all',
        ...settings,
    }));
    const mock = await new MockPlexServer().listen(0);
    mocks.push(mock);
    const mockUrl = `http://localhost:${(mock.address() as AddressInfo).port}`;
    const app = new App(new Config({
        DATA_DIR: dataDir,
        PACKS_DIR: newFolder(),
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

// reloadPacks starts a cycle in the background. This waits for it, then runs one more.
async function settle(app: App): Promise<void> {
    while (app.isSyncing) {
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
    await app.runCycle();
}

// A Discord webhook that keeps the body of each post.
async function listenWebhook(bodies: string[]): Promise<string> {
    const server = createServer((request, response) => {
        const chunks: Buffer[] = [];
        request.on('data', (chunk: Buffer) => chunks.push(chunk));
        request.on('end', () => {
            bodies.push(Buffer.concat(chunks).toString('utf8'));
            response.writeHead(204);
            response.end();
        });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    mocks.push(server);
    return `http://localhost:${(server.address() as AddressInfo).port}`;
}

function ownerHas(app: App, achievementId: string): boolean {
    return app.store
        .awards()
        .some((award) => award.userId === '1' && award.achievementId === achievementId);
}

describe('award packs', () => {

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

    it('counts only watches from the day that a new pack arrives', async () => {
        const { app, mockUrl } = await newApp(newFolder());
        await app.runCycle();
        assert.ok(ownerHas(app, 'film_first'));
        addPack(app.config.dataDir);
        app.reloadPacks();
        await settle(app);
        const pack = app.packs.find((entry) => entry.id === 'test_pack');
        assert.ok(Number(pack?.arrivedAt) > 0);
        assert.equal(ownerHas(app, 'test_pack_film'), false);
        await watchFilm(app, mockUrl);
        await settle(app);
        assert.ok(ownerHas(app, 'test_pack_film'));
    });

    it('counts a pack like the built-in awards when it is there from the start', async () => {
        const dataDir = newFolder();
        addPack(dataDir);
        const { app } = await newApp(dataDir);
        await app.runCycle();
        const pack = app.packs.find((entry) => entry.id === 'test_pack');
        assert.equal(pack?.arrivedAt, null);
        assert.ok(ownerHas(app, 'test_pack_film'));
    });

    it('posts a new pack to Discord once', async () => {
        const bodies: string[] = [];
        const webhookUrl = await listenWebhook(bodies);
        const { app } = await newApp(newFolder(), { discordWebhookUrl: webhookUrl });
        await app.runCycle();
        addPack(app.config.dataDir);
        app.reloadPacks();
        await settle(app);
        await settle(app);
        const posts = bodies.filter((body) => body.includes('New award pack: Test pack'));
        assert.equal(posts.length, 1);
    });

    it('removes the awards of a pack when its file goes', async () => {
        const dataDir = newFolder();
        addPack(dataDir);
        const { app } = await newApp(dataDir);
        await app.runCycle();
        assert.ok(ownerHas(app, 'test_pack_film'));
        rmSync(join(dataDir, 'packs', 'test_pack.json'));
        app.reloadPacks();
        await settle(app);
        assert.equal(ownerHas(app, 'test_pack_film'), false);
    });

});
