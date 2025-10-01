# 資料字典 (Data Dictionary)

本文件旨在說明專案中 `sheet-CONFIG.csv` 與 `sheet-PROMPTs.csv` 兩個資料檔案的結構、用途與內容，以利於 AI 程式碼助理（如 Gemini）或新進開發者快速理解系統的配置方式。

這兩個 CSV 檔案是從 Google 試算表中的 `CONFIG` 和 `PROMPTS` 工作表匯出的，代表了該專案的核心設定與 AI 互動指令。

---

## 1. `sheet-CONFIG.csv` - 系統設定檔

此檔案儲存了整個履歷自動化系統運作所需的各項靜態設定值。腳本透過 `getConfig(key)` 函式來讀取這些設定。

### 檔案結構

這是一個簡單的鍵值對 (Key-Value) 儲存結構，包含兩欄：

| 欄位名 | 說明 |
| :--- | :--- |
| `Key` | 設定項的唯一識別名稱。 |
| `Value` | 對應的設定值。 |

### 主要鍵值說明

*   `GMAIL_LABEL_NAME`: 指定系統要在 Gmail 中搜尋的標籤名稱，例如 `INBOX`。支援多個標籤，以逗號分隔。
*   `GMAIL_SEARCH_QUERY`: Gmail 搜尋的核心語法，用來精準匹配履歷郵件的主旨。
*   `JobDescription`: 職位描述 (JD)。這是評估履歷時的標準依據之一，會被填入 `cv_review` 提示詞中。
*   `BENCHMARK_CV`: 標竿履歷。這是一份理想候選人的履歷範本，作為評估時的黃金標準 (Gold Standard)，同樣會被填入 `cv_review` 提示詞。
*   `CV_RANK_THREADSHOLD`: 履歷評分閾值。一個 1-10 的數字，用於判斷一份履歷的 AI 評分是否達到「推薦」標準。預設值為 `8`。

---

## 2. `sheet-PROMPTs.csv` - AI 提示詞庫

此檔案集中管理所有與 Gemini API 互動時使用的提示詞 (Prompt)。腳本透過 `getPrompt(key)` 函式來讀取這些提示詞。

### 檔案結構

與設定檔類似，這也是一個鍵值對結構，包含兩欄：

| 欄位名 | 說明 |
| :--- | :--- |
| `Prompt Key` | 提示詞的唯一識別名稱。 |
| `Prompt Value` | 完整的提示詞內容。 |

### 主要提示詞說明

*   `html2md`: 用於將履歷郵件的 HTML 原始碼轉換為結構化 Markdown 格式的指令。它定義了提取規則與排除項目。
*   `cv_review`: 核心的履歷評估提示詞。它扮演一位資深 HR 專家，根據提供的 `<JD>`、`<BenchmarkCV>` 和 `<CandidateCV>`，產出一份詳細的結構化評估報告。
*   `readCVReviewComment`: 用於對 `cv_review` 產生的完整報告進行二次摘要的提示詞。它的任務是從長篇報告中僅抽取出「推薦信心度」和「總體建議」，用於在 Google Sheet 中快速預覽。

---

## 3. 與程式碼的關聯

*   `code.js` 中的 `getConfig(key)` 函式負責讀取 `CONFIG` 工作表（對應 `sheet-CONFIG.csv`）的內容。
*   `code.js` 中的 `getPrompt(key)` 函式負責讀取 `PROMPTS` 工作表（對應 `sheet-PROMPTs.csv`）的內容。

透過將設定與提示詞外部化到這兩個檔案中，開發者可以在不修改程式碼的情況下，彈性調整系統的搜尋目標、評分標準與 AI 的行為模式。

---

## 4. `sheet-履歷清單.csv` - 履歷處理主表

此檔案對應 Google 試算表中的 `履歷清單` 工作表，是整個自動化流程的核心資料表。它追蹤了每一份履歷從接收、處理、轉換、評估到報告的完整生命週期。

### 檔案結構

| 欄位名 | 說明 |
| :--- | :--- |
| `應徵者姓名` | 從郵件主旨中解析出的應徵者姓名。 |
| `郵件主旨` | 原始履歷郵件的主旨。 |
| `收到日期` | 收到履歷郵件的日期與時間。 |
| `郵件連結` | 該封郵件在 Gmail 中的永久連結。 |
| `郵件ID` | 該封郵件的唯一 Message ID，用於防止重複處理。 |
| `郵件內容HTML` | 儲存在 Google Drive 上的原始郵件內容 HTML 檔案連結。 |
| `Markdown 檔案連結` | 經由 Gemini API 將 HTML 內容轉換後的 Markdown 格式履歷檔案連結。 |
| `評估報告` | 由 Gemini API 產生的履歷評估摘要，通常包含核心優勢、潛在疑慮與推薦信心度。 |
| `完整評估報告` | 包含完整 AI 評估內容的檔案連結。 |
| `Prompt 檔案連結` | 該次履歷評估所使用的完整 Prompt 內容檔案連結。 |
| `Summary Prompt 檔案連結` | 用於產生「評估報告」摘要的 Prompt 內容檔案連結。 |
| `已發送` | 標記該履歷的評估報告是否已包含在每日快報中並寄出。 |
| `已發送邀請郵件` | 標記該履歷的 AI 評分是否超過設定的閾值 (`CV_RANK_THREADSHOLD`)，並且系統已自動發送面試邀請郵件。 |
