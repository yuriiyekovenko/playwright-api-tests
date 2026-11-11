# Playwright API Testing Practice

A hands-on project for practising API test automation with Playwright and TypeScript.

The tests target the [Spring PetClinic REST](https://github.com/spring-petclinic/spring-petclinic-rest)
service (a sample pet clinic backend) and currently cover the `PetType` resource.
The service runs locally in Docker, so no external system is needed.

The project demonstrates:

- a typed API client layer with two levels of methods:
  `*Raw` methods return the untouched `APIResponse` (used in negative tests),
  happy-path methods assert the expected status and return typed data
- custom Playwright fixtures
- test data factories (faker)
- positive and negative test scenarios
- environment selection via `TEST_ENV`
- GitHub Actions CI with a PetClinic service container

## Setup

Create a `.env` file (see below) and install dependencies:

```bash
npm ci
```

Required variables:

```
API_BASE_URL=http://localhost:9966
API_ADMIN_USERNAME=admin
API_ADMIN_PASSWORD=admin
```

Set `TEST_ENV=<name>` to load `.env.<name>` instead of `.env`.

## Run locally

Docker must be available: Playwright starts the PetClinic container
(or reuses one that is already running on port 9966).

```bash
npm test
```

## Other commands

```bash
npm run typecheck
npm run test:ui
npm run test:report
```
