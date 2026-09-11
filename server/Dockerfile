# Build stage: compiles TS -> dist/, has access to devDependencies (tsc,
# drizzle-kit) that the runtime image doesn't need.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage: production deps only, no source/TS toolchain, non-root.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle

RUN addgroup -S urbancart && adduser -S urbancart -G urbancart
USER urbancart

EXPOSE 3001
CMD ["node", "dist/server.js"]
