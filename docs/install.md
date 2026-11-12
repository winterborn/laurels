# Install Laurels

Laurels runs in one container next to Plex.
It reads the Plex watch history, so it needs the Plex account that owns the server.

## Before you start

- Find the `PUID`, `PGID` and `TZ` values of your other containers.
  Laurels uses the same values.
- Find out how Plex runs: as a container, or as an app on a computer.
  The table in [Plex address](#plex-address) uses this.

## 1. Add Laurels to Docker Compose

You can use the [docker-compose.yml](../docker-compose.yml) in this folder.
You can also add this service to the compose file that has Plex and your other apps:

```yaml
  laurels:
    image: ghcr.io/winterborn/laurels:latest
    container_name: laurels
    restart: unless-stopped
    ports:
      - "8484:8484"
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Europe/London
    volumes:
      - ./laurels/config:/config
```

To build the image yourself, put this repository in `./laurels`.
Then replace the `image` line with `build: ./laurels`.

## 2. Start the container

```bash
docker compose pull laurels
docker compose up -d laurels
```

To update Laurels later, run the same two commands.

## 3. Set up Laurels

Do these steps immediately after you start the container.
The first Plex account that signs in becomes the Laurels owner.

1. Open `http://<server>:8484`. The **Set up Laurels** page opens.
2. Click **Sign in with Plex**. Sign in with the account that owns the Plex server.
3. Select your server in the list, or type its address.
4. Click **Test connection**.
5. Click **Save settings**.

The first sync reads all of your Plex history.
Laurels then dates each award to the watch that won it.
Laurels does not send these old awards to Discord.

## Plex address

| How Plex runs | Address to use |
|---|---|
| A container in the same compose file | `http://plex:32400` (the service name) |
| A container with `network_mode: host` | `http://<server LAN IP>:32400` |
| An app on the same computer as Docker | `http://<server LAN IP>:32400` |
| An app on a different computer | `http://<that computer's IP>:32400` |

Inside a container, `localhost` is that container, not Plex.
Do not use `localhost` as the Plex address.

If Plex is in a different compose project, connect both containers to one network:

```yaml
    networks:
      - media

networks:
  media:
    external: true
```

After you sign in, Laurels shows the addresses that Plex reports.
Use a local address if you can. A relay address is slow.

## Who can see what

| Person | Can |
|---|---|
| The owner of the Plex server | See all awards and change the settings |
| A person who has access to the Plex server | See all awards. Each person signs in with their own Plex account. |
| Any other Plex account | Nothing. Laurels does not let this account sign in. |
| A person on your home network, when guest view is on | See all awards without a sign-in |

A sign-in stays valid for 30 days. **Sign out** is at the top right of the page.

## Settings

You can change all settings on the **Settings** page.
Laurels keeps them in `/config/settings.json`.

You can also set a value with an environment variable.
The environment variable has priority, and the Settings page locks that field.

| Setting | Variable | Default |
|---|---|---|
| Plex address | `PLEX_URL` | none |
| Plex token | `PLEX_TOKEN` | none (use **Sign in with Plex**) |
| Time between checks of Plex (minutes) | `POLL_MINUTES` | `5` |
| Time zone | `TZ` | the time zone of the container |
| Discord webhook | `DISCORD_WEBHOOK_URL` | none |
| Public address of Laurels, for posters in Discord | `PUBLIC_URL` | none |
| Days before the first sync to include in Discord | `NOTIFY_BACKFILL_DAYS` | `0` |
| Names to show | `USER_ALIASES` | none. Example: `1:Mum,2:Dad` |
| People to show | `ALLOWED_USERS` | everyone who watched something |
| Sign-in: `plex` or `off` | `AUTH` | `plex` |
| Guest view on the home network | `LAN_GUESTS` | `false` |

Container variables:

| Variable | Default | Use |
|---|---|---|
| `PUID`, `PGID` | `1000` | The user and group that own the files in `/config` |
| `PORT` | `8484` | The port inside the container |
| `DATA_DIR` | `/config` | The folder for settings and the database |

## Security

- Laurels uses Plex to sign people in. Laurels does not see Plex passwords.
- The session cookie is HttpOnly and SameSite=Lax.
  It is also Secure when a proxy sends `X-Forwarded-Proto: https`.
- `settings.json` contains the Plex token. Only its owner can read the file (mode 0600).
  Laurels does not send the token to the browser.
- Do not forward port 8484 on your router.
  For access from outside your home, use a reverse proxy with HTTPS.
- Laurels needs its own subdomain, for example `laurels.example.com`.
  A path such as `example.com/laurels` does not work.
- Guest view uses the IP address of the visitor.
  Keep guest view off if port 8484 is open to the internet.
  A visit through a proxy always needs a sign-in.
- `AUTH=off` removes the sign-in.
  Use it only behind a proxy that has its own sign-in, for example Authelia, Authentik or Cloudflare Access.

## Update

```bash
docker compose build laurels
```

```bash
docker compose up -d laurels
```

The update keeps your settings and awards, because they are in `/config`.

## Back up

Stop the container, then copy the `config` folder.
It has `settings.json` and the database `trophies.db`.

## Problems

| Message or problem | What to do |
|---|---|
| "Plex refused the token (401)" | Sign in with Plex again. Use the account that owns the server. |
| "Cannot reach Plex at …" | Check the address with the table in [Plex address](#plex-address). |
| "… has no access to this Plex server" | Share the Plex server with that account, or sign in with the owner account. |
| Only your own watches show | Sign in with the owner account, not a shared account. |
| The times are one hour wrong | Set `TZ` to your time zone. |
| Discord shows no posters | Set the public address. Discord must be able to reach it from the internet. |
| The wrong account is the owner | Stop the container. Remove `ownerId` from `/config/settings.json`. Start the container. Sign in with the owner account. |
