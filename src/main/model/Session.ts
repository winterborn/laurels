// owner: the Plex server owner, can change settings.
// member: has access to this Plex server, can view.
// guest: on the home network with guest view on, can view.
export type Role = 'owner' | 'member' | 'guest';

export interface Session {
    // SHA-256 of the cookie value. The cookie value itself is not stored.
    idHash: string;
    plexUserId: string;
    name: string;
    role: Role;
    createdAt: number;
    expiresAt: number;
}
