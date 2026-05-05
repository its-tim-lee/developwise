![Envy hero image](https://raw.githubusercontent.com/its-tim-lee/developwise/main/packages/envy/assets/images/logo.png)

# Envy

Vite-based tooling for environment variable cascade loading, schema validation, type generation, and `process.env` injection.

## Motivation

Vite mode is useful, but using it as the application environment creates a fragile mental model. A project still has `NODE_ENV` for JavaScript tooling behavior, Vite mode for Vite's own env loading, and a real deployment target such as development, staging, or production.

That relationship is hard to keep in your head, so editing scripts and config becomes riskier than it should be. It also splits env access between `import.meta.env` in bundled runtime code and `process.env` in build/config code, which only creates another cognitive load.

Vite mode also does not give the project a schema-validated env contract. It can load values, but it cannot prove before an important command like build or release command that required variables exist, unknown variables are rejected, and TypeScript knows the resolved key set.

There're also some other issues that making the environment variable handling implicit, confusing, complicated, careless, and error-prone.

It shouldn't be.

## Documentation

> Notice: Envy is designed for Vite and TypeScript projects.

- [Setup](https://github.com/its-tim-lee/developwise/blob/main/packages/envy/docs/setup.md): how to add Envy to a project for the first time

- [Concepts](https://github.com/its-tim-lee/developwise/blob/main/packages/envy/docs/concepts.md): why Envy does not use Vite mode as the application environment, how `APP_ENV` works, and how validation/type generation fit together.

## Support

Like this project? **Leave a star**! ⭐⭐⭐⭐⭐

If it helps you, consider buying me a coffee:

<a href="https://buymeacoffee.com/timlee" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50"></a>

Or recognized my open-source contributions: [Nominate me](https://stars.github.com/nominate) as GitHub Star! 💫

## Social

[![Threads](https://img.shields.io/badge/Threads-Follow-000000?style=for-the-badge&logo=threads&logoColor=white)](https://www.threads.com/@hereistimlee)
[![My GitHub](https://img.shields.io/badge/My_GitHub-Follow-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/its-tim-lee)
