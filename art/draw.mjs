import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = new URL('./out/', import.meta.url);
const BG = '#0f1a2b';
const INK = '#f1ead8';
const GOLD = '#e3b04b';
const SANS = "Futura, 'Century Gothic', 'Avenir Next', 'Trebuchet MS', sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";
const TIERS = {
    common: '#5f6e82',
    uncommon: '#3fa39a',
    rare: GOLD,
    epic: '#d0554c',
    legendary: INK,
};

const path = (d, color = INK, w = 10) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const fillPath = (d, color = INK) => `<path d="${d}" fill="${color}"/>`;
const ring = (cx, cy, r, color = INK, w = 10) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${w}"/>`;
const dot = (cx, cy, r, color = INK) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`;
const box = (x, y, w, h, r, color = INK, sw = 10, fill = 'none') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round"/>`;
const play = (cx, cy, s, color = GOLD) => `<path d="M${cx - s * 0.4} ${cy - s / 2} L${cx + s / 2} ${cy} L${cx - s * 0.4} ${cy + s / 2} Z" fill="${color}" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>`;
const label = (x, y, text, size, color = GOLD, font = SANS, extra = '') => `<text x="${x}" y="${y}" fill="${color}" font-family="${font}" font-weight="700" font-size="${size}" text-anchor="middle" ${extra}>${text}</text>`;
const scallops = (x0, x1, y, r) => {
    const parts = [];
    for (let x = x0; x < x1; x += r * 2) {
        parts.push(`M${x} ${y} A${r} ${r} 0 0 0 ${x + r * 2} ${y}`);
    }
    return path(parts.join(' '), INK, 7);
};
const cobweb = () => {
    const corner = [18, 18];
    const ends = [[22, 108], [58, 98], [88, 72], [100, 22]];
    const spokes = ends.map(([x, y]) => `M${corner[0]} ${corner[1]} L${x} ${y}`).join(' ');
    const at = (t) => ends.map(([x, y]) => [corner[0] + (x - corner[0]) * t, corner[1] + (y - corner[1]) * t]);
    const thread = (t) => {
        const pts = at(t);
        const segs = pts.slice(1).map(([x, y], i) => {
            const [px, py] = pts.at(i);
            const mx = (px + x) / 2 - 6 * t;
            const my = (py + y) / 2 - 6 * t;
            return `Q${mx.toFixed(1)} ${my.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
        });
        const [sx, sy] = pts.at(0);
        return `M${sx.toFixed(1)} ${sy.toFixed(1)} ${segs.join(' ')}`;
    };
    return path(spokes, INK, 2.5) + path(`${thread(0.35)} ${thread(0.65)} ${thread(0.92)}`, INK, 2.5);
};
const tv = (x, y, w, h, screen = BG) => box(x, y, w, h, 12, INK, 10, BG) + box(x + 12, y + 12, w - 24, h - 24, 7, INK, 4, screen);

const ART = {
    'night-owl': () => {
        const reel = (cx, cy) => ring(cx, cy, 27) + dot(cx, cy - 13, 5) + dot(cx + 13, cy, 5) + dot(cx, cy + 13, 5) + dot(cx - 13, cy, 5) + dot(cx, cy, 3);
        return path('M64 62 L94 90 Q128 80 162 90 L192 62 L196 140 Q194 198 128 206 Q62 198 60 140 Z')
            + path('M88 222 l8 -10 M120 226 l4 -12 M150 224 l-2 -12', INK, 6)
            + reel(100, 136) + reel(156, 136)
            + `<path d="M119 166 H137 L128 182 Z" fill="${GOLD}" stroke="${GOLD}" stroke-width="4" stroke-linejoin="round"/>`;
    },
    'binge-mode': () => {
        const pile = [[104, 186], [120, 186], [136, 186], [152, 186], [112, 170], [128, 170], [144, 170], [120, 154], [136, 154]];
        return path('M78 50 H178 M78 206 H178')
            + path('M92 58 C92 104 122 112 122 128 C122 144 92 152 92 198', INK, 7)
            + path('M164 58 C164 104 134 112 134 128 C134 144 164 152 164 198', INK, 7)
            + path('M120 82 L136 92 L120 102 Z', INK, 5)
            + play(128, 134, 8) + pile.map(([x, y]) => play(x, y, 12)).join('');
    },
    'double-feature': () => {
        const bucket = `<path d="M-27 -18 L-19 46 H19 L27 -18 Z" fill="${BG}" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/>`
            + path('M-9 -14 L-6 42 M9 -14 L6 42', INK, 5)
            + path('M-30 -18 A10 10 0 0 1 -13 -31 A11 11 0 0 1 8 -34 A10 10 0 0 1 30 -18', INK, 9);
        return `<g transform="translate(94 146) rotate(-14)">${bucket}</g><g transform="translate(162 146) rotate(14)">${bucket}</g>`
            + path('M128 74 V56 M110 80 L98 66 M146 80 L158 66', GOLD, 8);
    },
    'auteur-theory': () => path('M56 94 V60 H90 M166 60 H200 V94 M56 162 V196 H90 M200 162 V196 H166')
        + path('M78 128 Q128 84 178 128 Q128 172 78 128 Z')
        + dot(128, 128, 17, GOLD) + dot(128, 128, 7, BG) + dot(186, 46, 6),
    'opening-week': () => {
        const beam = '#1f3150';
        const star = 'M128 34 L134 50 L151 50 L137 60 L142 77 L128 67 L114 77 L119 60 L105 50 L122 50 Z';
        return fillPath('M82 190 L134 50 L186 74 Z', beam) + fillPath('M174 190 L122 50 L70 74 Z', beam)
            + path('M82 190 L134 50 M82 190 L186 74', INK, 5) + path('M174 190 L122 50 M174 190 L70 74', INK, 5)
            + path('M60 206 H196', INK, 8)
            + `<path d="M64 206 A18 18 0 0 1 100 206 Z" fill="${BG}" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>`
            + `<path d="M156 206 A18 18 0 0 1 192 206 Z" fill="${BG}" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>`
            + `<path d="${star}" fill="${GOLD}" stroke="${GOLD}" stroke-width="4" stroke-linejoin="round"/>`;
    },
    'night-shift': () => {
        const finger = (x) => path(`M${x} 118 V138`, BG, 18) + path(`M${x} 118 V138`, INK, 9);
        return path('M88 132 A40 40 0 0 1 168 132')
            + ring(114, 110, 10, INK, 6) + ring(142, 110, 10, INK, 6)
            + dot(118, 112, 5, GOLD) + dot(146, 112, 5, GOLD)
            + box(48, 130, 160, 84, 30, INK, 10, BG)
            + `<rect x="64" y="146" width="128" height="52" rx="18" fill="none" stroke="${INK}" stroke-width="4" stroke-dasharray="1 10" stroke-linecap="round"/>`
            + finger(76) + finger(90) + finger(166) + finger(180);
    },
    again: () => {
        const loop = 'M190 112 A64 64 0 1 1 158 72';
        return path(loop, INK, 30)
            + `<path d="${loop}" fill="none" stroke="${BG}" stroke-width="6" stroke-dasharray="7 9"/>`
            + `<path d="M148 50 L190 66 L158 98 Z" fill="${INK}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`
            + label(128, 150, '3', 56);
    },
    'box-set': () => path('M104 46 L128 66 L152 46', INK, 7)
        + box(50, 66, 156, 118, 16)
        + [96, 116, 136, 156].map((x) => path(`M${x} 96 V164`, INK, 9)).join('')
        + `<path d="M82 156 L174 104" stroke="${BG}" stroke-width="20" stroke-linecap="round"/>`
        + path('M82 156 L174 104', GOLD, 10)
        + path('M100 184 L92 204 M156 184 L164 204', INK, 8),
    'fade-in': () => scallops(34, 222, 52, 16)
        + path('M30 44 H226', INK, 10)
        + fillPath('M122 62 H134 L152 212 H104 Z', GOLD)
        + `<path d="M40 60 H122 Q112 140 104 212 Q70 202 40 212 Z" fill="${BG}" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/>`
        + `<path d="M216 60 H134 Q144 140 152 212 Q186 202 216 212 Z" fill="${BG}" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/>`
        + path('M64 72 Q60 140 66 204 M90 72 Q84 140 88 206 M192 72 Q196 140 190 204 M166 72 Q172 140 168 206', INK, 4),
    'fade-out': () => box(66, 82, 124, 92, 6)
        + label(128, 136, 'The End', 28, GOLD, SERIF, 'font-style="italic"')
        + `<path d="M28 60 H66 Q60 140 56 214 Q40 208 28 214 Z" fill="${BG}" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/>`
        + `<path d="M228 60 H190 Q196 140 200 214 Q216 208 228 214 Z" fill="${BG}" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/>`
        + path('M44 72 Q42 140 44 206 M212 72 Q214 140 212 206', INK, 4)
        + path('M24 46 H232', INK, 10) + scallops(30, 226, 54, 14)
        + path('M70 196 H186', INK, 6),
    'directors-cut': () => {
        const holes = [0, 72, 144, 216, 288].map((deg) => {
            const r = (deg - 90) * Math.PI / 180;
            return ring(150 + Math.cos(r) * 74, 140 + Math.sin(r) * 74, 30, INK, 9);
        }).join('');
        return `<g clip-path="url(#tile)">${ring(150, 140, 150, INK, 12)}${ring(150, 140, 128, INK, 4)}${holes}${dot(150, 140, 20, GOLD)}${dot(150, 140, 7, BG)}</g>`;
    },
    typecast: () => {
        const person = (x, y, s, color, outline) => {
            const head = outline ? ring(x, y, 12 * s, color, 8) : dot(x, y, 12 * s, color);
            const d = `M${x - 18 * s} ${y + 18 * s} Q${x} ${y + 10 * s} ${x + 18 * s} ${y + 18 * s} L${x + 22 * s} ${y + 58 * s} H${x - 22 * s} Z`;
            const body = outline ? path(d, color, 8) : fillPath(d, color);
            return head + body;
        };
        return person(128, 50, 1.45, GOLD, true)
            + path('M98 144 V156 M128 144 V160 M158 144 V156', INK, 5)
            + person(78, 176, 0.72, INK, false) + person(128, 176, 0.72, INK, false) + person(178, 176, 0.72, INK, false)
            + path('M44 222 H212', INK, 6);
    },
    sequelitis: () => `<g transform="translate(120 132) rotate(32)">`
        + box(-18, -96, 36, 150, 18, INK, 10, BG)
        + `<rect x="-6" y="-66" width="12" height="130" rx="6" fill="${GOLD}"/>`
        + `<circle cx="0" cy="78" r="30" fill="${BG}" stroke="${INK}" stroke-width="10"/>${dot(0, 78, 18, GOLD)}`
        + path('M18 -60 H30 M18 -30 H30 M18 0 H30', INK, 5)
        + `<g fill="${INK}" font-family="${SERIF}" font-weight="700" font-size="20"><text x="38" y="-53">IV</text><text x="38" y="-23">III</text><text x="38" y="7">II</text></g>`
        + `</g>` + fillPath('M200 44 Q210 60 200 66 Q190 60 200 44 Z') + fillPath('M218 74 Q226 86 218 91 Q210 86 218 74 Z'),
    'guilty-pleasure': () => `<path d="M128 78 C178 74 204 106 204 146 C204 190 170 212 128 212 C86 212 52 190 52 146 C52 106 78 74 128 78 Z" fill="${BG}" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/>`
        + path('M128 80 L128 54 M128 80 L104 66 M128 80 L152 66 M128 80 L112 92 M128 80 L144 92', INK, 7)
        + path('M92 112 Q106 102 120 110 M136 110 Q150 102 164 112', INK, 9)
        + ring(106, 132, 16, GOLD, 7) + ring(150, 132, 16, GOLD, 7) + path('M122 130 Q128 124 134 130', GOLD, 6)
        + dot(128, 154, 12)
        + fillPath('M92 172 Q108 160 128 168 Q148 160 164 172 Q148 186 128 176 Q108 186 92 172 Z'),
    walkout: () => `<rect x="70" y="36" width="116" height="48" rx="6" fill="${GOLD}"/>`
        + label(116, 72, 'EXIT', 30, BG)
        + `<path d="M160 50 L174 60 L160 70 Z" fill="${BG}"/>`
        + path('M128 84 V100', INK, 5) + path('M108 84 V96 M148 84 V96', INK, 3)
        + box(84, 120, 22, 92, 8, INK, 10, BG)
        + `<g transform="rotate(-58 108 180)">${box(108, 172, 70, 18, 8, INK, 10, BG)}</g>`
        + path('M156 112 Q178 126 182 154', INK, 5) + path('M168 108 Q194 124 198 156', INK, 4)
        + path('M70 212 H186', INK, 8),
    'pilot-season': () => path('M72 104 Q72 56 128 54 Q184 56 184 104', INK, 10)
        + box(48, 100, 18, 44, 8, INK, 9, BG) + box(190, 100, 18, 44, 8, INK, 9, BG)
        + tv(62, 104, 132, 92)
        + path('M70 102 H186', BG, 22) + path('M66 100 H190', INK, 6)
        + `<circle cx="104" cy="96" r="20" fill="${BG}" stroke="${GOLD}" stroke-width="8"/><circle cx="152" cy="96" r="20" fill="${BG}" stroke="${GOLD}" stroke-width="8"/>`
        + path('M124 96 H132', GOLD, 6)
        + path('M98 90 L106 84 M146 90 L154 84', INK, 4)
        + path('M104 196 L96 214 M152 196 L160 214', INK, 8),
    'jumped-the-shark': () => path('M24 204 Q44 192 64 204 T104 204 T144 204 T184 204 T224 204', INK, 7)
        + fillPath('M84 202 Q100 156 128 138 Q122 170 136 202 Z')
        + `<path d="M40 206 Q90 60 170 92" fill="none" stroke="${GOLD}" stroke-width="5" stroke-dasharray="2 12" stroke-linecap="round"/>`
        + `<g transform="rotate(-14 182 96)">${tv(148, 60, 76, 58)}${path('M176 60 L166 44 M190 60 L200 44', INK, 5)}${path('M140 132 H206 Q214 132 218 124', INK, 7)}${path('M164 118 V130 M196 118 V130', INK, 5)}</g>`,
    'graveyard-slot': () => `<path d="M72 208 V112 Q72 64 128 64 Q184 64 184 112 V208 Z" fill="${BG}" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/>`
        + path('M116 66 L100 42 M140 66 L156 42', INK, 6)
        + `<rect x="94" y="108" width="68" height="52" rx="6" fill="${GOLD}"/>`
        + label(128, 142, '2AM', 20, BG)
        + path('M40 212 H216', INK, 8)
        + path('M52 212 l-4 -12 M58 212 l2 -14 M196 212 l-2 -12 M202 212 l4 -14', INK, 4)
        + fillPath('M206 36 A16 16 0 1 0 206 68 A12 12 0 0 1 206 36 Z'),
    cliffhanger: () => fillPath('M10 92 H134 L124 118 L138 146 L120 176 L132 206 L118 250 H10 Z')
        + path('M30 120 L54 112 M44 156 L78 148 M26 196 L60 190 M70 226 L96 222', BG, 5)
        + `<rect x="84" y="78" width="26" height="16" rx="3" fill="${GOLD}"/>` + path('M90 78 V68 M104 78 V68', GOLD, 5)
        + path('M110 86 Q136 86 138 100 Q144 124 168 142', INK, 6)
        + `<g transform="rotate(16 186 172)">${tv(150, 140, 76, 58)}</g>`
        + path('M170 222 l-4 8 M200 226 l2 9', INK, 4),
    'previously-on': () => box(96, 48, 64, 172, 22, INK, 10, BG)
        + dot(128, 76, 11, GOLD)
        + [0, 1, 2].map((r) => [0, 1].map((c) => `<rect x="${110 + c * 22}" y="${104 + r * 24}" width="14" height="12" rx="4" fill="${INK}"/>`).join('')).join('')
        + path('M110 186 H146', INK, 5)
        + cobweb()
        + path('M226 96 L182 150', INK, 8)
        + path('M182 150 Q164 158 156 176 M182 150 Q170 168 172 188 M182 150 Q186 170 196 182 M182 150 Q160 146 148 156', INK, 5)
        + dot(176, 206, 5) + dot(196, 214, 4) + dot(160, 220, 3),
};

const can = (text, color = GOLD) => {
    const size = text.length > 3 ? 30 : 38;
    const holes = [0, 60, 120, 180, 240, 300].map((deg) => {
        const r = deg * Math.PI / 180;
        return ring((128 + Math.cos(r) * 50).toFixed(1), (128 + Math.sin(r) * 50).toFixed(1), 9, INK, 5);
    }).join('');
    return ring(128, 128, 82) + ring(128, 128, 70, INK, 3) + holes
        + `<rect x="62" y="104" width="132" height="48" rx="6" fill="${color}"/>`
        + label(128, 128 + size * 0.36, text, size, BG);
};

function tile(art, tier, locked = false) {
    const body = locked ? art.replaceAll(GOLD, INK) : art;
    const opacity = locked ? 0.32 : 1;
    const color = TIERS[tier];
    const frame = `<rect x="9" y="9" width="238" height="238" rx="22" fill="none" stroke="${color}" stroke-width="5"/>`
        + (tier === 'legendary' ? `<rect x="19" y="19" width="218" height="218" rx="15" fill="none" stroke="${color}" stroke-width="2"/>` : '');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">`
        + `<defs><clipPath id="tile"><rect x="12" y="12" width="232" height="232" rx="20"/></clipPath></defs>`
        + `<rect width="256" height="256" rx="26" fill="${BG}"/><g opacity="${opacity}">${body}</g>${frame}</svg>\n`;
}

const SET = {
    'night-owl': 'common',
    'binge-mode': 'epic',
    'double-feature': 'uncommon',
    'auteur-theory': 'uncommon',
    'opening-week': 'rare',
    'night-shift': 'rare',
    again: 'uncommon',
    'box-set': 'rare',
    'fade-in': 'common',
    'fade-out': 'legendary',
    'directors-cut': 'rare',
    typecast: 'uncommon',
    sequelitis: 'rare',
    'guilty-pleasure': 'uncommon',
    walkout: 'common',
    'pilot-season': 'uncommon',
    'jumped-the-shark': 'rare',
    'graveyard-slot': 'uncommon',
    cliffhanger: 'rare',
    'previously-on': 'common',
};

export { ART, SET, can, BG, INK, GOLD };

function main() {
mkdirSync(OUT, { recursive: true });
for (const [id, tier] of Object.entries(SET)) {
    writeFileSync(new URL(`${id}.svg`, OUT), tile(ART[id](), tier));
}
writeFileSync(new URL('can-10.svg', OUT), tile(can('10'), 'common'));
writeFileSync(new URL('can-100.svg', OUT), tile(can('100'), 'rare'));
writeFileSync(new URL('can-1000.svg', OUT), tile(can('1000'), 'legendary'));
writeFileSync(new URL('night-shift-locked.svg', OUT), tile(ART['night-shift'](), 'rare', true));
writeFileSync(new URL('secret.svg', OUT), tile(can('?', INK), 'epic'));
console.log('ok');
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
    main();
}
