# Build stage: `vite build` needs devDependencies (Vite itself, Tailwind).
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Baked into the bundle at build time -- Vite inlines import.meta.env.VITE_*
# values during `vite build`, so this must be a build ARG, not a runtime env
# var (a static SPA has no server-side process to read it from later).
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# Runtime stage: static files served by nginx, no Node at all.
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
