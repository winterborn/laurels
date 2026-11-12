import { rmSync } from 'node:fs';
import { App } from '../src/main/App.ts';
import { Config } from '../src/main/Config.ts';
import { Server } from '../src/main/http/index.ts';
import {
    MOCK_TOKEN,
    MockPlexServer,
} from './mock-plex/MockPlexServer.ts';

// Runs Laurels against the mock Plex server, from an empty database.
const MOCK_PORT = 32401;
const port = Number(process.env.PORT ?? '8484');
const dataDir = 'data-demo';

rmSync(dataDir, {
    recursive: true,
    force: true,
});

const mock = new MockPlexServer();
await mock.listen(MOCK_PORT);
console.log(`Mock Plex: ${mock.historySize} history rows`);

const config = new Config({
    PLEX_URL: `http://localhost:${MOCK_PORT}`,
    PLEX_TOKEN: MOCK_TOKEN,
    PORT: String(port),
    DATA_DIR: dataDir,
    TZ: 'Europe/London',
    POLL_MINUTES: '60',
    // The mock Plex has no websocket, so the demo does not record plays.
    RECORD_SESSIONS: 'false',
    PLEX_TV_URL: `http://localhost:${MOCK_PORT}`,
    PLEX_AUTH_URL: `http://localhost:${MOCK_PORT}/auth`,
    DEMO_MOCK_URL: `http://localhost:${MOCK_PORT}`,
});
const app = new App(config);
await app.runCycle();
const server = new Server(app);
await server.listen(port);
app.start();
console.log(`Laurels demo on http://localhost:${port} (sign in with the mock: Alex owns, Sam is shared)`);
