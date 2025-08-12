document.addEventListener('DOMContentLoaded', async () => {
  // Timer elements
  const timerInput = document.getElementById('timerInput');
  const startTimerBtn = document.getElementById('startTimerBtn');
  const timerStatus = document.getElementById('timerStatus');
  const remainingTime = document.getElementById('remainingTime');
  const timerWarning = document.getElementById('timerWarning');
  const timerControls = document.getElementById('timerControls');
  
  let updateInterval = null;
  
  // Initialize UI
  await updateUI();
  
  // Preset buttons event listeners
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      timerInput.value = btn.dataset.minutes;
    });
  });
  
  // Start timer button
  startTimerBtn.addEventListener('click', async () => {
    const duration = parseInt(timerInput.value);
    
    if (!duration || duration < 1 || duration > 480) {
      alert('Please set duration between 1 and 480 minutes');
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
    startTimerBtn.textContent = 'Start';
  });
  
  // Start timer countdown
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
    
    remainingTime.textContent = timeString;
    remainingTime.style.display = 'block';
  }
  
  // Update UI based on current status
  async function updateUI() {
    try {
      const status = await sendMessage({ action: 'getStatus' });
      const { timerMode } = status;
      
      if (timerMode) {
        // Timer mode active
        timerStatus.textContent = '🔥 Focus mode active';
        timerStatus.className = 'timer-status active';
        timerWarning.style.display = 'block';
        timerControls.style.display = 'none';
        
        // Get and display remaining time
        const remainingSeconds = await sendMessage({ action: 'getRemainingTime' });
        if (remainingSeconds > 0) {
          updateRemainingTimeDisplay(remainingSeconds);
          startTimerCountdown();
        }
      } else {
        // Timer mode inactive
        timerStatus.textContent = 'Ready to focus';
        timerStatus.className = 'timer-status';
        timerWarning.style.display = 'none';
        timerControls.style.display = 'block';
        remainingTime.style.display = 'none';
        
        if (updateInterval) {
          clearInterval(updateInterval);
          updateInterval = null;
        }
      }
    } catch (error) {
      console.error('UI update error:', error);
      timerStatus.textContent = 'Status fetch error';
      timerStatus.className = 'timer-status';
    }
  }
  
  // Send message to background script
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
