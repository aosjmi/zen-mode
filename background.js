
const DEFAULT_ALLOWED_SITES = [
    "github.com",
    "developer.mozilla.org",
    "docs.google.com",
    "gmail.com",
    "google.com",
    "wikipedia.org",
    "localhost",
    "git.local",
    "dictionary.cambridge.org",
    "claude.ai",
    "duckduckgo.com",
    "proton.me"
];

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({ 
    blockingEnabled: false,
    allowedSites: DEFAULT_ALLOWED_SITES,
    timerMode: false,
    timerEndTime: null,
    timerDuration: 60
  });
  updateIcon(false);
});

chrome.runtime.onStartup.addListener(async () => {
  await checkTimerStatus();
});

chrome.runtime.onInstalled.addListener(async () => {
  await checkTimerStatus();
});

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

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'focusTimer') {
    await endTimerMode();
  }
});

async function startTimerMode(durationMinutes) {
  const endTime = Date.now() + (durationMinutes * 60 * 1000);
  
  await chrome.storage.local.set({
    blockingEnabled: true,
    timerMode: true,
    timerEndTime: endTime,
    timerDuration: durationMinutes
  });
  
  await chrome.alarms.create('focusTimer', {
    when: endTime
  });
  
  await enableAllowListMode();
  updateIcon(true, true);
  
  console.log(`Time Mode: ${durationMinutes}m`);
  return true;
}

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
      console.log('error:', error);
    }
  }
}
}

async function checkTimerStatus() {
  const { timerMode, timerEndTime } = await chrome.storage.local.get(['timerMode', 'timerEndTime']);
  
  if (timerMode && timerEndTime) {
    const now = Date.now();
    
    if (now >= timerEndTime) {

      await endTimerMode();
    } else {

      await chrome.storage.local.set({ blockingEnabled: true });
      await enableAllowListMode();
      updateIcon(true, true);
      
      await chrome.alarms.create('focusTimer', {
        when: timerEndTime
      });
      
      console.log('タイマーモード復元完了');
    }
  }
}

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

async function getRemainingTime() {
  const { timerMode, timerEndTime } = await chrome.storage.local.get(['timerMode', 'timerEndTime']);
  
  if (!timerMode || !timerEndTime) {
    return null;
  }
  
  const remaining = Math.max(0, timerEndTime - Date.now());
  return Math.ceil(remaining / 1000);
}

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

async function getAllowedSites() {
  const { allowedSites } = await chrome.storage.local.get(['allowedSites']);
  return allowedSites || DEFAULT_ALLOWED_SITES;
}

async function updateAllowedSites(newSites) {
  await chrome.storage.local.set({ allowedSites: newSites });
  
  const { blockingEnabled } = await chrome.storage.local.get(['blockingEnabled']);
  if (blockingEnabled) {
    await enableAllowListMode();
  }
  
  return true;
}

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
