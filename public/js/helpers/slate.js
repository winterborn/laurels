import { escapeHtml } from './html.js';

// A clapperboard slate, in place of a poster that does not exist yet.
// rows: [['Award', 'Marathon'], ['Scene', '3 of 4'], ['Take', 'Epic']]
export function slateHtml(rows) {
    const items = rows.map(([label, value]) => {
        return `<div class="slate-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
    });
    return `<div class="slate">`
        + `<div class="slate-sticks" aria-hidden="true"></div>`
        + `<dl class="slate-board">${items.join('')}</dl>`
        + `</div>`;
}
