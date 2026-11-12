import { App } from './App.ts';
import { Config } from './Config.ts';
import { Server } from './http/index.ts';

try {
    const config = Config.fromProcess();
    const app = new App(config);
    const server = new Server(app);
    await server.listen(config.port);
    console.log(`Laurels on http://localhost:${config.port}`);
    if (!app.isConfigured) {
        console.log('Open the page and go to Settings to connect your server.');
    }
    app.start();
    // Docker sends SIGTERM on stop. Close the database cleanly.
    for (const signal of ['SIGTERM', 'SIGINT']) {
        process.on(signal, () => {
            app.store.close();
            process.exit(0);
        });
    }
} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
}
