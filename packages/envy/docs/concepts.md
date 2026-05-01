# Concepts

## One App Environment, No Mode Guessing

The painful part of Vite mode is needing to remember:

- when it matters
- when `NODE_ENV` matters
- which one your script is setting
- which one your app logic is actually depending on
- when to use `import.meta.env` vs. `process.env`
- ...

That mental split gets worse as a project grows. A dev command, staging build, production build, package command, and release command may all need environment-specific values. If those commands rely on different ideas of "mode", every script edit becomes a small correctness risk.

Envy removes that decision from the workflow: forget about `NODE_ENV` & Vite mode , just use `APP_ENV`

In the old days, we may utilize `NODE_ENV` a lots, but now many modern tools use it internally.
If you don't fully understand how the relevant internal logic work, you better don't touch it at all.
And that's why we have a dumb `APP_ENV`.

Envy is also explicit. Env values are not loaded into a runtime just because a variable has a special prefix (ie., in Vite, that's `VITE_*`) or because a bundler command happened to run in a mode. The project decides which runtime should receive the resolved values. Build-like code and bundled app code are separate targets, and each one must be wired deliberately.

That makes the env surface easier to inspect. If a runtime can read a value, there should be a visible reason in project config.

Meanwhile, Envy is strict on purpose. Selecting an app environment is not enough; the resolved values still have to satisfy the project's contract. That contract lets the project fail before important commands continue with missing, misspelled, unknown, or invalid env values.

So the idea is:

- **Simplification:** one app environment selector ⎯ when using Envy in the Vite project, you may ignore `NODE_ENV` and Vite mode, and simply embrace a single `APP_ENV`
- **Explicit:** load values only into the runtimes that should receive them.
- **Strict:** validate resolved values before relying on them.

That is why Envy treats Vite mode as unnecessary for application environment handling. Vite can keep its own mode system; Envy gives the app a simpler one.

## The design of `env.d.ts`

From the comment of the generated `env.d.ts`, you may ask: "Why not generate a different `env.d.ts` for each selected `APP_ENV`?"

Per-environment type generation makes local development unstable: checking production would rewrite the type file to production-only while the developer may still be editing development runtime code.

The stable union model avoids that churn.
