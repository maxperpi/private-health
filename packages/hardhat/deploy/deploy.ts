import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedFHEPrivateHealth = await deploy("FHEPrivateHealth", {
    from: deployer,
    log: true,
  });

  console.log(`FHEPrivateHealth contract: `, deployedFHEPrivateHealth.address);
};
export default func;
func.id = "deploy_FHEPrivateHealth"; // id required to prevent reexecution
func.tags = ["FHEPrivateHealth"];
