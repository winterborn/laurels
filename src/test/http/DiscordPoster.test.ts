import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import {
    createServer,
    type Server as HttpServer,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { App } from '../../main/App.ts';
import { Config } from '../../main/Config.ts';
import { Server } from '../../main/http/index.ts';
import { DiscordNotifier } from '../../main/notify/index.ts';
import { MockPlexServer } from '../../../dev/mock-plex/MockPlexServer.ts';

// Discord reads the poster of a new award with no session.
describe('Discord poster links', () => {

    const dataDir = mkdtempSync(join(tmpdir(), 'laurels-discord-'));
    const bodies: string[] = [];
    const context = {
        base: '',
        webhookUrl: '',
        mock: null as HttpServer | null,
        webhook: null as HttpServer | null,
        laurels: null as Server | null,
        app: null as App | null,
    };

    before(async () => {
        context.mock = await new MockPlexServer().listen(0);
        const mockUrl = `http://localhost:${(context.mock.address() as AddressInfo).port}`;
        context.app = new App(new Config({
            DATA_DIR: dataDir,
            PLEX_URL: mockUrl,
            PLEX_TOKEN: 'mock-token',
            TZ: 'UTC',
            AWARDS_FROM: 'all',
        }));
        await context.app.runCycle();
        context.laurels = new Server(context.app);
        context.base = `http://localhost:${await context.laurels.listen(0)}`;
        context.webhook = await listenWebhook(bodies);
        context.webhookUrl = `http://localhost:${(context.webhook.address() as AddressInfo).port}`;
    });

    after(() => {
        context.laurels?.close();
        context.mock?.closeAllConnections();
        context.mock?.close();
        context.webhook?.close();
        context.app?.stop();
        context.app?.store.close();
        rmSync(dataDir, {
            recursive: true,
            force: true,
        });
    });

    it('needs a session for a poster with no signature', async () => {
        const award = firstAward(context.app as App);
        const response = await fetch(`${context.base}/api/poster/${award.posterKey}`);
        assert.equal(response.status, 401);
    });

    it('sends a signed poster link that works with no session', async () => {
        const embed = await sendOne(context.app as App, context.webhookUrl, context.base, bodies);
        const response = await fetch(embed.thumbnail.url);
        assert.equal(response.status, 200);
    });

    it('refuses a poster link with a wrong signature', async () => {
        const embed = await sendOne(context.app as App, context.webhookUrl, context.base, bodies);
        const url = new URL(embed.thumbnail.url);
        url.searchParams.set('sig', 'wrong');
        const response = await fetch(url);
        assert.equal(response.status, 401);
    });

    it('shows the tier word in the Tier field', async () => {
        const app = context.app as App;
        const embed = await sendOne(app, context.webhookUrl, context.base, bodies);
        const tier = embed.fields.find((field: { name: string }) => field.name === 'Tier');
        const words = [
            'Official selection',
            'Special mention',
            'Winner',
            'Grand prize',
            'Lifetime achievement',
        ];
        assert.ok(words.includes(tier.value), `Tier is ${tier.value}`);
    });

});

function listenWebhook(bodies: string[]): Promise<HttpServer> {
    const server = createServer((request, response) => {
        const chunks: Buffer[] = [];
        request.on('data', (chunk) => chunks.push(chunk));
        request.on('end', () => {
            bodies.push(Buffer.concat(chunks).toString('utf8'));
            response.writeHead(204);
            response.end();
        });
    });
    return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

function firstAward(app: App) {
    const award = app.store.awards().find((candidate) => candidate.posterKey !== '');
    assert.ok(award, 'the demo history gives at least one award with a poster');
    return award;
}

// Sends one award to the test webhook and returns its embed.
async function sendOne(app: App, webhookUrl: string, publicUrl: string, bodies: string[]) {
    const award = firstAward(app);
    const notifier = new DiscordNotifier(webhookUrl, publicUrl, app.posterSigner);
    await notifier.sendAll([
        {
            award,
            achievement: app.catalogue.byId(award.achievementId)!,
            user: {
                id: award.userId,
                name: 'Alex',
            },
            earnedWith: '',
        },
    ]);
    const body = JSON.parse(bodies[bodies.length - 1]);
    return body.embeds[0];
}
