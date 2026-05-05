# Setup

## Installation

Run below (replace `<package-manager>` with yours: `npm`, `pnpm`, `yarn`, or `bun`):

```bash
<package-manager> add -D @developwise/envy
```

## Initialization

Run:

```bash
npx @developwise/envy init
```

It'll creates new or updates existing files, please scan all of them very quick (ie., expect Git is used), but it leads to the following topics (note: read them in order):

### Environment Variable Spec

The supported env var files are shown below, and the order (from top to bottom) is exactly how Envy loads them into the system:

```txt
.env.default
.env
.env.${APP_ENV}.defaults
.env.${APP_ENV}
```

> Note, more on `APP_ENV` later, but it has the value of either: "development", "staging", or "production"

The overriding rule is simple: later files override earlier files.

Recommended usage:

- `.env.default`: commit-safe fallback values shared across environments
- `.env`: local shared overrides
- `.env.${APP_ENV}.defaults`: commit-safe defaults for one application environment
- `.env.${APP_ENV}`: local final overrides for one application environment

Example:

```json
{
  "scripts": {
    "build:staging:sg": "APP_ENV=staging DEPLOY_REGION=sg vite build",
    "build:staging:us": "APP_ENV=staging DEPLOY_REGION=us vite build"
  }
}
```

```dotenv
# .env.default
PROJECT_NAME=rightdown

# .env
APP_CHANNEL_LABEL=${PROJECT_NAME}-${APP_ENV}

# .env.staging
API_ORIGIN=https://${DEPLOY_REGION}.api.example.com
```

In this example:

- The script sets `APP_ENV` and an inline `DEPLOY_REGION`.
- `APP_CHANNEL_LABEL` references `PROJECT_NAME` from an earlier file and `APP_ENV` from the current script.
- `API_ORIGIN` is an Envy-managed variable derived from the inline `DEPLOY_REGION`.

Envy uses dotenv-compatible parsing and expansion under the hood. Variables can reference values from upstream.

### Validation Contract

Before Envy can validate env var values, the project needs a validation contract. The generated `env.schema.ts` file is where each supported application environment defines its allowed env keys and value constraints.

The mental model: before filling exact values into env files, define how those values should behave:

- Which variables can each environment define?
- What value constraints should each variable satisfy?

If an var is passed from the script of package.json, it should be defined in `env.schema.ts` too.

### Environment Variable Typings

Once the validation contract is defined, Envy can generate TypeScript declarations for the resolved env vars in `env.d.ts`.

#### Typings Generation

To generate them, run:

```bash
npm run generate:env-types
```

You typically do so when `env.schema.ts` changes.

For details, see [The design of `env.d.ts`](./concepts.md#the-design-of-envdts).

#### TypeScript IntelliSense

If the project has separate tsconfigs for app code, build config, tests, Electron main/preload/renderer, or tooling code, include `env.d.ts` wherever `process.env.*` should have Envy-generated IntelliSense.

Example:

```json
# tsconfig.web.json
{
  "include": ["src", "env.d.ts"],
  ...
}
```

### Application Environment

Regardless of bundler, your app is always running or being prepared for a specific environment. In Envy, that selector is `APP_ENV`.

> Recommended reading: [One App Environment, No Mode Guessing](./concepts.md#one-app-environment-no-mode-guessing)

Envy uses `APP_ENV` to choose which env files to read, which schema to validate against, and which values to load.

With that, now you can be creative; eg., in your package.json:

```json
{
  "scripts": {
    "dev": "npm run check:env:development && npm run generate:env-types && APP_ENV=development vite dev",
    "build:staging": "npm run check:env:staging && npm run generate:env-types && APP_ENV=staging vite build",
    ...
  }
}
```

This means:

- Envy validates resolved env values to catch missing, misspelled, unknown, or invalid values before important commands continue.
- Validation before important commands reduces repeated defensive env guards throughout the codebase.
- You may access `APP_ENV` in certain runtimes via the standard `process.env` when the relevant loading mechanism is configured (more on this later)

### Environment Variable Loading

#### Load into build-like runtime

Use this import at the top of build config files that need validated values in `process.env`:

```ts
// eg., vite.config.ts
import "@developwise/envy/load-env-var";
import { defineConfig } from "vite";
...
// now you can access any variable from the specific environment (ie., APP_ENV) via `process.env.*`
```

#### Load into app runtime

When bundled app code should read env values through `process.env.*`, use the Vite plugin:

```ts
// vite.config.ts
import "@developwise/envy/load-env-var";
import { defineConfig } from "vite";
import { defineEnvVarPlugin } from "@developwise/envy";

export default defineConfig({
  plugins: [defineEnvVarPlugin(), ...],
  ...
});
```

## Agent Instructions

Consider to provide below prompt for your project's agent:

```md
# Environment Variable Handling

This project uses `@developwise/envy` for env loading, validation, and typings.

See: `@developwise/envy/docs/*.md`
```

## Wrap Up

Since Envy asks for a small mental shift from Vite's default environment model, you should note the major ones:

- Forget about `NODE_ENV` and Vite mode as application-environment selectors. Use `APP_ENV` for that job.
- You decide which runtime loads env vars: build config, bundled app code, test setup, scripts, or any combination of them.
- From now on, define the contract in `env.schema.ts` first, then implement the values in the corresponding env var files.
