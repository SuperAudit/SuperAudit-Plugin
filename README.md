# Hardhat 3 plugin template

This repository is a template for creating a Hardhat 3 plugin.

## Getting started

> This repository is structured as a pnpm monorepo, so make sure you have [`pnpm`](https://pnpm.io/) installed first

To get started, clone the repository and run:

```sh
pnpm install
pnpm build
```

This will install all the dependencies and build the plugin.

You can now run the tests of the plugin with:

```sh
pnpm test
```

And try the plugin out in `packages/example-project` with:

```sh
cd packages/example-project
pnpm hardhat my-task
```

which should print `Hola, Hardhat!`.

## Understanding the repository structure

### Monorepo structure

This repository is structured as a pnpm monorepo with the following packages:

- `packages/plugin`: The plugin itself.
- `packages/example-project`: An example Hardhat 3 project that uses the plugin.

All the development will happen in the `packages/plugin` directory, while `packages/example-project` is a playground to experiment with your plugin, and manually test it.

### Plugin template structure

The `packages/plugin` directory has a complete plugin example. It includes:

- A `README.md` file that documents the plugin.
- A `src/index.ts` file that defines and exports the plugin.
- An example task, which is defined in `src/index.ts`, and whose action is in `src/tasks/my-task.ts`.
- An example of how to extend the Hardhat config, which includes:
  - The logic to extend the validation and resolution of the Hardhat config, in `src/config.ts`.
  - The config Hook Handlers to inject that logic into Hardhat, in `src/hooks/config.ts`.
  - The Type Extensions to add your config to `HardhatUserConfig` and `HardhatConfig`, in `src/type-extensions.ts`.
- A network Hook Handler, which is in `src/hooks/network.ts`, which shows how to define them, and prints a few debug messages.
- An example of how to test the config of your plugin, in `test/config.ts`.
- An example of two different ways to test your plugin functionality, in `test/example-tests.ts`:
  - Using a file-system based fixture project.
  - Creating a new Hardhat Runtime Environment with an inline config.

### Github Actions setup

This repository is setup with a Github Actions workflow. You don't need to do anything to set it up, it runs on every push to `main`, on pull requests, and when manually triggered.

The workflow is equivalent to running this steps in the root of the repository:

```sh
pnpm install
pnpm build
pnpm test
pnpm lint
```

It runs using Node.js versions 22 and 24, on an `ubuntu-latest` runner.

## Development setup

- This repository includes a setup of typescript and eslint, based on the official recommendation of each project, and a a few custom rules that help building Hardhat plugins.
- It also includes `prettier` to format the code, with its default configuration.
- There are npm scripts in the root that should be enough to build, lint, test, etc.
  - Running `pnpm watch` can be helpful when using the example project. If you keep a terminal running it, things will normally be rebuilt by the time you try them out in `packages/example-project`.
