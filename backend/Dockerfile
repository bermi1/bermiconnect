# Bermi Connect backend — one image for API, worker and mock SMSC.
#   docker run IMAGE                      -> API (npm run start:api)
#   docker run IMAGE npm run worker       -> queue workers + SMPP bind
#   docker run IMAGE npm run migrate      -> run migrations
#   docker run IMAGE npm run mock-smsc    -> local mock SMPP server
FROM node:22-bookworm-slim

# procps provides pgrep (used by the worker healthcheck in docker-compose)
RUN apt-get update \
 && apt-get install -y --no-install-recommends procps ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000

COPY package.json package-lock.json ./
# tsx is a devDependency used at runtime by the npm scripts, so install everything.
RUN npm ci --include=dev && npm cache clean --force

COPY tsconfig.json tsconfig.build.json ./
COPY migrations ./migrations
COPY src ./src
COPY test ./test

RUN npx tsc --noEmit

USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["npm", "run", "start:api"]
