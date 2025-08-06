document.addEventListener('DOMContentLoaded', async () => {
  const toggleButton = document.getElementById('toggleButton');
  const statusDiv = document.getElementById('status');
  const newSiteInput = document.getElementById('newSiteInput');
  const addSiteButton = document.getElementById('addSiteButton');
  const siteList = document.getElementById('siteList');
  
  // タイマー要素
  const timerInput = document.getElementById('timerInput');
  const startTimerBtn = document.getElementById('startTimerBtn');
  const timerStatus = document.getElementById('timerStatus');
  const remainingTime = document.getElementById('remainingTime');
  const timerWarning = document.getElementById('timerWarning');
  const timerControls = document.getElementById('timerControls');
  
  let allowedSites = [];
  let updateInterval = null;
  
  // 初期化
  await updateUI();
  await loadAllowedSites();
  
  // プリセットボタン
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      timerInput.value = btn.dataset.minutes;
    });
  });
  
  // タイマー開始ボタン
  startTimerBtn.addEventListener('click', async () => {
    const duration = parseInt(timerInput.value);
    
    if (!duration || duration < 1 || duration > 480) {
      alert('1分から8時間の範囲で設定してください');
      return;
    }
    
    startTimerBtn.disabled = true;
    startTimerBtn.textContent = '開始中...';
    
    try {
      await sendMessage({ 
        action: 'startTimer', 
        duration: duration 
      });
      
      await updateUI();
      startTimerCountdown();
    } catch (error) {
      console.error('タイマー開始エラー:', error);
      alert('タイマーの開始に失敗しました');
    }
    
    startTimerBtn.disabled = false;
    startTimerBtn.textContent = '集中開始';
  });
  
  // 通常モード切り替えボタン
  toggleButton.addEventListener('click', async () => {
    toggleButton.classList.add('loading');
    toggleButton.disabled = true;
    
    try {
      const result = await sendMessage({ action: 'toggleBlocking' });
      
      if (result.error) {
        alert(result.error);
      } else {
        await updateUI();
      }
    } catch (error) {
      console.error('モード切り替えエラー:', error);
      statusDiv.textContent = 'エラーが発生しました';
      statusDiv.className = 'status';
    } finally {
      toggleButton.classList.remove('loading');
      toggleButton.disabled = false;
    }
  });
  
  // サイト追加
  addSiteButton.addEventListener('click', addSite);
  newSiteInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addSite();
    }
  });
  
  // タイマーカウントダウン開始
  function startTimerCountdown() {
    if (updateInterval) {
      clearInterval(updateInterval);
    }
    
    updateInterval = setInterval(async () => {
      try {
        const remainingSeconds = await sendMessage({ action: 'getRemainingTime' });
        
        if (remainingSeconds === null || remainingSeconds <= 0) {
          clearInterval(updateInterval);
          updateInterval = null;
          await updateUI();
        } else {
          updateRemainingTimeDisplay(remainingSeconds);
        }
      } catch (error) {
        console.error('残り時間取得エラー:', error);
      }
    }, 1000);
  }
  
  // 残り時間表示更新
  function updateRemainingTimeDisplay(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    let timeString = '';
    if (hours > 0) {
      timeString = `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      timeString = `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    
    remainingTime.textContent = `残り時間: ${timeString}`;
    remainingTime.style.display = 'block';
  }
  
  // UI更新
  async function updateUI() {
    try {
      const status = await sendMessage({ action: 'getStatus' });
      const { blockingEnabled, timerMode } = status;
      
      // タイマー状態の表示
      if (timerMode) {
        timerStatus.textContent = '🔥 集中モード実行中';
        timerStatus.className = 'timer-status active';
        timerWarning.style.display = 'block';
        timerControls.style.display = 'none';
        
        // サイト管理UI無効化
        newSiteInput.disabled = true;
        newSiteInput.placeholder = '集中モード中は追加不可';
        addSiteButton.disabled = true;
        addSiteButton.textContent = '追加不可';
        
        // 残り時間の初期表示
        const remainingSeconds = await sendMessage({ action: 'getRemainingTime' });
        if (remainingSeconds > 0) {
          updateRemainingTimeDisplay(remainingSeconds);
          startTimerCountdown();
        }
      } else {
        timerStatus.textContent = 'タイマー設定可能';
        timerStatus.className = 'timer-status';
        timerWarning.style.display = 'none';
        timerControls.style.display = 'flex';
        remainingTime.style.display = 'none';
        
        // サイト管理UI有効化
        newSiteInput.disabled = false;
        newSiteInput.placeholder = 'example.com';
        addSiteButton.disabled = false;
        addSiteButton.textContent = '追加';
        
        if (updateInterval) {
          clearInterval(updateInterval);
          updateInterval = null;
        }
      }
      
      // ボタンとステータスの更新
      if (blockingEnabled) {
        if (timerMode) {
          toggleButton.textContent = '集中モード中';
          toggleButton.className = 'toggle-button active';
          toggleButton.disabled = true;
          statusDiv.textContent = '🔥 集中モード実行中';
          statusDiv.className = 'status timer';
        } else {
          toggleButton.textContent = '許可モード無効化';
          toggleButton.className = 'toggle-button active';
          toggleButton.disabled = false;
          statusDiv.textContent = '🚫 許可リストモード有効';
          statusDiv.className = 'status enabled';
        }
      } else {
        toggleButton.textContent = '許可モード有効化';
        toggleButton.className = 'toggle-button';
        toggleButton.disabled = false;
        statusDiv.textContent = '✅ 通常モード';
        statusDiv.className = 'status disabled';
      }
      
      await updateSiteList();
      
      // 削除ボタンの状態も更新
      await updateRemoveButtonsState();
    } catch (error) {
      console.error('UI更新エラー:', error);
      statusDiv.textContent = '状態取得エラー';
      statusDiv.className = 'status';
    }
  }
  
  // サイト追加
  async function addSite() {
    // タイマーモード中は追加を無効化
    const status = await sendMessage({ action: 'getStatus' });
    if (status.timerMode) {
      alert('集中モード中はサイトの追加はできません');
      return;
    }
    
    const site = newSiteInput.value.trim();
    if (!site) return;
    
    const domain = normalizeDomain(site);
    if (!domain) {
      alert('有効なドメイン名を入力してください (例: example.com)');
      return;
    }
    
    if (allowedSites.includes(domain)) {
      alert('そのサイトは既に追加されています');
      return;
    }
    
    allowedSites.push(domain);
    await updateAllowedSites();
    newSiteInput.value = '';
  }
  
  // サイト削除
  async function removeSite(domain) {
    // タイマーモード中は削除を無効化
    const status = await sendMessage({ action: 'getStatus' });
    if (status.timerMode) {
      alert('集中モード中はサイトの削除はできません');
      return;
    }
    
    allowedSites = allowedSites.filter(site => site !== domain);
    await updateAllowedSites();
  }
  
  // 許可サイト更新
  async function updateAllowedSites() {
    try {
      await sendMessage({ 
        action: 'updateAllowedSites', 
        sites: allowedSites 
      });
      renderSiteList();
    } catch (error) {
      console.error('許可サイト更新エラー:', error);
    }
  }
  
  // 許可サイト読み込み
  async function loadAllowedSites() {
    try {
      allowedSites = await sendMessage({ action: 'getAllowedSites' });
      renderSiteList();
    } catch (error) {
      console.error('許可サイト読み込みエラー:', error);
    }
  }
  
  // サイト一覧表示
  function renderSiteList() {
    siteList.innerHTML = '';
    
    allowedSites.forEach(site => {
      const siteItem = document.createElement('div');
      siteItem.className = 'site-item';
      
      const siteText = document.createElement('span');
      siteText.textContent = site;
      
      const removeButton = document.createElement('button');
      removeButton.className = 'remove-button';
      removeButton.textContent = '削除';
      removeButton.onclick = () => removeSite(site);
      
      siteItem.appendChild(siteText);
      siteItem.appendChild(removeButton);
      siteList.appendChild(siteItem);
    });
    
    // タイマーモード中は削除ボタンを無効化
    updateRemoveButtonsState();
  }
  
  // 削除ボタンの状態更新
  async function updateRemoveButtonsState() {
    try {
      const status = await sendMessage({ action: 'getStatus' });
      const removeButtons = document.querySelectorAll('.remove-button');
      
      removeButtons.forEach(button => {
        if (status.timerMode) {
          button.disabled = true;
          button.textContent = '削除不可';
          button.style.opacity = '0.5';
          button.style.cursor = 'not-allowed';
        } else {
          button.disabled = false;
          button.textContent = '削除';
          button.style.opacity = '1';
          button.style.cursor = 'pointer';
        }
      });
    } catch (error) {
      console.error('削除ボタン状態更新エラー:', error);
    }
  }
  
  // サイト一覧表示
  async function updateSiteList() {
    await loadAllowedSites();
  }
  
  // ドメイン正規化
  function normalizeDomain(input) {
    let domain = input.replace(/^https?:\/\//, '');
    domain = domain.replace(/^www\./, '');
    domain = domain.split('/')[0];
    domain = domain.split(':')[0];
    
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain) && domain !== 'localhost') {
      return null;
    }
    
    return domain;
  }
  
  // background.jsにメッセージ送信
  function sendMessage(message) {
    console.log('Sending message:', message);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, 5000);
      
      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timeout);
        console.log('Received response:', response);
        
        if (chrome.runtime.lastError) {
          console.error('Runtime error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }
  
  // ページ終了時のクリーンアップ
  window.addEventListener('beforeunload', () => {
    if (updateInterval) {
      clearInterval(updateInterval);
    }
  });
});
