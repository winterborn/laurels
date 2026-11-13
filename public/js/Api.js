// Reads the dashboard JSON from the Laurels server.
export class Api {

    async users() {
        return this.get('/api/users');
    }

    async definitions() {
        return this.get('/api/definitions');
    }

    async packs() {
        return this.get('/api/packs');
    }

    async cabinet(userId) {
        return this.get(`/api/users/${encodeURIComponent(userId)}`);
    }

    async award(achievementId, userId) {
        return this.get(`/api/award/${encodeURIComponent(achievementId)}?user=${encodeURIComponent(userId)}`);
    }

    async ceremony(range) {
        return this.get(`/api/ceremony?range=${encodeURIComponent(range)}`);
    }

    async season(userId, year) {
        const query = year ? `?year=${encodeURIComponent(year)}` : '';
        return this.get(`/api/season/${encodeURIComponent(userId)}${query}`);
    }

    async premieres(userId, since) {
        return this.get(`/api/premieres?user=${encodeURIComponent(userId)}&since=${encodeURIComponent(since)}`);
    }

    async awards() {
        return this.get('/api/awards');
    }

    async me() {
        return this.get('/api/auth/me');
    }

    async signOut() {
        return this.post('/api/auth/sign-out', {});
    }

    async status() {
        return this.get('/api/status');
    }

    async settings() {
        return this.get('/api/settings');
    }

    // Returns { ok, body } instead of throwing, for forms.
    async post(path, body) {
        const response = await fetch(path, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        return {
            ok: response.ok,
            body: await response.json(),
        };
    }

    async getResult(path) {
        const response = await fetch(path);
        return {
            ok: response.ok,
            body: await response.json(),
        };
    }

    artUrl(ratingKey) {
        if (!ratingKey) {
            return '';
        }
        return `/api/art/${encodeURIComponent(ratingKey)}`;
    }

    posterUrl(ratingKey) {
        if (!ratingKey) {
            return '';
        }
        return `/api/poster/${encodeURIComponent(ratingKey)}`;
    }

    async get(path) {
        const response = await fetch(path);
        if (!response.ok) {
            const error = new Error(`${path} returned ${response.status}`);
            error.status = response.status;
            throw error;
        }
        return response.json();
    }

}
