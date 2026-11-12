import { Config } from './Config.ts';
import { SpikeApp } from './SpikeApp.ts';

try {
    const config = Config.fromProcess();
    const app = new SpikeApp(config);
    await app.run();
} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
}

// A half-closed websocket would keep Node running.
process.exit();
