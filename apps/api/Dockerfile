FROM node:20-alpine
RUN apk add --no-cache openssl
RUN npm install -g pnpm
WORKDIR /app
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/database/prisma ./packages/database/prisma
RUN pnpm install --no-frozen-lockfile
COPY apps/api ./apps/api
COPY packages/database ./packages/database
RUN cd packages/database && npx prisma generate
RUN pnpm --filter @geacfo/api build
EXPOSE 3001
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
