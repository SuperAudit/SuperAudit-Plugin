import { task } from "hardhat/config";
import type { HardhatPlugin } from "hardhat/types/plugins";

import "./type-extensions.js";

const plugin: HardhatPlugin = {
  id: "hardhat-superaudit",
  hookHandlers: {
    config: () => import("./hooks/config.js"),
    network: () => import("./hooks/network.js"),
  },
  tasks: [
    task("superaudit", "Run comprehensive security analysis on Solidity contracts with CFG analysis, YAML playbooks, and multiple output formats.")
      .setAction(() => import("./tasks/analyze.js"))
      .build(),
  ],
};

export default plugin;
