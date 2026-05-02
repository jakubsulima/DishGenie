# Stage 1: Build the React application
FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginxinc/nginx-unprivileged:stable-alpine

USER root
RUN apk add --no-cache gettext=0.24.1-r1 && \
	chown -R 101:101 /etc/nginx/conf.d /usr/share/nginx/html

COPY --from=build --chown=101:101 /app/dist /usr/share/nginx/html

COPY --chown=101:101 nginx.conf.template /etc/nginx/templates/default.conf.template

# Copy and set up the entrypoint script
COPY --chmod=755 --chown=101:101 entrypoint.sh /entrypoint.sh

USER 101

EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]
