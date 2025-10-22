# `hardhat-my-plugin`

This is an example plugin that adds a task that prints a greeting.

## Installation

To install this plugin, run the following command:

```bash
npm install --save-dev hardhat-my-plugin
```

In your `hardhat.config.ts` file, import the plugin and add it to the `plugins` array:

```ts
import myPlugin from "hardhat-my-plugin";

export default {
  plugins: [myPlugin],
};
```

## Usage

The plugin adds a new task called `my-task`. To run it, use the this command:

```bash
npx hardhat my-task
```

You should see the following output:

```
Hello, Hardhat!
```

### Configuration

You can configure the greeting that's printed by using the `myConfig` field in your Hardhat config. For example, you can have this config:

```ts
import myPlugin from "hardhat-my-plugin";

export default {
  plugins: [myPlugin],
  myConfig: {
    greeting: "Hola",
  },
  //...
};
```

### Network logs

This plugin also adds some example code to log different network events. To see it in action, all you need to do is run your Hardhat tests, deployment, or a script.
