# Build and run the whole app (web SPA + API) on a single port.
# Works on Render, Fly.io, or any Docker host.
FROM node:22-bookworm-slim
WORKDIR /app

# OpenSSL is required by the Prisma query engine.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies first for better layer caching. Dev deps are needed:
# tsx (runtime), vite (web build), prisma (generate/migrate).
COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY server/package.json server/package.json
COPY web/package.json web/package.json
# server's postinstall runs `prisma generate`, which needs the schema present.
COPY server/prisma server/prisma
RUN npm ci

# App source + build the web bundle the server will serve.
COPY . .
RUN npm --workspace web run build

ENV NODE_ENV=production
ENV SERVE_WEB=true
ENV PORT=4000
EXPOSE 4000

# Migrate, seed-if-empty, then start. (Host platforms inject PORT/DATABASE_URL.)
CMD ["sh", "docker-entrypoint.sh"]
