package org.jakub.backendapi.services;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.restclient.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class PostHogService {

    private static final Logger log = LoggerFactory.getLogger(PostHogService.class);

    private final RestTemplate restTemplate;
    private final boolean enabled;
    private final String projectKey;
    private final String captureUrl;

    @Autowired
    public PostHogService(
            RestTemplateBuilder restTemplateBuilder,
            @Value("${posthog.enabled:false}") boolean enabled,
            @Value("${posthog.host:https://eu.i.posthog.com}") String host,
            @Value("${posthog.project-key:}") String projectKey,
            @Value("${posthog.connect-timeout-ms:2000}") long connectTimeoutMs,
            @Value("${posthog.read-timeout-ms:5000}") long readTimeoutMs
    ) {
        this(
                restTemplateBuilder
                        .connectTimeout(Duration.ofMillis(connectTimeoutMs))
                        .readTimeout(Duration.ofMillis(readTimeoutMs))
                        .build(),
                enabled,
                host,
                projectKey
        );
    }

    PostHogService(RestTemplate restTemplate, boolean enabled, String host, String projectKey) {
        this.restTemplate = restTemplate;
        this.enabled = enabled;
        this.projectKey = projectKey;
        this.captureUrl = normalizeHost(host) + "/i/v0/e/";
    }

    @Async
    public void captureIdentifiedEvent(String distinctId, String eventName, Map<String, Object> properties) {
        if (!enabled || !StringUtils.hasText(projectKey) || !StringUtils.hasText(distinctId) || !StringUtils.hasText(eventName)) {
            return;
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("api_key", projectKey);
        payload.put("event", eventName);
        payload.put("distinct_id", distinctId);
        payload.put("timestamp", Instant.now().toString());

        Map<String, Object> safeProperties = new LinkedHashMap<>();
        safeProperties.put("captureSource", "backend");
        if (properties != null) {
            safeProperties.putAll(properties);
        }
        payload.put("properties", safeProperties);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        try {
            restTemplate.postForEntity(captureUrl, new HttpEntity<>(payload, headers), String.class);
        } catch (RestClientException exception) {
            log.warn("PostHog capture failed for event '{}': {}", eventName, exception.getMessage());
        }
    }

    private String normalizeHost(String host) {
        if (!StringUtils.hasText(host)) {
            return "https://eu.i.posthog.com";
        }

        String normalizedHost = host.trim();
        if (!normalizedHost.startsWith("http://") && !normalizedHost.startsWith("https://")) {
            normalizedHost = "https://" + normalizedHost;
        }

        return normalizedHost.replaceAll("/+$", "");
    }
}
