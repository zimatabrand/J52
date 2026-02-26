FROM node:20-slim

WORKDIR /app

# Copy root workspace config and package files
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/

# Install dependencies for shared and api workspaces
RUN npm ci --workspace=packages/api --workspace=packages/shared --include-workspace-root

# Copy source
COPY tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY packages/api/ packages/api/

# Build shared first, then api
RUN npm run build -w packages/shared && npm run build -w packages/api

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "packages/api/dist/index.js"]
