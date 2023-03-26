const { network } = require("hardhat")
const {
    developmentChains,
    DECIMALS,
    INITIAL_PRICE,
} = require("../helper-hardhat-config")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    // If we are on a local development network, we need to deploy mocks!

    //includes():function that checks to see if some variable is inside an array

    if (chainId == 31337) {
        //等同于if (develdomentChains.includes(network.name))
        log("Local network detected! Deploying mocks...")
        await deploy("MockV3Aggregator", {
            contract: "MockV3Aggregator",
            from: deployer,
            log: true,
            args: [DECIMALS, INITIAL_PRICE], //MockV3Aggregator合约的构造函数的俩参数
        })
        log("Mocks Deployed!")
        log("------------------------------------------------")
        log(
            "You are deploying to a local network, you'll need a local network running to interact"
        )
        log(
            "Please run `npx hardhat console` to interact with the deployed smart contracts!"
        )
        log("------------------------------------------------")
    }
}
module.exports.tags = ["all", "mocks"]
//可以决定是全部运行，还是只运行特别的tag
//比如这个script.js里有mocks这个tag，yarn hardhat deploy --tag mocks就会运行当前脚本
//所有脚本都有all这个tag，那么--tag all就会运行所有脚本。
