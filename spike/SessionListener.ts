import type { Findings, Verdict } from './Findings.ts';
import type { Output } from './Output.ts';
import type { PlexClient, PlexItem } from './PlexClient.ts';
import { formatCounts } from './helpers/format.ts';
import { countBy, median, unique } from './helpers/lists.ts';

const SECTION = 'Websocket';

export interface SessionListenerOptions {
    plex: PlexClient;
    output: Output;
    findings: Findings;
    minutes: number;
}

interface PlayingEvent {
    at: number;
    sessionKey: string;
    ratingKey: string;
    state: string;
    viewOffset: number;
}

// Listens the way Tautulli does: one socket, "playing" events,
// one /status/sessions lookup per new session.
export class SessionListener {

    private readonly plex: PlexClient;
    private readonly output: Output;
    private readonly findings: Findings;
    private readonly minutes: number;

    private readonly events: PlayingEvent[] = [];
    private readonly otherTypes: string[] = [];
    private readonly sessions = new Map<string, PlexItem>();
    private readonly lookups: Promise<void>[] = [];
    private readonly socketState = {
        opened: false,
        closedEarly: false,
        closeCode: 0,
    };

    constructor(options: SessionListenerOptions) {
        this.plex = options.plex;
        this.output = options.output;
        this.findings = options.findings;
        this.minutes = options.minutes;
    }

    async run(): Promise<void> {
        console.log(`Listening for ${this.minutes} minutes. Ctrl+C stops early.`);
        const socket = new WebSocket(this.plex.websocketUrl());
        socket.addEventListener('open', () => this.onOpen());
        socket.addEventListener('message', (event) => {
            this.onMessage(String(event.data));
        });
        await this.waitForEnd(socket);
        socket.close();
        await Promise.all(this.lookups);
        await this.save();
        this.report();
    }

    private async waitForEnd(socket: WebSocket): Promise<void> {
        const closed = new Promise<void>((resolve) => {
            socket.addEventListener('close', (event) => {
                this.socketState.closedEarly = true;
                this.socketState.closeCode = event.code;
                resolve();
            });
        });
        const interrupted = new Promise<void>((resolve) => {
            process.once('SIGINT', () => resolve());
        });
        const timer = { id: setTimeout(() => {}, 0) };
        const timedOut = new Promise<void>((resolve) => {
            timer.id = setTimeout(resolve, this.minutes * 60_000);
        });
        await Promise.race([closed, interrupted, timedOut]);
        clearTimeout(timer.id);
    }

    private onOpen(): void {
        this.socketState.opened = true;
        console.log('Socket open. Start playing something now.');
    }

    private onMessage(text: string): void {
        const container = this.parse(text);
        if (!container) {
            return;
        }
        const type = String(container.type);
        if (type === 'playing') {
            const notifications: PlexItem[] = container.PlaySessionStateNotification ?? [];
            for (const notification of notifications) {
                this.record(notification);
            }
        } else {
            this.otherTypes.push(type);
        }
    }

    private parse(text: string): PlexItem | null {
        try {
            const body = JSON.parse(text);
            return body.NotificationContainer ?? null;
        } catch {
            return null;
        }
    }

    private record(notification: PlexItem): void {
        const event: PlayingEvent = {
            at: Date.now(),
            sessionKey: String(notification.sessionKey),
            ratingKey: String(notification.ratingKey),
            state: String(notification.state),
            viewOffset: Number(notification.viewOffset),
        };
        this.events.push(event);
        this.print(event);
        if (!this.sessions.has(event.sessionKey)) {
            this.sessions.set(event.sessionKey, {
                pending: true,
            });
            this.lookups.push(this.lookup(event.sessionKey));
        }
    }

    private print(event: PlayingEvent): void {
        const time = new Date(event.at).toISOString().slice(11, 19);
        const seconds = Math.round(event.viewOffset / 1000);
        console.log(`${time} session ${event.sessionKey} ${event.state} at ${seconds}s`);
    }

    private async lookup(sessionKey: string): Promise<void> {
        try {
            const container = await this.plex.getJson('/status/sessions');
            const items: PlexItem[] = container.Metadata ?? [];
            const match = items.find((item) => String(item.sessionKey) === sessionKey);
            this.sessions.set(sessionKey, this.describe(match));
        } catch (error) {
            this.sessions.set(sessionKey, {
                error: String(error),
            });
        }
    }

    private describe(item: PlexItem | undefined): PlexItem {
        if (!item) {
            return {
                found: false,
            };
        }
        return {
            found: true,
            userId: String(item.User?.id ?? ''),
            userName: item.User?.title,
            platform: item.Player?.platform,
            product: item.Player?.product,
            type: item.type,
            ratingKey: item.ratingKey,
            duration: Number(item.duration),
        };
    }

    private async save(): Promise<void> {
        await this.output.json('listen-events', this.events);
        await this.output.json('listen-sessions', Object.fromEntries(this.sessions));
    }

    private report(): void {
        const sessions = [...this.sessions.values()];
        const found = sessions.filter((session) => session.found);
        const userIds = unique(found.map((session) => session.userId));
        const platforms = countBy(found, (session) => String(session.platform));
        const states = countBy(this.events, (event) => event.state);
        const others = countBy(this.otherTypes, (type) => type);
        this.noteSocket();
        this.note('"playing" events received', String(this.events.length), this.events.length ? 'ok' : 'fail');
        this.note('States seen', formatCounts(states), this.stateVerdict(states));
        this.note('Other event types', formatCounts(others), 'info');
        this.note('Sessions seen', String(sessions.length), 'info');
        this.note('Sessions found in /status/sessions', `${found.length} of ${sessions.length}`, 'info');
        this.note('User ids seen', userIds.join(', ') || 'none', userIds.length > 1 ? 'ok' : 'check');
        this.note('Platforms seen', formatCounts(platforms), 'info');
        this.note('Median seconds between events', String(this.medianGap()), 'info');
    }

    private noteSocket(): void {
        const opened = this.socketState.opened ? 'yes' : 'no';
        this.note('Socket opened with owner token', opened, this.socketState.opened ? 'ok' : 'fail');
        if (this.socketState.closedEarly) {
            const answer = `yes, code ${this.socketState.closeCode}`;
            this.note('Socket closed by server', answer, 'check');
        }
    }

    private stateVerdict(states: Record<string, number>): Verdict {
        const hasPause = states.paused !== undefined;
        const hasStop = states.stopped !== undefined;
        return hasPause && hasStop ? 'ok' : 'check';
    }

    private medianGap(): number {
        const gaps: number[] = [];
        for (const sessionKey of this.sessions.keys()) {
            const times = this.events
                .filter((event) => event.sessionKey === sessionKey)
                .map((event) => event.at);
            for (const [index, time] of times.entries()) {
                if (index > 0) {
                    gaps.push((time - times[index - 1]) / 1000);
                }
            }
        }
        return Math.round(median(gaps));
    }

    private note(question: string, answer: string, verdict: Verdict): void {
        this.findings.add(SECTION, question, answer, verdict);
    }

}
