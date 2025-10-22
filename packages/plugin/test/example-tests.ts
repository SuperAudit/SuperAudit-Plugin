import assert from "node:assert/strict";
import { describe, it } from "node:test";

import path from "node:path";
import { createHardhatRuntimeEnvironment } from "hardhat/hre";
import MyPlugin from "../src/index.js";
import { createFixtureProjectHRE } from "./helpers/fixture-projects.js";

describe("MyPlugin tests", () => {
  describe("Test using a fixture project", async () => {
    it("Should define my-task", async () => {
      const hre = await createFixtureProjectHRE("base-project");

      const myTask = hre.tasks.getTask("my-task");
      assert.notEqual(
        myTask,
        undefined,
        "my-task should be defined because we loaded the plugin",
      );

      // You can use any feature of Hardhat to build your tests, for example,
      // running the task and connecting to a new edr-simulated network
      await myTask.run();

      const conn = await hre.network.connect();
      assert.equal(
        await conn.provider.request({ method: "eth_blockNumber" }),
        "0x0",
        "The simulated chain is new, so it should be empty",
      );
    });
  });

  describe("Test creating a new HRE with an inline config", async () => {
    it("Should be able to load the plugin", async () => {
      // You can also create a new HRE without a fixture project, including
      // a custom config.
      //
      // In this case we don't provide a fixture project, nor a config path, just
      // a config object.
      //
      // You can customize the config object here, including adding new plugins.
      const hre = await createHardhatRuntimeEnvironment({
        plugins: [MyPlugin],
        myConfig: {
          greeting: "Hola",
        },
      });

      assert.equal(hre.config.myConfig.greeting, "Hola");

      // The config path is undefined because we didn't provide it to
      // createHardhatRuntimeEnvironment. See its documentation for more info.
      assert.equal(hre.config.paths.config, undefined);

      // The root path is the directory containing the closest package.json to
      // the CWD, if none is provided.
      assert.equal(
        hre.config.paths.root,
        path.resolve(import.meta.dirname, ".."),
      );
    });
  });
});
