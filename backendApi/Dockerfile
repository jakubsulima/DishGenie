# Stage 1: Build the application with Gradle
FROM eclipse-temurin:17-jdk-noble AS builder

WORKDIR /app
ENV GRADLE_USER_HOME=/home/gradle/.gradle

# Copy Gradle wrapper and build files first (for dependency caching)
COPY --chmod=755 gradlew .
COPY gradle ./gradle
COPY build.gradle .
COPY settings.gradle .

# Pre-download dependencies without triggering bootJar
RUN --mount=type=cache,target=/home/gradle/.gradle \
    ./gradlew compileJava -x test --no-daemon -Dorg.gradle.vfs.watch=false

# Copy source code
COPY src ./src

# Build the application, skipping tests
# Add memory settings + disable file watcher
ENV JAVA_TOOL_OPTIONS="-Xmx1g -XX:+UseContainerSupport"
RUN --mount=type=cache,target=/home/gradle/.gradle \
    java -version && javac -version && \
    ./gradlew bootJar --no-daemon -x test -Dorg.gradle.vfs.watch=false --stacktrace --info

# Stage 2: Create the final runtime image
FROM eclipse-temurin:17-jre-noble
WORKDIR /app
ARG PYTHON_PACKAGE_VERSION=3.12.3-0ubuntu2.1

COPY src/main/resources/offers/requirements.txt /tmp/leaflet-requirements.txt
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends python3="${PYTHON_PACKAGE_VERSION}" python3-venv="${PYTHON_PACKAGE_VERSION}" && \
    python3 -m venv /opt/leaflet && /opt/leaflet/bin/pip install --no-cache-dir -r /tmp/leaflet-requirements.txt && \
    /opt/leaflet/bin/python -c "import pdfplumber" && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd --system appgroup && useradd --system --gid appgroup --create-home appuser

# Copy the built JAR from the builder stage
COPY --from=builder --chown=appuser:appgroup /app/build/libs/*.jar app.jar

USER appuser
ENV LIDL_LEAFLET_PYTHON=/opt/leaflet/bin/python

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
