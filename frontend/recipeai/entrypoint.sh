#!/bin/sh
set -e

# Default to a non-privileged port for non-root Nginx runtime
PORT="${PORT:-8080}"

echo "--> PORT is $PORT"
echo "--> Generating Nginx configuration..."

cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.__RECIPE_AI_RUNTIME_CONFIG__ = {
	googleClientId: "${GOOGLE_OAUTH_CLIENT_ID:-}",
};
EOF

# Substitute environment variables
envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

echo "--> Starting Nginx..."
# Start Nginx
exec nginx -g 'daemon off;'
