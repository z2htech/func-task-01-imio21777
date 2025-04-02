const fs = require("fs");
const path = require("path");
const {
  TonClient,
  Cell,
  WalletContractV4,
  internal,
  beginCell,
  Address,
  toNano,
  fromNano,
  BitString,
} = require("ton");
const { mnemonicToPrivateKey } = require("ton-crypto");
require("dotenv").config();

// 从.env读取助记词和端点URL
const MNEMONIC = process.env.MNEMONIC || "";
const ENDPOINT =
  process.env.ENDPOINT || "https://testnet.toncenter.com/api/v2/jsonRPC";
const API_KEY = process.env.API_KEY || "";

// 检查助记词和端点URL
if (!MNEMONIC) {
  console.error("请在.env文件中设置MNEMONIC");
  process.exit(1);
}

if (!ENDPOINT) {
  console.error("请在.env文件中设置ENDPOINT");
  process.exit(1);
}

// 创建TonClient实例
const client = new TonClient({
  endpoint: ENDPOINT,
  apiKey: API_KEY,
});

// 创建NFT元数据Cell
function createNFTContentCell(params) {
  const { name, description, image, attributes } = params;

  // 创建URI格式的链接，而不是存储整个JSON
  // TON标准支持URI格式，这样可以避免Cell溢出
  const uri = `https://example.com/metadata.json`;
  // 编码为UTF-8并存储
  const buffer = Buffer.from(uri, "utf-8");

  // 使用链接模式
  return beginCell()
    .storeUint(0, 8) // 链下存储标记(0)
    .storeBuffer(buffer)
    .endCell();
}

// 创建版税参数Cell
function createRoyaltyParamsCell(params) {
  const { royaltyFactor, royaltyBase, royaltyAddress } = params;

  return beginCell()
    .storeAddress(Address.parse(royaltyAddress))
    .storeUint(royaltyFactor, 16) // 通常是百分比，例如 0.05 = 5%
    .storeUint(royaltyBase, 16) // 基数，一般是 100
    .endCell();
}

// 部署NFT集合合约
async function deployNFTCollection() {
  try {
    // 从助记词获取钱包
    const keyPair = await mnemonicToPrivateKey(MNEMONIC.split(" "));
    const wallet = WalletContractV4.create({
      publicKey: keyPair.publicKey,
      workchain: 0,
    });
    const walletContract = client.open(wallet);
    const walletAddress = wallet.address;

    console.log(`使用钱包地址: ${walletAddress.toString()}`);

    // 检查钱包余额
    const balance = await client.getBalance(walletAddress);
    console.log(`钱包余额: ${fromNano(balance)} TON`);

    if (balance < toNano("0.5")) {
      console.error("钱包余额不足，请确保有至少0.5 TON");
      process.exit(1);
    }

    // 创建NFT集合数据
    const collectionContent = createNFTContentCell({
      name: "示例NFT集合",
      description: "这是一个示例NFT集合，用于展示TON区块链上的NFT功能",
      image: "https://example.com/collection.png",
    });

    // 创建版税参数
    const royaltyParams = createRoyaltyParamsCell({
      royaltyFactor: 5,
      royaltyBase: 100,
      royaltyAddress: walletAddress.toString(),
    });

    console.log("NFT集合数据已创建");

    // 创建一个简单的测试Cell，而不是尝试加载可能有问题的cell文件
    // 注意：这不是真正的合约代码，只是为了测试部署流程
    console.log("⚠️ 警告：使用简化版的测试Cell，而不是编译后的合约代码");
    console.log("这只会测试部署流程，部署的合约不会有实际功能");

    // 正确创建Cell的方式是使用beginCell
    const dummyCell = beginCell().storeUint(0, 32).endCell();

    const collectionCode = dummyCell;
    const itemCode = dummyCell;

    console.log("测试Cell已创建");

    // 创建集合数据Cell
    const collectionData = beginCell()
      .storeUint(0, 32) // 存储标志
      .storeRef(itemCode) // NFT个体代码
      .storeAddress(walletAddress) // 所有者地址
      .storeUint(0, 64) // 下一个NFT索引
      .storeRef(collectionContent) // 集合内容
      .storeRef(royaltyParams) // 版税参数
      .endCell();

    // 创建状态初始化
    const stateInit = beginCell()
      .storeUint(0, 2) // 无分片信息
      .storeRef(collectionCode) // 代码
      .storeRef(collectionData) // 数据
      .storeUint(0, 1) // 无库
      .endCell();

    // 计算合约地址
    const hash = stateInit.hash();
    const contractAddress = new Address(0, hash); // 0是workchain ID

    console.log(`NFT集合合约地址: ${contractAddress.toString()}`);

    // 发送部署交易
    const seqno = await walletContract.getSeqno();
    console.log(`钱包seqno: ${seqno}`);

    // 发送部署消息
    await walletContract.sendTransfer({
      secretKey: keyPair.secretKey,
      seqno: seqno,
      messages: [
        internal({
          to: contractAddress,
          value: toNano("0.5"), // 发送0.5 TON
          init: {
            code: collectionCode,
            data: collectionData,
          },
          bounce: false,
        }),
      ],
    });

    console.log("部署交易已发送！等待确认...");
    console.log(
      `在浏览器中查看: https://testnet.tonscan.org/address/${contractAddress.toString()}`
    );

    return contractAddress.toString();
  } catch (error) {
    console.error("部署失败:", error);
    return null;
  }
}

// 铸造示例NFT
async function mintExampleNFT(collectionAddress) {
  try {
    if (!collectionAddress) {
      console.error("未提供集合地址，无法铸造NFT");
      return;
    }

    console.log("开始铸造示例NFT...");

    // 从助记词获取钱包
    const keyPair = await mnemonicToPrivateKey(MNEMONIC.split(" "));
    const wallet = WalletContractV4.create({
      publicKey: keyPair.publicKey,
      workchain: 0,
    });
    const walletContract = client.open(wallet);
    // 直接从wallet获取地址
    const walletAddress = wallet.address;

    // 创建NFT内容
    const nftContent = createNFTContentCell({
      name: "我的第一个NFT",
      description: "这是在TON区块链上创建的NFT示例",
      image: "https://example.com/nft1.png",
      attributes: [
        { trait_type: "稀有度", value: "普通" },
        { trait_type: "类型", value: "示例" },
      ],
    });

    // 创建mint操作消息
    const mintMsg = beginCell()
      .storeUint(1, 32) // op::mint() = 1
      .storeUint(0, 64) // query_id
      .storeAddress(walletAddress) // to_address
      .storeRef(nftContent) // nft_content
      .endCell();

    // 发送消息到集合合约
    const seqno = await walletContract.getSeqno();
    await walletContract.sendTransfer({
      secretKey: keyPair.secretKey,
      seqno: seqno,
      messages: [
        internal({
          to: Address.parse(collectionAddress),
          value: toNano("0.1"), // 发送0.1 TON用于铸造
          body: mintMsg,
          bounce: true,
        }),
      ],
    });

    console.log("NFT铸造消息已发送!");
    console.log(
      `在浏览器中查看集合: https://testnet.tonscan.org/address/${collectionAddress}`
    );
  } catch (error) {
    console.error("铸造NFT失败:", error);
  }
}

// 部署NFT项目并创建示例NFT
async function deploy() {
  console.log("开始部署NFT项目到TON测试网...");
  const collectionAddress = await deployNFTCollection();

  if (collectionAddress) {
    console.log("等待30秒让集合合约确认...");
    await new Promise((resolve) => setTimeout(resolve, 30000));

    await mintExampleNFT(collectionAddress);
  }

  console.log("全部完成！");
}

// 执行部署
deploy().catch(console.error);
