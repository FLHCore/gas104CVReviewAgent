#!/usr/bin/env bash

# version.sh: 自動更新 code.js 中的 SCRIPT_VERSION 版本號
#
# 這個腳本用於根據語意化版本 (Semantic Versioning) 的規則，
# 自動增加 'code.js' 檔案中的 SCRIPT_VERSION 常數。
#
# 使用方式:
#   ./version.sh [major|minor|patch]
#
# 參數:
#   major   (可選) 將 major 版本號 +1，minor 和 patch 重設為 0。(例如: 2.1.5 -> 3.0.0)
#   minor   (可選) 將 minor 版本號 +1，patch 重設為 0。(例如: 2.1.5 -> 2.2.0)
#   patch   (可選) 將 patch 版本號 +1。(例如: 2.1.5 -> 2.1.6)
#
# 如果不提供任何參數，預設行為是將 patch 版本號 +1。

# --- 顏色定義 ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# --- 變數設定 ---
TARGET_FILE="code.js"
VERSION_TYPE=${1:-patch} # 如果沒有參數，預設為 patch

# --- 說明函式 ---
usage() {
  cat <<EOF
Usage: ./version.sh [major|minor|patch]

自動更新 code.js 中的 SCRIPT_VERSION 版本號。

參數:
  major   (可選) 將 major 版本號 +1，minor 和 patch 重設為 0。
  minor   (可選) 將 minor 版本號 +1，patch 重設為 0。
  patch   (可選) 將 patch 版本號 +1 (預設行為)。

範例:
  # 更新 patch 版本 (e.g., 2.0.1 -> 2.0.2)
  ./version.sh

  # 更新 minor 版本 (e.g., 2.0.1 -> 2.1.0)
  ./version.sh minor

  # 更新 major 版本 (e.g., 2.0.1 -> 3.0.0)
  ./version.sh major
EOF
  exit 0
}

if [[ "$1" == "-h" || "$1" == "--help" ]]; then
  usage
fi

# --- 檢查目標檔案是否存在 ---
if [ ! -f "$TARGET_FILE" ]; then
    echo -e "${RED}錯誤: 找不到目標檔案: ${TARGET_FILE}${NC}"
    exit 1
fi

# --- 步驟 1: 讀取目前的版本號 ---
echo "Step 1: 正在讀取目前的版本號..."
current_version_line=$(grep "const SCRIPT_VERSION =" "$TARGET_FILE")
current_version=$(echo "$current_version_line" | sed -n "s/.*'\(.*\)'.*/\1/p")

if [ -z "$current_version" ]; then
    echo -e "${RED}錯誤: 在 ${TARGET_FILE} 中找不到 'SCRIPT_VERSION'。${NC}"
    exit 1
fi

echo -e "目前版本: ${YELLOW}${current_version}${NC}"

# --- 步驟 2: 根據參數計算新版本號 ---
echo "Step 2: 正在計算新版本號 (更新類型: ${VERSION_TYPE})..."
IFS='.' read -r major minor patch <<< "$current_version"

case "$VERSION_TYPE" in
  major) major=$((major + 1)); minor=0; patch=0 ;;
  minor) minor=$((minor + 1)); patch=0 ;;
  patch) patch=$((patch + 1)) ;;
  *) echo -e "${RED}錯誤: 無效的參數 '$VERSION_TYPE'。請使用 'major', 'minor', 或 'patch'。${NC}"; exit 1 ;;
esac

new_version="${major}.${minor}.${patch}"
echo -e "新版本: ${GREEN}${new_version}${NC}"

# --- 步驟 3: 更新檔案內容 ---
echo "Step 3: 正在更新 ${TARGET_FILE}..."
sed -i.bak "s/const SCRIPT_VERSION = '.*'/const SCRIPT_VERSION = '${new_version}'/" "$TARGET_FILE"
rm "${TARGET_FILE}.bak" # 移除備份檔案

echo -e "${GREEN}檔案 ${TARGET_FILE} 更新完成！${NC}"

# --- 步驟 4: 自動 Git Commit ---
echo "Step 4: 正在建立 Git commit..."

# 檢查是否在一個 git repository 中
if ! git rev-parse --is-inside-work-tree &> /dev/null; then
    echo -e "${YELLOW}警告: 目前不在 Git repository 中，跳過 commit。${NC}"
    echo -e "${GREEN}版本號更新流程結束。${NC}"
    exit 0
fi

# 將變更加入 stage
git add "$TARGET_FILE"

# 建立 commit
commit_message="chore(version): bump version to v${new_version}"
git commit -m "$commit_message"

echo -e "${GREEN}成功建立 Git commit: '$commit_message'${NC}"