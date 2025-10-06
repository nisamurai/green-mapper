FROM oven/bun:1.2.10 AS builder
ARG VITE_BETTER_AUTH_BASE_URL
ENV VITE_BETTER_AUTH_BASE_URL=$VITE_BETTER_AUTH_BASE_URL
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
WORKDIR /app
COPY bun.lock package.json ./
RUN bun install --frozen-lockfile
COPY . .
RUN bunx --bun vite build

FROM caddy:alpine
COPY --from=builder /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 80
