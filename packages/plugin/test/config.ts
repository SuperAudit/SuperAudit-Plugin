import { describe, it } from "node:test";

import assert from "node:assert/strict";
import { HardhatConfig, HardhatUserConfig } from "hardhat/types/config";
import { resolvePluginConfig, validatePluginConfig } from "../src/config.js";

describe("MyPlugin config", () => {
  describe("Config validation", () => {
    describe("Valid cases", () => {
      it("Should consider an empty config as valid", async () => {
        const validationErrors = await validatePluginConfig({});

        assert.equal(validationErrors.length, 0);
      });

      it("Should ignore errors in other parts of the config", async () => {
        const validationErrors = await validatePluginConfig({
          networks: {
            foo: {
              type: "http",
              url: "INVALID URL",
            },
          },
        });

        assert.equal(validationErrors.length, 0);
      });

      it("Should accept an empty myConfig object", async () => {
        const validationErrors = await validatePluginConfig({
          myConfig: {},
        });

        assert.equal(validationErrors.length, 0);
      });

      it("Should accept an non-empty greeting", async () => {
        const validationErrors = await validatePluginConfig({
          myConfig: {
            greeting: "Hola",
          },
        });

        assert.equal(validationErrors.length, 0);
      });
    });

    describe("Invalid cases", () => {
      // Many invalid cases are type-unsafe, as we have to trick TypeScript into
      // allowing something that is invalid
      it("Should reject a myConfig field with an invalid type", async () => {
        const validationErrors = await validatePluginConfig({
          // @ts-expect-error We're intentionally passing a string here
          myConfig: "INVALID",
        });

        assert.deepEqual(validationErrors, [
          {
            path: ["myConfig"],
            message: "Expected an object with an optional greeting.",
          },
        ]);
      });

      it("Should reject a myConfig field with an invalid greeting", async () => {
        const validationErrors = await validatePluginConfig({
          myConfig: {
            greeting: 123 as unknown as string,
          },
        });

        assert.deepEqual(validationErrors, [
          {
            path: ["myConfig", "greeting"],
            message: "Expected a non-empty string.",
          },
        ]);
      });

      it("Should reject a myConfig field with an empty greeting", async () => {
        const validationErrors = await validatePluginConfig({
          myConfig: {
            greeting: "",
          },
        });

        assert.deepEqual(validationErrors, [
          {
            path: ["myConfig", "greeting"],
            message: "Expected a non-empty string.",
          },
        ]);
      });
    });
  });

  describe("Config resolution", () => {
    // The config resolution is always type-unsafe, as your plugin is extending
    // the HardhatConfig type, but the partially resolved config isn't aware of
    // your plugin's extensions. You are responsible for ensuring that they are
    // defined correctly during the resolution process.
    //
    // We recommend testing using an artificial partially resolved config, as
    // we do here, but taking care that the fields that your resolution logic
    // depends on are defined and valid.

    it("Should resolve a config without a myConfig field", async () => {
      const userConfig: HardhatUserConfig = {};
      const partiallyResolvedConfig = {} as HardhatConfig;

      const resolvedConfig = await resolvePluginConfig(
        userConfig,
        partiallyResolvedConfig,
      );

      assert.deepEqual(resolvedConfig.myConfig, { greeting: "Hello" });
    });

    it("Should resolve a config with an empty myConfig field", async () => {
      const userConfig: HardhatUserConfig = { myConfig: {} };
      const partiallyResolvedConfig = {} as HardhatConfig;

      const resolvedConfig = await resolvePluginConfig(
        userConfig,
        partiallyResolvedConfig,
      );

      assert.deepEqual(resolvedConfig.myConfig, { greeting: "Hello" });
    });

    it("Should resolve a config using the provided greeting", async () => {
      const userConfig: HardhatUserConfig = { myConfig: { greeting: "Hola" } };
      const partiallyResolvedConfig = {} as HardhatConfig;

      const resolvedConfig = await resolvePluginConfig(
        userConfig,
        partiallyResolvedConfig,
      );

      assert.deepEqual(resolvedConfig.myConfig, { greeting: "Hola" });
    });
  });
});
