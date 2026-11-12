import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { Achievement } from '../../main/model/index.ts';
import { TIER_POINTS } from '../../main/helpers/index.ts';

// Film and Television must stay near even, so neither side is heavy.
const MAX_SHARE = 0.6;

const catalogue: Achievement[] = JSON.parse(
    readFileSync(new URL('../../../achievements/achievements.json', import.meta.url), 'utf8'),
);

function inSection(section: string): Achievement[] {
    return catalogue.filter((achievement) => achievement.section === section);
}

function pointsOf(list: Achievement[]): number {
    return list.reduce((sum, achievement) => sum + TIER_POINTS[achievement.tier], 0);
}

function hasTier(list: Achievement[], tier: string): boolean {
    return list.some((achievement) => achievement.tier === tier);
}

describe('Catalogue balance', () => {

    const film = inSection('film');
    const tv = inSection('tv');

    it('gives Film no more than 60% of the Film and Television awards', () => {
        const share = film.length / (film.length + tv.length);
        assert.ok(share <= MAX_SHARE, `Film has ${Math.round(share * 100)}%`);
        assert.ok(1 - share <= MAX_SHARE, `Television has ${Math.round((1 - share) * 100)}%`);
    });

    it('gives Film no more than 60% of the Film and Television points', () => {
        const filmPoints = pointsOf(film);
        const share = filmPoints / (filmPoints + pointsOf(tv));
        assert.ok(share <= MAX_SHARE, `Film has ${Math.round(share * 100)}%`);
        assert.ok(1 - share <= MAX_SHARE, `Television has ${Math.round((1 - share) * 100)}%`);
    });

    it('has an Epic and a Legendary award in Film and in Television', () => {
        for (const list of [film, tv]) {
            assert.ok(hasTier(list, 'Epic'));
            assert.ok(hasTier(list, 'Legendary'));
        }
    });

    it('gives every award a citation that starts with "For"', () => {
        const missing = catalogue
            .filter((achievement) => !achievement.flavorText?.startsWith('For'))
            .map((achievement) => achievement.id);
        assert.deepEqual(missing, []);
    });

});
