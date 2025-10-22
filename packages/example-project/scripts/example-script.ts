import { network } from "hardhat";

console.log("Running example script");
const { provider } = await network.connect();

const accounts = await provider.send("eth_accounts", []);

console.log("Accounts:", accounts);

console.log(`Sending 1wei from ${accounts[0]} to ${accounts[1]}...`);

const tx = await provider.request({
  method: "eth_sendTransaction",
  params: [{ from: accounts[0], to: accounts[1], value: "0x1" }],
});

console.log(`Successfully sent transaction with hash ${tx}`);
