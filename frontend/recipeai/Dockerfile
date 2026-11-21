# Stage 1: Build the React application
FROM node:24-alpine AS build
WORKDIR /app
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx/nginx-unprivileged:1.30.7-alpine@sha256:0c53a1f2890c3526bfd201440f0fd3970e5b78f80630f58284aad0d34b5ec7bd

USER root
RUN apk upgrade --no-cache && \
	apk add --no-cache gettext=1.0-r0 && \
	chown -R 101:101 /etc/nginx/conf.d /usr/share/nginx/html

COPY --from=build --chown=101:101 /app/dist /usr/share/nginx/html

COPY --chown=101:101 nginx.conf.template /etc/nginx/templates/default.conf.template

# Copy and set up the entrypoint script
COPY --chmod=755 --chown=101:101 entrypoint.sh /entrypoint.sh

USER 101

EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]
