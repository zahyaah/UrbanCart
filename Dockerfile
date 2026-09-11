# Build stage: `vite build` needs devDependencies (Vite itself, Tailwind).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Baked into the bundle at build time -- Vite inlines import.meta.env.VITE_*
# values during `vite build`, so these must be build ARGs, not runtime env
# vars (a static SPA has no server-side process to read them from later).
ARG VITE_API_URL
ARG VITE_STRIPE_PUBLISHABLE_KEY
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_STRIPE_PUBLISHABLE_KEY=${VITE_STRIPE_PUBLISHABLE_KEY}
RUN npm run build

# Runtime stage: static files served by nginx, no Node at all.
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
