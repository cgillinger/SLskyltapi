# ═══════════════════════════════════════════════════════════
# DOCKERFILE - SL Avgångstavla
# ═══════════════════════════════════════════════════════════

# Använd officiell Node.js 18 Alpine image (liten och säker)
FROM node:18-alpine

# Metadata
LABEL maintainer="christian"
LABEL description="SL Avgångstavla med real-time avgångar"
LABEL version="1.0.0"

# Sätt arbetskatalog i containern
WORKDIR /app

# Kopiera package.json och package-lock.json först (bättre caching)
COPY package*.json ./

# Installera endast production dependencies
RUN npm ci --only=production

# Kopiera all applikationskod
COPY . .

# Exponera port 8200
EXPOSE 8200

# Healthcheck för att verifiera att servern är igång
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8200/api/status', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Kör applikationen som non-root user (säkerhet)
USER node

# Starta servern
CMD ["node", "api_cache.js"]
