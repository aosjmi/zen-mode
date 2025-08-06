// 許可サイトのデフォルトリスト
const DEFAULT_ALLOWED_SITES = [
  "github.com",
  "stackoverflow.com", 
  "developer.mozilla.org",
  "docs.google.com",
  "gmail.com",
  "google.com",
  "wikipedia.org",
  "localhost"
];

// 拡張機能インストール時の初期化
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({ 
    blockingEnabled: false,
    allowedSites: DEFAULT_ALLOWED_SITES,
    timerMode: false,
    timerEndTime: null,
    timerDuration: 30 // デフォルト30分
  });
  updateIcon(false);
});

// 拡張機能開始時（再起動含む）の初期化
chrome.runtime.onStartup.addListener(async () => {
  await checkTimerStatus();
});

// Service Worker起動時の初期化
chrome.runtime.onInstalled.addListener(async () => {
  await checkTimerStatus();
});

// ポップアップからのメッセージを受信
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  
  if (message.action === 'toggleBlocking') {
    toggleBlocking().then(result => {
      console.log('Toggle result:', result);
      sendResponse(result);
    }).catch(error => {
      console.error('Toggle error:', error);
      sendResponse({ error: error.message });
    });
    return true;
  }
  
  if (message.action === 'startTimer') {
    startTimerMode(message.duration).then(result => {
      console.log('Timer start result:', result);
      sendResponse(result);
    }).catch(error => {
      console.error('Timer start error:', error);
      sendResponse({ error: error.message });
    });
    return true;
  }
  
  if (message.action === 'getStatus') {
    getFullStatus().then(result => {
      console.log('Status result:', result);
      sendResponse(result);
    }).catch(error => {
      console.error('Status error:', error);
      sendResponse({ error: error.message });
    });
    return true;
  }
  
  if (message.action === 'getAllowedSites') {
    getAllowedSites().then(result => {
      console.log('Sites result:', result);
      sendResponse(result);
    }).catch(error => {
      console.error('Sites error:', error);
      sendResponse({ error: error.message });
    });
    return true;
  }
  
  if (message.action === 'updateAllowedSites') {
    updateAllowedSites(message.sites).then(result => {
      console.log('Update sites result:', result);
      sendResponse(result);
    }).catch(error => {
      console.error('Update sites error:', error);
      sendResponse({ error: error.message });
    });
    return true;
  }
  
  if (message.action === 'getRemainingTime') {
    getRemainingTime().then(result => {
      console.log('Remaining time result:', result);
      sendResponse(result);
    }).catch(error => {
      console.error('Remaining time error:', error);
      sendResponse({ error: error.message });
    });
    return true;
  }
  
  console.log('Unknown action:', message.action);
  sendResponse({ error: 'Unknown action' });
});

// アラーム設定
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'focusTimer') {
    await endTimerMode();
  }
});

// タイマーモード開始
async function startTimerMode(durationMinutes) {
  const endTime = Date.now() + (durationMinutes * 60 * 1000);
  
  await chrome.storage.local.set({
    blockingEnabled: true,
    timerMode: true,
    timerEndTime: endTime,
    timerDuration: durationMinutes
  });
  
  // アラーム設定
  await chrome.alarms.create('focusTimer', {
    when: endTime
  });
  
  await enableAllowListMode();
  updateIcon(true, true);
  
  console.log(`タイマーモード開始: ${durationMinutes}分間`);
  return true;
}

// タイマーモード終了
async function endTimerMode() {
  await chrome.storage.local.set({
    blockingEnabled: false,
    timerMode: false,
    timerEndTime: null
  });
  
  await chrome.alarms.clear('focusTimer');
  await disableAllowListMode();
  updateIcon(false, false);
  
  console.log('タイマーモード終了');
  
// 通知表示（Firefox対応）
async function showNotification(title, message) {
  if (chrome.notifications) {
    try {
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/border-48.png',
        title: title,
        message: message
      });
    } catch (error) {
      console.log('通知表示エラー:', error);
    }
  }
}
}

// タイマー状態チェック（起動時）
async function checkTimerStatus() {
  const { timerMode, timerEndTime } = await chrome.storage.local.get(['timerMode', 'timerEndTime']);
  
  if (timerMode && timerEndTime) {
    const now = Date.now();
    
    if (now >= timerEndTime) {
      // タイマー期限切れ
      await endTimerMode();
    } else {
      // まだタイマー中 - ブロック状態を復元
      await chrome.storage.local.set({ blockingEnabled: true });
      await enableAllowListMode();
      updateIcon(true, true);
      
      // 残り時間でアラーム再設定
      await chrome.alarms.create('focusTimer', {
        when: timerEndTime
      });
      
      console.log('タイマーモード復元完了');
    }
  }
}

// 通常のブロック機能切り替え（タイマーモード中は無効）
async function toggleBlocking() {
  const { timerMode } = await chrome.storage.local.get(['timerMode']);
  
  if (timerMode) {
    return { error: 'タイマーモード中は無効化できません' };
  }
  
  const { blockingEnabled } = await chrome.storage.local.get(['blockingEnabled']);
  const newState = !blockingEnabled;
  
  await chrome.storage.local.set({ blockingEnabled: newState });
  
  if (newState) {
    await enableAllowListMode();
  } else {
    await disableAllowListMode();
  }
  
  updateIcon(newState, false);
  return { success: true, enabled: newState };
}

// 残り時間取得
async function getRemainingTime() {
  const { timerMode, timerEndTime } = await chrome.storage.local.get(['timerMode', 'timerEndTime']);
  
  if (!timerMode || !timerEndTime) {
    return null;
  }
  
  const remaining = Math.max(0, timerEndTime - Date.now());
  return Math.ceil(remaining / 1000); // 秒単位
}

// 詳細ステータス取得
async function getFullStatus() {
  const { blockingEnabled, timerMode, timerDuration } = await chrome.storage.local.get([
    'blockingEnabled', 'timerMode', 'timerDuration'
  ]);
  
  return {
    blockingEnabled: blockingEnabled || false,
    timerMode: timerMode || false,
    timerDuration: timerDuration || 30
  };
}

// 許可リストモード有効化
async function enableAllowListMode() {
  const { allowedSites } = await chrome.storage.local.get(['allowedSites']);
  
  await disableAllowListMode();
  
  const allowRules = [];
  let ruleId = 1;
  
  for (const site of allowedSites) {
    allowRules.push({
      id: ruleId++,
      priority: 2,
      action: { type: "allow" },
      condition: {
        urlFilter: `*://${site}/*`,
        resourceTypes: ["main_frame"]
      }
    });
    
    allowRules.push({
      id: ruleId++,
      priority: 2,
      action: { type: "allow" },
      condition: {
        urlFilter: `*://www.${site}/*`,
        resourceTypes: ["main_frame"]
      }
    });
  }
  
  const blockAllRule = {
    id: 999,
    priority: 1,
    action: { type: "block" },
    condition: {
      urlFilter: "*",
      resourceTypes: ["main_frame"]
    }
  };
  
  try {
    if (allowRules.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: allowRules
      });
    }
    
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [blockAllRule]
    });
  } catch (error) {
    console.error('ブロックルール設定エラー:', error);
  }
}

// 許可リストモード無効化
async function disableAllowListMode() {
  try {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIds = existingRules.map(rule => rule.id);
    
    if (ruleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIds
      });
    }
  } catch (error) {
    console.error('ブロックルール削除エラー:', error);
  }
}

// 許可サイト一覧を取得
async function getAllowedSites() {
  const { allowedSites } = await chrome.storage.local.get(['allowedSites']);
  return allowedSites || DEFAULT_ALLOWED_SITES;
}

// 許可サイト一覧を更新
async function updateAllowedSites(newSites) {
  await chrome.storage.local.set({ allowedSites: newSites });
  
  const { blockingEnabled } = await chrome.storage.local.get(['blockingEnabled']);
  if (blockingEnabled) {
    await enableAllowListMode();
  }
  
  return true;
}

// 拡張機能アイコンの更新
function updateIcon(enabled, isTimer) {
  const badgeText = enabled ? (isTimer ? "⏰" : "ON") : "";
  const badgeColor = enabled ? (isTimer ? "#ff8800" : "#ff4444") : "#666666";
  const title = enabled ? 
    (isTimer ? "集中モード実行中" : "許可リストモード有効") : 
    "許可リストモード無効";
  
  chrome.action.setBadgeText({ text: badgeText });
  chrome.action.setBadgeBackgroundColor({ color: badgeColor });
  chrome.action.setTitle({ title });
}
