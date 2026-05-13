package org.jakub.backendapi.controllers;

import org.jakub.backendapi.repositories.projections.RecipeSitemapEntry;
import org.jakub.backendapi.services.RecipeService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
public class SitemapController {
    private static final DateTimeFormatter SITEMAP_DATE_FORMATTER = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private final RecipeService recipeService;
    private final String publicSiteUrl;
    private final String allowedOrigins;

    public SitemapController(
            RecipeService recipeService,
            @Value("${PUBLIC_SITE_URL:}") String publicSiteUrl,
            @Value("${allowed.origins:}") String allowedOrigins
    ) {
        this.recipeService = recipeService;
        this.publicSiteUrl = publicSiteUrl;
        this.allowedOrigins = allowedOrigins;
    }

    @GetMapping(value = "/sitemap.xml", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> getSitemap() {
        List<RecipeSitemapEntry> recipeEntries = recipeService.getPublicRecipeSitemapEntries();
        String siteOrigin = resolveSiteOrigin();
        Instant latestRecipeUpdate = recipeEntries.stream()
                .map(RecipeSitemapEntry::getUpdatedAt)
                .filter(java.util.Objects::nonNull)
                .max(Instant::compareTo)
                .orElse(Instant.now());

        Map<String, Instant> urls = new LinkedHashMap<>();
        urls.put(siteOrigin + "/", latestRecipeUpdate);
        urls.put(siteOrigin + "/Recipes", latestRecipeUpdate);

        for (RecipeSitemapEntry recipeEntry : recipeEntries) {
            if (recipeEntry.getId() == null) {
                continue;
            }
            urls.put(siteOrigin + "/Recipe/" + recipeEntry.getId(), recipeEntry.getUpdatedAt());
        }

        StringBuilder xml = new StringBuilder(4096);
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");

        for (Map.Entry<String, Instant> entry : urls.entrySet()) {
            xml.append("  <url>\n");
            xml.append("    <loc>").append(escapeXml(entry.getKey())).append("</loc>\n");
            if (entry.getValue() != null) {
                xml.append("    <lastmod>")
                        .append(formatLastModified(entry.getValue()))
                        .append("</lastmod>\n");
            }
            xml.append("  </url>\n");
        }

        xml.append("</urlset>\n");

        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-cache, no-store, must-revalidate")
                .body(xml.toString());
    }

    private String resolveSiteOrigin() {
        String configuredOrigin = firstConfiguredOrigin(publicSiteUrl);
        if (configuredOrigin == null) {
            configuredOrigin = firstConfiguredOrigin(allowedOrigins);
        }

        return configuredOrigin != null ? configuredOrigin : "http://localhost";
    }

    private String firstConfiguredOrigin(String rawOrigins) {
        if (!StringUtils.hasText(rawOrigins)) {
            return null;
        }

        String[] candidates = rawOrigins.split(",");
        for (String candidate : candidates) {
            String normalized = normalizeOrigin(candidate);
            if (normalized != null) {
                return normalized;
            }
        }

        return null;
    }

    private String normalizeOrigin(String rawOrigin) {
        if (!StringUtils.hasText(rawOrigin)) {
            return null;
        }

        String trimmed = rawOrigin.trim().replaceAll("/+$", "");
        try {
            URI uri = new URI(trimmed);
            String scheme = uri.getScheme();
            String host = uri.getHost();

            if (!StringUtils.hasText(scheme) || !StringUtils.hasText(host)) {
                return null;
            }

            if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
                return null;
            }

            int port = uri.getPort();
            boolean standardPort = ("https".equalsIgnoreCase(scheme) && port == 443)
                    || ("http".equalsIgnoreCase(scheme) && port == 80);

            if (port > 0 && !standardPort) {
                return scheme + "://" + host + ":" + port;
            }

            return scheme + "://" + host;
        } catch (URISyntaxException ignored) {
            return null;
        }
    }

    private String formatLastModified(Instant instant) {
        return SITEMAP_DATE_FORMATTER.format(instant.atOffset(ZoneOffset.UTC));
    }

    private String escapeXml(String value) {
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }
}
