import { mkdirSync, writeFileSync } from 'node:fs';
import { ART, SET, can, BG, INK, GOLD } from './draw.mjs';

const OUT = new URL('./token/', import.meta.url);
const BEAM = '#1f3150';

const METALS = {
    common: { base: '#b77843', label: 'BRONZE', enamel: '#1f6f6a' },
    uncommon: { base: '#b9c2cb', label: 'SILVER', enamel: '#a3202b' },
    rare: { base: '#d6a63c', label: 'GOLD', enamel: '#a3202b' },
    epic: { base: '#d6a63c', label: 'GOLD', enamel: '#5b2a86' },
    legendary: { base: '#dfe7ec', label: 'PLATINUM', enamel: '#1d4f9a' },
};

const INFO = {
    'night-owl': ['TV', 'NIGHT OWL'],
    'binge-mode': ['TV', 'BINGE MODE'],
    'double-feature': ['FILM', 'DOUBLE FEATURE'],
    'auteur-theory': ['FILM', 'AUTEUR THEORY'],
    'opening-week': ['FILM', 'OPENING WEEK'],
    'night-shift': ['FILM', 'NIGHT SHIFT'],
    again: ['FILM', 'AGAIN'],
    'box-set': ['TV', 'BOX SET'],
    'fade-in': ['FILM', 'FADE IN'],
    'fade-out': ['FILM', 'FADE OUT'],
    'directors-cut': ['FILM', "DIRECTOR'S CUT"],
    typecast: ['FILM', 'TYPECAST'],
    sequelitis: ['FILM', 'SEQUELITIS'],
    'guilty-pleasure': ['FILM', 'GUILTY PLEASURE'],
    walkout: ['FILM', 'WALKOUT'],
    'pilot-season': ['TV', 'PILOT SEASON'],
    'jumped-the-shark': ['TV', 'JUMPED THE SHARK'],
    'graveyard-slot': ['TV', 'GRAVEYARD SLOT'],
    cliffhanger: ['TV', 'CLIFFHANGER'],
    'previously-on': ['TV', 'PREVIOUSLY ON'],
};

const PLATE_TEXT = '#010101';
const markText = (art) => art.replaceAll(`fill="${BG}" font-family`, `fill="${PLATE_TEXT}" font-family`);
const recolour = (art, map) => Object.entries(map).reduce((s, [from, to]) => s.replaceAll(from, to), art);

function defs(metal, id) {
    const light = '<feDistantLight azimuth="225" elevation="42"/>';
    return `<defs>
<linearGradient id="fold-${id}" x1="0" x2="1" spreadMethod="repeat" gradientTransform="scale(0.14 1)">
<stop offset="0" stop-color="#2a0609"/><stop offset="0.45" stop-color="#6e1520"/><stop offset="0.6" stop-color="#7c1a26"/><stop offset="1" stop-color="#2a0609"/>
</linearGradient>
<radialGradient id="vignette-${id}" cx="50%" cy="45%" r="70%">
<stop offset="0.45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.75"/>
</radialGradient>
<radialGradient id="occlusion-${id}" cx="50%" cy="50%" r="50%">
<stop offset="0.7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.35"/>
</radialGradient>
<filter id="grain-${id}" x="0" y="0" width="100%" height="100%">
<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/>
<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.18 0"/>
</filter>
<filter id="relief-${id}" x="0" y="0" width="256" height="256" filterUnits="userSpaceOnUse">
<feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="h"/>
<feGaussianBlur in="h" stdDeviation="1.3" result="hb"/>
<feDiffuseLighting in="hb" surfaceScale="7" diffuseConstant="1.15" lighting-color="#ffffff" result="diff">${light}</feDiffuseLighting>
<feSpecularLighting in="hb" surfaceScale="7" specularConstant="0.85" specularExponent="24" lighting-color="#fff4d6" result="spec">${light}</feSpecularLighting>
<feFlood flood-color="${metal.base}" result="metal"/>
<feBlend in="metal" in2="diff" mode="multiply" result="lit"/>
<feComposite in="lit" in2="spec" operator="arithmetic" k1="0" k2="1" k3="0.9" k4="0" result="shiny"/>
<feComponentTransfer in="SourceGraphic" result="finish"><feFuncR type="linear" slope="0.55" intercept="0.5"/><feFuncG type="linear" slope="0.55" intercept="0.5"/><feFuncB type="linear" slope="0.55" intercept="0.5"/></feComponentTransfer>
<feBlend in="shiny" in2="finish" mode="multiply" result="proof"/>
<feComposite in="proof" in2="SourceAlpha" operator="in"/>
</filter>
<filter id="enamel-${id}" x="0" y="0" width="256" height="256" filterUnits="userSpaceOnUse">
<feGaussianBlur in="SourceAlpha" stdDeviation="2.2" result="b"/>
<feSpecularLighting in="b" surfaceScale="3" specularConstant="0.7" specularExponent="30" lighting-color="#ffffff" result="s">${light}</feSpecularLighting>
<feComposite in="s" in2="SourceAlpha" operator="in" result="sIn"/>
<feComposite in="SourceGraphic" in2="sIn" operator="arithmetic" k1="0" k2="1" k3="0.8" k4="0"/>
</filter>
<filter id="shadow-${id}" x="-20%" y="-20%" width="140%" height="140%">
<feGaussianBlur stdDeviation="6"/>
</filter>
<path id="rim-${id}" d="M24 128 A104 104 0 0 1 232 128"/>
<path id="rim-low-${id}" d="M33 128 A95 95 0 0 0 223 128"/>
<clipPath id="field-${id}"><circle cx="128" cy="128" r="90"/></clipPath>
</defs>`;
}

function reeding() {
    const ticks = [];
    for (let i = 0; i < 120; i += 1) {
        const a = (i * 3) * Math.PI / 180;
        const x1 = 128 + Math.cos(a) * 110;
        const y1 = 128 + Math.sin(a) * 110;
        const x2 = 128 + Math.cos(a) * 114;
        const y2 = 128 + Math.sin(a) * 114;
        ticks.push(`M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`);
    }
    return `<path d="${ticks.join(' ')}" stroke="#7a7a7a" stroke-width="1.6"/>`;
}

function rays() {
    const lines = [];
    for (let i = 0; i < 72; i += 1) {
        const a = (i * 5) * Math.PI / 180;
        const x1 = 128 + Math.cos(a) * 24;
        const y1 = 128 + Math.sin(a) * 24;
        const x2 = 128 + Math.cos(a) * 92;
        const y2 = 128 + Math.sin(a) * 92;
        lines.push(`M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`);
    }
    return `<path d="${lines.join(' ')}" stroke="#141414" stroke-width="1.4"/>`;
}

function heightmap(art, id, category, name, metal) {
    const raised = recolour(markText(art), {
        [PLATE_TEXT]: '#3a3a3a',
        [INK]: '#ffffff',
        [GOLD]: '#ffffff',
        [BG]: '#3a3a3a',
        [BEAM]: '#555555',
    });
    const words = name;
    const low = `★ ${category} · ${metal.label} ★`;
    return `<g filter="url(#relief-${id})">
<circle cx="128" cy="128" r="115" fill="#d8d8d8"/>
${reeding()}
<circle cx="128" cy="128" r="91" fill="#3a3a3a"/>
<circle cx="128" cy="128" r="91" fill="none" stroke="#9a9a9a" stroke-width="3"/>
<g clip-path="url(#field-${id})">${rays()}</g>
<text font-family="Georgia, 'Times New Roman', serif" font-size="12.5" font-weight="700" letter-spacing="2.4" fill="#4a4a4a"><textPath href="#rim-${id}" startOffset="50%" text-anchor="middle">${words}</textPath></text>
<text font-family="Georgia, 'Times New Roman', serif" font-size="9.5" font-weight="700" letter-spacing="2" fill="#4a4a4a"><textPath href="#rim-low-${id}" startOffset="50%" text-anchor="middle">${low}</textPath></text>
<g clip-path="url(#field-${id})"><g transform="translate(128 130) scale(0.74) translate(-128 -128)">${raised}</g></g>
</g>`;
}

function enamel(art, id, metal) {
    const accent = recolour(markText(art), {
        [PLATE_TEXT]: metal.base,
        [INK]: 'none',
        [BG]: 'none',
        [BEAM]: 'none',
        [GOLD]: metal.enamel,
    });
    return `<g filter="url(#enamel-${id})" clip-path="url(#field-${id})"><g transform="translate(128 130) scale(0.74) translate(-128 -128)">${accent}</g></g>`;
}

function token(id, art, tier, locked = false) {
    const metal = METALS[tier];
    const [category, name] = INFO[id] ?? ['FILM', id.toUpperCase()];
    const coin = heightmap(art, id, category, name, metal) + enamel(art, id, metal)
        + `<circle cx="128" cy="128" r="115" fill="url(#occlusion-${id})"/>`;
    const body = locked
        ? `<g opacity="0.45" style="filter: grayscale(1)">${coin}</g>`
        : coin;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
${defs(metal, id)}
<rect width="256" height="256" rx="24" fill="url(#fold-${id})"/>
<rect width="256" height="256" rx="24" filter="url(#grain-${id})"/>
<rect width="256" height="256" rx="24" fill="url(#vignette-${id})"/>
<ellipse cx="132" cy="140" rx="112" ry="112" fill="#000" opacity="0.6" filter="url(#shadow-${id})"/>
${body}
</svg>
`;
}

const only = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const ids = only.length ? only : Object.keys(SET);
for (const id of ids) {
    writeFileSync(new URL(`${id}.svg`, OUT), token(id, ART[id](), SET[id]));
}
if (!only.length) {
    INFO['can-10'] = ['FILM', '10 FILMS'];
    INFO['can-100'] = ['FILM', '100 FILMS'];
    INFO['can-1000'] = ['FILM', '1,000 FILMS'];
    INFO['night-shift-locked'] = INFO['night-shift'];
    INFO.secret = ['SECRET', 'HIDDEN'];
    writeFileSync(new URL('can-10.svg', OUT), token('can-10', can('10'), 'common'));
    writeFileSync(new URL('can-100.svg', OUT), token('can-100', can('100'), 'rare'));
    writeFileSync(new URL('can-1000.svg', OUT), token('can-1000', can('1000'), 'legendary'));
    writeFileSync(new URL('night-shift-locked.svg', OUT), token('night-shift-locked', ART['night-shift'](), 'rare', true));
    writeFileSync(new URL('secret.svg', OUT), token('secret', can('?', INK), 'epic'));
}
console.log('ok', ids.length);
