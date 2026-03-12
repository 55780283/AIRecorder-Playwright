// Content Script - 不使用 ES6 modules（Chrome 限制）
// 所有依赖的函数都内联在此文件中

const MAX_SELECTOR_DEPTH = 5;
let actionIdCounter = 0;

function generateId() {
  return `${Date.now()}-${++actionIdCounter}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateSelector(element) {
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  const uniqueAttr = findUniqueAttribute(element);
  if (uniqueAttr) {
    return uniqueAttr;
  }

  const path = getElementPath(element);
  return path;
}

function findUniqueAttribute(element) {
  const uniqueAttributes = [
    'data-testid',
    'data-test',
    'data-cy',
    'data-automation-id',
    'aria-label',
    'name',
    'placeholder',
    'title',
  ];

  for (const attr of uniqueAttributes) {
    const value = element.getAttribute(attr);
    if (value) {
      const selector = `[${attr}="${CSS.escape(value)}"]`;
      if (isUniqueSelector(selector)) {
        return selector;
      }
    }
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    if (element.placeholder) {
      const selector = `[placeholder="${CSS.escape(element.placeholder)}"]`;
      if (isUniqueSelector(selector)) {
        return selector;
      }
    }
  }

  return null;
}

function getElementPath(element) {
  const path = [];
  let current = element;
  let depth = 0;

  while (current && current !== document.documentElement && depth < MAX_SELECTOR_DEPTH) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector = `#${current.id}`;
      path.unshift(selector);
      break;
    }

    const siblings = current.parentElement?.children;
    if (siblings && siblings.length > 1) {
      const index = Array.from(siblings).indexOf(current) + 1;
      selector += `:nth-child(${index})`;
    }

    path.unshift(selector);
    current = current.parentElement;
    depth++;
  }

  return path.join(' > ');
}

function isUniqueSelector(selector) {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

function getElementDescription(element, action) {
  const tagName = element.tagName.toLowerCase();
  const type = element.getAttribute('type');
  const text = getElementText(element);
  const name = element.getAttribute('name');
  const placeholder = element.getAttribute('placeholder');
  const ariaLabel = element.getAttribute('aria-label');

  const parts = [action];

  if (tagName === 'input' || tagName === 'textarea') {
    parts.push(type || tagName);
    if (placeholder) parts.push(`"${placeholder}"`);
    if (name) parts.push(`(name: ${name})`);
  } else if (tagName === 'button' || tagName === 'a') {
    parts.push(text || ariaLabel || tagName);
  } else if (tagName === 'select') {
    parts.push('dropdown');
    if (name) parts.push(`(name: ${name})`);
  } else {
    parts.push(tagName);
    if (text) parts.push(`"${text.slice(0, 30)}"`);
  }

  return parts.join(' ');
}

function getElementText(element) {
  const text = element.textContent?.trim() || '';
  return text.replace(/\s+/g, ' ').slice(0, 50);
}

function isInteractiveElement(element) {
  const interactiveTags = ['a', 'button', 'input', 'select', 'textarea', 'option'];
  const tagName = element.tagName.toLowerCase();

  if (interactiveTags.includes(tagName)) {
    return true;
  }

  if (element.getAttribute('role')) {
    const interactiveRoles = ['button', 'link', 'checkbox', 'radio', 'tab', 'menuitem'];
    if (interactiveRoles.includes(element.getAttribute('role') || '')) {
      return true;
    }
  }

  if (element.getAttribute('onclick') || element.getAttribute('ng-click')) {
    return true;
  }

  const style = window.getComputedStyle(element);
  if (style.cursor === 'pointer') {
    return true;
  }

  return false;
}

// ActionRecorder 类
class ActionRecorder {
  constructor() {
    this.isRecording = false;
    this.isPaused = false;
    this.lastActionTime = 0;
    this.pendingInputTimeout = null;
    this.lastInputValue = '';
    this.lastInputElement = null;
    this.isInitialized = false;
    this.lastScrollPosition = { x: 0, y: 0 };
    this.scrollThreshold = 50;

    this.setupEventListeners();
    this.setupMessageListener();
    setTimeout(() => this.checkRecordingState(), 500);
  }

 setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'START_RECORDING') {
        this.startRecording();
        sendResponse({ success: true });
      } else if (message.type === 'SYNC_RECORDING_STATE') {
        this.syncRecordingState();
        sendResponse({ success: true });
      } else if (message.type === 'STOP_RECORDING') {
        this.stopRecording();
        sendResponse({ success: true });
      } else if (message.type === 'PAUSE_RECORDING') {
        this.pauseRecording();
        sendResponse({ success: true });
      } else if (message.type === 'RESUME_RECORDING') {
        this.resumeRecording();
        sendResponse({ success: true });
      } else if (message.type === 'GET_RECORDING_STATE') {
        sendResponse({ isRecording: this.isRecording, isPaused: this.isPaused });
      }
      return true;
    });
  }

  setupEventListeners() {
    document.addEventListener('click', this.handleClick.bind(this), true);
    document.addEventListener('dblclick', this.handleDblClick.bind(this), true);
    document.addEventListener('input', this.handleInput.bind(this), true);
    document.addEventListener('change', this.handleChange.bind(this), true);
    document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
    document.addEventListener('scroll', this.handleScroll.bind(this), true);
    window.addEventListener('popstate', this.handleNavigation.bind(this), true);
    
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('[Content] 页面重新可见， 同步录制状态');
        this.syncRecordingState();
      }
    });
    
    if (document.readyState === 'complete') {
      this.checkRecordingState();
    } else {
      window.addEventListener('load', () => this.checkRecordingState());
    }
    
    const observer = new MutationObserver(() => {
      if (this.isRecording && !document.getElementById('ai-recorder-indicator')) {
        this.showRecordingIndicator();
      }
    });
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  async checkRecordingState(force = false) {
    if (this.isInitialized && !force) return;
    
    try {
      console.log('[Content] 检查录制状态...');
      const response = await chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATE' });
      console.log('[Content] 录制状态响应:', response);
      if (response && response.isRecording) {
        console.log('[Content] 开始录制！');
        this.isRecording = true;
        this.isPaused = response.isPaused || false;
        this.lastActionTime = Date.now();
        this.lastScrollPosition = { x: window.scrollX, y: window.scrollY };
        this.showRecordingIndicator();
        if (this.isPaused) {
          this.updateIndicatorPausedState();
        }
        await this.restoreExistingActions(response.session?.sopId);
        if (!this.isPaused) {
          this.recordNavigation();
        }
      }
      this.isInitialized = true;
    } catch (error) {
      console.log('[Content] 检查状态失败，200ms 后重试:', error.message);
      if (!this.retryCount) this.retryCount = 0;
      this.retryCount++;
      if (this.retryCount < 3) {
        setTimeout(() => this.checkRecordingState(), 200);
      }
    }
  }

  async syncRecordingState() {
    console.log('[Content] 收到同步录制状态消息');
    this.isInitialized = false;
    await this.checkRecordingState(true);
  }

  async restoreExistingActions(sopId) {
    if (!sopId) {
      const response = await chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATE' });
      sopId = response?.session?.sopId;
    }
    if (!sopId) return;
    
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SOP', id: sopId });
      if (response && response.sop && response.sop.actions) {
        const countEl = document.getElementById('ai-recorder-count');
        const logContent = document.getElementById('ai-recorder-log-content');
        
        if (countEl) {
          countEl.textContent = response.sop.actions.length.toString();
        }
        
        if (logContent && response.sop.actions.length > 0) {
          logContent.innerHTML = '';
          response.sop.actions.forEach(action => {
            this.addLogItem(action, logContent);
          });
        }
      }
    } catch (error) {
      console.log('[Content] 恢复操作日志失败:', error);
    }
  }

  addLogItem(action, logContent) {
    const time = new Date(action.timestamp).toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    
    const icon = this.getActionIcon(action.type);
    const label = this.getActionLabel(action.type);
    
    const logItem = document.createElement('div');
    logItem.className = `ai-recorder-log-item ${action.type}`;
    logItem.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 12px;">${icon}</span>
        <span style="font-weight: 600; color: #374151;">${label}</span>
        <span style="color: #6b7280; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${action.description.slice(0, 25)}
        </span>
        <span style="color: #9ca3af; font-size: 9px; font-family: monospace;">${time}</span>
      </div>
    `;
    
    logContent.appendChild(logItem);
  }

  startRecording() {
    this.isRecording = true;
    this.isPaused = false;
    this.lastActionTime = Date.now();
    this.lastScrollPosition = { x: window.scrollX, y: window.scrollY };
    this.showRecordingIndicator();
    this.restoreExistingActions();
    this.recordNavigation();
  }

  stopRecording() {
    this.isRecording = false;
    this.isPaused = false;
    this.hideRecordingIndicator();
    if (this.pendingInputTimeout) {
      clearTimeout(this.pendingInputTimeout);
      this.pendingInputTimeout = null;
    }
  }

  pauseRecording() {
    if (!this.isRecording) return;
    this.isPaused = true;
    this.updateIndicatorPausedState();
  }

  resumeRecording() {
    if (!this.isRecording) return;
    this.isPaused = false;
    this.updateIndicatorPausedState();
  }

  updateIndicatorPausedState() {
    const header = document.getElementById('ai-recorder-header');
    const dot = document.getElementById('ai-recorder-dot');
    const statusText = document.getElementById('ai-recorder-status');
    const pauseBtn = document.getElementById('ai-recorder-pause-btn');
    
    if (!header) return;
    
    if (this.isPaused) {
      header.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
      header.style.boxShadow = '0 4px 20px rgba(245, 158, 11, 0.5)';
      if (dot) {
        dot.style.animation = 'none';
        dot.style.boxShadow = 'none';
      }
      if (statusText) statusText.textContent = '已暂停';
      if (pauseBtn) pauseBtn.textContent = '▶';
    } else {
      header.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
      header.style.boxShadow = '0 4px 20px rgba(239, 68, 68, 0.5)';
      if (dot) {
        dot.style.animation = 'pulse 1s ease-in-out infinite';
        dot.style.boxShadow = '0 0 12px rgba(255,255,255,0.9)';
      }
      if (statusText) statusText.textContent = '录制中...';
      if (pauseBtn) pauseBtn.textContent = '⏸';
    }
  }

  showRecordingIndicator() {
    const existingIndicator = document.getElementById('ai-recorder-indicator');
    if (existingIndicator) {
      return;
    }

    const indicator = document.createElement('div');
    indicator.id = 'ai-recorder-indicator';
    indicator.innerHTML = `
      <div id="ai-recorder-panel" style="
        position: fixed;
        top: 12px;
        right: 12px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        min-width: 280px;
      ">
        <div id="ai-recorder-header" style="
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
          padding: 10px 16px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 4px 20px rgba(239, 68, 68, 0.5);
          font-size: 13px;
          font-weight: 600;
        ">
          <span id="ai-recorder-dot" style="
            width: 10px;
            height: 10px;
            background: white;
            border-radius: 50%;
            animation: pulse 1s ease-in-out infinite;
            box-shadow: 0 0 12px rgba(255,255,255,0.9);
          "></span>
          <span id="ai-recorder-status" style="flex: 1;">录制中...</span>
          <span id="ai-recorder-count" style="
            background: rgba(255,255,255,0.25);
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
          ">0</span>
          <button id="ai-recorder-pause-btn" style="
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
          " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">⏸</button>
          <button id="ai-recorder-stop-btn" style="
            background: rgba(0, 0, 0, 0.5);
            border: none;
            color: white;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
          " onmouseover="this.style.background='rgba(0, 0, 0, 0.7)'" onmouseout="this.style.background='rgba(0, 0, 0, 0.5)'">⏹</button>
          <span id="ai-recorder-toggle" style="
            font-size: 10px;
            cursor: pointer;
            opacity: 0.8;
          ">▼</span>
        </div>
        <div id="ai-recorder-log" style="
          background: white;
          border-radius: 0 0 12px 12px;
          margin-top: -4px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
          overflow: hidden;
          border: 1px solid rgba(0,0,0,0.05);
          border-top: none;
        ">
          <div id="ai-recorder-log-content" style="
            max-height: 200px;
            overflow-y: auto;
            padding: 10px;
            display: flex;
            flex-direction: column;
            gap: 6px;
          ">
            <div style="text-align: center; color: #9ca3af; font-size: 12px; padding: 16px;">
              等待操作...
            </div>
          </div>
        </div>
      </div>
      <style>
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        #ai-recorder-log-content::-webkit-scrollbar {
          width: 5px;
        }
        #ai-recorder-log-content::-webkit-scrollbar-track {
          background: #f8fafc;
          border-radius: 3px;
        }
        #ai-recorder-log-content::-webkit-scrollbar-thumb {
          background: #ef4444;
          border-radius: 3px;
        }
        .ai-recorder-log-item {
          padding: 8px 10px;
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border-radius: 8px;
          font-size: 12px;
          border-left: 3px solid #ef4444;
          animation: slideIn 0.25s ease-out;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .ai-recorder-log-item:hover {
          transform: translateX(2px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .ai-recorder-log-item.click { border-left-color: #10b981; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); }
        .ai-recorder-log-item.input { border-left-color: #f59e0b; background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); }
        .ai-recorder-log-item.navigation { border-left-color: #3b82f6; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); }
        .ai-recorder-log-item.scroll { border-left-color: #ec4899; background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%); }
        .ai-recorder-log-item.keydown { border-left-color: #06b6d4; background: linear-gradient(135deg, #ecfeff 0%, #cffafe 100%); }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
      </style>
    `;
    document.body.appendChild(indicator);
    
    const toggle = document.getElementById('ai-recorder-toggle');
    const logPanel = document.getElementById('ai-recorder-log');
    const pauseBtn = document.getElementById('ai-recorder-pause-btn');
    const stopBtn = document.getElementById('ai-recorder-stop-btn');
    
    if (toggle && logPanel) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = logPanel.style.display === 'none';
        logPanel.style.display = isHidden ? 'block' : 'none';
        toggle.textContent = isHidden ? '▼' : '▶';
      });
    }

    if (pauseBtn) {
      pauseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.isPaused) {
          chrome.runtime.sendMessage({ type: 'RESUME_RECORDING' });
        } else {
          chrome.runtime.sendMessage({ type: 'PAUSE_RECORDING' });
        }
      });
    }

    if (stopBtn) {
      stopBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
      });
    }
  }

  updateRecordingLog(action) {
    const logContent = document.getElementById('ai-recorder-log-content');
    const countEl = document.getElementById('ai-recorder-count');
    
    if (!logContent) return;
    
    const currentCount = parseInt(countEl?.textContent || '0');
    if (countEl) {
      countEl.textContent = (currentCount + 1).toString();
    }
    
    if (logContent.querySelector('div[style*="text-align: center"]')) {
      logContent.innerHTML = '';
    }
    
    this.addLogItem(action, logContent);
    logContent.scrollTop = logContent.scrollHeight;
  }

  getActionIcon(type) {
    const icons = {
      click: '🖱️',
      dblclick: '🖱️',
      input: '⌨️',
      select: '📋',
      scroll: '📜',
      keydown: '⌨️',
      navigation: '🌐',
      wait: '⏳',
    };
    return icons[type] || '📝';
  }

  getActionLabel(type) {
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

  hideRecordingIndicator() {
    const indicator = document.getElementById('ai-recorder-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  recordAction(type, element, options = {}) {
    if (!this.isRecording) {
      console.log('[Content] 未录制，忽略操作:', type);
      return;
    }

    if (this.isPaused) {
      console.log('[Content] 已暂停，忽略操作:', type);
      return;
    }

    const now = Date.now();
    const waitDuration = now - this.lastActionTime;
    this.lastActionTime = now;

    const selector = generateSelector(element);
    const description = getElementDescription(element, type);

    const action = {
      id: generateId(),
      type,
      timestamp: now,
      selector,
      tagName: element.tagName.toLowerCase(),
      url: window.location.href,
      pageTitle: document.title,
      description,
      waitDuration: waitDuration > 100 ? waitDuration : undefined,
      ...options,
    };

    console.log('[Content] 发送录制动作:', action.type, action.description);
    chrome.runtime.sendMessage({
      type: 'RECORD_ACTION',
      action,
    });
    
    this.updateRecordingLog(action);
  }

  recordNavigation() {
    if (!this.isRecording) return;
    if (this.isPaused) return;

    const action = {
      id: generateId(),
      type: 'navigation',
      timestamp: Date.now(),
      selector: '',
      tagName: '',
      url: window.location.href,
      pageTitle: document.title,
      description: `Navigate to ${window.location.href}`,
    };

    chrome.runtime.sendMessage({
      type: 'RECORD_ACTION',
      action,
    });
    
    // 更新页面上的日志面板
    this.updateRecordingLog(action);
  }

  handleClick(event) {
    if (!this.isRecording) return;
    const target = event.target;
    if (!isInteractiveElement(target)) return;

    this.recordAction('click', target, {
      coordinates: { x: event.clientX, y: event.clientY },
    });
  }

  handleDblClick(event) {
    if (!this.isRecording) return;
    const target = event.target;
    if (!isInteractiveElement(target)) return;

    this.recordAction('dblclick', target, {
      coordinates: { x: event.clientX, y: event.clientY },
    });
  }

  handleInput(event) {
    if (!this.isRecording) return;
    const target = event.target;
    if (!target) return;

    if (this.pendingInputTimeout) {
      clearTimeout(this.pendingInputTimeout);
    }

    this.lastInputElement = target;
    this.lastInputValue = target.value;

    this.pendingInputTimeout = setTimeout(() => {
      if (this.lastInputElement && this.lastInputValue) {
        this.recordAction('input', this.lastInputElement, {
          value: this.lastInputValue,
        });
      }
      this.pendingInputTimeout = null;
      this.lastInputElement = null;
      this.lastInputValue = '';
    }, 500);
  }

  handleChange(event) {
    if (!this.isRecording) return;
    const target = event.target;
    if (!target) return;

    if (target.tagName.toLowerCase() === 'select') {
      this.recordAction('select', target, {
        value: target.value,
      });
    }
  }

  handleKeyDown(event) {
    if (!this.isRecording) return;
    
    const specialKeys = ['Enter', 'Tab', 'Escape', 'Backspace', 'Delete'];
    if (!specialKeys.includes(event.key)) return;

    const target = event.target;
    this.recordAction('keydown', target, {
      keyInfo: {
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
      },
    });
  }

  handleScroll(_event) {
    if (!this.isRecording) return;

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    const dx = Math.abs(scrollX - this.lastScrollPosition.x);
    const dy = Math.abs(scrollY - this.lastScrollPosition.y);

    if (dx < this.scrollThreshold && dy < this.scrollThreshold) {
      return;
    }

    if (this.pendingInputTimeout) {
      clearTimeout(this.pendingInputTimeout);
    }

    this.pendingInputTimeout = setTimeout(() => {
      const currentScrollX = window.scrollX;
      const currentScrollY = window.scrollY;

      this.lastScrollPosition = { x: currentScrollX, y: currentScrollY };
      
      this.recordAction('scroll', document.body, {
        scrollPosition: { x: currentScrollX, y: currentScrollY },
      });
      this.pendingInputTimeout = null;
    }, 300);
  }

  handleNavigation() {
    if (!this.isRecording) return;
    setTimeout(() => {
      this.recordNavigation();
    }, 100);
  }
}

new ActionRecorder();
