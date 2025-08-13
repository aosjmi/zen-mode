document.addEventListener('DOMContentLoaded', async () => {
  const statusDiv = document.getElementById('status');
  const newSiteInput = document.getElementById('newSiteInput');
  const addSiteButton = document.getElementById('addSiteButton');
  const siteList = document.getElementById('siteList');
  
  // Timer elements
  const timerInput = document.getElementById('timerInput');
  const startTimerBtn = document.getElementById('startTimerBtn');
  const timerStatus = document.getElementById('timerStatus');
  const remainingTime = document.getElementById('remainingTime');
  const timerWarning = document.getElementById('timerWarning');
  const timerControls = document.getElementById('timerControls');
  
  let allowedSites = [];
  let updateInterval = null;
  
  // Preset buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      timerInput.value = btn.dataset.minutes;
    });
  });
  
  // Initialize
  await updateUI();
  await loadAllowedSites();
  
  // Timer start button
  startTimerBtn.addEventListener('click', async () => {
    const duration = parseInt(timerInput.value);
    
    if (!duration || duration < 1 || duration > 720) {
      alert('Please set duration between 1 and 720 minutes');
      return;
    }
    
    startTimerBtn.disabled = true;
    startTimerBtn.textContent = 'Starting...';
    
    try {
      await sendMessage({ 
        action: 'startTimer', 
        duration: duration 
      });
      
      await updateUI();
      startTimerCountdown();
    } catch (error) {
      console.error('Timer start error:', error);
      alert('Failed to start timer');
    }
    
    startTimerBtn.disabled = false;
    startTimerBtn.textContent = 'Start Focus';
  });
  
  // Site management
  addSiteButton.addEventListener('click', addSite);
  newSiteInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addSite();
    }
  });
  
  // Timer countdown
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
        console.error('Remaining time fetch error:', error);
      }
    }, 1000);
  }

  // Update remaining time display
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
    
    remainingTime.textContent = `Remaining: ${timeString}`;
    remainingTime.style.display = 'block';
  }
  
  // UI update
  async function updateUI() {
    try {
      const status = await sendMessage({ action: 'getStatus' });
      const { blockingEnabled, timerMode } = status;
      
      // Timer state display
      if (timerMode) {
        timerStatus.textContent = '🔥 Focus mode active';
        timerStatus.className = 'timer-status active';
        timerWarning.style.display = 'block';
        timerControls.style.display = 'none';
        
        // Disable site management UI
        newSiteInput.disabled = true;
        newSiteInput.placeholder = 'Cannot add during focus mode';
        addSiteButton.disabled = true;
        addSiteButton.textContent = 'Cannot Add';
        
        // Initial remaining time display
        const remainingSeconds = await sendMessage({ action: 'getRemainingTime' });
        if (remainingSeconds > 0) {
          updateRemainingTimeDisplay(remainingSeconds);
          startTimerCountdown();
        }
      } else {
        timerStatus.textContent = 'Timer ready';
        timerStatus.className = 'timer-status';
        timerWarning.style.display = 'none';
        timerControls.style.display = 'flex';
        remainingTime.style.display = 'none';
        
        // Enable site management UI
        newSiteInput.disabled = false;
        newSiteInput.placeholder = 'example.com';
        addSiteButton.disabled = false;
        addSiteButton.textContent = 'Add';
        
        if (updateInterval) {
          clearInterval(updateInterval);
          updateInterval = null;
        }
      }
      
      // Status update - only show timer-related information
      if (timerMode) {
        statusDiv.textContent = '🔥 Focus mode active';
        statusDiv.className = 'status timer';
      } else {
        statusDiv.textContent = '✅ Ready to focus';
        statusDiv.className = 'status disabled';
      }
      
      await updateSiteList();
      
      // Update remove button states
      await updateRemoveButtonsState();
    } catch (error) {
      console.error('UI update error:', error);
      statusDiv.textContent = 'Status fetch error';
      statusDiv.className = 'status';
    }
  }
  
  // Add site
  async function addSite() {
    // Disable adding during timer mode
    const status = await sendMessage({ action: 'getStatus' });
    if (status.timerMode) {
      alert('Cannot add sites during focus mode');
      return;
    }
    
    const site = newSiteInput.value.trim();
    if (!site) return;
    
    const domain = normalizeDomain(site);
    if (!domain) {
      alert('Please enter a valid domain name (e.g., example.com)');
      return;
    }
    
    if (allowedSites.includes(domain)) {
      alert('That site is already added');
      return;
    }
    
    allowedSites.push(domain);
    await updateAllowedSites();
    newSiteInput.value = '';
  }
  
  // Remove site
  async function removeSite(domain) {
    // Disable removing during timer mode
    const status = await sendMessage({ action: 'getStatus' });
    if (status.timerMode) {
      alert('Cannot remove sites during focus mode');
      return;
    }
    
    allowedSites = allowedSites.filter(site => site !== domain);
    await updateAllowedSites();
  }
  
  // Update allowed sites
  async function updateAllowedSites() {
    try {
      await sendMessage({ 
        action: 'updateAllowedSites', 
        sites: allowedSites 
      });
      renderSiteList();
    } catch (error) {
      console.error('Allowed sites update error:', error);
    }
  }
  
  // Load allowed sites
  async function loadAllowedSites() {
    try {
      allowedSites = await sendMessage({ action: 'getAllowedSites' });
      renderSiteList();
    } catch (error) {
      console.error('Allowed sites load error:', error);
    }
  }
  
  // Render site list
  function renderSiteList() {
    siteList.innerHTML = '';
    
    allowedSites.forEach(site => {
      const siteItem = document.createElement('div');
      siteItem.className = 'site-item';
      
      const siteText = document.createElement('span');
      siteText.textContent = site;
      
      const removeButton = document.createElement('button');
      removeButton.className = 'remove-button';
      removeButton.textContent = 'Remove';
      removeButton.onclick = () => removeSite(site);
      
      siteItem.appendChild(siteText);
      siteItem.appendChild(removeButton);
      siteList.appendChild(siteItem);
    });
    
    // Disable remove buttons during timer mode
    updateRemoveButtonsState();
  }
  
  // Update remove button state
  async function updateRemoveButtonsState() {
    try {
      const status = await sendMessage({ action: 'getStatus' });
      const removeButtons = document.querySelectorAll('.remove-button');
      
      removeButtons.forEach(button => {
        if (status.timerMode) {
          button.disabled = true;
          button.textContent = 'Cannot Remove';
          button.style.opacity = '0.5';
          button.style.cursor = 'not-allowed';
        } else {
          button.disabled = false;
          button.textContent = 'Remove';
          button.style.opacity = '1';
          button.style.cursor = 'pointer';
        }
      });
    } catch (error) {
      console.error('Remove button state update error:', error);
    }
  }
  
  // Update site list
  async function updateSiteList() {
    await loadAllowedSites();
  }
  
  // Domain normalization
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
  
  // Send message to background.js
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
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (updateInterval) {
      clearInterval(updateInterval);
    }
  });
});
