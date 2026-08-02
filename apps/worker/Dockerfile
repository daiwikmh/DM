# Playwright's own image: it ships Chromium plus the system libraries it needs,
# which is the whole difficulty of running a browser in a container.
FROM mcr.microsoft.com/playwright:v1.62.1-noble

WORKDIR /app
ENV NODE_ENV=production CI=true

RUN corepack enable

# Manifests first so a dependency layer survives source-only changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json packages/db/
COPY apps/worker/package.json apps/worker/

# The web app is not part of this image; installing it would pull Astro and its
# toolchain into a container that only ever runs the worker.
RUN pnpm install --frozen-lockfile --filter @prava/worker... --prod=false

COPY packages/db packages/db
COPY apps/worker apps/worker

# Railway injects PORT; the worker serves webhooks and /execute on it.
EXPOSE 8787

# tsx runs the TypeScript directly, matching how the worker runs in development.
CMD ["pnpm", "--filter", "@prava/worker", "start"]
