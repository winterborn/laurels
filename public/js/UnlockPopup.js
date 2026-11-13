import {
    awardLink,
    awardsLink,
    developPrint,
    dissolveIn,
    escapeHtml,
    irisIn,
} from './helpers/index.js';

const KEY_PREFIX = 'laurels.lastSeen.';
const BATCH_POSTERS = 3;
const NAMES_SHOWN = 5;

// Shows awards that are new since your last visit.
// The first visit only remembers the time, so old awards never pop up.
export class UnlockPopup {

    constructor(api, definitions) {
        this.api = api;
        this.definitions = definitions;
    }

    show(userId, awards) {
        this.userId = userId;
        const lastSeen = this.lastSeen(userId);
        const newest = Math.max(0, ...awards.map((award) => award.grantedAt ?? 0));
        this.remember(userId, Math.max(newest, Math.floor(Date.now() / 1000)));
        if (lastSeen === null) {
            return;
        }
        const fresh = awards.filter((award) => (award.grantedAt ?? 0) > lastSeen);
        if (!fresh.length) {
            return;
        }
        const html = fresh.length === 1 ? this.single(fresh[0], userId) : this.batch(fresh);
        this.open(html);
    }

    single(award, userId) {
        const definition = this.definitions.get(award.achievementId);
        const eyebrow = `Just announced · ${definition.laurel}`;
        return `<div class="unlock" style="box-shadow: 0 0 0 2px ${definition.colour}, var(--raised)">`
            + `<img class="unlock-poster" src="${this.api.posterUrl(award.posterKey)}" alt="Poster for ${escapeHtml(award.posterTitle)}">`
            + `<div class="stack">`
            + `<span class="eyebrow" style="color: ${definition.colour}">${escapeHtml(eyebrow)}</span>`
            + `<span class="display small" id="unlock-title">${escapeHtml(definition.title)}</span>`
            + `<span class="caption">${escapeHtml(`${definition.category} · ${definition.points} points · ${definition.description}`)}</span>`
            + `<div class="row">`
            + `<a class="button primary" href="${awardLink(award.achievementId, userId)}" data-close>See award</a>`
            + `<button type="button" class="button" data-close>Close</button>`
            + `</div></div></div>`;
    }

    batch(awards) {
        const posters = awards.slice(0, BATCH_POSTERS).map((award) => {
            const definition = this.definitions.get(award.achievementId);
            return `<img src="${this.api.posterUrl(award.posterKey)}" alt="" style="box-shadow: 0 0 0 2px ${definition.colour}">`;
        });
        const list = this.nameList(awards.map((award) => this.definitions.get(award.achievementId).title));
        return `<div class="unlock">`
            + `<div class="poster-fan">${posters.join('')}</div>`
            + `<div class="stack">`
            + `<span class="display small" id="unlock-title">Just announced: ${awards.length} new awards</span>`
            + `<span class="caption">${escapeHtml(list)}</span>`
            + `<div class="row">`
            + `<a class="button primary" href="${awardsLink(this.userId)}" data-close>See your awards</a>`
            + `<button type="button" class="button" data-close>Close</button>`
            + `</div>`
            + `</div></div>`;
    }

    // "A, B and C." or "A, B, C, D, E and 15 more."
    nameList(names) {
        const shown = names.slice(0, NAMES_SHOWN);
        const hidden = names.length - shown.length;
        if (hidden > 0) {
            return `${shown.join(', ')} and ${hidden} more.`;
        }
        if (shown.length === 1) {
            return `${shown[0]}.`;
        }
        return `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}.`;
    }

    // A modal dialog: Tab stays inside, Escape closes, focus goes back.
    open(html) {
        const opener = document.activeElement;
        const listening = new AbortController();
        const overlay = document.createElement('div');
        overlay.className = 'overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'unlock-title');
        overlay.innerHTML = html;
        const close = () => {
            listening.abort();
            overlay.remove();
            opener?.focus?.();
        };
        overlay.addEventListener('click', (event) => {
            const isBackdrop = event.target === overlay;
            const isClose = event.target.closest('[data-close]');
            if (isBackdrop || isClose) {
                close();
            }
        });
        document.addEventListener('keydown', (event) => this.onKey(event, overlay, close), {
            signal: listening.signal,
        });
        document.body.appendChild(overlay);
        dissolveIn(overlay);
        irisIn(overlay.querySelector('.unlock'));
        developPrint(overlay.querySelector('.unlock-poster'));
        overlay.querySelector('[data-close]')?.focus();
    }

    onKey(event, overlay, close) {
        switch (event.key) {
            case 'Escape':
                close();
                return;
            case 'Tab':
                this.keepFocusIn(overlay, event);
                return;
        }
    }

    // Tab from the last control goes to the first, Shift+Tab the other way.
    keepFocusIn(overlay, event) {
        const controls = [...overlay.querySelectorAll('a[href], button')];
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first) {
            return;
        }
        const isOutside = !overlay.contains(document.activeElement);
        const wrapsBack = event.shiftKey && document.activeElement === first;
        const wrapsForward = !event.shiftKey && document.activeElement === last;
        if (isOutside || wrapsForward) {
            event.preventDefault();
            first.focus();
        } else if (wrapsBack) {
            event.preventDefault();
            last.focus();
        }
    }

    // Local storage can be blocked. Then the popup never shows.
    lastSeen(userId) {
        try {
            const value = localStorage.getItem(KEY_PREFIX + userId);
            return value === null ? null : Number(value);
        } catch {
            return null;
        }
    }

    remember(userId, seconds) {
        try {
            localStorage.setItem(KEY_PREFIX + userId, String(seconds));
        } catch {
            // Nothing to remember.
        }
    }

}
