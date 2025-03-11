import { Address, toNano, beginCell } from "ton-core";
import { TonClient, WalletContractV4, internal } from "ton";
import { mnemonicToPrivateKey } from "ton-crypto";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  // 使用之前部署的集合地址
  const collectionAddress = Address.parse(process.env.COLLECTION_ADDRESS || "");

  if (!collectionAddress) {
    throw new Error("请设置 COLLECTION_ADDRESS 环境变量");
  }

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

  // 准备 NFT 内容
  const CID = process.env.NFT_CID || "";
  const nftContent = beginCell()
    .storeUint(0x01, 8) // off-chain 标记
    .storeStringTail(CID) // NFT 元数据 URL
    .endCell();

  // 发送铸造交易
  const seqno = await walletContract.getSeqno();
  await walletContract.sendTransfer({
    seqno,
    secretKey: keyPair.secretKey,
    messages: [
      internal({
        to: collectionAddress,
        value: toNano("0.05"),
        body: beginCell()
          .storeUint(1, 32) // op (1 = deploy new nft)
          .storeUint(0, 64) // query_id
          .storeUint(0, 64) // item_index (从0开始)
          .storeCoins(toNano("0.02")) // amount for NFT deploy
          .storeRef(nftContent)
          .endCell(),
      }),
    ],
  });

  console.log("NFT 铸造交易已发送！");
}

main()
  .then(() => {
    console.log("NFT 铸造成功！");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
