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
    
    task("upload-playbook", "Upload a security playbook to Lighthouse/IPFS community storage.")
      .setAction(() => import("./tasks/upload-playbook.js"))
      .build(),
    
    task("download-playbook", "Download and register a playbook from Lighthouse by CID.")
      .setAction(() => import("./tasks/download-playbook.js"))
      .build(),
    
    task("list-playbooks", "List all registered security playbooks.")
      .setAction(() => import("./tasks/list-playbooks.js"))
      .build(),
    
    task("sync-playbooks", "Sync playbooks from Lighthouse community storage.")
      .setAction(() => import("./tasks/sync-playbooks.js"))
      .build(),
    
    task("lighthouse-info", "Show Lighthouse storage configuration and usage information.")
      .setAction(() => import("./tasks/lighthouse-info.js"))
      .build(),
  ],
};

export default plugin;
