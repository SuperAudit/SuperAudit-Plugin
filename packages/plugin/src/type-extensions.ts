// SuperAudit plugin configuration extensions
// For now, we don't add any custom config options, but this is where they would go

import "hardhat/types/config";
declare module "hardhat/types/config" {
  interface HardhatUserConfig {
    // superaudit?: SuperAuditUserConfig; // Future: plugin configuration options
  }

  interface HardhatConfig {
    // superaudit: SuperAuditConfig; // Future: resolved plugin configuration
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
