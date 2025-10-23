// SuperAudit plugin configuration extensions

import "hardhat/types/config";
declare module "hardhat/types/config" {
  export interface SuperAuditUserConfig {
    mode?: "basic" | "advanced" | "full";
    playbook?: string;
    rules?: string[];
    format?: "console" | "json" | "sarif";
    output?: string;
    ai?: {
      enabled?: boolean;
      provider?: "openai" | "anthropic" | "local";
      model?: string;
      temperature?: number;
      maxTokens?: number;
    };
  }

  export interface SuperAuditConfig {
    mode: "basic" | "advanced" | "full";
    playbook?: string;
    rules?: string[];
    format: "console" | "json" | "sarif";
    output?: string;
    ai?: {
      enabled: boolean;
      provider: "openai" | "anthropic" | "local";
      model?: string;
      temperature?: number;
      maxTokens?: number;
    };
  }

  interface HardhatUserConfig {
    superaudit?: SuperAuditUserConfig;
  }

  interface HardhatConfig {
    superaudit: SuperAuditConfig;
  }
}

import "hardhat/types/network";
declare module "hardhat/types/network" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Delete this line if you add fields to the NetworkConnection type
  interface NetworkConnection<
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- You can ignore or remove this type parameters if your plugin doesn't use them
    ChainTypeT extends ChainType | string = DefaultChainType,
  > {
    // Add your network connection properties here
  }
}
