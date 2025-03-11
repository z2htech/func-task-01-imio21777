import { Address, toNano, beginCell, Cell } from "ton-core";
import { TonClient, WalletContractV4, internal } from "ton";
import { mnemonicToPrivateKey } from "ton-crypto";
import * as fs from "fs";
import * as dotenv from "dotenv";
dotenv.config();

// 加载合约代码
async function loadCollectionCode(): Promise<Cell> {
  const code = fs.readFileSync("./build/nft-collection.cell");
  return Cell.fromBoc(Buffer.from(code))[0]; // 将文件内容转换为 Buffer
}

async function loadNftItemCode(): Promise<Cell> {
  const code = fs.readFileSync("./build/nft-item.cell");
  return Cell.fromBoc(Buffer.from(code))[0]; // 将文件内容转换为 Buffer
}

// 计算集合地址
async function calculateCollectionAddress(
  collectionData: Cell
): Promise<Address> {
  const stateInit = beginCell()
    .storeUint(0, 2) // split_depth:(## 5)
    .storeRef(await loadCollectionCode()) // 改用 storeRef 替代 storeDict
    .storeRef(collectionData) // 改用 storeRef 替代 storeDict
    .storeUint(0, 1) // library:(Maybe ^Cell)
    .endCell();

  const hash = stateInit.hash();
  return new Address(0, hash); // workchain = 0
}

async function main() {
  // 初始化 TON 客户端
  const client = new TonClient({
    endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
    apiKey: process.env.TON_API_KEY || "",
  });

  // 加载钱包
  const mnemonic = process.env.MNEMONIC || "";
  if (!mnemonic) throw new Error("请设置 MNEMONIC 环境变量");

  const keyPair = await mnemonicToPrivateKey(mnemonic.split(" "));
  const wallet = WalletContractV4.create({
    publicKey: keyPair.publicKey,
    workchain: 0,
  });
  const walletContract = client.open(wallet);
  const walletAddress = walletContract.address;

  const CID = process.env.NFT_CID || "";
  // 准备集合数据
  const collectionContent = beginCell()
    .storeRef(
      beginCell()
        .storeUint(0x01, 8) // off-chain 标记
        .storeStringTail(CID) // 集合元数据 URL
        .endCell()
    )
    .storeRef(
      beginCell()
        .storeStringTail(CID) // NFT 项目基础 URL
        .endCell()
    )
    .endCell();

  // 部署集合
  const collectionData = beginCell()
    .storeAddress(walletAddress) // owner_address
    .storeUint(0, 64) // next_item_index
    .storeRef(collectionContent) // collection_content
    .storeRef(await loadNftItemCode()) // nft_item_code
    .endCell();

  const collectionAddress = await calculateCollectionAddress(collectionData);

  // 发送部署交易
  const seqno = await walletContract.getSeqno();
  await walletContract.sendTransfer({
    seqno,
    secretKey: keyPair.secretKey,
    messages: [
      internal({
        to: collectionAddress,
        value: toNano("0.05"),
        init: {
          code: await loadCollectionCode(),
          data: collectionData,
        },
        bounce: false,
      }),
    ],
  });

  console.log(`Collection address: ${collectionAddress.toString()}`);

  return collectionAddress.toString();
}

main()
  .then((collectionAddress) => {
    console.log("部署成功！");
    console.log(`Collection address: ${collectionAddress}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
