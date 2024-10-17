import { ethers, network } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  getRequiredEnvVar,
  tryVerifyContract,
  tryStoreAddress,
  validateDeployBranchAndTags,
  getDeployedContractAddress,
} from "../common/helpers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre;
  validateDeployBranchAndTags(hre.network.name);

  const contractName = "TestERC20";
  const existingContractAddress = await getDeployedContractAddress(contractName, deployments);

  const tokenName = getRequiredEnvVar("TEST_ERC20_NAME");
  const tokenSymbol = getRequiredEnvVar("TEST_ERC20_SYMBOL");
  const initialSupply = getRequiredEnvVar("TEST_ERC20_INITIAL_SUPPLY");
  const mintReceiver = getRequiredEnvVar("TEST_ERC20_MINT_RECEIVER");

  if (!existingContractAddress) {
    console.log(`Deploying initial version, NB: the address will be saved if env SAVE_ADDRESS=true.`);
  } else {
    console.log(`Deploying new version, NB: ${existingContractAddress} will be overwritten if env SAVE_ADDRESS=true.`);
  }

  const TestERC20Factory = await ethers.getContractFactory(contractName);
  const contract = await TestERC20Factory.deploy(
    tokenName,
    tokenSymbol,
    ethers.parseEther(initialSupply),
    mintReceiver,
  );

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log(`${contractName} deployed at ${contractAddress}`);

  const deployTx = contract.deploymentTransaction();
  if (!deployTx) {
    throw "Deployment transaction not found.";
  }

  await tryStoreAddress(network.name, contractName, contractAddress, deployTx.hash);

  console.log(`${contractName} deployed on ${network.name}, at address: ${contractAddress}`);
  await tryVerifyContract(contractAddress);
};

export default func;
func.tags = ["TestERC20"];
