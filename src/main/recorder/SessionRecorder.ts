import type { Store } from '../store/index.ts';
import {
    ActivityTracker,
    type SessionReader,
    type Timeline,
} from './ActivityTracker.ts';

// Tautulli's WEBSOCKET_CONNECTION_ATTEMPTS and WEBSOCKET_CONNECTION_TIMEOUT.
const QUICK_ATTEMPTS = 5;
const QUICK_WAIT_MS = 5_000;
// After the quick attempts, try again once a minute.
const SLOW_WAIT_MS = 60_000;
// How often to look for stale sessions.
const STALE_CHECK_MS = 60_000;

// Listens to the Plex websocket, like Tautulli, and passes each "playing"
// event to the ActivityTracker. The token goes in the address, as Plex needs it,
// so this class never logs the address.
export class SessionRecorder {

    private readonly url: string;
    private readonly tracker: ActivityTracker;
    private socket: WebSocket | null = null;
    private failures = 0;
    private isStopped = false;
    private reconnectTimer: NodeJS.Timeout | undefined;
    private staleTimer: NodeJS.Timeout | undefined;
    // Events run one at a time, in the order Plex sends them.
    private queue: Promise<void> = Promise.resolve();

    constructor(
        plexUrl: string,
        token: string,
        store: Store,
        reader: SessionReader,
        now?: () => number,
    ) {
        const socketBase = plexUrl.replace(/^http/, 'ws');
        this.url = `${socketBase}/:/websockets/notifications?X-Plex-Token=${encodeURIComponent(token)}`;
        this.tracker = new ActivityTracker(store, reader, now);
    }

    start(): void {
        this.isStopped = false;
        this.connect();
        this.staleTimer = setInterval(() => this.checkStale(), STALE_CHECK_MS);
    }

    stop(): void {
        this.isStopped = true;
        clearTimeout(this.reconnectTimer);
        clearInterval(this.staleTimer);
        this.socket?.close();
        this.socket = null;
    }

    // Resolves when every event so far is handled.
    async settled(): Promise<void> {
        await this.queue;
    }

    private connect(): void {
        const socket = new WebSocket(this.url);
        this.socket = socket;
        socket.addEventListener('open', () => this.onOpen());
        socket.addEventListener('message', (event) => this.onMessage(event.data));
        socket.addEventListener('close', () => this.onClose());
        socket.addEventListener('error', () => socket.close());
    }

    // check_active_sessions on connect: catch up with what happened while away.
    private onOpen(): void {
        if (this.failures > 0) {
            console.log('Session recorder: connected to Plex again');
        }
        this.failures = 0;
        this.enqueue(() => this.tracker.reconcile());
    }

    private onMessage(data: unknown): void {
        const timelines = this.playingEvents(String(data));
        for (const timeline of timelines) {
            this.enqueue(() => this.tracker.process(timeline));
        }
    }

    private onClose(): void {
        this.socket = null;
        if (this.isStopped) {
            return;
        }
        this.failures += 1;
        if (this.failures === 1) {
            console.warn('Session recorder: lost the connection to Plex. Laurels tries again.');
        }
        const wait = this.failures <= QUICK_ATTEMPTS ? QUICK_WAIT_MS : SLOW_WAIT_MS;
        this.reconnectTimer = setTimeout(() => this.connect(), wait);
    }

    // Only "playing" notifications carry session states.
    private playingEvents(text: string): Timeline[] {
        try {
            const container = JSON.parse(text)?.NotificationContainer;
            if (container?.type !== 'playing') {
                return [];
            }
            return container.PlaySessionStateNotification ?? [];
        } catch {
            return [];
        }
    }

    private checkStale(): void {
        this.enqueue(async () => this.tracker.stopStale());
    }

    private enqueue(run: () => Promise<void>): void {
        this.queue = this.queue
            .then(run)
            .catch((error) => console.error('Session recorder failed:', error));
    }

}
