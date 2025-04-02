#!/bin/bash
cd ton-nft-project
mkdir -p build

# 使用本地func编译器
# 编译集合合约
func -o build/nft-collection.fif -SPA contracts/stdlib.fc contracts/op-codes.fc contracts/nft-collection.fc

# 编译NFT个体合约
func -o build/nft-item.fif -SPA contracts/stdlib.fc contracts/op-codes.fc contracts/nft-item.fc

# 使用本地fift将Fift脚本转换为Cell格式
# 确保输出正确保存到文件
fift -s build/nft-collection.fif > build/nft-collection.cell
echo "集合合约编译完成: $(wc -c < build/nft-collection.cell) 字节"

fift -s build/nft-item.fif > build/nft-item.cell
echo "NFT个体合约编译完成: $(wc -c < build/nft-item.cell) 字节"

echo "编译完成！所有文件已保存到ton-nft-project/build目录"
