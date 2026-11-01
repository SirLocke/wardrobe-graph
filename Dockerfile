# ATELIER BIOMETRIC — Deterministic Biometric Wardrobe PWA + MCP Server
FROM node:22-alpine

WORKDIR /app

# Copy package manifests first for layer caching
COPY package*.json ./
RUN npm install

# Copy application source & build production PWA bundle
COPY . .
RUN npm run build

# Persistent directory for shared Wardrobe & Biometric JSON store (Web UI <-> MCP Server)
RUN mkdir -p /app/data
VOLUME ["/app/data"]

ENV NODE_ENV=production
ENV PORT=3000
ENV WARDROBE_DATA_FILE=/app/data/wardrobe-store.json

EXPOSE 3000

# Starts Express server serving the built PWA on :3000 and MCP HTTP endpoint on :3000/mcp
# For STDIO MCP clients: `docker exec -i atelier-biometric npx tsx mcp-server.ts`
CMD ["npx", "tsx", "server.ts"]
