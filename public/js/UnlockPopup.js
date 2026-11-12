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
        return `<div class="unlock" style="box-shadow: 0 0 0 2px ${definition.colour}, var(--raised)">`
            + `<img class="unlock-poster" src="${this.api.posterUrl(award.posterKey)}" alt="Poster for ${escapeHtml(award.posterTitle)}">`
            + `<div class="stack">`
            + `<span class="eyebrow" style="color: ${definition.colour}">New award for you · ${escapeHtml(definition.laurel)}</span>`
            + `<span class="display small" id="unlock-title">${escapeHtml(definition.title)}</span>`
            + `<span class="caption">${escapeHtml(`${definition.category} · ${definition.points} points · ${definition.description}`)}</span>`
            + `<div class="row">`
            + `<a class="button primary" href="${awardLink(award.achievementId, userId)}" data-close>See award</a>`
            + `<button type="button" class="button" data-close>Dismiss</button>`
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
            + `<span class="display small" id="unlock-title">You won ${awards.length} awards while you were away</span>`
            + `<span class="caption">${escapeHtml(list)}</span>`
            + `<div class="row"><a class="button primary" href="${awardsLink(this.userId)}" data-close>See your awards</a></div>`
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

    open(html) {
        const overlay = document.createElement('div');
        overlay.className = 'overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'unlock-title');
        overlay.innerHTML = html;
        const close = () => overlay.remove();
        overlay.addEventListener('click', (event) => {
            const isBackdrop = event.target === overlay;
            const isClose = event.target.closest('[data-close]');
            if (isBackdrop || isClose) {
                close();
            }
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                close();
            }
        }, { once: true });
        document.body.appendChild(overlay);
        dissolveIn(overlay);
        irisIn(overlay.querySelector('.unlock'));
        developPrint(overlay.querySelector('.unlock-poster'));
        overlay.querySelector('[data-close]')?.focus();
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
