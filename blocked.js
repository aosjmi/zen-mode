document.addEventListener('DOMContentLoaded', async () => {
    const blockedUrlElement = document.getElementById('blockedUrl');
    const sitesContainer = document.getElementById('sitesContainer');
    const timerInfo = document.getElementById('timerInfo');
    const remainingTimeElement = document.getElementById('remainingTime');
    const refreshBtn = document.getElementById('refreshBtn');
    
    let updateInterval = null;
    
    // 初期化
    await init();
    
    // 更新ボタン
    refreshBtn.addEventListener('click', () => {
        location.reload();
    });
    
    async function init() {
        // ブロックされたURLを表示
        displayBlockedUrl();
        
        // 拡張機能の状態を取得
        try {
            await loadExtensionStatus();
            await loadAllowedSites();
        } catch (error) {
            console.error('初期化エラー:', error);
            showError();
        }
    }
    
    function displayBlockedUrl() {
        const url = window.location.href;
        const urlParams = new URLSearchParams(window.location.search);
        const blockedUrl = urlParams.get('url') || url;
        
        blockedUrlElement.textContent = blockedUrl;
    }
    
    async function loadExtensionStatus() {
        try {
            const status = await sendMessage({ action: 'getStatus' });
            
            if (status.timerMode) {
                timerInfo.style.display = 'block';
                startTimerCountdown();
            }
        } catch (error) {
            console.error('ステータス取得エラー:', error);
        }
    }
    
    async function loadAllowedSites() {
        try {
            const allowedSites = await sendMessage({ action: 'getAllowedSites' });
            displayAllowedSites(allowedSites);
        } catch (error) {
            console.error('許可サイト取得エラー:', error);
            sitesContainer.innerHTML = '<div class="no-sites">許可サイトの取得に失敗しました</div>';
        }
    }
    
    function displayAllowedSites(sites) {
        if (!sites || sites.length === 0) {
            sitesContainer.innerHTML = '<div class="no-sites">許可サイトが設定されていません</div>';
            return;
        }
        
        const sitesGrid = document.createElement('div');
        sitesGrid.className = 'sites-grid';
        
        sites.forEach(site => {
            const siteCard = document.createElement('div');
            siteCard.className = 'site-card';
            
            const link = document.createElement('a');
            link.href = `https://${site}`;
            link.textContent = site;
            link.target = '_blank';
            
            siteCard.appendChild(link);
            sitesGrid.appendChild(siteCard);
        });
        
        sitesContainer.innerHTML = '';
        sitesContainer.appendChild(sitesGrid);
    }
    
    function startTimerCountdown() {
        updateInterval = setInterval(async () => {
            try {
                const remainingSeconds = await sendMessage({ action: 'getRemainingTime' });
                
                if (remainingSeconds === null || remainingSeconds <= 0) {
                    clearInterval(updateInterval);
                    location.reload();
                } else {
                    updateRemainingTimeDisplay(remainingSeconds);
                }
            } catch (error) {
                console.error('残り時間取得エラー:', error);
            }
        }, 1000);
    }
    
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
        
        remainingTimeElement.textContent = `残り ${timeString}`;
    }
    
    function showError() {
        sitesContainer.innerHTML = `
            <div class="no-sites">
                拡張機能との通信に失敗しました<br>
                <small>ページを更新するか、拡張機能を再インストールしてください</small>
            </div>
        `;
    }
    
    function sendMessage(message) {
        return new Promise((resolve, reject) => {
            if (!chrome.runtime) {
                reject(new Error('Extension context invalid'));
                return;
            }
            
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
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
