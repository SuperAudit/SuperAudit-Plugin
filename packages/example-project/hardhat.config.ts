import { HardhatUserConfig } from "hardhat/config";
import superauditPlugin from "hardhat-superaudit";

export default {
  plugins: [superauditPlugin],
  solidity: "0.8.29",
} satisfies HardhatUserConfig;
