import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PlexMapper } from '../../main/sources/index.ts';

const mapper = new PlexMapper();

const removedEpisode = {
    historyKey: '/status/sessions/history/901',
    type: 'episode',
    title: 'The last one',
    grandparentTitle: 'Old show',
    index: 1,
    parentIndex: 2,
    accountID: 7,
    viewedAt: 1700000000,
};

describe('PlexMapper', () => {

    it('keeps the watch of an item that left the library', () => {
        const event = mapper.event(removedEpisode);
        assert.equal(event?.ratingKey, 'gone:episode:old show:2:1');
        assert.equal(event?.showKey, 'gone:show:Old show');
        assert.equal(event?.id, 'plex:901');
    });

    it('gives the removed item its title and episode number', () => {
        const item = mapper.removed(removedEpisode, 'gone:901', 'gone:show:Old show');
        assert.equal(item.title, 'The last one');
        assert.equal(item.index, 1);
        assert.equal(item.missing, true);
        assert.equal(item.stub, false);
    });

    it('names the removed show from the history row', () => {
        const show = mapper.removedShow(removedEpisode, 'gone:show:Old show');
        assert.equal(show.kind, 'show');
        assert.equal(show.title, 'Old show');
    });

    it('gives all watches of a removed film one key from its title', () => {
        const film = {
            type: 'movie',
            title: 'Old Film',
            year: 1999,
            accountID: 7,
        };
        const first = mapper.event({
            ...film,
            historyKey: '/status/sessions/history/11',
            viewedAt: 1700000000,
        });
        const second = mapper.event({
            ...film,
            historyKey: '/status/sessions/history/12',
            viewedAt: 1800000000,
        });
        assert.equal(first?.ratingKey, 'gone:movie:old film:1999');
        assert.equal(second?.ratingKey, first?.ratingKey);
        assert.notEqual(second?.id, first?.id);
    });

    it('uses the history id when a removed episode has no show or number', () => {
        const row = {
            ...removedEpisode,
            index: undefined,
        };
        assert.equal(mapper.event(row)?.ratingKey, 'gone:901');
    });

    it('skips a row with no key, no title and no history id', () => {
        const row = {
            ...removedEpisode,
            grandparentTitle: undefined,
            historyKey: undefined,
        };
        assert.equal(mapper.event(row), null);
    });

    it('uses the Plex key when the item is still in the library', () => {
        const row = {
            ...removedEpisode,
            ratingKey: '55',
            grandparentKey: '/library/metadata/50',
        };
        const event = mapper.event(row);
        assert.equal(event?.ratingKey, '55');
        assert.equal(event?.showKey, '50');
    });

});
