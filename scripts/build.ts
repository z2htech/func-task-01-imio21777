import { compileFunc } from "@ton-community/func-js";
import * as fs from "fs";

async function main() {
  // 编译 NFT Collection 合约
  const collectionResult = await compileFunc({
    targets: ["contracts/nft-collection.fc"],
    sources: {
      "contracts/nft-collection.fc": fs.readFileSync(
        "contracts/nft-collection.fc",
        "utf8"
      ),
      "contracts/imports/stdlib.fc": fs.readFileSync(
        "contracts/imports/stdlib.fc",
        "utf8"
      ),
      "contracts/imports/op-codes.fc": fs.readFileSync(
        "contracts/imports/op-codes.fc",
        "utf8"
      ),
      "contracts/imports/params.fc": fs.readFileSync(
        "contracts/imports/params.fc",
        "utf8"
      ),
    },
  });

  // 编译 NFT Item 合约
  const itemResult = await compileFunc({
    targets: ["contracts/nft-item.fc"],
    sources: {
      "contracts/nft-item.fc": fs.readFileSync("contracts/nft-item.fc", "utf8"),
      "contracts/imports/stdlib.fc": fs.readFileSync(
        "contracts/imports/stdlib.fc",
        "utf8"
      ),
      "contracts/imports/op-codes.fc": fs.readFileSync(
        "contracts/imports/op-codes.fc",
        "utf8"
      ),
      "contracts/imports/params.fc": fs.readFileSync(
        "contracts/imports/params.fc",
        "utf8"
      ),
    },
  });

  // 检查编译结果
  if (collectionResult.status === "error") {
    console.error("Collection compilation failed:", collectionResult.message);
    process.exit(1);
  }

  if (itemResult.status === "error") {
    console.error("Item compilation failed:", itemResult.message);
    process.exit(1);
  }

  // 创建 build 目录
  if (!fs.existsSync("build")) {
    fs.mkdirSync("build");
  }

  // 保存编译结果
  if (collectionResult.status === "ok" && itemResult.status === "ok") {
    fs.writeFileSync(
      "build/nft-collection.cell",
      Buffer.from(collectionResult.codeBoc, "base64")
    );
    fs.writeFileSync(
      "build/nft-item.cell",
      Buffer.from(itemResult.codeBoc, "base64")
    );
    console.log("编译成功！");
  }
}

main().catch(console.error);
