import { UnlockPopup } from './UnlockPopup.js';

const CHECK_MS = 60_000;

// Looks for premieres (awards new since your last visit) on every page:
// at start, every minute while the tab is open, and when asked.
export class PremiereWatcher {

    constructor(api) {
        this.api = api;
        this.userId = '';
        this.timer = null;
        window.addEventListener('laurels:check-premieres', () => this.check());
    }

    start(userId) {
        if (!userId || userId === this.userId) {
            return;
        }
        this.userId = userId;
        clearInterval(this.timer);
        this.timer = setInterval(() => this.check(), CHECK_MS);
        this.check();
    }

    stop() {
        clearInterval(this.timer);
        this.userId = '';
    }

    async check() {
        const isBusy = document.hidden || document.querySelector('.overlay');
        if (!this.userId || isBusy) {
            return;
        }
        const popup = new UnlockPopup(this.api, null);
        const since = popup.lastSeen(this.userId);
        const awards = await this.api.premieres(this.userId, since ?? Math.floor(Date.now() / 1000));
        if (since !== null && !awards.length) {
            return;
        }
        const definitions = new Map((await this.api.definitions()).map((definition) => [definition.id, definition]));
        new UnlockPopup(this.api, definitions).show(this.userId, awards);
    }

}
