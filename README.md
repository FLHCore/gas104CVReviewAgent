# gas104CVReviewAgent
Google Apps Script project using Gemini to help managers match 104 resumes with job descriptions. Automates candidate-job analysis, scoring compatibility, and sends daily analytics reports via GAS routine—streamlining recruitment and enhancing decision-making.

## 部署 (Deployment)

本專案包含一個 `deploy.sh` 腳本，用於模擬 CI/CD 流程，可將本地的 Google Apps Script 專案程式碼推送到指定的 Google Apps Script 專案。

### 環境依賴

在執行部署腳本前，請確保您的開發環境已安裝以下工具：
- `node` & `npm`
- `clasp` (Google Apps Script CLI): 可透過 `npm install -g @google/clasp` 安裝。
- `jq` (可選，但建議安裝): 用於讀取 `.clasp.json` 的設定。

並且，您需要先登入 `clasp`:
```bash
clasp login
```

### 使用方式

```bash
./deploy.sh [scriptId|keyword] [rootDir]
```

#### 參數

- `scriptId` (可選): 要部署的 Google Apps Script 專案 ID。
- `rootDir` (可選): 專案的根目錄，預設為 `.`。

#### 特殊關鍵字

您可以使用以下關鍵字作為 `scriptId` 來快速部署到預設的環境：

- `default`: 強制腳本讀取本地 `.clasp.json` 的設定。
- `release`: 自動部署到 **正式環境** (Google 專案名稱: `HR 履歷小幫手 - 104CVReviewAgent`)。
- `staging`: 自動部署到 **測試環境** (Google 專案名稱: `Agentic-HR 履歷小幫手-SPM`)。
- `devp`: 自動部署到 **開發環境** (Google 專案名稱: `[devp]-HR 履歷小幫手 - 104CVReviewAgent 的副本`)。

#### 範例

```bash
# 部署到開發環境
./deploy.sh devp

# 部署到指定的 script ID
./deploy.sh "YOUR_SCRIPT_ID"
```
