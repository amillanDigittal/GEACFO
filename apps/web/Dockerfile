FROM node:20-alpine
RUN apk add --no-cache openssl
RUN npm install -g pnpm
WORKDIR /app
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/database/package.json ./packages/database/
COPY packages/database/prisma ./packages/database/prisma
RUN pnpm install --no-frozen-lockfile
COPY apps/web ./apps/web
COPY packages/database ./packages/database
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL=http://51.210.8.120:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV API_INTERNAL_URL=http://api:3001
RUN cd packages/database && npx prisma generate
RUN pnpm --filter @geacfo/web build
RUN cp -r /app/apps/web/.next/static /app/apps/web/.next/standalone/apps/web/.next/static && \
    cp -r /app/apps/web/public /app/apps/web/.next/standalone/apps/web/public 2>/dev/null || true && \
    mkdir -p /app/apps/web/.next/standalone/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client && \
    cp /app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/libquery_engine-linux-musl-openssl-3.0.x.so.node \
    /app/apps/web/.next/standalone/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/
EXPOSE 3000
WORKDIR /app/apps/web
CMD ["node", ".next/standalone/apps/web/server.js"]
