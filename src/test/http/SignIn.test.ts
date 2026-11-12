import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import type { Server as HttpServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { App } from '../../main/App.ts';
import { Config } from '../../main/Config.ts';
import { Server } from '../../main/http/index.ts';
import { MockPlexServer } from '../../../dev/mock-plex/MockPlexServer.ts';

// Full sign-in against the mock Plex and mock plex.tv.
describe('sign in with Plex', () => {

    const dataDir = mkdtempSync(join(tmpdir(), 'laurels-test-'));
    const context = {
        base: '',
        mockUrl: '',
        mock: null as HttpServer | null,
        laurels: null as Server | null,
        app: null as App | null,
    };

    before(async () => {
        context.mock = await new MockPlexServer().listen(0);
        const mockPort = (context.mock.address() as AddressInfo).port;
        const mockUrl = `http://localhost:${mockPort}`;
        context.mockUrl = mockUrl;
        const config = new Config({
            DATA_DIR: dataDir,
            PLEX_URL: mockUrl,
            PLEX_TOKEN: 'mock-token',
            PLEX_TV_URL: mockUrl,
            PLEX_AUTH_URL: `${mockUrl}/auth`,
            TZ: 'UTC',
        });
        context.app = new App(config);
        await context.app.runCycle();
        context.laurels = new Server(context.app);
        const port = await context.laurels.listen(0);
        context.base = `http://localhost:${port}`;
    });

    after(() => {
        context.laurels?.close();
        context.mock?.closeAllConnections();
        context.mock?.close();
        context.app?.store.close();
        rmSync(dataDir, {
            recursive: true,
            force: true,
        });
    });

    async function signIn(token: string): Promise<{ status: number; cookie: string; body: any }> {
        const pin = await post('/api/auth/sign-in', {});
        const code = new URLSearchParams(pin.body.authUrl.split('#?')[1]).get('code');
        await fetch(`${context.mockUrl}/mock-auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, token }),
        });
        const response = await fetch(`${context.base}/api/auth/sign-in/${pin.body.id}`);
        const cookie = (response.headers.get('set-cookie') ?? '').split(';')[0];
        return {
            status: response.status,
            cookie,
            body: await response.json(),
        };
    }

    async function post(path: string, body: unknown, cookie = ''): Promise<{ status: number; body: any }> {
        const response = await fetch(context.base + path, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookie,
            },
            body: JSON.stringify(body),
        });
        return {
            status: response.status,
            body: await response.json(),
        };
    }

    async function statusOf(path: string, cookie = ''): Promise<number> {
        const response = await fetch(context.base + path, {
            headers: { Cookie: cookie },
        });
        await response.arrayBuffer();
        return response.status;
    }

    it('keeps data and settings closed without a session', async () => {
        assert.equal(await statusOf('/api/users'), 401);
        assert.equal(await statusOf('/api/settings'), 401);
        assert.equal(await statusOf('/'), 200);
    });

    it('lets a shared user view but not change settings', async () => {
        const sam = await signIn('mock-token-sam');
        assert.equal(sam.body.role, 'member');
        assert.equal(await statusOf('/api/users', sam.cookie), 200);
        assert.equal(await statusOf('/api/settings', sam.cookie), 403);
        const save = await post('/api/settings', { authMode: 'off' }, sam.cookie);
        assert.equal(save.status, 403);
    });

    it('refuses an account with no access to the server', async () => {
        const stranger = await signIn('mock-token-stranger');
        assert.equal(stranger.status, 403);
        assert.equal(stranger.cookie, '');
    });

    it('gives the owner settings, and sign-out ends the session', async () => {
        const alex = await signIn('mock-token');
        assert.equal(alex.body.role, 'owner');
        assert.equal(await statusOf('/api/settings', alex.cookie), 200);
        await post('/api/auth/sign-out', {}, alex.cookie);
        assert.equal(await statusOf('/api/settings', alex.cookie), 401);
    });

    it('gives awards and progress in the reference project format', async () => {
        const sam = await signIn('mock-token-sam');
        const awards = await fetch(`${context.base}/api/awards?user=1`, {
            headers: { Cookie: sam.cookie },
        }).then((response) => response.json());
        assert.ok(awards.length > 0);
        assert.ok(awards.every((award: any) => award.userId === '1'));
        assert.ok(awards[0].achievementId);
        const progress = await fetch(`${context.base}/api/progress?user=1`, {
            headers: { Cookie: sam.cookie },
        }).then((response) => response.json());
        assert.equal(progress.length, 1);
        assert.ok(progress[0].progress.length > 0);
        assert.equal(await statusOf('/api/awards'), 401);
    });

    it('refuses form posts', async () => {
        const response = await fetch(`${context.base}/api/auth/sign-out`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'x=1',
        });
        assert.equal(response.status, 415);
    });

});
