import { HardhatRuntimeEnvironment } from "hardhat/types/hre";

interface MyTaskTaskArguments {
  who: string;
}

export default async function (
  taskArguments: MyTaskTaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  console.log(`${hre.config.myConfig.greeting}, ${taskArguments.who}!`);
}
