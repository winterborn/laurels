FROM node:24-alpine

LABEL org.opencontainers.image.title="Laurels" \
      org.opencontainers.image.description="Festival-style trophies for what your household watches on Plex."

RUN apk add --no-cache su-exec

WORKDIR /app
COPY package.json ./
COPY achievements ./achievements
COPY public ./public
COPY src/main ./src/main
COPY docker/entrypoint.sh /usr/local/bin/laurels-entrypoint

ENV NODE_ENV=production \
    DATA_DIR=/config \
    PORT=8484 \
    PUID=1000 \
    PGID=1000

VOLUME /config
EXPOSE 8484

HEALTHCHECK --interval=60s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8484) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["laurels-entrypoint"]
CMD ["node", "--disable-warning=ExperimentalWarning", "src/main/main.ts"]
