const POLL_MS = 2000;
const TIMEOUT_MS = 5 * 60 * 1000;
const RESUME_TIMEOUT_MS = 30 * 1000;
const PENDING_KEY = 'laurels.pendingPin';

// Opens Plex sign-in and waits for plex.tv to confirm.
// If the browser blocks the popup, Plex sends the person back here
// (forwardUrl) and resume() finishes the sign-in.
export class PlexSignIn {

    constructor(api) {
        this.api = api;
    }

    // Resolves to { ok, role, name } or { ok: false, error }.
    async run(onWaiting) {
        const popup = window.open('', 'plex-sign-in', 'width=600,height=720');
        const pin = await this.api.post('/api/auth/sign-in', {});
        if (!pin.ok) {
            popup?.close();
            return this.failure(pin.body.error);
        }
        this.remember(pin.body.id);
        const authUrl = this.withReturn(pin.body.authUrl);
        if (!popup) {
            window.location.href = authUrl;
            return new Promise(() => {});
        }
        popup.location.href = authUrl;
        onWaiting();
        const result = await this.waitFor(pin.body.id, TIMEOUT_MS);
        popup.close();
        return result;
    }

    // After coming back from Plex in the same tab.
    async resume() {
        const pinId = this.pending();
        if (!pinId) {
            return null;
        }
        return this.waitFor(pinId, RESUME_TIMEOUT_MS);
    }

    async waitFor(pinId, timeoutMs) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const result = await this.api.getResult(`/api/auth/sign-in/${pinId}`);
            if (!result.ok) {
                this.forget();
                return this.failure(result.body.error);
            }
            if (result.body.signedIn) {
                this.forget();
                return {
                    ok: true,
                    role: result.body.role,
                    name: result.body.name,
                };
            }
            await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        }
        this.forget();
        return this.failure('Sign-in timed out. Try again.');
    }

    withReturn(authUrl) {
        const back = `${location.origin}${location.pathname}`;
        return `${authUrl}&forwardUrl=${encodeURIComponent(back)}`;
    }

    // Session storage can be blocked: sign-in still works with the popup.
    remember(pinId) {
        try {
            sessionStorage.setItem(PENDING_KEY, String(pinId));
        } catch {
            // Popup flow only.
        }
    }

    pending() {
        try {
            return sessionStorage.getItem(PENDING_KEY);
        } catch {
            return null;
        }
    }

    forget() {
        try {
            sessionStorage.removeItem(PENDING_KEY);
        } catch {
            // Nothing saved.
        }
    }

    failure(message) {
        return {
            ok: false,
            error: message,
        };
    }

}
