# A Hardhat 3 project that uses your plugin

This is an example project that uses your plugin.

## Getting started

To run this project, you need to install the dependencies and build the plugin:

```sh
pnpm install
pnpm build
```

Then, you can run hardhat with:

```sh
pnpm hardhat my-task
```

You can also run an example script with:

```sh
pnpm hardhat run scripts/example-script.ts
```

And the project's solidity tests with:

```sh
pnpm hardhat test
```

## What's inside the project?

This is a minimal Hardhat 3 project that only has the built-in functionality of Hardhat and your plugin.

This means that you don't have `ethers,` `viem`, `mocha`, nor the Node.js test runner plugins.

Please install whichever dependency or plugin you need in here. This package won't be published, so you have complete freedom to do whatever you want.
