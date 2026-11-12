import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    isPrivateAddress,
    parseCookies,
} from '../../main/helpers/index.ts';

describe('isPrivateAddress', () => {

    it('accepts home-network and loopback addresses', () => {
        const addresses = ['192.168.1.20', '10.0.0.5', '172.20.1.1', '127.0.0.1', '::1', '::ffff:192.168.1.20', 'fd00::1'];
        for (const address of addresses) {
            assert.equal(isPrivateAddress(address), true, address);
        }
    });

    it('refuses public addresses', () => {
        const addresses = ['8.8.8.8', '172.32.0.1', '2001:4860::8888', '', undefined];
        for (const address of addresses) {
            assert.equal(isPrivateAddress(address), false, String(address));
        }
    });

});

describe('parseCookies', () => {

    it('reads name and value pairs', () => {
        const cookies = parseCookies('a=1; laurels_session=abc%3D; b=');
        assert.equal(cookies.get('laurels_session'), 'abc=');
        assert.equal(cookies.get('b'), '');
    });

});
