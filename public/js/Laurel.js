const CENTRE_X = 100;
const CENTRE_Y = 104;
const RADIUS = 78;
const FIRST_ANGLE = 96;
const LAST_ANGLE = 232;
const LEAF_PAIRS = 9;
const LEAF = 'M0 0 Q11 -8 24 0 Q11 8 0 0Z';
const STAR_POINTS = 5;
const STAR_INNER = 0.45;
const RAY_COUNT = 12;

// A festival laurel with a tier emblem inside. Higher tiers get a
// bigger emblem: 1, 2 and 3 stars, then a ringed star, then a ringed
// star with rays. No numbers, so the tier reads at any size.
export class Laurel {

    static branch = Laurel.drawBranch();

    static svg(colour, tier) {
        const branch = Laurel.branch.replaceAll('COLOUR', colour);
        return `<svg viewBox="0 0 200 200" aria-hidden="true">`
            + `<g>${branch}</g>`
            + `<g transform="translate(200 0) scale(-1 1)">${branch}</g>`
            + `<g fill="${colour}" stroke="${colour}">${Laurel.emblem(tier)}</g>`
            + `</svg>`;
    }

    // label: for example "Winner, Rare, 50 points".
    static html(colour, tier, size, label) {
        return `<span class="laurel ${size}" role="img" aria-label="${label}" title="${label}">`
            + Laurel.svg(colour, tier)
            + `</span>`;
    }

    static emblem(tier) {
        switch (tier) {
            case 'Common':
                return Laurel.star(100, 100, 24);
            case 'Uncommon':
                return Laurel.star(78, 102, 19) + Laurel.star(122, 102, 19);
            case 'Rare':
                return Laurel.star(100, 80, 18) + Laurel.star(70, 114, 16) + Laurel.star(130, 114, 16);
            case 'Epic':
                return Laurel.ring() + Laurel.star(100, 102, 25);
            case 'Legendary':
                return Laurel.rays() + Laurel.ring() + Laurel.star(100, 102, 25);
            default:
                return '';
        }
    }

    static star(centreX, centreY, radius) {
        const corners = Array.from({ length: STAR_POINTS * 2 }, (_, index) => {
            const isOuter = index % 2 === 0;
            const reach = isOuter ? radius : radius * STAR_INNER;
            const angle = -90 + index * (180 / STAR_POINTS);
            const radians = angle * Math.PI / 180;
            const x = centreX + reach * Math.cos(radians);
            const y = centreY + reach * Math.sin(radians);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        });
        return `<polygon points="${corners.join(' ')}" stroke="none"/>`;
    }

    static ring() {
        return `<circle cx="100" cy="102" r="39" fill="none" stroke-width="6"/>`;
    }

    static rays() {
        const lines = Array.from({ length: RAY_COUNT }, (_, index) => {
            const angle = index * (360 / RAY_COUNT) * Math.PI / 180;
            const fromX = 100 + 46 * Math.cos(angle);
            const fromY = 102 + 46 * Math.sin(angle);
            const toX = 100 + 56 * Math.cos(angle);
            const toY = 102 + 56 * Math.sin(angle);
            return `<line x1="${fromX.toFixed(1)}" y1="${fromY.toFixed(1)}" `
                + `x2="${toX.toFixed(1)}" y2="${toY.toFixed(1)}" stroke-width="5" stroke-linecap="round"/>`;
        });
        return lines.join('');
    }

    static drawBranch() {
        const [startX, startY] = Laurel.pointAt(FIRST_ANGLE, RADIUS);
        const [endX, endY] = Laurel.pointAt(LAST_ANGLE, RADIUS);
        const stem = `<path d="M${startX} ${startY} A${RADIUS} ${RADIUS} 0 0 1 ${endX} ${endY}" `
            + `fill="none" stroke="COLOUR" stroke-width="2.6" stroke-linecap="round"/>`;
        const leaves = Array.from({ length: LEAF_PAIRS }, (_, index) => Laurel.leafPair(index));
        const [tipX, tipY] = Laurel.pointAt(LAST_ANGLE + 4, RADIUS);
        const tip = Laurel.leaf(tipX, tipY, LAST_ANGLE + 90, 0.9);
        return stem + leaves.join('') + tip;
    }

    static leafPair(index) {
        const share = index / (LEAF_PAIRS - 1);
        const angle = FIRST_ANGLE + 8 + (LAST_ANGLE - FIRST_ANGLE - 8) * share;
        const [x, y] = Laurel.pointAt(angle, RADIUS);
        const scale = 0.8 + 0.35 * Math.sin(Math.PI * share);
        const tangent = angle + 90;
        return Laurel.leaf(x, y, tangent - 34, scale) + Laurel.leaf(x, y, tangent + 34, scale);
    }

    static leaf(x, y, rotation, scale) {
        const move = `translate(${x} ${y}) rotate(${rotation.toFixed(1)}) scale(${scale.toFixed(2)})`;
        return `<path d="${LEAF}" fill="COLOUR" transform="${move}"/>`;
    }

    static pointAt(angle, radius) {
        const radians = angle * Math.PI / 180;
        const x = CENTRE_X + radius * Math.cos(radians);
        const y = CENTRE_Y + radius * Math.sin(radians);
        return [x.toFixed(1), y.toFixed(1)];
    }

}
