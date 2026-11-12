import {
    createHash,
    randomBytes,
} from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { App } from '../App.ts';
import {
    isPrivateAddress,
    parseCookies,
} from '../helpers/index.ts';
import type {
    Role,
    Session,
} from '../model/index.ts';
import {
    PlexAccount,
    type PlexPin,
    type PlexUser,
} from '../sources/index.ts';

export const SESSION_COOKIE = 'laurels_session';

const SESSION_DAYS = 30;
const DAY_SECONDS = 86_400;

export interface Access {
    role: Role | null;
    name: string;
    // The person's account id in Plex history. The owner is always 1 there.
    accountId: string;
}

const OWNER_ACCOUNT_ID = '1';

export type SignInResult =
    | { status: 'waiting' }
    | { status: 'refused'; message: string }
    | { status: 'signed-in'; role: Role; name: string; cookieValue: string };

// Sign in with Plex. The owner manages settings, members only view.
export class AuthService {

    private readonly app: App;

    constructor(app: App) {
        this.app = app;
    }

    get isOff(): boolean {
        return this.app.settings.authMode === 'off';
    }

    // Who is asking: from the session cookie, the guest rule, or nobody.
    accessFor(request: IncomingMessage): Access {
        if (this.isOff) {
            return {
                role: 'owner',
                name: '',
                accountId: '',
            };
        }
        const session = this.sessionFor(request);
        if (session) {
            return {
                role: session.role,
                name: session.name,
                accountId: session.role === 'owner' ? OWNER_ACCOUNT_ID : session.plexUserId,
            };
        }
        const isGuest = this.app.settings.lanGuests && this.isHomeNetwork(request);
        return {
            role: isGuest ? 'guest' : null,
            name: '',
            accountId: '',
        };
    }

    async startSignIn(): Promise<PlexPin> {
        return this.account().createPin();
    }

    async finishSignIn(pinId: number): Promise<SignInResult> {
        const token = await this.account().tokenFor(pinId);
        if (!token) {
            return { status: 'waiting' };
        }
        const user = await this.account().whoAmI(token);
        const role = await this.roleFor(user, token);
        if (!role) {
            return {
                status: 'refused',
                message: `${user.name} has no access to this Plex server. `
                    + 'To set up Laurels, sign in with the account that owns the server.',
            };
        }
        if (role === 'owner') {
            this.keepOwnerToken(user, token);
        }
        return {
            status: 'signed-in',
            role,
            name: user.name,
            cookieValue: this.createSession(user, role),
        };
    }

    signOut(request: IncomingMessage): void {
        const value = parseCookies(request.headers.cookie).get(SESSION_COOKIE);
        if (value) {
            this.app.store.deleteSession(this.hash(value));
        }
    }

    // First sign-in on a new install makes that account the owner,
    // but only if the account owns the Plex server.
    async roleFor(user: PlexUser, token: string): Promise<Role | null> {
        const ownerId = await this.ownerId();
        if (!ownerId) {
            const isServerOwner = await this.ownsServer(token);
            return isServerOwner ? 'owner' : null;
        }
        if (user.id === ownerId) {
            return 'owner';
        }
        const isMember = await this.isMember(token);
        return isMember ? 'member' : null;
    }

    // The server at the Plex address, or any server if Laurels has no address yet.
    private async ownsServer(token: string): Promise<boolean> {
        const servers = await this.account().servers(token);
        const owned = servers.filter((server) => server.owned);
        const machineId = await this.configuredMachineId();
        if (!machineId) {
            return owned.length > 0;
        }
        return owned.some((server) => server.machineId === machineId);
    }

    private async configuredMachineId(): Promise<string> {
        const plex = this.app.plex;
        if (!plex) {
            return '';
        }
        try {
            return await plex.machineId();
        } catch {
            return '';
        }
    }

    private async isMember(token: string): Promise<boolean> {
        const plex = this.app.plex;
        if (!plex) {
            return false;
        }
        const machineId = await plex.machineId();
        if (!machineId) {
            return false;
        }
        return this.account().canReach(token, machineId);
    }

    // Saved owner, or the account behind a PLEX_TOKEN variable.
    private async ownerId(): Promise<string> {
        const saved = this.app.settings.ownerId;
        const token = this.app.settings.plexToken;
        if (saved || !token) {
            return saved;
        }
        const owner = await this.account().whoAmI(token);
        this.app.settingsStore.saveOwner(owner.id);
        return owner.id;
    }

    // The owner's fresh token replaces a saved one that may have expired.
    private keepOwnerToken(user: PlexUser, token: string): void {
        if (!this.app.settings.ownerId) {
            this.app.settingsStore.saveOwner(user.id);
        }
        const isTokenLocked = this.app.settingsStore.locked.includes('plexToken');
        if (!isTokenLocked) {
            this.app.updateSettings({ plexToken: token });
        }
    }

    private createSession(user: PlexUser, role: Role): string {
        const value = randomBytes(32).toString('base64url');
        const now = Math.floor(Date.now() / 1000);
        this.app.store.deleteExpiredSessions(now);
        this.app.store.saveSession({
            idHash: this.hash(value),
            plexUserId: user.id,
            name: user.name,
            role,
            createdAt: now,
            expiresAt: now + SESSION_DAYS * DAY_SECONDS,
        });
        return value;
    }

    private sessionFor(request: IncomingMessage): Session | null {
        const value = parseCookies(request.headers.cookie).get(SESSION_COOKIE);
        if (!value) {
            return null;
        }
        const now = Math.floor(Date.now() / 1000);
        return this.app.store.findSession(this.hash(value), now);
    }

    // A proxy in front hides the real visitor, so proxied requests never count.
    private isHomeNetwork(request: IncomingMessage): boolean {
        const isProxied = Boolean(request.headers['x-forwarded-for'] || request.headers.forwarded);
        if (isProxied) {
            return false;
        }
        return isPrivateAddress(request.socket.remoteAddress);
    }

    private account(): PlexAccount {
        return new PlexAccount(this.app.settings.clientId, this.app.config.plexTv);
    }

    private hash(value: string): string {
        return createHash('sha256').update(value).digest('hex');
    }

}
