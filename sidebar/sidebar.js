class SidebarManager {
  constructor() {
    this.isRecording = false;
    this.currentActions = [];
    this.logUpdateInterval = null;
    this.currentSOP = null;
    this.initialize();
  }

  async initialize() {
    this.setupEventListeners();
    this.startLogUpdate();
    await this.checkRecordingState();
  }

  setupEventListeners() {
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const closeBtn = document.getElementById('close-btn');
    const clearLogBtn = document.getElementById('clear-log-btn');

    startBtn?.addEventListener('click', () => this.startRecording());
    stopBtn?.addEventListener('click', () => this.stopRecording());
    closeBtn?.addEventListener('click', () => this.closeSidebar());
    clearLogBtn?.addEventListener('click', () => this.clearLog());
  }

  async checkRecordingState() {
    try {
      const response = await this.sendMessage({ type: 'GET_RECORDING_STATE' });
      if (response && response.isRecording) {
        this.isRecording = true;
        this.updateRecordingUI();
        this.showInfoPanel();
      }
    } catch (error) {
      console.error('检查录制状态失败:', error);
    }
  }

  async startRecording() {
    const now = new Date();
    const name = `SOP ${now.toLocaleString('zh-CN')}`;
    
    await this.sendMessage({
      type: 'START_RECORDING',
      name,
      description: '从侧边栏录制',
    });

    this.isRecording = true;
    this.currentActions = [];
    this.updateRecordingUI();
    this.showInfoPanel();
    this.updateSOPName(name);
  }

  async stopRecording() {
    await this.sendMessage({ type: 'STOP_RECORDING' });
    this.isRecording = false;
    this.currentActions = [];
    this.updateRecordingUI();
    this.hideInfoPanel();
    this.clearLog();
  }

  closeSidebar() {
    window.close();
  }

  clearLog() {
    const logEl = document.getElementById('recording-log');
    if (logEl) {
      logEl.innerHTML = `
        <div class="empty-log">
          <p>暂无录制内容</p>
          <p class="hint">点击"开始录制"并开始操作</p>
        </div>
      `;
    }
    this.updateActionCount(0);
  }

  updateRecordingUI() {
    const statusEl = document.getElementById('recording-status');
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const statusText = statusEl?.querySelector('.status-text');

    if (this.isRecording) {
      statusEl?.classList.add('recording');
      if (statusText) statusText.textContent = '录制中...';
      startBtn.disabled = true;
      stopBtn.disabled = false;
    } else {
      statusEl?.classList.remove('recording');
      if (statusText) statusText.textContent = '就绪';
      startBtn.disabled = false;
      stopBtn.disabled = true;
    }
  }

  showInfoPanel() {
    const infoPanel = document.getElementById('recording-info');
    if (infoPanel) {
      infoPanel.classList.remove('hidden');
    }
  }

  hideInfoPanel() {
    const infoPanel = document.getElementById('recording-info');
    if (infoPanel) {
      infoPanel.classList.add('hidden');
    }
  }

  updateSOPName(name) {
    const nameEl = document.getElementById('current-sop-name');
    if (nameEl) {
      nameEl.textContent = name;
    }
  }

  updateActionCount(count) {
    const countEl = document.getElementById('action-count');
    if (countEl) {
      countEl.textContent = count.toString();
    }
  }

  startLogUpdate() {
    this.logUpdateInterval = setInterval(async () => {
      if (this.isRecording) {
        await this.updateRecordingLog();
      }
    }, 500);
  }

  async updateRecordingLog() {
    try {
      const response = await this.sendMessage({ type: 'GET_RECORDING_STATE' });
      if (response && response.isRecording) {
        const sops = await this.sendMessage({ type: 'GET_SOPS' });
        const sopList = Object.values(sops.sops || {});
        
        if (sopList.length > 0) {
          const latestSOP = sopList.sort((a, b) => b.updatedAt - a.updatedAt)[0];
          const sopDetail = await this.sendMessage({ type: 'GET_SOP', id: latestSOP.id });
          
          if (sopDetail && sopDetail.sop && sopDetail.sop.actions) {
            const newActions = sopDetail.sop.actions;
            
            if (newActions.length !== this.currentActions.length) {
              this.currentActions = newActions;
              this.renderRecordingLog();
              this.updateActionCount(newActions.length);
            }
          }
        }
      }
    } catch (error) {
      console.error('更新日志失败:', error);
    }
  }

  renderRecordingLog() {
    const logEl = document.getElementById('recording-log');
    if (!logEl) return;

    logEl.innerHTML = this.currentActions
      .map((action) => {
        const time = new Date(action.timestamp).toLocaleTimeString('zh-CN', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        const icon = this.getActionIcon(action.type);
        const label = this.getActionTypeLabel(action.type);

        return `
          <div class="log-item ${action.type}">
            <span class="log-icon">${icon}</span>
            <div class="log-content">
              <span class="log-type">${label}</span>
              <span class="log-description">${this.escapeHtml(action.description)}</span>
            </div>
            <span class="log-time">${time}</span>
          </div>
        `;
      })
      .join('');

    logEl.scrollTop = logEl.scrollHeight;
  }

  getActionTypeLabel(type) {
    const labels = {
      click: '点击',
      dblclick: '双击',
      input: '输入',
      select: '选择',
      scroll: '滚动',
      keydown: '按键',
      navigation: '导航',
      wait: '等待',
    };
    return labels[type] || type;
  }

  getActionIcon(type) {
    const icons = {
      click: '🖱️',
      dblclick: '🖱️🖱️',
      input: '⌨️',
      select: '📋',
      scroll: '📜',
      keydown: '⌨️',
      navigation: '🌐',
      wait: '⏳',
    };
    return icons[type] || '📝';
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response);
      });
    });
  }
}

new SidebarManager();
