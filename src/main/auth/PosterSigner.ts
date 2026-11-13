import {
    createHmac,
    randomBytes,
    timingSafeEqual,
} from 'node:crypto';
import type { Store } from '../store/index.ts';

const SECRET_NAME = 'posters.secret';

// Signs poster links for Discord. Discord has no session,
// so a link with a valid signature can read that one poster.
export class PosterSigner {

    private readonly secret: string;

    constructor(store: Store) {
        this.secret = this.secretFrom(store);
    }

    // The signature of one path segment, for example "1234".
    signatureOf(segment: string): string {
        return createHmac('sha256', this.secret)
            .update(segment)
            .digest('base64url');
    }

    isValid(segment: string, signature: string): boolean {
        const expected = Buffer.from(this.signatureOf(segment));
        const given = Buffer.from(signature);
        if (expected.length !== given.length) {
            return false;
        }
        return timingSafeEqual(expected, given);
    }

    // Made once and kept in the database, so old Discord messages keep their posters.
    private secretFrom(store: Store): string {
        const saved = store.getState(SECRET_NAME);
        if (saved) {
            return saved;
        }
        const secret = randomBytes(32).toString('base64url');
        store.setState(SECRET_NAME, secret);
        return secret;
    }

}
