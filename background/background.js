import * as storage from '../utils/storage.js';

class BackgroundService {
  constructor() {
    this.currentSession = null;
    this.isPaused = false;
    this.recordingTabId = null;
    this.setupMessageListener();
    this.initialize();
  }

  async initialize() {
    await storage.initialize();
    
    chrome.tabs.onActivated.addListener((activeInfo) => {
      if (this.currentSession) {
        this.recordingTabId = activeInfo.tabId;
        setTimeout(() => {
          this.broadcastToTab(activeInfo.tabId, { type: 'SYNC_RECORDING_STATE' });
        }, 300);
      }
    });
    
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (this.currentSession && this.recordingTabId === tabId) {
        if (changeInfo.status === 'complete') {
          setTimeout(() => {
            this.broadcastToTab(tabId, { type: 'SYNC_RECORDING_STATE' });
          }, 500);
        }
      }
    });

    chrome.windows.onFocusChanged.addListener(async (windowId) => {
      console.log('[Background] 窗口焦点变化:', windowId, '当前录制:', !!this.currentSession);
      if (this.currentSession && windowId !== chrome.windows.WINDOW_ID_NONE) {
        try {
          const [tab] = await chrome.tabs.query({ active: true, windowId });
          console.log('[Background] 活动标签页:', tab?.id, tab?.url);
          if (tab && tab.id) {
            this.recordingTabId = tab.id;
            setTimeout(async () => {
              try {
                await this.broadcastToTab(tab.id, { type: 'SYNC_RECORDING_STATE' });
                console.log('[Background] 已发送同步消息到标签页:', tab.id);
              } catch (e) {
                console.log('[Background] 发送消息失败:', e);
              }
            }, 300);
          }
        } catch (error) {
          console.log('[Background] 窗口焦点处理失败:', error);
        }
      }
    });
  }

  async openPopupWindow() {
    try {
      const windows = await chrome.windows.getAll({ populate: true });
      for (const window of windows) {
        if (window.tabs && window.tabs.some(tab => tab.url && tab.url.includes('popup.html'))) {
          await chrome.windows.update(window.id, { focused: true });
          return;
        }
      }
      
      await chrome.windows.create({
        url: chrome.runtime.getURL('popup/popup.html'),
        type: 'popup',
        width: 420,
        height: 550,
        left: screen.width - 420,
        top: 100,
        focused: true
      });
    } catch (error) {
      console.error('打开 popup 窗口失败:', error);
    }
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // 记录发送消息的标签页 ID
      if (sender.tab && sender.tab.id) {
        if (this.currentSession && !this.recordingTabId) {
          this.recordingTabId = sender.tab.id;
        }
      }
      this.handleMessage(message, sender, sendResponse);
      return true;
    });
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case 'OPEN_POPUP_WINDOW':
          await this.openPopupWindow();
          sendResponse({ success: true });
          break;
          
        case 'START_RECORDING':
          await this.startRecording(message.name, message.description);
          sendResponse({ success: true });
          break;

        case 'STOP_RECORDING':
          await this.stopRecording();
          sendResponse({ success: true, sop: this.currentSession });
          break;

        case 'PAUSE_RECORDING':
          await this.pauseRecording();
          sendResponse({ success: true });
          break;

        case 'RESUME_RECORDING':
          await this.resumeRecording();
          sendResponse({ success: true });
          break;

        case 'RECORD_ACTION':
          await this.recordAction(message.action);
          sendResponse({ success: true });
          break;

        case 'GET_RECORDING_STATE':
          sendResponse({
            isRecording: this.currentSession !== null,
            isPaused: this.isPaused,
            session: this.currentSession,
          });
          break;

        case 'GET_SOPS':
          const sops = await storage.getSOPs();
          sendResponse({ sops });
          break;

        case 'GET_SOP':
          const sop = await storage.getSOP(message.id);
          sendResponse({ sop });
          break;

        case 'SAVE_SOP':
          await storage.saveSOP(message.sop);
          sendResponse({ success: true });
          break;

        case 'DELETE_SOP':
          await storage.deleteSOP(message.id);
          sendResponse({ success: true });
          break;

        case 'UPDATE_SOP_ACTIONS':
          await storage.updateSOPActions(
            message.sopId,
            message.actions
          );
          sendResponse({ success: true });
          break;

        case 'GET_SETTINGS':
          const settings = await storage.getSettings();
          sendResponse({ settings });
          break;

        case 'UPDATE_SETTINGS':
          await storage.updateSettings(message.settings);
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      sendResponse({ error: error.message });
    }
  }

  async startRecording(name, description = '') {
    console.log('[Background] 开始录制，名称:', name, '描述:', description);
    const sop = await storage.createSOP(name, description);
    console.log('[Background] 创建的 SOP:', sop);
    
    this.currentSession = {
      sopId: sop.id,
      actions: [],
      startTime: Date.now(),
    };
    console.log('[Background] 当前 Session 初始化:', this.currentSession);

    await this.broadcastToAllTabs({ type: 'START_RECORDING' });
  }

  async stopRecording() {
    console.log('[Background] 停止录制，当前 session:', this.currentSession);
    
    if (this.currentSession) {
      const sop = await storage.getSOP(this.currentSession.sopId);
      console.log('[Background] 从存储获取的 SOP:', sop);
      console.log('[Background] Session 中的操作数量:', this.currentSession.actions.length);
      
      if (sop) {
        const currentSOP = await storage.getSOP(this.currentSession.sopId);
        if (currentSOP) {
          currentSOP.actions = this.currentSession.actions;
          await storage.saveSOP(currentSOP);
          console.log('[Background] SOP 已保存，操作数量:', currentSOP.actions.length);
        }
      }
    }

    await this.broadcastToAllTabs({ type: 'STOP_RECORDING' });
    this.currentSession = null;
    this.isPaused = false;
    this.recordingTabId = null;
    console.log('[Background] 录制已停止');
  }

  async pauseRecording() {
    if (!this.currentSession) return;
    this.isPaused = true;
    await this.broadcastToAllTabs({ type: 'PAUSE_RECORDING' });
    console.log('[Background] 录制已暂停');
  }

  async resumeRecording() {
    if (!this.currentSession) return;
    this.isPaused = false;
    await this.broadcastToAllTabs({ type: 'RESUME_RECORDING' });
    console.log('[Background] 录制已恢复');
  }

  async recordAction(action) {
    if (this.currentSession) {
      this.currentSession.actions.push(action);
      await storage.addActionToSOP(this.currentSession.sopId, action);
      console.log('[Background] 记录操作:', action.type, '当前操作数量:', this.currentSession.actions.length);
    } else {
      console.warn('[Background] 录制未开始，无法记录操作');
    }
  }

  async broadcastToTab(tabId, message) {
    try {
      await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      // Tab might not have content script loaded or already closed
    }
  }

  async broadcastToAllTabs(message) {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id && !tab.url.startsWith('chrome://')) {
        await this.broadcastToTab(tab.id, message);
      }
    }
  }
}

new BackgroundService();
