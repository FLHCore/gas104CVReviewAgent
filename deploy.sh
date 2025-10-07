#!/usr/bin/env bash

# deploy.sh: 本地端 Google Apps Script 部署腳本
#
# 這個腳本模擬 CI/CD 流程，用於將本地的 Apps Script 專案推送到指定的 scriptId。
#
# 使用方式:
# 1. 直接執行，使用 .clasp.json 中的現有設定：
#    ./deploy.sh
#
# 2. 提供 scriptId 和 rootDir 參數來覆寫 .clasp.json：
#    ./deploy.sh "YOUR_SCRIPT_ID" "./your_root_dir"
#

# --- 顏色定義 ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# --- 說明函式 ---
usage() {
  cat <<EOF
Usage: ./deploy.sh [-h|--help] [scriptId] [rootDir]

本地端 Google Apps Script 部署腳本。
這個腳本模擬 CI/CD 流程，用於將本地的 Apps Script 專案推送到指定的 scriptId。

參數:
  scriptId    (可選) 要部署的 Google Apps Script 專案 ID。
              如果未提供，將會嘗試從本地的 .clasp.json 檔案讀取。
  rootDir     (可選) 專案的根目錄。
              如果未提供，將會嘗試從 .clasp.json 讀取，預設為 "."。

特殊關鍵字:
  default     使用此關鍵字作為 scriptId，將強制腳本讀取本地 .clasp.json 的設定。
  release     使用此關鍵字作為 scriptId，將自動部署到正式環境。
  staging     使用此關鍵字作為 scriptId，將自動部署到測試環境。
  devp        使用此關鍵字作為 scriptId，將自動部署到開發環境 (Development)。

選項:
  -h, --help  顯示此說明訊息並結束。

範例:
  # 明確指定使用本地 .clasp.json 的設定
  ./deploy.sh default

  # 指定 scriptId 和 rootDir 進行部署
  ./deploy.sh "YOUR_SCRIPT_ID" "./src"
EOF
  exit 0
}

# --- 處理參數 ---
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
  usage
fi

# --- 步驟 1: 檢查環境依賴 ---
echo "Step 1: 正在檢查環境依賴..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}錯誤: 找不到 'node' 指令。請先安裝 Node.js。${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}錯誤: 找不到 'npm' 指令。請確認您的 Node.js 環境是否完整。${NC}"
    exit 1
fi

if ! command -v clasp &> /dev/null; then
    echo -e "${RED}錯誤: 找不到 'clasp' 指令。請執行 'npm install -g @google/clasp' 進行安裝。${NC}"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}警告: 找不到 'jq' 指令。腳本將無法讀取 .clasp.json 的預設值。建議安裝 jq (例如: 'brew install jq' 或 'sudo apt-get install jq')。${NC}"
fi

echo -e "${GREEN}環境檢查通過。${NC}"

# --- 步驟 2: 檢查 clasp 認證 ---
echo "Step 2: 正在檢查 clasp 認證狀態..."
if [ ! -f ~/.clasprc.json ]; then
    echo -e "${RED}錯誤: 找不到 clasp 認證檔案 (~/.clasprc.json)。請先執行 'clasp login' 進行登入。${NC}"
    exit 1
fi
echo -e "${GREEN}clasp 已認證。${NC}"

# --- 步驟 3: 設定 scriptId 和 rootDir ---
echo "Step 3: 正在設定目標 Script ID 和根目錄..."

SCRIPT_ID_ARG=${1}
ROOT_DIR_ARG=${2}

g_spreadsheet_filename=""

if [ "$SCRIPT_ID_ARG" == "release" ]; then
    echo -e "${YELLOW}偵測到 'release' 環境，自動替換為 Release Script ID。${NC}"
    g_spreadsheet_filename="HR 履歷小幫手 - 104CVReviewAgent"
    SCRIPT_ID="1e0cZMYPKz2zwHNzvtQFkwSL97U-IlTXcPoSS0SHuY-5GjGmcouuOsgLN"
    ROOT_DIR=${ROOT_DIR_ARG:-"."}
elif [ "$SCRIPT_ID_ARG" == "staging" ]; then
    echo -e "${YELLOW}偵測到 'staging' 環境，自動替換為 Staging Script ID。${NC}"
    g_spreadsheet_filename="HR 履歷小幫手-SPM104CV"
    SCRIPT_ID="1AU2q42-poSB057vk6i9uLIV93tA3DhF_btsNPbGNjy4SFCmotjJaxEPL"
    ROOT_DIR=${ROOT_DIR_ARG:-"."}
elif [ "$SCRIPT_ID_ARG" == "devp" ]; then
    echo -e "${YELLOW}偵測到 'devp' 環境，自動替換為 Development Script ID。${NC}"
    g_spreadsheet_filename="[devp]-HR 履歷小幫手 - 104CVReviewAgent 的副本"
    SCRIPT_ID="1-K7Q_0OvjoQAkNN4KiUB4c6KjJ0djcVI_UFAH57psMKEP57cxfvD8Z2X"
    ROOT_DIR=${ROOT_DIR_ARG:-"."}
elif [ "$SCRIPT_ID_ARG" == "sales" ]; then
    echo -e "${YELLOW}偵測到 'sales' 環境，自動替換為 Sales Script ID。${NC}"
    g_spreadsheet_filename="HR 履歷小幫手 - 業務104CV"
    SCRIPT_ID="1hLAmDWHenOmwLeoWSS6Mb0YwiqklUzi0Km-3iQx2cLzFi1ftespUcQEe"
    ROOT_DIR=${ROOT_DIR_ARG:-"."}
elif [ "$SCRIPT_ID_ARG" == "cs" ]; then
    echo -e "${YELLOW}偵測到 'cs' 環境，自動替換為 Customer Service Script ID。${NC}"
    g_spreadsheet_filename="HR 履歷小幫手 - 客服104CV"
    SCRIPT_ID="1hhuhjpWn00QAla4cY8R5MPfiuE0X4wOTWNn6cuj9Lfiv_mR7IWXVPyW7"
    ROOT_DIR=${ROOT_DIR_ARG:-"."}
elif [ "$SCRIPT_ID_ARG" == "default" ] && [ -f .clasp.json ] && command -v jq &> /dev/null; then
    echo -e "${YELLOW}偵測到 'default' 關鍵字，將使用本地 .clasp.json 設定。${NC}"
    SCRIPT_ID=$(jq -r '.scriptId' .clasp.json)
    ROOT_DIR=$(jq -r '.rootDir' .clasp.json)
    if [ -z "$SCRIPT_ID" ]; then
        echo -e "${RED}錯誤: 未提供 scriptId，且無法從本地 .clasp.json 讀取設定。${NC}"
        usage
    fi
elif [-z "$SCRIPT_ID_ARG"];then
    echo -e "${RED}錯誤: 未提供 scriptId，或無法從本地 .clasp.json 讀取設定。${NC}"
    usage
else
    # 使用傳入的參數
    SCRIPT_ID=$SCRIPT_ID_ARG
    ROOT_DIR=${ROOT_DIR_ARG:-"."}
fi

if [ -z "$SCRIPT_ID" ] || [ "$SCRIPT_ID" == "null" ]; then
    echo -e "${RED}錯誤: Script ID 未設定。請提供有效的 scriptId 或使用 'default' 關鍵字。${NC}\n"
    usage
fi

if [ -n "$g_spreadsheet_filename" ]; then
    echo "  - Google Sheet: $g_spreadsheet_filename"
fi
echo "  - Script ID: $SCRIPT_ID"
echo "  - Root Dir:  $ROOT_DIR"

# --- 步驟 4: 建立 .clasp.json 檔案 ---
echo "Step 4: 正在建立/更新 .clasp.json..."
cat <<EOF > .clasp.json
{
  "scriptId": "$SCRIPT_ID",
  "rootDir": "$ROOT_DIR"
}
EOF
echo -e "${GREEN}.clasp.json 已成功設定。${NC}"

# --- 步驟 5: 推送程式碼 ---
echo "Step 5: 正在推送程式碼至 Google Apps Script..."
clasp push -f

echo -e "${GREEN}部署完成！${NC}"
