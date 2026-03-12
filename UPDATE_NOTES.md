# 连续录制功能更新说明

## 问题描述
之前版本在用户点击链接跳转到新页面时，录制会中断，无法连续录制跨页面的操作流程。

## 解决方案

### 1. Content Script 增强

在 `content/content.js` 中添加了以下功能：

- **自动状态恢复**：页面加载时自动从 background 查询录制状态
- **页面加载监听**：监听 `load` 事件，确保页面完全加载后恢复录制
- **DOM 监控**：使用 MutationObserver 监控 DOM 变化，确保录制指示器始终显示
- **重试机制**：如果 background 还未准备好，会重试获取录制状态

### 2. Background Service Worker 增强

在 `background/background.js` 中添加了以下功能：

- **标签页追踪**：记录正在录制的标签页 ID (`recordingTabId`)
- **标签页切换监听**：监听 `chrome.tabs.onActivated`，切换标签页时自动恢复录制
- **页面导航监听**：监听 `chrome.tabs.onUpdated`，页面加载完成后自动恢复录制
- **智能广播**：优化消息广播逻辑，只发送到有效的 HTTP/HTTPS 页面

## 技术实现

### Content Script 状态恢复流程

```javascript
// 1. 页面加载时检查录制状态
async checkRecordingState() {
  try {
    const response = await chrome.runtime.sendMessage({ 
      type: 'GET_RECORDING_STATE' 
    });
    if (response && response.isRecording) {
      this.isRecording = true;
      this.showRecordingIndicator();
      this.recordNavigation(); // 记录导航动作
    }
  } catch (error) {
    // Background 未准备好，100ms 后重试
    setTimeout(() => this.checkRecordingState(), 100);
  }
}

// 2. 监听页面加载完成
if (document.readyState === 'complete') {
  this.checkRecordingState();
} else {
  window.addEventListener('load', () => this.checkRecordingState());
}

// 3. 监控 DOM 变化，确保录制指示器存在
const observer = new MutationObserver(() => {
  if (this.isRecording && !document.getElementById('ai-recorder-indicator')) {
    this.showRecordingIndicator();
  }
});
observer.observe(document.body || document.documentElement, {
  childList: true,
  subtree: true
});
```

### Background 状态管理流程

```javascript
// 1. 监听标签页激活
chrome.tabs.onActivated.addListener((activeInfo) => {
  if (this.currentSession) {
    this.recordingTabId = activeInfo.tabId;
    // 300ms 后通知新标签页开始录制
    setTimeout(() => {
      this.broadcastToTab(activeInfo.tabId, { type: 'START_RECORDING' });
    }, 300);
  }
});

// 2. 监听页面更新（导航、刷新）
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (this.currentSession && this.recordingTabId === tabId) {
    if (changeInfo.status === 'complete') {
      // 页面加载完成后 500ms 恢复录制
      setTimeout(() => {
        this.broadcastToTab(tabId, { type: 'START_RECORDING' });
      }, 500);
    }
  }
});
```

## 测试方法

### 测试场景 1：基本页面跳转

1. 点击扩展图标，点击"开始录制"
2. 在页面 A 点击一个链接跳转到页面 B
3. 在页面 B 执行一些操作（点击、输入等）
4. 再点击链接跳转到页面 C
5. 点击"停止录制"

**预期结果**：
- 页面跳转后录制指示器仍然显示
- 所有页面的操作都被记录
- SOP 中包含跨页面的所有步骤

### 测试场景 2：表单提交流程

1. 开始录制
2. 在首页点击"登录"按钮
3. 跳转到登录页，输入用户名和密码
4. 点击登录按钮提交
5. 跳转到仪表盘页面
6. 执行其他操作
7. 停止录制

**预期结果**：
- 登录流程的所有步骤都被记录
- 包括页面跳转前后的所有操作

### 测试场景 3：多标签页录制

1. 开始录制
2. 在标签页 1 执行操作
3. 切换到标签页 2（已存在的页面）
4. 在标签页 2 执行操作
5. 回到标签页 1 继续操作
6. 停止录制

**预期结果**：
- 所有标签页的操作都被记录
- 标签页切换流畅，录制不中断

## 录制的数据结构

录制的 SOP 现在会包含完整的跨页面操作流程：

```json
{
  "id": "sop-xxx",
  "name": "跨页面操作流程",
  "actions": [
    {
      "type": "navigation",
      "url": "https://example.com/page1",
      "description": "Navigate to https://example.com/page1"
    },
    {
      "type": "click",
      "selector": "#link-to-page2",
      "description": "click 跳转到页面 2"
    },
    {
      "type": "navigation",
      "url": "https://example.com/page2",
      "description": "Navigate to https://example.com/page2"
    },
    {
      "type": "input",
      "selector": "#username",
      "value": "testuser",
      "description": "input username"
    },
    {
      "type": "click",
      "selector": "#submit",
      "description": "click 提交"
    }
  ]
}
```

## 注意事项

1. **Chrome 权限**：需要 `tabs` 权限来监听标签页变化
2. **延迟设置**：
   - 标签页切换延迟：300ms
   - 页面加载完成延迟：500ms
   - 状态检查重试间隔：100ms
3. **性能优化**：使用防抖和节流避免过多的消息发送
4. **错误处理**：所有异步操作都有 try-catch 保护

## 已知限制

1. **Chrome 内部页面**：无法在 `chrome://` 页面上录制
2. **新标签页**：从地址栏直接输入 URL 打开的新标签页可能无法立即恢复录制
3. **iframe**：iframe 内的操作可能无法完全录制

## 故障排除

### 问题：页面跳转后录制指示器消失

**解决方法**：
1. 检查浏览器控制台是否有错误
2. 确认 content script 已正确注入
3. 刷新页面重试

### 问题：跨页面操作没有被记录

**解决方法**：
1. 确保在同一个标签页中操作
2. 检查 background service worker 是否正常运行
3. 在 `chrome://extensions/` 页面查看扩展状态

### 问题：录制状态不同步

**解决方法**：
1. 停止录制，重新开始
2. 刷新所有相关页面
3. 检查多个标签页之间的切换

## 更新日志

**v1.0.1** - 2024-03-11
- ✅ 修复页面跳转导致录制的中断问题
- ✅ 添加标签页切换监听
- ✅ 添加页面加载完成自动恢复
- ✅ 添加 DOM 监控确保录制指示器显示
- ✅ 优化消息广播逻辑
- ✅ 添加状态检查和重试机制
