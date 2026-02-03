# EvoAgent Dockerfile
# Multi-stage build for optimal image size

# ============================================
# Build Stage - Dependencies
# ============================================
FROM node:20-alpine AS dependencies

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install production dependencies only
RUN npm ci --only=production --ignore-scripts

# ============================================
# Build Stage - TypeScript
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy all source files
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src

# Install all dependencies including dev dependencies for build
RUN npm ci --ignore-scripts

# Build TypeScript
RUN npm run build

# ============================================
# Runtime Stage
# ============================================
FROM node:20-alpine AS runtime

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S evoagent && \
    adduser -S -u 1001 -G evoagent evoagent

# Copy production dependencies from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/package*.json ./

# Copy compiled JavaScript from builder stage
COPY --from=builder /app/dist ./dist

# Copy config files
COPY config.example.yaml ./config.yaml

# Set environment
ENV NODE_ENV=production
ENV PORT=18790

# Change ownership
RUN chown -R evoagent:evoagent /app

# Switch to non-root user
USER evoagent

# Expose ports
EXPOSE 18790

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:18790/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]