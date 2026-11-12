const PRIVATE_V4 = [
    /^10\./,
    /^127\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^169\.254\./,
];

const PRIVATE_V6 = [
    /^::1$/,
    /^f[cd][0-9a-f]{2}:/i,
    /^fe80:/i,
];

// True for loopback, home-network and link-local addresses.
export function isPrivateAddress(address: string | undefined): boolean {
    if (!address) {
        return false;
    }
    const plain = address.replace(/^::ffff:/i, '');
    const isV4 = PRIVATE_V4.some((pattern) => pattern.test(plain));
    const isV6 = PRIVATE_V6.some((pattern) => pattern.test(plain));
    return isV4 || isV6;
}
