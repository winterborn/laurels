import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { householdShare } from '../../main/helpers/index.ts';

describe('householdShare', () => {

    it('hides the share below 5 people', () => {
        assert.equal(householdShare(2, 4), null);
    });

    it('gives the share from 5 people', () => {
        assert.equal(householdShare(2, 5), 0.4);
    });

});
