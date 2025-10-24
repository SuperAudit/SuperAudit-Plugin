import { task } from "hardhat/config";
import { ArgumentType } from "hardhat/types/arguments";
import type { HardhatPlugin } from "hardhat/types/plugins";

import "./type-extensions.js";

const plugin: HardhatPlugin = {
  id: "hardhat-superaudit",
  hookHandlers: {
    config: () => import("./hooks/config.js"),
    network: () => import("./hooks/network.js"),
  },
  tasks: [
    task(
      "superaudit",
      "Run comprehensive security analysis on Solidity contracts with CFG analysis, YAML playbooks, and multiple output formats.",
    )
      .addOption({
        name: "playbookCid",
        description: "Playbook CID from Lighthouse",
        type: ArgumentType.STRING,
        defaultValue: "",
      })
      .setAction(() => import("./tasks/analyze.js"))
      .build(),

    task(
      "upload-playbook",
      "Upload a security playbook to Lighthouse/IPFS community storage.",
    )
      .setAction(() => import("./tasks/upload-playbook.js"))
      .build(),

    task(
      "upload-playbook-encrypted",
      "Upload an encrypted security playbook to Lighthouse/IPFS with access control.",
    )
      .addOption({
        name: "file",
        description: "Path to playbook file",
        type: ArgumentType.STRING,
        defaultValue: "",
      })
      .addOption({
        name: "publicKey",
        description: "Public key for encryption",
        type: ArgumentType.STRING,
        defaultValue: "",
      })
      .addOption({
        name: "privateKey",
        description: "Private key for signing",
        type: ArgumentType.STRING,
        defaultValue: "",
      })
      .addOption({
        name: "paymentAmount",
        description: "Payment amount in ETH for access",
        type: ArgumentType.STRING,
        defaultValue: "0.01",
      })
      .addOption({
        name: "creatorPublicKey",
        description: "Creator's public key for payment",
        type: ArgumentType.STRING,
        defaultValue: "",
      })
      .setAction(() => import("./tasks/upload-playbook-encrypted.js"))
      .build(),

    task(
      "download-playbook",
      "Download and register a playbook from Lighthouse by CID.",
    )
      .setAction(() => import("./tasks/download-playbook.js"))
      .build(),

    task("list-playbooks", "List all registered security playbooks.")
      .setAction(() => import("./tasks/list-playbooks.js"))
      .build(),

    task("sync-playbooks", "Sync playbooks from Lighthouse community storage.")
      .setAction(() => import("./tasks/sync-playbooks.js"))
      .build(),

    task(
      "lighthouse-info",
      "Show Lighthouse storage configuration and usage information.",
    )
      .setAction(() => import("./tasks/lighthouse-info.js"))
      .build(),
  ],
};

export default plugin;
