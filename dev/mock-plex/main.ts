import { MockPlexServer } from './MockPlexServer.ts';

const port = Number(process.env.MOCK_PLEX_PORT ?? '32401');
const mock = new MockPlexServer();
await mock.listen(port);
console.log(`Mock Plex on http://localhost:${port} (token: mock-token, ${mock.historySize} history rows)`);
