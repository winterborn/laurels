import type {
    IncomingMessage,
    ServerResponse,
} from 'node:http';
import type { App } from '../App.ts';
import {
    type AuthService,
    SESSION_COOKIE,
} from '../auth/index.ts';
import type { RouteResult } from './SettingsRoutes.ts';

const COOKIE_DAYS = 30;

// /api/auth: who am I, sign in with Plex, sign out.
export class AuthRoutes {

    private readonly app: App;
    private readonly auth: AuthService;

    constructor(app: App, auth: AuthService) {
        this.app = app;
        this.auth = auth;
    }

    me(request: IncomingMessage): RouteResult {
        const access = this.auth.accessFor(request);
        return {
            status: 200,
            body: {
                role: access.role,
                name: access.name,
                accountId: access.accountId,
                authMode: this.app.settings.authMode,
                configured: this.app.isConfigured,
                hasOwner: this.app.settings.ownerId !== '' || this.app.settings.plexToken !== '',
            },
        };
    }

    async startSignIn(): Promise<RouteResult> {
        try {
            const pin = await this.auth.startSignIn();
            return {
                status: 200,
                body: {
                    id: pin.id,
                    authUrl: pin.authUrl,
                },
            };
        } catch (error) {
            return this.fail(error);
        }
    }

    // Polled by the page until plex.tv confirms the sign-in.
    async finishSignIn(
        pinId: string,
        request: IncomingMessage,
        response: ServerResponse,
    ): Promise<RouteResult> {
        try {
            const result = await this.auth.finishSignIn(Number(pinId));
            switch (result.status) {
                case 'waiting':
                    return {
                        status: 200,
                        body: { signedIn: false },
                    };
                case 'refused':
                    return {
                        status: 403,
                        body: { error: result.message },
                    };
                case 'signed-in':
                    this.setCookie(request, response, result.cookieValue, COOKIE_DAYS * 86_400);
                    return {
                        status: 200,
                        body: {
                            signedIn: true,
                            role: result.role,
                            name: result.name,
                        },
                    };
            }
        } catch (error) {
            return this.fail(error);
        }
    }

    signOut(request: IncomingMessage, response: ServerResponse): RouteResult {
        this.auth.signOut(request);
        this.setCookie(request, response, '', 0);
        return {
            status: 200,
            body: { signedIn: false },
        };
    }

    // HttpOnly: page scripts cannot read it. Secure when served over HTTPS.
    private setCookie(
        request: IncomingMessage,
        response: ServerResponse,
        value: string,
        maxAge: number,
    ): void {
        const isHttps = request.headers['x-forwarded-proto'] === 'https';
        const parts = [
            `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
            'Path=/',
            'HttpOnly',
            'SameSite=Lax',
            `Max-Age=${maxAge}`,
        ];
        if (isHttps) {
            parts.push('Secure');
        }
        response.setHeader('Set-Cookie', parts.join('; '));
    }

    private fail(error: unknown): RouteResult {
        const message = error instanceof Error ? error.message : String(error);
        return {
            status: 400,
            body: { error: message },
        };
    }

}
