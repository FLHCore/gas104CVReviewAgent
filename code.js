/**
 * @fileoverview 履歷自動化處理系統 (Resume Automation System)
 * @version 1.0
 * @author Gemini Code Assist
 *
 * @description
 * 這個 Google Apps Script 旨在自動化處理求職者的履歷。它會：
 * 1. 從指定的 Gmail 標籤中搜尋新的履歷郵件。
 * 2. 將郵件內容儲存為 HTML 檔案至 Google Drive。
 * 3. 使用 Gemini API 將 HTML 內容轉換為 Markdown 格式。
 * 4. 根據預設的職位描述 (JD) 和標準履歷 (Benchmark CV)，使用 Gemini API 對履歷進行評分和分析。
 * 5. 產生每日簡歷快報，並透過 Email 發送給指定收件人。
 *
 * @refactor
 * - [ ] **調整 html2md prompt 讀取位置：** 簡歷 HTML 格式轉換為 MD 格式內容中，有些會少了104簡歷的「代碼：1843339840761」資訊。
 * - [ ] **新增 days CONFIG 參數：** 設定系統搜尋 Gmail 郵件的天數範圍，「空值為預設」系統會從上週一到今天，正整數。
 * - [ ] **新增 SHEET-[履歷清單] [職缺名稱]欄位：** 新增[職缺名稱]欄位，用來設定CV對應的職缺，提供系統後續處理的依據。
 * - [ ] **新增 SHEET-[CVReviewPrompts]：** Fields: Title, JobDescription(JD), BenchmarkCV, JDReviewPrompt，將所有職缺評估所需要的提示詞參數統一管理。
 * - [ ] **重新定位 SHEET-[簡歷清單] 為 NoTitle CV List**： 。
 * - [ ] **新增 SHEET-[{JoTitile}] 職缺清單 SHEET**： 。
 * 
 * @todo
 * - [ ] **新增功能：** 讀取簡歷中的「郵件位址」以及「電話」。
 * - [ ] **使用者回饋：** 簡歷AI評分若是超過「設定閾值」就直接發送 template mail 邀請對方。
 * - [ ] **使用者回饋：** 簡歷 HTML 格式轉換為 MD 格式內容中，有些會少了104簡歷的「代碼：1843339840761」資訊。
 * - [ ] **使用者回饋：** 透過104系統批次轉寄的簡歷郵件，需要自動匹配職缺，然後使用對應的 ReviewPrompt 處理。
 * -- 以下是 todo 的範例 ------------------------------------
 * - [ ] **功能建議：** 增加一個儀表板，視覺化呈現每週收到的履歷數量、評分分佈等統計數據。
 * - [ ] **體驗改善：** 當 Gemini API Key 或 Folder ID 設定錯誤時，錯誤提示可以更明確地引導使用者到設定選單。
 * - [ ] **錯誤處理：** 針對 `evaluateResumes` 函式，如果單一履歷評估失敗，目前只會記錄錯誤，可以考慮增加自動重試機制。
 * - [ ] **效能優化：** `dailyWorkflow` 函式中的各個步驟是循序執行的，研究是否可以將無相依性的步驟非同步處理以縮短整體執行時間。
 * - [ ] **使用者回饋：** 使用者回報 `extractReportDetails` 函式在解析某些特殊格式的報告時會失敗，需要增加更多樣的正規表示式匹配規則。
 * - [ ] **功能建議：** 增加支援從郵件附件 (如 .pdf, .docx) 中提取履歷內容的功能。
 */


// 當試算表被打開時，自動建立一個自訂選單
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('履歷小幫手')
      .addItem('設定 GDrive Folder ID', 'setFolderId')
      .addItem('設定 Gemini API KEY', 'setGeminiApiKey')
      .addItem('設定簡歷快報收件人', 'setCVReportReceiversEmail')
      .addSeparator()
      .addItem('更新郵箱簡歷清單', 'mainProcessResumes')
      .addItem('依序儲存郵箱簡歷', 'saveEmailAsHtmlFile')
      .addItem('依序轉換簡歷格式', 'convertDocsToMarkdown')
      .addItem('讀取 E-mail 與聯絡電話', 'extractContactInfoFromMarkdown') // [新增]
      .addItem('依序評分簡歷', 'evaluateResumes') 
      .addItem('依序發送面試邀請郵件', 'sendInvitationEmails')
      .addItem('今日簡歷快報', 'generateDailyCVReviewReport_v4')
      .addSeparator() 
      .addItem('手動執行DailyRoutine', 'dailyWorkflow')
      .addItem('清除履歷清單', 'clearAllResumes')
      .addItem('移除單一已處理ID', 'promptAndRemoveMessageId')
      .addItem('清除ScriptProperties', 'deleteScriptProperties')
      .addToUi();
}

/**
 * [新增] 每日自動化工作流程主函式
 * 此函式會依序執行所有必要的履歷處理步驟。
 * 請為此函式設定一個每日的時間觸發器。
 */
function dailyWorkflow() {
  const FUNCTION_NAME = 'dailyWorkflow';
  Logger.log(`======= [開始] ${FUNCTION_NAME} 每日自動化履歷處理流程 =======`);
  
  try {
    Logger.log("步驟 1/5: 更新郵箱簡歷清單 (mainProcessResumes)...");
    mainProcessResumes();
    Logger.log("步驟 1/5: 完成。");

    Logger.log("步驟 2/5: 依序儲存郵箱簡歷為 HTML (saveEmailAsHtmlFile)...");
    saveEmailAsHtmlFile();
    Logger.log("步驟 2/5: 完成。");

    Logger.log("步驟 3/5: 依序轉換簡歷格式為 Markdown (convertDocsToMarkdown)...");
    convertDocsToMarkdown();
    Logger.log("步驟 3/5: 完成。");

    Logger.log("步驟 4/5: 依序評分簡歷 (evaluateResumes)...");
    evaluateResumes();
    Logger.log("步驟 4/5: 完成。");

    Logger.log("步驟 5/6 (skip): 依序發送高分履歷面試邀請 (sendInvitationEmails)...");
    // sendInvitationEmails();
    // Logger.log("步驟 5/6: 完成。");

    Logger.log("步驟 6/6: 產生並寄送今日簡歷快報 (generateDailyCVReviewReport_v4)...");
    generateDailyCVReviewReport_v4();
    Logger.log("步驟 6/6: 完成。");

  } catch (e) {
    const recipient = Session.getActiveUser().getEmail();
    const subject = `【錯誤通知】每日自動化履歷處理流程 (${FUNCTION_NAME}) 發生錯誤`;
    const body = `每日自動化履歷處理流程執行失敗。\n\n錯誤詳情：\n${e.toString()}\n${e.stack}`;
    GmailApp.sendEmail(recipient, subject, body);
    Logger.log(`[ERROR] ${FUNCTION_NAME}: 每日自動化流程中斷: ${e.toString()}\n${e.stack}`);
  } finally {
    Logger.log(`======= [結束] ${FUNCTION_NAME} 每日自動化履歷處理流程 =======`);
  }
}

/**
 * 設定並儲存 Gemini API KEY
 */
function setGeminiApiKey() {
  const ui = SpreadsheetApp.getUi();
  const scriptProperties = PropertiesService.getScriptProperties();
  const currentApiKey = scriptProperties.getProperty('geminiApiKey') || '';
  
  // 提示使用者輸入
  const response = ui.prompt(
    '設定 Gemini API KEY',
    `目前設定的 API KEY 為：\n${currentApiKey}\n\n若要更新，請貼上新的 API KEY：`,
    ui.ButtonSet.OK_CANCEL
  );

  // 檢查使用者是否按下 "OK" 且有輸入內容
  if (response.getSelectedButton() == ui.Button.OK) {
    const apiKey = response.getResponseText().trim();
    if (apiKey) {
      scriptProperties.setProperty('geminiApiKey', apiKey);
      ui.alert(`設定成功！新的 Gemini API KEY 已儲存：\n${apiKey}`);
    } else {
      ui.alert('您沒有輸入任何內容。');
    }
  }
}

/**
 * [新功能] 設定並儲存 Google Drive Folder ID
 */
function setFolderId() {
  const ui = SpreadsheetApp.getUi();
  const scriptProperties = PropertiesService.getScriptProperties();
  const currentFolderId = scriptProperties.getProperty('folderId') || '';
  
  // 提示使用者輸入
  const response = ui.prompt(
    '設定目標資料夾 ID',
    `目前設定的 Folder ID 為：\n${currentFolderId}\n\n若要更新，請貼上新的 Google Drive 資料夾 ID：`,
    ui.ButtonSet.OK_CANCEL
  );

  // 檢查使用者是否按下 "OK" 且有輸入內容
  if (response.getSelectedButton() == ui.Button.OK) {
    const folderId = response.getResponseText().trim();
    if (folderId) {
      // 驗證 folderId 是否有效 (可選，但建議)
      try {
        DriveApp.getFolderById(folderId); // 嘗試讀取，如果ID無效會拋出錯誤
        scriptProperties.setProperty('folderId', folderId);
        ui.alert(`設定成功！新的 Folder ID 已儲存：\n${folderId}`);
      } catch (e) {
        ui.alert(`設定失敗！\n您輸入的 Folder ID "${folderId}" 無效或無法存取。`);
      }
    } else {
      ui.alert('您沒有輸入任何內容。');
    }
  }
}

/**
 * 設定簡歷快報收件人
 */
function setCVReportReceiversEmail() {
  const ui = SpreadsheetApp.getUi();
  const scriptProperties = PropertiesService.getScriptProperties();
  const currentEmail = scriptProperties.getProperty('cvReportReceiversEmail') || '';

  const response = ui.prompt('設定簡歷快報收件人', `目前設定的收件人為：\n${currentEmail}\n\n若要更新，請輸入新的 email 地址：`, ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() === ui.Button.OK) {
    const emailAddress = response.getResponseText().trim();
    if (emailAddress) {
      PropertiesService.getScriptProperties().setProperty('cvReportReceiversEmail', emailAddress);
      ui.alert('簡歷快報收件人已設定成功！');
    } else {
      ui.alert('請輸入有效的 email 地址！');
    }
  }
}

/**
 * 主流程函式
 */
function mainProcessResumes() {
  try {
    const today = new Date();
    
    // 計算上週一的日期
    const lastMonday = new Date();
    
    // 獲取當前是星期幾（0是星期日，1是星期一，...，6是星期六）
    const currentDay = today.getDay();
    
    // 計算上週一的日期（當前日期 - 當前星期幾 - 6）
    lastMonday.setDate(today.getDate() - currentDay - 6);
    
    // 使用今天作為結束日期
    const todayDate = today;
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const lastMondayStr = Utilities.formatDate(lastMonday, Session.getScriptTimeZone(), 'yyyy/MM/dd');
    const todayStr = Utilities.formatDate(todayDate, Session.getScriptTimeZone(), 'yyyy/MM/dd');
    const tomorrowStr = Utilities.formatDate(tomorrow, Session.getScriptTimeZone(), 'yyyy/MM/dd');

    
    const newResumes = searchAndProcessResumes(lastMondayStr, tomorrowStr);
    
    if (newResumes.length > 0) {
      writeToSheet(newResumes);
      // sendSummaryReport(newResumes.length, `${lastMondayStr} 至 ${todayStr}`);
    } else {
      Logger.log(`在 ${lastMondayStr} 至 ${todayStr} 期間沒有找到新的履歷。`);
    }
  } catch (e) {
    const recipient = Session.getActiveUser().getEmail();
    GmailApp.sendEmail(recipient, '【錯誤通知】履歷擷取指令碼發生錯誤', `錯誤詳情：\n${e.toString()}\n${e.stack}`);
    Logger.log(`發生錯誤：${e.toString()}`);
  }
}

/**
 * 【最終穩定版】搜尋並處理郵件，使用串聯排除法
 * @param {string} yesterdayString - 要搜尋的起始日期 (YYYY/MM/DD)
 * @param {string} todayString - 要搜尋的結束日期 (YYYY/MM/DD)
 * @return {Array<Array<string>>} 處理好的履歷資料陣列
 */
function searchAndProcessResumes(yesterdayString, todayString) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const processedIds = JSON.parse(scriptProperties.getProperty('processedIds') || '[]');
  
  // 【最終修正】將 OR 邏輯的排除，改成多個獨立的排除條件串聯，穩定性最高
  // [修改] 從 CONFIG 工作表讀取 Gmail 搜尋語法
  const baseQuery = getConfig('GMAIL_SEARCH_QUERY');

  // [升級] 支援搜尋多個 Gmail 標籤，以逗號分隔。若無設定則預設為 'INBOX'
  const labelNamesInput = getConfig('GMAIL_LABEL_NAME') || 'INBOX';
  const labels = labelNamesInput.split(',').map(label => label.trim()).filter(Boolean); // 解析、去除空白、過濾空值
  let labelQuery = '';

  if (labels.length > 1) {
    // 如果有多個標籤，組合成 {label1 OR label2} 的格式
    labelQuery = `label:{${labels.join(' OR ')}}`;
  } else if (labels.length === 1) {
    // 如果只有一個標籤
    labelQuery = `label:${labels[0]}`;
  } else {
    // 如果輸入為空或只有逗號，預設為 INBOX
    labelQuery = 'label:INBOX';
  }

  const dateQuery = `after:${yesterdayString} before:${todayString}`;

  if (!baseQuery) {
    const errorMsg = '錯誤：無法從 CONFIG 工作表讀取 "GMAIL_SEARCH_QUERY" 設定，請檢查工作表內容。';
    Logger.log(`[ERROR] searchAndProcessResumes: ${errorMsg}`);
    SpreadsheetApp.getUi().alert(errorMsg);
    throw new Error(errorMsg);
  }
  
  const searchQuery = `${baseQuery} ${labelQuery} ${dateQuery}`;
  Logger.log(`正在使用的搜尋語法: ${searchQuery}`);

  const threads = GmailApp.search(searchQuery);
  Logger.log('匹配的郵件 Thread #' + threads.length);
  const newResumes = [];
  const newProcessedIds = [...processedIds];

  threads.forEach(thread => {
    const message = thread.getMessages()[0];
    const messageId = message.getId();

    if (!processedIds.includes(messageId)) {
      const subject = message.getSubject();
      const receivedDate = message.getDate();
      const messageUrl = thread.getPermalink();

      let name = '無法解析姓名';
      // 規則 1: 嘗試匹配 "王小明履歷表..." 格式
      let nameMatch = subject.match(/^(.*?)履歷表/);
      if (nameMatch && nameMatch[1]) {
        name = nameMatch[1].trim();
      } else {
        // 規則 2 (備用): 嘗試匹配 "...】丁禹翔(..." 格式
        nameMatch = subject.match(/】(.*?)\(/);
        if (nameMatch && nameMatch[1]) {
          name = nameMatch[1].trim();
        }
      }

      newResumes.push([name, subject, receivedDate, messageUrl, messageId]);
      newProcessedIds.push(messageId);
    }
  });

  scriptProperties.setProperty('processedIds', JSON.stringify(newProcessedIds));
  
  return newResumes;
}

/**
 * 將資料寫入工作表
 * @param {Array<Array<string>>} data - 要寫入的資料
 */
function writeToSheet(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('履歷清單') || SpreadsheetApp.getActiveSpreadsheet().insertSheet('履歷清單');
  const lastRow = sheet.getLastRow();
  Logger.log('sheet [履歷清單] lastRow: ' + lastRow);
  
  // 檢查表格是否為空或只有標題列
  if (lastRow === 0) {
    // 表格為空，先寫入標題列
    sheet.appendRow(['應徵者姓名', '郵件主旨', '收到日期', '郵件連結', '郵件ID', '郵件內容HTML']);
    // 從第二行開始寫入資料
    sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
  } else {
    // 表格已有資料，從最後一行之後開始寫入
    sheet.getRange(lastRow + 1, 1, data.length, data[0].length).setValues(data);
  }

}

/**
 * 寄送摘要報告
 * @param {number} count - 新履歷的數量
 * @param {string} dateString - 報告的日期
 */
function sendSummaryReport(count, dateString) {
  const recipient = Session.getActiveUser().getEmail();
  const sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  const subject = `[自動通知] ${dateString} 履歷報告 - 共 ${count} 封`;
  const body = `您好，\n\n系統已於 ${new Date().toLocaleString()} 自動處理 ${dateString} 的履歷郵件。\n\n` +
               `本次共新增 ${count} 封新的履歷。\n\n` +
               `您可以點擊以下連結查看詳細清單：\n${sheetUrl}\n\n` +
               `此為系統自動發送郵件，請勿直接回覆。`;
  GmailApp.sendEmail(recipient, subject, body);
}

/**
 * 清除所有履歷
 */
function clearAllResumes() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('履歷清單');
  if (sheet) {
    const lastRow = sheet.getLastRow();
    // 如果工作表不只一列 (表示有資料列)，則清除標題列以外的所有內容
    if (lastRow > 1) {
      // getRange(startRow, startCol, numRows, numCols)
      sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
      Logger.log('已成功清除所有履歷資料列 (保留標題)。');
      ui.alert('已成功清除所有履歷 (標題列已保留)！');
    } else {
      Logger.log('履歷清單中沒有資料可清除。');
      ui.alert('履歷清單中沒有資料可清除。');
    }
  } else {
    ui.alert('找不到「履歷清單」工作表。');
  }
}

/**
 * 清除所有 Script Properties (用於測試)
 */
function clearScriptProperties() {
  const scriptProperties = PropertiesService.getScriptProperties();
  // scriptProperties.deleteAllProperties();
  scriptProperties.setProperty('processedIds', '[]');
  Logger.log('已成功清除所有 Script [processedIds] Properties。');
  SpreadsheetApp.getUi().alert('已成功清除所有 Script [processedIds] Properties！');
}

/**
 * [新增] 清除設定相關的 Script Properties
 * 會清除 folderId, geminiApiKey, cvReportReceiversEmail
 */
function deleteScriptProperties() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '確認清除設定？',
    '您確定要清除已儲存的 Google Drive Folder ID, Gemini API KEY, 以及簡歷快報收件人設定嗎？\n此操作無法復原。',
    ui.ButtonSet.OK_CANCEL);

  if (response == ui.Button.OK) {
    const scriptProperties = PropertiesService.getScriptProperties();
    scriptProperties.deleteProperty('folderId');
    scriptProperties.deleteProperty('geminiApiKey');
    scriptProperties.deleteProperty('cvReportReceiversEmail');
    
    Logger.log('已成功清除 folderId, geminiApiKey, cvReportReceiversEmail 等 Script Properties。');
    ui.alert('已成功清除相關設定！');
  } else {
    ui.alert('已取消操作。');
  }
}

/**
 * [新增] 提示使用者輸入 messageId 並從 processedIds 中移除。
 */
function promptAndRemoveMessageId() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '移除已處理的 Message ID',
    '請貼上您想要從「已處理清單」中移除的單一 Message ID：\n(這會讓系統在下次執行時重新處理該郵件)',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() == ui.Button.OK) {
    const messageId = response.getResponseText().trim();
    if (messageId) {
      removeMessageIdFromProcessed(messageId);
    } else {
      ui.alert('您沒有輸入任何內容。');
    }
  }
}

/**
 * [新增] 根據 messageId 從 script properties 'processedIds' 中移除指定的 ID。
 * @param {string} messageId - 要移除的郵件 ID。
 */
function removeMessageIdFromProcessed(messageId) {
  const FUNCTION_NAME = 'removeMessageIdFromProcessed';
  const ui = SpreadsheetApp.getUi();

  if (!messageId || typeof messageId !== 'string' || messageId.trim() === '') {
    ui.alert('未提供有效的 messageId。');
    return;
  }

  const scriptProperties = PropertiesService.getScriptProperties();
  const processedIdsJson = scriptProperties.getProperty('processedIds');
  
  if (!processedIdsJson) {
    ui.alert('「已處理清單」(processedIds) 為空，無需移除。');
    return;
  }

  let processedIds = JSON.parse(processedIdsJson);
  const initialLength = processedIds.length;
  
  const updatedIds = processedIds.filter(id => id !== messageId);

  if (updatedIds.length < initialLength) {
    scriptProperties.setProperty('processedIds', JSON.stringify(updatedIds));
    const successMsg = `成功從「已處理清單」中移除了 messageId: ${messageId}`;
    Logger.log(`[SUCCESS] ${FUNCTION_NAME}: ${successMsg}`);
    ui.alert(successMsg);
  } else {
    ui.alert(`在「已處理清單」中找不到指定的 messageId: ${messageId}`);
  }
}

/**
 * [最終修正版] 將郵件內容儲存為 .html 檔案，並將連結放回儲存格。
 */
function saveEmailAsHtmlFile() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('履歷清單');
  if (!sheet) {
    const errorMsg = '找不到名為 "履歷清單" 的工作表';
    Logger.log(`[ERROR] saveEmailAsHtmlFile: ${errorMsg}`);
    throw new Error(errorMsg);
    return;
  }
  
  const scriptProperties = PropertiesService.getScriptProperties();
  const folderId = scriptProperties.getProperty('folderId');

  if (!folderId) {
    const errorMsg = '錯誤：尚未設定目標資料夾 ID。請從選單設定。';
    Logger.log(`[ERROR] saveEmailAsHtmlFile: ${errorMsg}`);
    throw new Error(errorMsg);
    return;
  }

  const mailFolder = DriveApp.getFolderById(folderId);
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  for (let i = 1; i < values.length; i++) {
    const messageId = values[i][4]; // 假設 messageId 在 E 欄

    // 如果 messageId 存在且目標儲存格是空的
    if (messageId && !values[i][5]) { // 假設目標是 F 欄
      try {
        const message = GmailApp.getMessageById(messageId);
        const mailSubject = message.getSubject();
        const mailContent = message.getBody(); // 獲取完整的 HTML 內容
        const receivedDate = message.getDate();

        // --- 檔案名稱格式設定 ---
        const formattedDate = Utilities.formatDate(receivedDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
        const sanitizedSubject = mailSubject.replace(/[\/\\?%*:|"<>]/g, '-');
        
        const fileName = `${formattedDate} - ${messageId} - ${sanitizedSubject}`;
        
        const htmlFile = DriveApp.createFile(fileName, mailContent, MimeType.HTML);
        
        htmlFile.moveTo(mailFolder);
        
        const fileUrl = htmlFile.getUrl();

        sheet.getRange(i + 1, 6).setValue(fileUrl);

      } catch (e) {
        const errorMessage = `處理失敗: ${e.name} - ${e.message} (at line ${e.lineNumber})`;
        sheet.getRange(i + 1, 6).setValue(errorMessage);
      }
    }
  }
}


/**
 * [最終版] 將郵件內容儲存為 Google Doc，並將連結放回儲存格。
 */
function saveEmailContentToGoogleDoc() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('履歷清單');
  if (!sheet) {
    const errorMsg = '找不到名為 "履歷清單" 的工作表';
    Logger.log(`[ERROR] saveEmailContentToGoogleDoc: ${errorMsg}`);
    throw new Error(errorMsg);
    return;
  }

  const scriptProperties = PropertiesService.getScriptProperties();
  const folderId = scriptProperties.getProperty('folderId');

  if (!folderId) {
    const errorMsg = '錯誤：尚未設定目標資料夾 ID。請從選單設定。';
    Logger.log(`[ERROR] saveEmailContentToGoogleDoc: ${errorMsg}`);
    throw new Error(errorMsg);
    return;
  }

  const mailFolder = DriveApp.getFolderById(folderId);
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  for (let i = 1; i < values.length; i++) {
    const messageId = values[i][4]; // 假設 messageId 在 E 欄

    if (messageId && !values[i][5]) { // 假設目標是 F 欄
      try {
        const message = GmailApp.getMessageById(messageId);
        const mailSubject = message.getSubject();
        const mailContent = message.getBody();
        const receivedDate = message.getDate(); // 獲取郵件日期物件

        const formattedDate = Utilities.formatDate(receivedDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
        const sanitizedSubject = mailSubject.replace(/[\/\\?%*:|"<>]/g, '-');
        const docName = `${formattedDate} - ${messageId} - ${sanitizedSubject}`;
        
        // 建立 Google Doc
        const doc = DocumentApp.create(docName);
        // !! 注意：此處的 appendHtml 是一個已知錯誤，可能會失敗。
        // !! 建議使用 saveEmailAsHtmlFile() 函式。
        doc.getBody().appendHtml(mailContent); 
        doc.saveAndClose();

        const docFile = DriveApp.getFileById(doc.getId());
        docFile.moveTo(mailFolder);
        
        const docUrl = docFile.getUrl();

        sheet.getRange(i + 1, 6).setValue(docUrl);

      } catch (e) {
        sheet.getRange(i + 1, 6).setValue('處理失敗: ' + e.toString());
      }
    }
  }
}

/**
 * 根據 messageId 讀取 Gmail 郵件的 HTML 內容，
 * 並在寫入儲存格後，保持原有的列高。
 */
function getGmailMessagesByMessageId() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('履歷清單');
  if (!sheet) {
    Logger.log('[ERROR] getGmailMessagesByMessageId: 找不到名為 "履歷清單" 的工作表');
    // 在此情境下，不拋出錯誤，僅記錄日誌並返回，避免中斷手動操作
    return;
  }

  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  for (let i = 1; i < values.length; i++) {
    const messageId = values[i][4];

    if (messageId) {
      try {
        const message = GmailApp.getMessageById(messageId);
        const mailContent = message.getPlainBody();
        
        const targetCell = sheet.getRange(i + 1, 6);
        
        targetCell.setValue(mailContent);
        
        targetCell.setWrapStrategy(SpreadsheetApp.WrapStrategy.OVERFLOW);

      } catch (e) {
        const errorCell = sheet.getRange(i + 1, 6);
        errorCell.setValue('無法讀取郵件內容: ' + e.toString());
        errorCell.setWrapStrategy(SpreadsheetApp.WrapStrategy.OVERFLOW);
      }
    }
  }
}

/**
 * [最終穩健版 - 使用內建 Logger] 
 * 讀取 '履歷清單' 中已存檔的履歷 (HTML 或 Google Doc)，
 * 透過 Gemini API 將其內容轉換為 Markdown 格式，並使用內建 Logger 記錄過程。
 * 此版本已確認可處理標準的 Google Drive 檔案分享連結。
 */
function convertDocsToMarkdown() {
  const FUNCTION_NAME = 'convertDocsToMarkdown'; // 定義函式名稱供日誌使用
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('履歷清單');
  
  if (!sheet) {
    const errorMsg = '找不到名為 "履歷清單" 的工作表';
    Logger.log(`[ERROR] ${FUNCTION_NAME}: ${errorMsg}`);
    throw new Error(errorMsg);
    return;
  }

  const scriptProperties = PropertiesService.getScriptProperties();
  const folderId = scriptProperties.getProperty('folderId');

  if (!folderId) {
    const errorMsg = '錯誤：尚未設定目標資料夾 ID。請從選單設定。';
    Logger.log(`[ERROR] ${FUNCTION_NAME}: ${errorMsg}`);
    throw new Error(errorMsg);
    return;
  }

  const mailFolder = DriveApp.getFolderById(folderId);
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  const headers = values[0];

  // --- 檢查並新增所有需要的欄位 ---
  let mdUrlColIdx = headers.indexOf('Markdown 檔案連結');
  if (mdUrlColIdx === -1) {
    mdUrlColIdx = headers.length;
    sheet.getRange(1, mdUrlColIdx + 1).setValue('Markdown 檔案連結');
    Logger.log(`[INFO] ${FUNCTION_NAME}: 已新增 'Markdown 檔案連結' 欄位。`);
  }

  Logger.log(`[INFO] ${FUNCTION_NAME}: ======= 轉換作業開始，共 ${values.length - 1} 筆資料 =======`);

  for (let i = 1; i < values.length; i++) {
    const rowNum = i + 1;
    const fileUrl = values[i][5]; // F 欄的原始檔案連結
    const mdUrlCell = values[i][mdUrlColIdx]; // Markdown 連結欄位

    // --- 條件檢查 ---
    if (mdUrlCell) {
      continue; // 如果 G 欄已經有內容，靜默跳過
    }
    if (!fileUrl || typeof fileUrl !== 'string' || !fileUrl.includes('/d/')) {
      Logger.log(`[INFO] ${FUNCTION_NAME}: 第 ${rowNum} 列：F 欄無有效檔案連結，跳過。`);
      continue;
    }

    // --- 核心處理邏輯 ---
    try {
      // 這個正規表示式非常穩健，能從各種 Drive URL 中抓取 File ID
      const idMatch = fileUrl.match(/[-\w]{25,}/); 
      if (!idMatch) {
          throw new Error("無法從 URL 中解析出檔案 ID。");
      }
      const fileId = idMatch[0];
      
      const file = DriveApp.getFileById(fileId);
      const fileName = file.getName();
      const mimeType = file.getMimeType();
      let fileContent = '';

      if (mimeType === MimeType.GOOGLE_DOCS) {
        fileContent = DocumentApp.openById(fileId).getBody().getText();
      } else {
        // 適用於 HTML, TXT 等純文字檔案
        fileContent = file.getBlob().getDataAsString('UTF-8');
      }

      if (!fileContent) {
          throw new Error("讀取檔案內容為空。");
      }

      const html2md_prompt = getPrompt('html2md') || "請將接下來提供的 HTML 履歷內容，轉換為結構清晰的 Markdown 格式。"; // Fallback
      let markdownContent = callGeminiAPI(html2md_prompt + "\n\n" + fileContent);

      if (markdownContent) {
        // [新增] 移除 LLM 可能回傳的 Markdown 程式碼區塊標記
        // 使用正規表示式匹配開頭的 ```markdown 和結尾的 ```
        const fenceRegex = /^\s*```(?:markdown)?\s*\n?([\s\S]*?)\n?\s*```\s*$/;
        const match = markdownContent.match(fenceRegex);
        if (match && match[1]) {
          markdownContent = match[1].trim(); // 取出匹配到的內容並移除前後空白
        }

        const mdFileName = fileName.replace(/\.html?$/i, '') + '.md';
        const mdFile = mailFolder.createFile(mdFileName, markdownContent, MimeType.PLAIN_TEXT);          
        const mdFileUrl = mdFile.getUrl();
        sheet.getRange(rowNum, mdUrlColIdx + 1).setValue(mdFileUrl);
        Logger.log(`[INFO] ${FUNCTION_NAME}: 第 ${rowNum} 列：成功轉換檔案 "${fileName}"。`);

      } else {
        throw new Error("Gemini API 回傳內容為空或轉換失敗。");
      }

    } catch (e) {
      // --- 錯誤處理與日誌記錄 ---
      const errorMessage = e.toString();
      const errorStack = e.stack || '無堆疊資訊';
      sheet.getRange(rowNum, mdUrlColIdx + 1).setValue('處理失敗，請查看執行記錄');
      Logger.log(`[ERROR] ${FUNCTION_NAME}: 第 ${rowNum} 列處理失敗。\n  URL: ${fileUrl}\n  錯誤訊息: ${errorMessage}\n  堆疊: ${errorStack}`);
    }
  }
  Logger.log(`[INFO] ${FUNCTION_NAME}: ======= 轉換作業結束 =======`);
}

/**
 * [新增] 從 Markdown 檔案中提取聯絡資訊 (E-mail, 電話)
 * 遍歷 '履歷清單'，讀取 Markdown 履歷內容，並解析出聯絡資訊填入對應欄位。
 */
function extractContactInfoFromMarkdown() {
  const FUNCTION_NAME = 'extractContactInfoFromMarkdown';
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('履歷清單');
  
  if (!sheet) {
    const errorMsg = '找不到名為 "履歷清單" 的工作表';
    Logger.log(`[ERROR] ${FUNCTION_NAME}: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  let dataRange = sheet.getDataRange();
  let values = dataRange.getValues();
  let headers = values[0];

  // --- 檢查並獲取所需欄位的索引 ---
  let mdUrlColIdx = headers.indexOf('Markdown 檔案連結');
  let emailColIdx = headers.indexOf('E-mail');
  let phoneColIdx = headers.indexOf('聯絡電話');
  let codeColIdx = headers.indexOf('代碼'); // 新增：檢查「代碼」欄位

  if (mdUrlColIdx === -1) {
    const errorMsg = '找不到 "Markdown 檔案連結" 欄位。請先執行「依序轉換簡歷格式」。';
    Logger.log(`[ERROR] ${FUNCTION_NAME}: ${errorMsg}`);
    SpreadsheetApp.getUi().alert(errorMsg);
    return;
  }

  // --- 動態新增不存在的欄位 (從前往後插入，並在每次插入後更新 headers) ---
  let columnsAdded = false;
  if (emailColIdx === -1) { 
    sheet.insertColumnAfter(mdUrlColIdx + 1);
    sheet.getRange(1, mdUrlColIdx + 2).setValue('E-mail');
    columnsAdded = true; 
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]; // 更新 headers
  }
  if (phoneColIdx === -1) { 
    emailColIdx = headers.indexOf('E-mail'); // 重新獲取 E-mail 索引
    sheet.insertColumnAfter(emailColIdx + 1);
    sheet.getRange(1, emailColIdx + 2).setValue('聯絡電話');
    columnsAdded = true; 
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]; // 再次更新 headers
  }
  if (codeColIdx === -1) { 
    phoneColIdx = headers.indexOf('聯絡電話'); // 重新獲取電話索引
    sheet.insertColumnAfter(phoneColIdx + 1);
    sheet.getRange(1, phoneColIdx + 2).setValue('代碼');
    columnsAdded = true; 
  }

  // 如果新增了欄位，需要重新獲取資料和欄位索引
  if (columnsAdded) {
    dataRange = sheet.getDataRange();
    values = dataRange.getValues();
    headers = values[0];
    emailColIdx = headers.indexOf('E-mail');
    phoneColIdx = headers.indexOf('聯絡電話');
    codeColIdx = headers.indexOf('代碼'); // 新增：重新獲取「代碼」欄位索引
  }

  Logger.log(`[INFO] ${FUNCTION_NAME}: ======= 聯絡資訊提取作業開始，共 ${values.length - 1} 筆資料 =======`);

  for (let i = 1; i < values.length; i++) {
    const rowNum = i + 1;
    const markdownUrl = values[i][mdUrlColIdx];
    const emailCell = values[i][emailColIdx];
    const phoneCell = values[i][phoneColIdx];
    const codeCell = values[i][codeColIdx]; // 新增：獲取「代碼」儲存格內容

    // 條件：有 Markdown 連結，且 E-mail、電話或代碼欄位為空
    if (markdownUrl && (!emailCell || !phoneCell || !codeCell)) {
      try {
        const idMatch = markdownUrl.match(/[-\w]{25,}/);
        if (!idMatch) throw new Error("無法從 URL 中解析出檔案 ID。");
        
        const fileId = idMatch[0];
        const markdownContent = DriveApp.getFileById(fileId).getBlob().getDataAsString('UTF-8');

        if (!markdownContent) throw new Error("讀取的 Markdown 檔案內容為空。");

        // --- 提取 E-mail 和聯絡電話 (支援全形與半形冒號) ---
        const emailRegex = /(?:E-mail|Email)[:：]\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
        const phoneRegex = /聯絡電話[:：]\s*([\d-]+)/;
        const codeRegex = /代碼[:：]\s*(\w+)/; // 新增：提取「代碼」的正規表示式

        const emailMatch = markdownContent.match(emailRegex);
        const phoneMatch = markdownContent.match(phoneRegex);
        const codeMatch = markdownContent.match(codeRegex); // 新增：匹配「代碼」

        // 處理 E-mail
        if (!emailCell) { // 只有當儲存格為空時才處理
          if (emailMatch && emailMatch[1]) {
            sheet.getRange(rowNum, emailColIdx + 1).setValue(emailMatch[1].trim());
            Logger.log(`[INFO] ${FUNCTION_NAME}: 第 ${rowNum} 列：成功提取 E-mail。`);
          } else {
            sheet.getRange(rowNum, emailColIdx + 1).setValue('[N/A]');
          }
        }
        // 處理聯絡電話
        if (!phoneCell) { // 只有當儲存格為空時才處理
          if (phoneMatch && phoneMatch[1]) {
            sheet.getRange(rowNum, phoneColIdx + 1).setValue(phoneMatch[1].trim());
            Logger.log(`[INFO] ${FUNCTION_NAME}: 第 ${rowNum} 列：成功提取聯絡電話。`);
          } else {
            sheet.getRange(rowNum, phoneColIdx + 1).setValue('[N/A]');
          }
        }
        // 新增：處理代碼
        if (!codeCell) { // 只有當儲存格為空時才處理
          if (codeMatch && codeMatch[1]) {
            sheet.getRange(rowNum, codeColIdx + 1).setValue("'" + codeMatch[1].trim()); // 加上 ' 確保以文字格式儲存
            Logger.log(`[INFO] ${FUNCTION_NAME}: 第 ${rowNum} 列：成功提取代碼。`);
          } else {
            sheet.getRange(rowNum, codeColIdx + 1).setValue('[N/A]');
          }
        }

      } catch (e) {
        const errorMessage = `提取失敗: ${e.toString()}`;
        // 只在所有目標欄位都為空時寫入錯誤訊息，避免覆蓋已有的資料
        if (!emailCell && !phoneCell) {
          sheet.getRange(rowNum, emailColIdx + 1).setValue(errorMessage);
        }
        Logger.log(`[ERROR] ${FUNCTION_NAME}: 第 ${rowNum} 列處理失敗。\n  URL: ${markdownUrl}\n  錯誤訊息: ${e.stack}`);
      }
    }
  }
  Logger.log(`[INFO] ${FUNCTION_NAME}: ======= 聯絡資訊提取作業結束 =======`);
}

/**
 * 呼叫 Google Gemini API
 * @param {string} prompt - 要發送給模型的完整提示詞
 * @return {string|null} - 模型生成的回應內容，或在失敗時返回 null
 */
function callGeminiAPI(prompt) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const apiKey = scriptProperties.getProperty('geminiApiKey');

  if (!apiKey) {
    Logger.log('錯誤：找不到 geminiApiKey。請在指令碼屬性中設定。');
    SpreadsheetApp.getUi().alert('錯誤：找不到 Gemini API 金鑰。\n請先點擊「履歷小幫手」>「設定 Gemini API KEY」進行設定。');
    return null;
  }

  // 更新為與 fna-app-script 一致的 API URL，使用 gemini-2.5-flash 模型
  const geminiApiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  const payload = {
    "contents": [{
      "parts": [{
        "text": prompt
      }]
    }]
  };

  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'headers': {
      'x-goog-api-key': apiKey
    },
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true // 設定為 true 以便捕捉 HTTP 錯誤
  };

  try {
    const response = UrlFetchApp.fetch(geminiApiUrl, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode === 200) {
      const jsonResponse = JSON.parse(responseBody);
      return jsonResponse.candidates[0].content.parts[0].text;
    } else {
      Logger.log(`API 請求失敗，狀態碼: ${responseCode}, 回應: ${responseBody}`);
      return null;
    }
  } catch (e) {
    Logger.log(`呼叫 API 時發生例外錯誤: ${e.toString()}`);
    return null;
  }
}

/**
 * [新增] 讀取 PROMPTS 工作表中的設定值
 * @param {string} key - 要讀取的 Prompt 鍵值
 * @returns {string|null} - Prompt 的內容，或在找不到時返回 null
 */
const promptCache = {}; // 使用快取避免重複讀取
function getPrompt(key) {
  if (Object.keys(promptCache).length === 0) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('PROMPTS');
    if (!sheet) {
      Logger.log('[ERROR] getPrompt: 找不到名為 "PROMPTS" 的工作表。');
      SpreadsheetApp.getUi().alert('錯誤：找不到名為 "PROMPTS" 的設定工作表。');
      return null;
    }
    const data = sheet.getDataRange().getValues();
    // 從第二行開始讀取，跳過標題
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) { // 如果 Key 存在
        promptCache[data[i][0]] = data[i][1];
      }
    }
    Logger.log('[INFO] getPrompt: 已載入 PROMPTS 工作表設定。');
  }

  return promptCache[key] || null;
}

/**
 * [重構] 讀取 CONFIG 工作表中的設定值。
 * 新增 defaultValue 參數，當在工作表中找不到指定的 key 時，會自動將 key 和 defaultValue 新增到工作表中。
 * @param {string} key - 要讀取的設定鍵值
 * @param {string} [defaultValue] - (可選) 當 key 不存在時要設定的預設值。
 * @returns {string|null} - 設定的值，或在發生錯誤時返回 null。
 */
const configCache = {}; // 使用快取避免重複讀取
function getConfig(key, defaultValue = undefined) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CONFIG');
  if (!sheet) {
    Logger.log('[ERROR] getConfig: 找不到名為 "CONFIG" 的工作表。');
    SpreadsheetApp.getUi().alert('錯誤：找不到名為 "CONFIG" 的設定工作表。');
    return null;
  }

  // 如果快取是空的，就從工作表載入所有設定
  if (Object.keys(configCache).length === 0) {
    const data = sheet.getDataRange().getValues();
    // 從第二行開始讀取，跳過標題
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) { // 如果 Key 存在
        configCache[data[i][0]] = data[i][1];
      }
    }
    Logger.log('[INFO] getConfig: 已從 CONFIG 工作表載入快取。');
  }

  // 檢查快取中是否存在該 key
  if (key in configCache) {
    return configCache[key];
  } 
  // 如果 key 不存在，且提供了 defaultValue
  else if (defaultValue !== undefined) {
    Logger.log(`[INFO] getConfig: 在 CONFIG 中找不到 key: "${key}"。正在使用預設值並寫入工作表。`);
    try {
      sheet.appendRow([key, defaultValue]); // 在工作表最後新增此設定
      configCache[key] = defaultValue; // 更新快取
      return defaultValue;
    } catch (e) {
      Logger.log(`[ERROR] getConfig: 無法將新的設定值 ("${key}") 寫入 CONFIG 工作表: ${e.toString()}`);
      SpreadsheetApp.getUi().alert(`無法將新的設定值 ("${key}") 寫入 CONFIG 工作表。請檢查權限。`);
      return null;
    }
  } else {
    // 如果 key 不存在，且沒有提供 defaultValue
    const errorMsg = `設定錯誤：在 'CONFIG' 工作表中找不到必要的設定值 "${key}"，且未提供預設值。`;
    Logger.log(`[ERROR] getConfig: ${errorMsg}`);
    SpreadsheetApp.getUi().alert(errorMsg);
    return null;
  }
}
/**
 * [V8 - 新增儲存 Summary Prompt] 根據 Markdown 履歷連結，使用 Gemini API 進行評估。
 * - "評估報告" 欄位的內容，改為使用 PROMPTS.readCVReviewComment 提示詞，對完整報告進行二次摘要。
 * - 新增 "Prompt 檔案連結" 欄位，儲存用於該次評估的 Prompt 內容檔案連結。
 * - 新增 "Summary Prompt 檔案連結" 欄位，儲存用於產生摘要的 Prompt 內容檔案連結。
 * - "評估中..." 和錯誤訊息會顯示在 "評估報告" 欄位。
 * - 最終產出 "評估報告" 摘要和 "完整評估報告" 連結。
 */
function evaluateResumes() {
  const FUNCTION_NAME = 'evaluateResumes';
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('履歷清單');

  if (!sheet) {
    const errorMsg = '找不到名為 "履歷清單" 的工作表';
    Logger.log(`[ERROR] ${FUNCTION_NAME}: ${errorMsg}`);
    throw new Error(errorMsg);
    return;
  }
  
  const scriptProperties = PropertiesService.getScriptProperties();
  const folderId = scriptProperties.getProperty('folderId');
  if (!folderId) {
    const errorMsg = '錯誤：尚未設定目標資料夾 ID。請從選單設定。';
    Logger.log(`[ERROR] ${FUNCTION_NAME}: ${errorMsg}`);
    throw new Error(errorMsg);
    return;
  }
  const mailFolder = DriveApp.getFolderById(folderId);

  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  const headers = values[0];

  // --- 檢查並新增所有需要的欄位 ---
  let markdownUrlColIdx = headers.indexOf('Markdown 檔案連結');
  let summaryColIdx = headers.indexOf('評估報告');
  let fullReportColIdx = headers.indexOf('完整評估報告');
  let promptFileColIdx = headers.indexOf('Prompt 檔案連結');
  let summaryPromptFileColIdx = headers.indexOf('Summary Prompt 檔案連結'); // 新增：檢查 Summary Prompt 連結欄位

  if (markdownUrlColIdx === -1) {
    const errorMsg = '找不到 "Markdown 檔案連結" 欄位。請先執行「依序轉換簡歷格式」。';
    Logger.log(`[ERROR] ${FUNCTION_NAME}: ${errorMsg}`);
    throw new Error(errorMsg);
    return;
  }

  // 動態新增不存在的欄位
  let nextCol = headers.length + 1;
  if (summaryColIdx === -1) { summaryColIdx = nextCol - 1; sheet.getRange(1, nextCol++).setValue('評估報告'); }
  if (fullReportColIdx === -1) { fullReportColIdx = nextCol - 1; sheet.getRange(1, nextCol++).setValue('完整評估報告'); }
  if (promptFileColIdx === -1) { promptFileColIdx = nextCol - 1; sheet.getRange(1, nextCol++).setValue('Prompt 檔案連結'); }
  if (summaryPromptFileColIdx === -1) { summaryPromptFileColIdx = nextCol - 1; sheet.getRange(1, nextCol++).setValue('Summary Prompt 檔案連結'); } // 新增：如果欄位不存在則建立

  // 在迴圈外更新一次 headers 陣列，以確保後續的 values[i][colIdx] 能正確取值
  const updatedHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  summaryColIdx = updatedHeaders.indexOf('評估報告');
  fullReportColIdx = updatedHeaders.indexOf('完整評估報告');
  promptFileColIdx = updatedHeaders.indexOf('Prompt 檔案連結');
  summaryPromptFileColIdx = updatedHeaders.indexOf('Summary Prompt 檔案連結'); // 新增：更新 Summary Prompt 連結欄位的索引


  Logger.log(`[INFO] ${FUNCTION_NAME}: ======= 履歷評估作業開始，共 ${values.length - 1} 筆資料 =======`);

  // 從 CONFIG 工作表讀取 JD 和 Benchmark CV
  const jobDescription = getConfig('JobDescription');
  const benchmarkCV = getConfig('BENCHMARK_CV');

  if (!jobDescription || !benchmarkCV) {
    const errorMsg = '無法從 CONFIG 工作表讀取 "JobDescription" 或 "BENCHMARK_CV"，請檢查設定。';
    Logger.log(`[ERROR] ${FUNCTION_NAME}: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const basePrompt = getPrompt('cv_review');
  if (!basePrompt) {
    const errorMsg = '無法從 PROMPTS 工作表讀取 "cv_review"，請檢查設定。';
    Logger.log(`[ERROR] ${FUNCTION_NAME}: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  let promptWithJD = basePrompt.replace('[請在此貼上 Job Description 內容]', jobDescription);
  let promptWithBenchmark = promptWithJD.replace('[請在此貼上 Sample CV 內容]', benchmarkCV);

  for (let i = 1; i < values.length; i++) {
    const rowNum = i + 1;
    const markdownUrl = values[i][markdownUrlColIdx];
    const fullReportCellContent = values[i][fullReportColIdx];

    if (fullReportCellContent) continue;
    if (!markdownUrl || typeof markdownUrl !== 'string' || !markdownUrl.includes('/d/')) continue;

    const summaryCell = sheet.getRange(rowNum, summaryColIdx + 1);

    try {
      Logger.log(`[INFO] ${FUNCTION_NAME}: 正在處理第 ${rowNum} 列...`);
      summaryCell.setValue('評估中...');

      const idMatch = markdownUrl.match(/[-\w]{25,}/);
      if (!idMatch) throw new Error("無法從 URL 中解析出檔案 ID。");
      const fileId = idMatch[0];
      
      const mdFile = DriveApp.getFileById(fileId);
      const originalFileName = mdFile.getName();
      const candidateCVContent = mdFile.getBlob().getDataAsString('UTF-8');
      
      if (!candidateCVContent) throw new Error("讀取的候選人履歷內容為空。");

      const finalPrompt = promptWithBenchmark.replace('[請在此貼上新的候選人履歷]', `${candidateCVContent}`);
      
      const promptFileName = originalFileName.replace(/\.md$/i, '') + '_prompt.md';
      const promptFile = mailFolder.createFile(promptFileName, finalPrompt, MimeType.PLAIN_TEXT);
      const promptFileUrl = promptFile.getUrl();
      sheet.getRange(rowNum, promptFileColIdx + 1).setValue(promptFileUrl);
      
      Logger.log(`[INFO] ${FUNCTION_NAME}: 已保存 Prompt 內容到檔案: ${promptFileName}`);
      
      const evaluationResult = callGeminiAPI(finalPrompt);

      if (evaluationResult && !evaluationResult.startsWith('API')) {
        const summaryPromptTemplate = getPrompt('readCVReviewComment');
        if (!summaryPromptTemplate) {
            throw new Error("無法從 PROMPTS 工作表讀取 'readCVReviewComment'。");
        }

        const summaryPrompt = summaryPromptTemplate.replace('[在此放入完整報告內容]', evaluationResult);

        
        // --- 新增部分：將 summaryPrompt 儲存成檔案 ---
        const summaryPromptFileName = originalFileName.replace(/\.md$/i, '') + '_summary_prompt.md';
        const summaryPromptFile = mailFolder.createFile(summaryPromptFileName, summaryPrompt, MimeType.PLAIN_TEXT);
        const summaryPromptFileUrl = summaryPromptFile.getUrl();
        sheet.getRange(rowNum, summaryPromptFileColIdx + 1).setValue(summaryPromptFileUrl);
        Logger.log(`[INFO] ${FUNCTION_NAME}: 已保存 Summary Prompt 內容到檔案: ${summaryPromptFileName}`);
        // --- 新增結束 ---
        
        const summaryText = callGeminiAPI(summaryPrompt);

        if (summaryText) {
          summaryCell.setValue(summaryText);
          summaryCell.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
        } else {
          throw new Error("無法從完整報告中產生摘要。");
        }

        const combinedContent = `# 原始履歷\n\n${candidateCVContent}\n\n---\n\n# AI 評估報告\n\n${evaluationResult}`;
        const newFileName = originalFileName.replace(/\.md$/i, '') + '_評估報告.md';
        const newFile = mailFolder.createFile(newFileName, combinedContent, MimeType.PLAIN_TEXT);
        sheet.getRange(rowNum, fullReportColIdx + 1).setValue(newFile.getUrl());
        
        Logger.log(`[INFO] ${FUNCTION_NAME}: 第 ${rowNum} 列：成功產生評估報告。`);
      } else {
        throw new Error(evaluationResult || "Gemini API 回傳內容為空或評估失敗。");
      }

    } catch (e) {
      const errorMessage = `評估失敗: ${e.toString()}`;
      summaryCell.setValue(errorMessage);
      Logger.log(`[ERROR] ${FUNCTION_NAME}: 第 ${rowNum} 列處理失敗。\n  URL: ${markdownUrl}\n  錯誤訊息: ${e.stack}`);
    }
  }
  Logger.log(`[INFO] ${FUNCTION_NAME}: ======= 履歷評估作業結束 =======`);
}

/**
 * [輔助函式] 從評估報告文字中提取關鍵資訊
 * @param {string} reportText - 完整的評估報告文字
 * @returns {object|null} - 包含候選人姓名、核心優勢、潛在疑慮、推薦信心度的物件，或在失敗時返回 null
 */
function extractReportDetails(reportText) {
  const details = {};
  const patterns = {
    name: /\*\*候選人姓名\*\*：(.*?)\n/s,
    strength: /\*\*核心優勢\*\*：(.*?)\n/s,
    concern: /\*\*潛在疑慮\*\*：(.*?)\n/s,
    confidence: /\*\*推薦信心度\*\*：(.*?)\//s,
  };

  details.name = (reportText.match(patterns.name) || [])[1]?.trim() || '無法解析';
  details.strength = (reportText.match(patterns.strength) || [])[1]?.trim() || '無法解析';
  details.concern = (reportText.match(patterns.concern) || [])[1]?.trim() || '無法解析';
  details.confidence = (reportText.match(patterns.confidence) || [])[1]?.trim() || '無法解析';

  // 如果所有欄位都無法解析，則視為失敗
  return Object.values(details).every(v => v === '無法解析') ? null : details;
}

/**
 * [V3] 生成簡歷快報郵件。
 * 1. 檢查 '已發送' 欄位是否存在，若無則新增。
 * 2. 找出 '評估報告' 已產生但 '已發送' 欄位為空的履歷。
 * 3. 將這些履歷的評估摘要彙整成一封郵件。
 * 4. 郵件發送成功後，將對應履歷的 '已發送' 欄位更新為發送日期。
 */
function generateDailyCVReviewReport_v4() {
  const FUNCTION_NAME = 'generateDailyCVReviewReport_v4';
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('履歷清單');
  if (!sheet) {
    const errorMsg = '找不到名為 "履歷清單" 的工作表。';
    Logger.log(`[ERROR] ${FUNCTION_NAME}: ${errorMsg}`);
    throw new Error(errorMsg);
    return;
  }

  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  const headers = values[0];

  // --- 1. 檢查並獲取所需欄位的索引 ---
  const summaryColIdx = headers.indexOf('評估報告');
  const fullReportColIdx = headers.indexOf('完整評估報告');
  const summaryPromptFileColIdx = headers.indexOf('Summary Prompt 檔案連結'); // 新增：讀取 Summary Prompt 連結
  let sentStatusColIdx = headers.indexOf('已發送');

  // 如果 '已發送' 欄位不存在，則在最後一欄新增
  if (sentStatusColIdx === -1) {
    sentStatusColIdx = sheet.getLastColumn();
    sheet.getRange(1, sentStatusColIdx + 1).setValue('已發送');
    Logger.log(`[INFO] ${FUNCTION_NAME}: 已新增 '已發送' 欄位於第 ${sentStatusColIdx + 1} 欄。`);
  }

  // --- 2. 收集所有尚未發送的已評估履歷 ---
  let dailySummary = '';
  const reportsToSend = []; // 儲存待發送報告的資訊 {details, fullReportUrl, rowNum}

  for (let i = 1; i < values.length; i++) {
    const rowData = values[i];
    const summary = rowData[summaryColIdx];
    const summaryPromptUrl = rowData[summaryPromptFileColIdx];
    const sentStatus = rowData[sentStatusColIdx];
    const rowNum = i + 1;

    // 條件：評估報告已產生，且尚未發送
    if (summary && !sentStatus && summaryPromptUrl) {
      let reportContent = '';
      try {
        const idMatch = summaryPromptUrl.match(/[-\w]{25,}/);
        if (!idMatch) throw new Error("無法從 URL 中解析出檔案 ID。");
        
        const fileId = idMatch[0];
        const promptFileContent = DriveApp.getFileById(fileId).getBlob().getDataAsString('UTF-8');

        // 從 prompt 檔案中提取 <report> 區塊的完整報告內容
        const reportMatch = promptFileContent.match(/<report>([\s\S]*?)<\/report>/);
        if (!reportMatch || !reportMatch[1]) {
          Logger.log(`[WARN] ${FUNCTION_NAME}: 第 ${rowNum} 列的 Prompt 檔案中找不到 <report> 標籤，跳過。`);
          continue;
        }
        const fullReportText = reportMatch[1];
        const reportDetails = extractReportDetails(fullReportText);

        if (reportDetails) {
          reportsToSend.push({
            details: reportDetails,
            fullReportUrl: rowData[fullReportColIdx] || '#',
            rowNum: rowNum // 記錄行號以便後續更新
          });
        } else {
          Logger.log(`[WARN] ${FUNCTION_NAME}: 第 ${rowNum} 列的報告內容無法解析出關鍵字，跳過。`);
        }
      } catch (e) {
        Logger.log(`[ERROR] ${FUNCTION_NAME}: 處理第 ${rowNum} 列時發生錯誤: ${e.toString()}`);
      }
    }
  }

  // --- 3. 如果有需要發送的報告，則組合郵件並發送 ---
  if (reportsToSend.length > 0) {
    let emailBody = `# 簡歷評估報告\n\n本次更新 ${reportsToSend.length} 份履歷評估：\n\n---\n\n`;
    const sheetURL = SpreadsheetApp.getActiveSpreadsheet().getUrl();

    reportsToSend.forEach(report => {
      dailySummary += `### ${report.details.name}\n`
                   +  `- **推薦信心度**: ${report.details.confidence}\n`
                   +  `- **核心優勢**: ${report.details.strength}\n`
                   +  `- **潛在疑慮**: ${report.details.concern}\n\n`
                   +  `查看完整評估報告: ${report.fullReportUrl}\n\n`
                   +  `---\n\n`;
    });
    emailBody += `${dailySummary}\n* Google Sheet 總表連結：${sheetURL} *\n\n`;
    emailBody += `*本郵件為系統自動產生，請勿回覆。*`;
    
    const receivers = Session.getActiveUser().getEmail() + ';' 
      + (PropertiesService.getScriptProperties().getProperty('cvReportReceiversEmail') || '');
    const today = new Date();
    const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm');
    const subject = `簡歷Agent評估報告 - ${todayStr}`;
    
    // 使用進階選項來發送 Markdown 格式的郵件
    GmailApp.sendEmail(receivers, subject, "此郵件為 HTML 格式，請使用支援的客戶端查看。", {
      htmlBody: markdownToHtml(emailBody)
    });

    Logger.log(`[INFO] ${FUNCTION_NAME}: 已發送包含 ${reportsToSend.length} 份履歷的評估報告。`);

    // --- 4. 更新已發送履歷的狀態 ---
    const sentDate = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy/MM/dd');
    reportsToSend.forEach(report => {
      sheet.getRange(report.rowNum, sentStatusColIdx + 1).setValue(sentDate);
    });
    Logger.log(`[INFO] ${FUNCTION_NAME}: 已更新 ${reportsToSend.length} 筆履歷的發送狀態。`);
  } else {
    Logger.log(`[INFO] ${FUNCTION_NAME}: 沒有新的已評估履歷需要發送。`);
  }
}

/**
 * [新增] 簡易的 Markdown 轉 HTML 函式
 * @param {string} md - Markdown 格式的字串
 * @returns {string} - HTML 格式的字串
 */
function markdownToHtml(md) {
  // 處理標題 (### 和 #)
  md = md.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  md = md.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // 處理分隔線 (---)
  md = md.replace(/^---/gim, '<hr>');

  // 處理粗體 (**)
  md = md.replace(/\*\*(.*?)\*\*/gim, '<b>$1</b>');

  // 處理清單項目 (-)
  md = md.replace(/^\- (.*$)/gim, '<li>$1</li>');
  // 將連續的 <li> 包在 <ul> 中
  md = md.replace(/<li>(.*?)<\/li>/g, '<ul><li>$1</li></ul>')
         .replace(/<\/ul>\s*<ul>/g, '');

  // 處理換行，將 Markdown 的換行符轉為 <br>
  md = md.replace(/\n/g, '<br>');

  return md;
}

/**
 * [新增] 依序發送面試邀請郵件
 * 找出評分超過 CV_RANK_THREADSHOLD 且尚未發送邀請的履歷，並自動寄送面試邀請。
 */
function sendInvitationEmails() {
  const FUNCTION_NAME = 'sendInvitationEmails';
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('履歷清單');
  if (!sheet) {
    const errorMsg = '找不到名為 "履歷清單" 的工作表。';
    Logger.log(`[ERROR] ${FUNCTION_NAME}: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  const headers = values[0];

  // --- 獲取所需欄位的索引 ---
  const nameColIdx = headers.indexOf('應徵者姓名');
  const summaryColIdx = headers.indexOf('評估報告');
  const messageIdColIdx = headers.indexOf('郵件ID');
  const sentStatusColIdx = headers.indexOf('已發送'); // 找到「已發送」欄位的索引
  let invitationSentColIdx = headers.indexOf('已發送邀請郵件');

  // 如果 '已發送邀請郵件' 欄位不存在，則新增它
  if (invitationSentColIdx === -1) {
    if (sentStatusColIdx !== -1) {
      // 如果「已發送」欄位存在，則在其前面插入新欄位
      const targetCol = sentStatusColIdx + 1;
      sheet.insertColumnBefore(targetCol);
      sheet.getRange(1, targetCol).setValue('已發送邀請郵件');
      invitationSentColIdx = sentStatusColIdx; // 更新索引
      Logger.log(`[INFO] ${FUNCTION_NAME}: 已在 '已發送' 欄位前新增 '已發送邀請郵件' 欄位。`);
    } else {
      // 如果「已發送」欄位也不存在，則在最後新增
      invitationSentColIdx = sheet.getLastColumn();
      sheet.getRange(1, invitationSentColIdx + 1).setValue('已發送邀請郵件');
      Logger.log(`[INFO] ${FUNCTION_NAME}: 已新增 '已發送邀請郵件' 欄位於第 ${invitationSentColIdx + 1} 欄。`);
    }
  }

  // --- 獲取設定值 ---
  const defaultSubject = '關於 [您的公司名稱] [職缺名稱] 職位的面試邀請 - {{應徵者姓名}}';
  const defaultBody = `親愛的 {{應徵者姓名}} 您好：

感謝您應徵 [您的公司名稱] 的 [職缺名稱] 職位。

我們在仔細閱讀您的履歷後，對您的專業背景與經歷留下了深刻的印象，認為您非常符合我們的需求。因此，我們誠摯地邀請您進入下一階段的面試流程，讓我們能有更深入的交流。

請問您下週有哪些時段方便進行線上面談呢？

期待您的回覆！

祝 順心

[您的姓名或 HR 部門]
[您的公司名稱]
`;

  // 使用重構後的 getConfig，如果找不到 key，會自動從 sheet-CONFIG.csv 的內容建立預設值
  const rankThreshold = parseFloat(getConfig('CV_RANK_THREADSHOLD', '8'));
  let emailSubjectTemplate = getConfig('INVITATION_EMAIL_SUBJECT', defaultSubject);
  let emailBodyTemplate = getConfig('INVITATION_EMAIL_BODY', defaultBody);

  if (!emailSubjectTemplate || !emailBodyTemplate) {
    const errorMsg = '找不到 "INVITATION_EMAIL_SUBJECT" 或 "INVITATION_EMAIL_BODY" 的郵件範本，請在 CONFIG 工作表中設定。';
    Logger.log(`[ERROR] ${FUNCTION_NAME}: ${errorMsg}`);
    SpreadsheetApp.getUi().alert(errorMsg);
    return;
  }

  // [新增] 檢查是否為未經修改的預設值，如果是，則提示使用者並停止執行
  if (emailSubjectTemplate.includes('[您的公司名稱]') || emailBodyTemplate.includes('[您的公司名稱]')) {
    const logMsg = '偵測到您尚未設定面試邀請郵件範本 (INVITATION_EMAIL_SUBJECT, INVITATION_EMAIL_BODY)。系統已為您新增預設值，但需要您手動修改如 "[您的公司名稱]" 等資訊。郵件發送流程已中止。';
    Logger.log(`[WARN] ${FUNCTION_NAME}: ${logMsg}`);
    return;
  }

  Logger.log(`[INFO] ${FUNCTION_NAME}: ======= 開始檢查並發送面試邀請 (分數門檻: ${rankThreshold}) =======`);
  let emailsSentCount = 0;

  for (let i = 1; i < values.length; i++) {
    const rowData = values[i];
    const rowNum = i + 1;

    const summary = rowData[summaryColIdx];
    const invitationSentStatus = rowData[invitationSentColIdx];

    // 條件：有評估報告、尚未發送邀請
    if (summary && !invitationSentStatus) {
      try {
        // 從 "推薦信心度：8 / 10\n總體建議：建議面試" 中提取分數
        const scoreMatch = summary.match(/推薦信心度：\s*(\d+(\.\d+)?)/);
        if (!scoreMatch || !scoreMatch[1]) {
          continue; // 找不到分數，跳過
        }

        const score = parseFloat(scoreMatch[1]);

        // 檢查分數是否超過門檻
        if (score >= rankThreshold) {
          const applicantName = rowData[nameColIdx] || '應徵者';
          const messageId = rowData[messageIdColIdx];

          if (!messageId) {
            Logger.log(`[WARN] ${FUNCTION_NAME}: 第 ${rowNum} 列分數達標但缺少郵件ID，無法回覆。`);
            continue;
          }

          const originalMessage = GmailApp.getMessageById(messageId);
          const recipientEmail = originalMessage.getFrom(); // 取得原始寄件人 email

          // 替換範本中的變數
          let emailSubject = emailSubjectTemplate.replace('{{應徵者姓名}}', applicantName);
          let emailBody = emailBodyTemplate.replace(/{{應徵者姓名}}/g, applicantName);

          // 將純文字郵件內文轉換為保留換行的 HTML 格式
          const htmlBody = emailBody.replace(/\n/g, '<br>');

          // 以回覆的方式寄送郵件
          originalMessage.reply(emailBody, {
            htmlBody: htmlBody,
            name: '招募團隊' // 可自訂寄件人名稱
          });

          // 更新工作表狀態
          const sentDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm');
          sheet.getRange(rowNum, invitationSentColIdx + 1).setValue(sentDate);
          emailsSentCount++;
          Logger.log(`[SUCCESS] ${FUNCTION_NAME}: 已向 "${applicantName}" (${recipientEmail}) 發送面試邀請。`);
        }
      } catch (e) {
        const errorMessage = `處理失敗: ${e.toString()}`;
        sheet.getRange(rowNum, invitationSentColIdx + 1).setValue(errorMessage);
        Logger.log(`[ERROR] ${FUNCTION_NAME}: 處理第 ${rowNum} 列時發生錯誤: ${e.stack}`);
      }
    }
  }

  if (emailsSentCount > 0) {
    Logger.log(`[INFO] ${FUNCTION_NAME}: ======= 作業結束，共發送了 ${emailsSentCount} 封面試邀請。 =======`);
    SpreadsheetApp.getUi().alert(`作業完成！共發送了 ${emailsSentCount} 封面試邀請。`);
  } else {
    Logger.log(`[INFO] ${FUNCTION_NAME}: ======= 作業結束，沒有找到需要發送新邀請的履歷。 =======`);
  }
}
