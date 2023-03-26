const { network } = require("hardhat")
const { networkConfig, developmentChains } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")
require("dotenv").config()

// function deployFunc(hre) {
//   console.log("Hi!");
// }

// module.exports.default = deployFunc; //设置为默认方式

// module.exports = async (hre) => {
//和上面是一个意思，匿名函数的写法
// const { getNamedAccounts, deployments } = hre
// hre.getNamedAccounts()
// hre.deployments
// }

// const { networkConfig } = require("../helper-hardhat-config")
// const helperConfig = require("../helper-hardhat-config") 这两句和上面一句是一个意思
// const networkConfig = helperConfig.networkConfig

module.exports = async ({ getNamedAccounts, deployments }) => {
    //和上面是一个意思，匿名函数的写法
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts() //从hardhat.config.js里的namedAccounts字段获取accounts，并且可命名，就不用在不同network的accounts字段里费劲写各种账户了
    const chainId = network.config.chainId

    //当我们想在hardhat和localhost网络使用合约，我们需要使用Mock
    //如果使用某个链时，链上合约不存在，deploy minimize version
    //If we're on a network that doesn't have any price feed contracts like hard hat or localhost，就用00-deploy-mocks.js。

    // if chainId is X use address Y
    // if chainId is Z use address A

    // const ethUsdPriceFeedAddress = networkConfig[chainId]["ethUsdPriceFeed"];

    // if the contract doesn't exist, we deploy a minimal version
    // for our local testing
    //-------------------------------------------------

    let ethUsdPriceFeedAddress
    if (chainId == 31337) {
        const ethUsdAggregator = await deployments.get("MockV3Aggregator")
        ethUsdPriceFeedAddress = ethUsdAggregator.address
        log(
            `IN:01-deploy-fund-me.js--ethUsdAggregator deployed at ${ethUsdAggregator.address}`
        )
    } else {
        ethUsdPriceFeedAddress = networkConfig[chainId]["ethUsdPriceFeed"]
    }
    log("----------------------------------------------------")
    log("Deploying FundMe and waiting for confirmations...")

    const fundMe = await deploy("FundMe", {
        from: deployer,
        args: [ethUsdPriceFeedAddress],
        log: true,
        // we need to wait if on a live network so we can verify properly
        waitConfirmations: network.config.blockConfirmations || 1, //hardhat.config.js里的blockConfirmations: 6
    })
    log(`FundMe deployed at ${fundMe.address}`)
    log(`ethUsdPriceFeedAddress is ${ethUsdPriceFeedAddress}`)

    if (
        !developmentChains.includes(network.name) &&
        process.env.ETHERSCAN_API_KEY
    ) {
        await verify(fundMe.address, [ethUsdPriceFeedAddress])
    }
}

module.exports.tags = ["all", "fundme"]
