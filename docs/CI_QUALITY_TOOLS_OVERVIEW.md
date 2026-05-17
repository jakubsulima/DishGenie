# CI Quality and Security Overview

This document describes the quality and security tools used in GitHub Actions and why each one is enabled.

## Policy

- Blocking checks are required to pass before container image security scan and publish stages.
- Advisory checks run in CI but do not block merges while the codebase baseline is being improved.

## Tools

### ESLint (Frontend Linter)

- Job: `frontend-lint`
- Scope: TypeScript/React frontend code
- Why it is a solid choice:
  - Fast feedback on correctness and code quality issues
  - Prevents common React and TypeScript mistakes early
- Status: Blocking

### Knip (Frontend Unused Code)

- Job: `frontend-unused-code`
- Scope: TypeScript/React entrypoints, tests, E2E tests, and tooling config
- Why it is a solid choice:
  - Finds unused files, exports, dependencies, and dev dependencies that ESLint does not cover
  - Helps keep the frontend dependency graph small and understandable
- Status: Advisory

### jscpd (Duplicate Code)

- Job: `duplicate-code`
- Scope: TypeScript, JavaScript, TSX/JSX, and Java source files across the repo
- Why it is a solid choice:
  - Detects copy-pasted logic across frontend and backend in one pass
  - Produces an HTML report artifact that is easier to inspect than console-only output
- Status: Advisory

### PMD (Backend Unused Java Code)

- Job: `backend-unused-code`
- Scope: Java backend code in `src/main`
- Why it is a solid choice:
  - Detects unused imports, local variables, private fields, and private methods
  - Runs through Gradle, so it fits the existing Java workflow without extra services
- Status: Advisory

### Testcontainers Integration Validation

- Job: `backend-testcontainers`
- Scope: Integration tests named `*IT.java`
- Why it is a solid choice:
  - Verifies realistic integration behavior against containerized dependencies
  - Reduces local-vs-CI environment drift
- Current caveat:
  - Runs only when integration tests exist
- Status: Advisory

### Gitleaks (Secret Scanning)

- Job: `secret-scan`
- Scope: Full repository history available in workflow checkout
- Why it is a solid choice:
  - Detects accidental credentials and keys before merge/release
  - High security impact with low runtime cost
- Status: Blocking

### Hadolint (Dockerfile Linter)

- Job: `dockerfile-lint`
- Scope: Backend, frontend and database Dockerfiles
- Why it is a solid choice:
  - Catches Dockerfile anti-patterns early
  - Improves image maintainability and security posture
- Status: Blocking

### Trivy (Container Image Vulnerability Scan)

- Job: `image-security-scan`
- Scope: Built backend/frontend/db images
- Why it is a solid choice:
  - Detects OS and library vulnerabilities in final images
  - CRITICAL gate enforces minimum security standard
- Status: Blocking

## Recommended Progression

1. Keep advisory checks visible until noise is reduced.
2. Promote advisory checks to blocking when failure rate is stable and actionable.
3. Add Testcontainers-backed integration tests progressively, then make that gate blocking.

## Local Commands

- Frontend unused code: `cd frontend/recipeai && npm run unused`
- Cross-stack duplicate code: `cd frontend/recipeai && npm run duplicates`
- Backend unused Java code: `cd backendApi && ./gradlew unusedJava` using Java 17
