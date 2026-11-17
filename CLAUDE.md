# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm ci` — install dependencies
- `npm test` — run all tests (`playwright test`)
- `npx playwright test tests/api/pet-types-api.spec.ts -g "Create new PetType"` — run a single file / test by title
- `npm run typecheck` — `tsc -p tsconfig.json`
- `npm run format` / `npm run format:check` — Prettier (4-space indent, see `.prettierrc`)
- `npm run test:ui` / `test:debug` / `test:report` — Playwright UI mode, debugger, HTML report

## Environment

- Config is read from `.env` (gitignored) by `config/env.ts`; `TEST_ENV=<name>` loads `.env.<name>` instead. Required: `API_BASE_URL`, `API_ADMIN_USERNAME`, `API_ADMIN_PASSWORD` (missing ones throw at startup). `playwright.config.ts` imports `env`, so every run needs them.
- System under test is [Spring PetClinic REST](https://github.com/spring-petclinic/spring-petclinic-rest) at `http://localhost:9966`, API under `/petclinic/api/...`, secured with HTTP basic auth (set globally via `httpCredentials` in `use`).
- Locally, `webServer` in `playwright.config.ts` starts the service with `docker run` (Docker required) and reuses a container already listening on 9966. In CI (`process.env.CI`) there is no `webServer`; the GitHub Actions workflow provides the PetClinic as a service container.

## Architecture

Layered, all wired through a Playwright fixture:

- `fixtures/fixtures.ts` — extends `test` with a `client` fixture (`PetClinicAPIClient`). Tests import `test`/`expect` from here, not from `@playwright/test`.
- `utils/cleanup-registry.ts` — per-test stack of undo actions. The `client` fixture creates one per test, passes it to the clients and runs it at teardown: newest first (children before parents), 2xx/404 count as success, every action is attempted, and any other failure fails the test. Tests need no manual cleanup; only ids returned to the test are deleted, so the suite is safe against long-lived environments.
- `clients/pet-clinic-api-client.ts` — facade holding one sub-client per resource (`petTypes`, `owners`, `pets`). New resources: add a `*-api-client.ts`, pass it the `CleanupRegistry`, and expose it here.
- Every `createRaw` must register the matching delete with the registry when the response is 201 (happy-path `create` goes through `createRaw`, so it is covered too).
- `clients/pet-types-api-client.ts` — two-level convention for every client method:
    - `*Raw` methods return the untouched `APIResponse` — use in negative tests and assert status/body in the test.
    - Unsuffixed methods are happy-path: assert the expected status (via `expectStatus`, with the response body in the failure message) and return typed data.
- `types/` — request/response types (`Create*` for payloads without `id`).
- `factories/` — faker-based test data builders (e.g. `PetTypeFactory.random()` uses UUID names to avoid collisions, since tests run fully parallel against one shared service).
- `tests/api/*.spec.ts` — specs; `fullyParallel` is on, so tests must create their own data and not depend on shared state.

## API Specification

- Swagger UI: http://localhost:9966/petclinic/swagger-ui/index.html
- OpenAPI JSON: http://localhost:9966/petclinic/v3/api-docs
- Use the OpenAPI specification as the primary source for discovering endpoints, request/response schemas, and documented status codes.
- Cross-check the specification against actual API behavior.
- Do not assume undocumented behavior is correct.

## Agent Guidelines

- Follow the existing framework architecture and coding conventions.
- Reuse existing clients, factories, fixtures, and utilities.
- Do not modify production application code.
- Do not weaken assertions to make failing tests pass.
- Distinguish API defects from test implementation defects.
- Do not commit, push, or create pull requests without explicit approval.
- Test design must be reviewed before implementation.

## Agent Safety and Scope

- Never guess, brute-force, or enumerate credentials.
- Only create or delete test data owned by the current test run.
  Never modify or delete seeded data.
- Do not expand the requested investigation scope without approval.

## Reporting Guidelines

- Keep progress updates and final summaries concise.
- Report outcomes, blockers, and decisions rather than narrating every action.
- Avoid repeating information already recorded in generated files.
- Final summaries should normally be no longer than 10 lines.
- Provide detailed investigation logs only when explicitly requested.
