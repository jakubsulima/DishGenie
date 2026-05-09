#!/bin/sh
set -e

# Default to a non-privileged port for non-root Nginx runtime
PORT="${PORT:-8080}"

SITE_ORIGIN="${PUBLIC_SITE_URL:-}"
if [ -z "$SITE_ORIGIN" ]; then
	if [ -n "$APP_DOMAIN" ]; then
		SITE_ORIGIN="https://$APP_DOMAIN"
	else
		SITE_ORIGIN="http://localhost:$PORT"
	fi
fi

echo "--> PORT is $PORT"
echo "--> Generating Nginx configuration..."

cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.__RECIPE_AI_RUNTIME_CONFIG__ = {
	googleClientId: "${GOOGLE_OAUTH_CLIENT_ID:-}",
};
EOF

cat > /usr/share/nginx/html/robots.txt <<EOF
User-agent: *
Allow: /
Disallow: /admin
Disallow: /login
Disallow: /register
Disallow: /My%20Profile
Disallow: /My%20Preferences
Disallow: /ShoppingList
Sitemap: ${SITE_ORIGIN}/sitemap.xml
EOF

cat > /usr/share/nginx/html/sitemap.xml <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
	<url>
		<loc>${SITE_ORIGIN}/</loc>
	</url>
	<url>
		<loc>${SITE_ORIGIN}/Recipes</loc>
	</url>
</urlset>
EOF

# Substitute environment variables
envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

echo "--> Starting Nginx..."
# Start Nginx
exec nginx -g 'daemon off;'
