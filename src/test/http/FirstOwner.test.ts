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

// A new install with no owner and no token: who can claim it?
describe('first sign-in on a new install', () => {

    const dataDir = mkdtempSync(join(tmpdir(), 'laurels-owner-'));
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
        context.mockUrl = `http://localhost:${mockPort}`;
        const config = new Config({
            DATA_DIR: dataDir,
            PLEX_TV_URL: context.mockUrl,
            PLEX_AUTH_URL: `${context.mockUrl}/auth`,
            TZ: 'UTC',
        });
        context.app = new App(config);
        context.laurels = new Server(context.app);
        const port = await context.laurels.listen(0);
        context.base = `http://localhost:${port}`;
    });

    after(() => {
        context.laurels?.close();
        context.mock?.closeAllConnections();
        context.mock?.close();
        context.app?.stop();
        context.app?.store.close();
        rmSync(dataDir, {
            recursive: true,
            force: true,
        });
    });

    async function signIn(token: string): Promise<{ status: number; body: any }> {
        const pin = await fetch(`${context.base}/api/auth/sign-in`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
        }).then((response) => response.json());
        const code = new URLSearchParams(pin.authUrl.split('#?')[1]).get('code');
        await fetch(`${context.mockUrl}/mock-auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, token }),
        });
        const response = await fetch(`${context.base}/api/auth/sign-in/${pin.id}`);
        return {
            status: response.status,
            body: await response.json(),
        };
    }

    it('refuses an account that does not own a Plex server', async () => {
        const sam = await signIn('mock-token-sam');
        assert.equal(sam.status, 403);
        assert.equal(context.app?.settings.ownerId, '');
    });

    it('makes the account that owns the server the owner', async () => {
        const alex = await signIn('mock-token');
        assert.equal(alex.body.role, 'owner');
        assert.equal(context.app?.settings.ownerId, '1');
    });

});
