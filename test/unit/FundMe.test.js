const { network, deployments, ethers, getNamedAccounts } = require("hardhat")
const { assert, expect } = require("chai")
const { developmentChains } = require("../../helper-hardhat-config")

describe("FundMe", async function () {
    let fundMe
    let deployer
    let mockV3Aggregator
    const sendValue = ethers.utils.parseEther("1") // 1ETH，this 'parse' the ethers utility converts this 1 into that 1 with 18 zeros。下面第二张图中展示了utils里面另一个工具函数，可以标单位
    beforeEach(async function () {
        // deploy our fundMe contract
        // using Hardhat-deploy
        //const accounts = await ethers.getSigners() // 返回下图中红框，也就是网络中的所有accounts。比如如果在default 网络，会返回一个10账户的list
        //const accountZero = accounts[0]
        deployer = (await getNamedAccounts()).deployer //告诉ethers哪个account要连接到fundme合约.https://learnblockchain.cn/docs/hardhat/plugins/hardhat-deploy.html#:~:text=%E6%96%B0%E5%AD%97%E6%AE%B5%EF%BC%9A-,getNamedAccounts,-%E6%98%AF%E4%B8%80%E4%B8%AA%E5%87%BD%E6%95%B0
        await deployments.fixture(["all"]) //fixture允许我们运行整个deploy文件夹（根据不同tag）
        fundMe = await ethers.getContract("FundMe", deployer) //得到最近部署的FundMe合约,并用账户对象deployer连接。以后所有call fundme的function都是来自deployer account
        mockV3Aggregator = await ethers.getContract(
            "MockV3Aggregator",
            deployer
        )
    })

    describe("constructor", async function () {
        it("sets the aggregator addresses correctly", async () => {
            const response = await fundMe.priceFeed() //getPriceFeed是合约FindMe里的合约对象，这里response是该合约对象的地址
            //注意，这里如果把priceFeed的括号去掉。response就不是地址了，而是合约对象类型
            //通过yarn hardhat node得知，这个地址不是任何accounts的地址，就是正正好好的MockV3Aggregator合约的deploy地址
            //因为是通过deploy文件夹里俩文件本地部署，能看到chainid=31337时构造函数的输入参数args就是合约MockV3Aggregator的地址
            //所以此时不加()的priceFeed就是合约MockV3Aggregator。
            //具体为什么加个括号就能得到地址不太清楚，debug后显示priceFeed()确实是个函数
            //谷歌后得知任何在合约定义为公共的东西，solidity 都会分配一个 getter 函数
            //可能加了()后getter函数获得的合约对象就是合约地址吧？Maybe
            //其实可以在remix上试试，以后想起来再补充
            assert.equal(response, mockV3Aggregator.address)
        })
    })

    describe("fund", function () {
        // https://ethereum-waffle.readthedocs.io/en/latest/matchers.html
        // could also do assert.fail
        it("Fails if you don't send enough ETH", async () => {
            //测试fund传空值时应该revert
            await expect(fundMe.fund()).to.be.revertedWith(
                "You need to spend more ETH!"
            )
        })
        // we could be even more precise here by making sure exactly $50 works
        // but this is good enough for now
        it("Updates the amount funded data structure", async () => {
            //测试mapping正常
            await fundMe.fund({ value: sendValue })
            const response = await fundMe.addressToAmountFunded(
                //addressToAmountFunded是合约里的一个mapping，address=>uint256，each address and how much they've actually funded
                deployer //已经是address类型了貌似
            )
            assert.equal(response.toString(), sendValue.toString()) //BigNumber转化。此处这俩应该相等，因为上面就是转了1ETH，只是为了测试。
        })
        it("Adds funder to array of funders", async () => {
            //测试funders address array正常。该数组每次fund后都把funder的地址放进数组。如下图三
            await fundMe.fund({ value: sendValue })
            //const response = await fundMe.getFunder(0)
            const funder = await fundMe.funders(0) //数组索引也用括号
            //assert.equal(response, deployer)
            assert.equal(funder, deployer)
        })
    })

    describe("withdraw", async function () {
        beforeEach(async () => {
            //确保test withdraw前，合约里确实有钱。所以这里beforeEach来确保已经fund过
            await fundMe.fund({ value: sendValue })
        })
        it("withdraws ETH from a single funder", async function () {
            // Arrange  ,set this test up
            const startingFundMeBalance = await fundMe.provider.getBalance(
                fundMe.address
            ) //这里可以看ethers.js的文档。contract部分有说到，可以通过合约对象转换成相应的provider，再拿到该合约账户地址的balance
            //这里如果是await ethers.provider.getBalance(fundMe.address)也是一样的，只要拿到provider object的getBalance()就行
            const startingDeployerBalance = await fundMe.provider.getBalance(
                deployer
            ) //即将收到退款者的余额

            // Act
            const transactionResponse = await fundMe.withdraw() //退款，应该把balance加给deployer
            const transactionReceipt = await transactionResponse.wait(1)
            //但是当调用withdraw时，deployer会消耗gas。这里可以使用debug去查看该变量包含哪些属性，以及属性的值。具体可以看https://www.bilibili.com/video/BV1Ca411n7ta/?p=91&spm_id_from=pageDriver&vd_source=f843a67860caec6ec5ef9d73b5e972d7。
            const { gasUsed, effectiveGasPrice } = transactionReceipt //pull them right out of that transaction receipt object
            const gasCost = gasUsed.mul(effectiveGasPrice) //gasCost = gasUsed * effectiveGasPrice

            const endingFundMeBalance = await fundMe.provider.getBalance(
                fundMe.address
            )
            const endingDeployerBalance = await fundMe.provider.getBalance(
                deployer
            )

            // Assert
            // Maybe clean up to understand the testing
            assert.equal(endingFundMeBalance, 0) //撤回所有钱了，所以合约余额应该为0
            assert.equal(
                startingFundMeBalance.add(startingDeployerBalance).toString(),
                endingDeployerBalance.add(gasCost).toString()
            ) //两者在算上gas消耗后应该相等。注意加法是bignumber类型，可以使用下面图四中的函数
        })
        // this test is overloaded. Ideally we'd split it into multiple tests
        // but for simplicity we left it as one
        it("allows us to withdraw with multiple funders", async function () {
            //Arrange
            const accounts = await ethers.getSigners()
            for (let i = 0; i < accounts.length; i++) {
                const fundMeConnectedContract = await fundMe.connect(
                    accounts[i]
                )
                await fundMeConnectedContract.fund({ value: sendValue })
            }
            const startingFundMeBalance = await fundMe.provider.getBalance(
                fundMe.address
            ) //这里可以看ethers.js的文档。contract部分有说到，可以通过合约对象转换成相应的provider，再拿到该合约账户地址的balance
            //这里如果是await ethers.provider.getBalance(fundMe.address)也是一样的，只要拿到provider object的getBalance()就行
            const startingDeployerBalance = await fundMe.provider.getBalance(
                deployer
            ) //即将收到退款者的余额

            // Act
            const transactionResponse = await fundMe.withdraw()
            const transactionReceipt = await transactionResponse.wait(1)
            const { gasUsed, effectiveGasPrice } = transactionReceipt //pull them right out of that transaction receipt object
            const gasCost = gasUsed.mul(effectiveGasPrice) //gasCost = gasUsed * effectiveGasPrice
            const endingFundMeBalance = await fundMe.provider.getBalance(
                fundMe.address
            )
            const endingDeployerBalance = await fundMe.provider.getBalance(
                deployer
            )

            // Assert
            // Maybe clean up to understand the testing
            assert.equal(endingFundMeBalance, 0) //撤回所有钱了，所以合约余额应该为0
            assert.equal(
                startingFundMeBalance.add(startingDeployerBalance).toString(),
                endingDeployerBalance.add(gasCost).toString()
            ) //两者在算上gas消耗后应该相等。注意加法是bignumber类型，可以使用下面图四中的函数

            await expect(fundMe.funders(0)).to.be.reverted //对应合约的第51行，withdraw函数里会将funders数组清空。这里是测试确实被清空，所以才会在调用第0个数组时revert。

            console.log("account[0]:", accounts[0])
            console.log("account[0].address:", accounts[0].address)

            for (let i = 0; i < 6; i++) {
                assert.equal(
                    await fundMe.addressToAmountFunded(accounts[i].address), //对应合约中第49行，测试是否为0
                    0
                )
            }
        })

        it("Only allows the owner to withdraw", async function () {
            const accounts = await ethers.getSigners()
            const attacker = accounts[1]
            const attackConnectedContract = await fundMe.connect(attacker)

            await expect(
                attackConnectedContract.withdraw()
            ).to.be.revertedWithCustomError(fundMe, "FundMe__NotOwner")
            //据我所知to.be.revertedWith用于捕获字符串错误。要期待自定义错误，您需要使用to.be.revertedWithCustomError(contractInstance,NameOfTheCustomError). 此外，如果自定义错误有参数，您可以添加.withArgs(..args).
        })
    })
})
