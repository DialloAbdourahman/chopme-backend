# Dependencies stage: install and compile everything, cached unless package*.json changes
FROM node:20-alpine AS deps

WORKDIR /app

# Install build tools for native packages (e.g. bcrypt)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

# Build stage: cached node_modules, only rebuilds when source changes
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production stage: keep only production dependencies, cached unless package*.json changes
FROM node:20-alpine

WORKDIR /app

COPY --from=deps /app/package*.json ./
COPY --from=deps /app/node_modules ./node_modules
RUN npm prune --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]
