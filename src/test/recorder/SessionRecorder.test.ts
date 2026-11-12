import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { SessionInfo } from '../../main/model/index.ts';
import { SessionRecorder } from '../../main/recorder/index.ts';
import { Store } from '../../main/store/index.ts';

const folder = mkdtempSync(join(tmpdir(), 'laurels-socket-'));
const WEBSOCKET_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

// A small websocket server that sends text frames, like the Plex notifications endpoint.
class FakePlexSocket {

    readonly server: Server;
    readonly clients: Socket[] = [];
    lastUrl = '';

    constructor() {
        this.server = createServer();
        this.server.on('upgrade', (request, socket) => {
            this.lastUrl = request.url ?? '';
            const accept = createHash('sha1')
                .update(`${request.headers['sec-websocket-key']}${WEBSOCKET_GUID}`)
                .digest('base64');
            socket.write([
                'HTTP/1.1 101 Switching Protocols',
                'Upgrade: websocket',
                'Connection: Upgrade',
                `Sec-WebSocket-Accept: ${accept}`,
                '',
                '',
            ].join('\r\n'));
            this.clients.push(socket as Socket);
        });
    }

    send(body: unknown): void {
        const payload = Buffer.from(JSON.stringify(body));
        const header = payload.length < 126
            ? Buffer.from([0x81, payload.length])
            : Buffer.from([0x81, 126, payload.length >> 8, payload.length & 0xff]);
        for (const client of this.clients) {
            client.write(Buffer.concat([header, payload]));
        }
    }

}

function playing(state: string, viewOffset: number) {
    return {
        NotificationContainer: {
            type: 'playing',
            PlaySessionStateNotification: [{
                sessionKey: '21',
                ratingKey: '7',
                state,
                viewOffset,
            }],
        },
    };
}

describe('SessionRecorder', () => {

    const store = new Store(join(folder, 'test.db'));
    const plex = new FakePlexSocket();
    const clock = { time: 1000 };
    const info: SessionInfo = {
        sessionKey: '21',
        ratingKey: '7',
        userId: '1',
        kind: 'movie',
        title: 'Film 7',
        guid: 'plex://movie/7',
        durationMs: 6_000_000,
        viewOffsetMs: 0,
        state: 'playing',
        isLive: false,
    };
    const reader = {
        currentSessions: async () => [info],
        creditsStart: async () => undefined,
    };
    const context = { recorder: null as SessionRecorder | null };

    before(async () => {
        await new Promise<void>((resolve) => plex.server.listen(0, resolve));
        const port = (plex.server.address() as AddressInfo).port;
        context.recorder = new SessionRecorder(`http://localhost:${port}`, 'secret-token', store, reader, () => clock.time);
        context.recorder.start();
        await waitFor(() => plex.clients.length > 0);
    });

    after(() => {
        context.recorder?.stop();
        plex.clients.forEach((client) => client.destroy());
        plex.server.close();
        store.close();
        rmSync(folder, {
            recursive: true,
            force: true,
        });
    });

    async function waitFor(check: () => boolean): Promise<void> {
        for (const _ of Array.from({ length: 100 })) {
            if (check()) {
                return;
            }
            await new Promise((resolve) => setTimeout(resolve, 20));
        }
        throw new Error('Timed out');
    }

    // Each event waits until the recorder handled it, so the fake clock is right.
    async function send(time: number, state: string, viewOffset: number): Promise<void> {
        clock.time = time;
        plex.send(playing(state, viewOffset));
        await new Promise((resolve) => setTimeout(resolve, 50));
        await context.recorder?.settled();
    }

    it('connects to the Plex notifications address with the token', () => {
        assert.ok(plex.lastUrl.startsWith('/:/websockets/notifications?X-Plex-Token=secret-token'));
    });

    it('records a play from the websocket events', async () => {
        await send(1000, 'playing', 0);
        await send(1300, 'paused', 300_000);
        await send(1400, 'playing', 300_000);
        await send(7400, 'stopped', 5_999_000);
        const [play] = store.recordedPlays();
        assert.equal(play?.started, 1000);
        assert.equal(play?.stopped, 7400);
        assert.equal(play?.pausedSeconds, 100);
    });

});
