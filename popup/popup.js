import {
  generatePlaywrightScriptWithComments,
  generatePlaywrightScriptForAI,
  generateSOPSummary,
  generateSkill,
  generateCompleteSkill,
} from '../utils/playwright-generator.js';
import { optimizeActions, getOptimizationStats } from '../utils/ai-optimizer.js';
import { optimizeSelectors } from '../utils/selector-optimizer.js';

class PopupManager {
  constructor() {
    this.isRecording = false;
    this.isPaused = false;
    this.sops = {};
    this.currentSOP = null;
    this.initialize();
  }

  async initialize() {
    await this.loadSOPs();
    await this.checkRecordingState();
    this.setupEventListeners();
  }

  async loadSOPs() {
    const response = await this.sendMessage({ type: 'GET_SOPS' });
    this.sops = response.sops || {};
    this.renderSOPList();
  }

  async checkRecordingState() {
    const response = await this.sendMessage({ type: 'GET_RECORDING_STATE' });
    this.isRecording = response.isRecording;
    this.isPaused = response.isPaused;
    this.updateRecordingUI();
  }

  setupEventListeners() {
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const stopBtn = document.getElementById('stop-btn');
    const backBtn = document.getElementById('back-btn');

    startBtn?.addEventListener('click', () => this.startRecording());
    pauseBtn?.addEventListener('click', () => this.togglePause());
    stopBtn?.addEventListener('click', () => this.stopRecording());
    backBtn?.addEventListener('click', () => this.showSOPList());
  }

  async startRecording() {
    const nameInput = document.getElementById('sop-name');
    const descInput = document.getElementById('sop-description');

    const name = nameInput.value.trim() || `SOP ${new Date().toLocaleString()}`;
    const description = descInput.value.trim();

    await this.sendMessage({
      type: 'START_RECORDING',
      name,
      description,
    });

    this.isRecording = true;
    this.isPaused = false;
    this.updateRecordingUI();
    
    window.close();
  }

  async togglePause() {
    if (this.isPaused) {
      await this.sendMessage({ type: 'RESUME_RECORDING' });
      this.isPaused = false;
    } else {
      await this.sendMessage({ type: 'PAUSE_RECORDING' });
      this.isPaused = true;
    }
    this.updateRecordingUI();
  }

  async stopRecording() {
    console.log('[Popup] 停止录制...');
    await this.sendMessage({ type: 'STOP_RECORDING' });
    console.log('[Popup] 等待数据保存...');
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    this.isRecording = false;
    this.isPaused = false;
    this.updateRecordingUI();
    await this.loadSOPs();
    console.log('[Popup] 录制已停止，SOP 列表已更新');

    const nameInput = document.getElementById('sop-name');
    const descInput = document.getElementById('sop-description');
    nameInput.value = '';
    descInput.value = '';
  }

  updateRecordingUI() {
    const statusBar = document.getElementById('recording-status');
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const stopBtn = document.getElementById('stop-btn');
    const pauseText = pauseBtn?.querySelector('.pause-text');
    const pauseIcon = pauseBtn?.querySelector('span:first-child');

    if (this.isRecording) {
      startBtn.disabled = true;
      pauseBtn.disabled = false;
      stopBtn.disabled = false;
      
      statusBar.classList.remove('recording', 'paused');
      
      if (this.isPaused) {
        statusBar.classList.add('paused');
        if (pauseText) pauseText.textContent = '继续';
        if (pauseIcon) pauseIcon.textContent = '▶';
      } else {
        statusBar.classList.add('recording');
        if (pauseText) pauseText.textContent = '暂停';
        if (pauseIcon) pauseIcon.textContent = '⏸';
      }
    } else {
      statusBar.classList.remove('recording', 'paused');
      startBtn.disabled = false;
      pauseBtn.disabled = true;
      stopBtn.disabled = true;
      if (pauseText) pauseText.textContent = '暂停';
      if (pauseIcon) pauseIcon.textContent = '⏸';
    }
  }

  renderSOPList() {
    const listEl = document.getElementById('sop-list');
    const countEl = document.getElementById('sop-count');

    if (!listEl) return;

    const sopArray = Object.values(this.sops).sort(
      (a, b) => b.updatedAt - a.updatedAt
    );

    if (countEl) {
      countEl.textContent = sopArray.length.toString();
    }

    if (sopArray.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <p>暂无 SOP</p>
          <p>点击"开始录制"创建第一个 SOP</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = sopArray
      .map(
        (sop) => `
      <div class="sop-item" data-id="${sop.id}">
        <div class="sop-info">
          <div class="sop-name">${this.escapeHtml(sop.name)}</div>
          <div class="sop-meta">${sop.actions.length} 步骤 · ${this.formatDate(sop.updatedAt)}</div>
        </div>
        <div class="sop-actions">
          <button class="view-btn" data-id="${sop.id}">查看</button>
          <button class="delete-btn" data-id="${sop.id}">删除</button>
        </div>
      </div>
    `
      )
      .join('');

    listEl.querySelectorAll('.view-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (id) this.showSOPDetail(id);
      });
    });

    listEl.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (id && confirm('确定要删除这个 SOP 吗？')) {
          await this.deleteSOP(id);
        }
      });
    });
  }

  async showSOPDetail(id) {
    const response = await this.sendMessage({ type: 'GET_SOP', id });
    this.currentSOP = response.sop;

    if (!this.currentSOP) return;

    const listPanel = document.getElementById('sop-list-panel');
    const detailPanel = document.getElementById('sop-detail-panel');
    const titleEl = document.getElementById('detail-title');
    const contentEl = document.getElementById('sop-detail-content');

    if (listPanel) listPanel.classList.add('hidden');
    if (detailPanel) detailPanel.classList.remove('hidden');
    if (titleEl) titleEl.textContent = this.currentSOP.name;

    if (contentEl) {
      contentEl.innerHTML = `
        <div class="step-list">
          ${this.currentSOP.actions
            .map(
              (action, index) => `
            <div class="step-item">
              <div class="step-number">${index + 1}</div>
              <div class="step-content">
                <div class="step-type">${this.getActionTypeLabel(action.type)}</div>
                <div class="step-selector">${this.escapeHtml(action.selector)}</div>
                ${action.value ? `<div class="step-value">值: ${this.escapeHtml(action.value)}</div>` : ''}
              </div>
            </div>
          `
            )
            .join('')}
        </div>
        <div class="export-options">
          <button class="btn btn-primary" id="export-playwright">导出 Playwright</button>
          <button class="btn btn-secondary" id="export-json">导出 JSON</button>
          <button class="btn btn-secondary" id="export-skill">导出 Skill</button>
        </div>
      `;

      document
        .getElementById('export-playwright')
        ?.addEventListener('click', () => this.exportPlaywright());
      document
        .getElementById('export-json')
        ?.addEventListener('click', () => this.exportJSON());
      document
        .getElementById('export-skill')
        ?.addEventListener('click', () => this.exportSkill());
    }
  }

  showSOPList() {
    const listPanel = document.getElementById('sop-list-panel');
    const detailPanel = document.getElementById('sop-detail-panel');

    if (listPanel) listPanel.classList.remove('hidden');
    if (detailPanel) detailPanel.classList.add('hidden');
    this.currentSOP = null;
  }

  async deleteSOP(id) {
    await this.sendMessage({ type: 'DELETE_SOP', id });
    await this.loadSOPs();
  }

  exportPlaywright() {
    if (!this.currentSOP) return;
    
    const optimizedSOP = this.optimizeSOP(this.currentSOP);
    const script = generatePlaywrightScriptWithComments(optimizedSOP);
    this.downloadFile(script, `${this.currentSOP.name}.spec.ts`, 'text/typescript');
  }

  exportJSON() {
    if (!this.currentSOP) return;
    
    const optimizedSOP = this.optimizeSOP(this.currentSOP);
    const json = generatePlaywrightScriptForAI(optimizedSOP);
    this.downloadFile(json, `${this.currentSOP.name}.json`, 'application/json');
  }

  optimizeSOP(sop) {
    const originalActions = sop.actions || [];
    
    const cleanedActions = optimizeActions(originalActions);
    
    const optimizedActions = optimizeSelectors(cleanedActions);
    
    const stats = getOptimizationStats(originalActions, optimizedActions);
    console.log('[Optimizer] Stats:', stats);
    
    return {
      ...sop,
      actions: optimizedActions,
      optimizationStats: stats
    };
  }

  exportSummary() {
    if (!this.currentSOP) return;
    const summary = generateSOPSummary(this.currentSOP);
    this.downloadFile(summary, `${this.currentSOP.name}.md`, 'text/markdown');
  }

  exportSkill() {
    if (!this.currentSOP) return;
    
    const optimizedSOP = this.optimizeSOP(this.currentSOP);
    const skill = generateCompleteSkill(optimizedSOP);
    const skillName = this.currentSOP.name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30) || 'recorded-action';
    this.downloadFile(skill, `${skillName}-skill.md`, 'text/markdown');
  }

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  getActionTypeLabel(type) {
    const labels = {
      click: '🖱️ 点击',
      dblclick: '🖱️ 双击',
      input: '⌨️ 输入',
      select: '📋 选择',
      scroll: '📜 滚动',
      keydown: '⌨️ 按键',
      navigation: '🌐 导航',
      wait: '⏳ 等待',
    };
    return labels[type] || type;
  }

  formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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

new PopupManager();
