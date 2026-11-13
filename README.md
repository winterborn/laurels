# Laurels

**An achievement system for Plex.**

Laurels reads your Plex watch history and gives awards for the films and episodes that your household watches.
Each award shows the poster of the film or show that won it.
There are five tiers, from Official selection to Lifetime achievement.
Each award is in one of three categories: Film, Television or Screen (films and episodes together).

The pages:

- **Awards**: one person's newest award, a Film shelf, a Television shelf and the awards nearest to a win.
- **Ballot**: every award on one ballot, with a mark for each win.
- **Ceremony**: the household ranked by points.
- **Press room**: new awards, week by week.
- **Season review**: one person's year in films and episodes.

Laurels works with Plex Media Server. Laurels is not made or endorsed by Plex, Inc.

## What you need

- A Plex Media Server, and the Plex account that owns it.
- Docker with Docker Compose, or Node.js 24.

## Install with Docker Compose

1. Put this folder on the machine that runs Docker.
2. In this folder, run:

   ```bash
   docker compose up -d
   ```

3. On the machine that runs Docker, open `http://localhost:8484`.
   The compose file allows only this machine. See [Security](docs/install.md#security) to open it to other devices.
4. Click **Sign in with Plex**. Use the account that owns the Plex server.
5. Select your server. Click **Test connection**, then **Save settings**.

The first sync reads all of your Plex history.
By default, only watches from setup win awards, so everyone starts with no awards.
To give awards for past watches too, open **Settings**, go to **Watches that win awards**, and select **All watches**.
Laurels then dates each award to the watch that won it.

Awards follow the rules.
If the rules no longer give an award, Laurels removes it.
For example, Laurels removes the awards for past watches when you change back to **From setup**.

The full guide is [docs/install.md](docs/install.md).
It tells you how to connect Laurels to Plex when Plex also runs in Docker.

Optional:

- Connect Tautulli for real start times and the real time on screen.
- Add your own awards in `/config/awards.json`. See [docs/awards.md](docs/awards.md).
- Add award packs, groups of new awards like DLC, in `/config/packs`. See [Award packs](docs/awards.md#award-packs).

## Run without Docker

Use Node.js 24.

```bash
npm start
```

Open `http://localhost:8484` and do steps 4 and 5 above.
Laurels keeps its settings in `data/settings.json`.

## Try the demo

The demo does not use your Plex server.
It starts a mock Plex server with six example people. Frankie watches only films. Tess watches only episodes.

```bash
npm run demo
```

Open `http://localhost:8484`. Click **Sign in with Plex**.
On the mock sign-in page, select Alex (the owner) or Sam (a shared user).

To see a new award, open **Settings** and click **Add a winning watch** in the Demo panel.
The "Just announced" popup opens on the page you are on.

## For developers

```bash
npm test
```

- [docs/api.md](docs/api.md): the routes of the Laurels API.
- [docs/awards.md](docs/awards.md): how to add your own awards.
