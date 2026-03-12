# 调试指南 - 录制功能

## 🔍 问题诊断步骤

### 步骤 1：打开开发者工具

1. 访问 `chrome://extensions/`
2. 找到 AI Recorder 扩展
3. 点击"Service Worker"链接
4. 这会打开 Background Service Worker 的开发者工具

### 步骤 2：开始录制并观察日志

```
1. 点击 popup 中的"开始录制"
2. 查看 Background 控制台的日志输出
3. 应该看到：
   - [Background] 开始录制，名称：xxx
   - [Background] 创建的 SOP: {id: ..., name: ...}
   - [Background] 当前 Session 初始化：{sopId: ..., actions: []}
```

### 步骤 3：执行操作并观察

```
1. 在页面中点击一些元素
2. 查看 Background 控制台的日志
3. 应该看到：
   - [Background] 记录操作：click 当前操作数量：1
   - [Background] 记录操作：input 当前操作数量：2
   - ...
```

### 步骤 4：停止录制并检查

```
1. 点击"停止录制"
2. 查看日志输出：
   - [Background] 停止录制，当前 session: {...}
   - [Background] 从存储获取的 SOP: {...}
   - [Background] Session 中的操作数量：X
   - [Background] SOP 已保存，操作数量：X
   - [Background] 录制已停止
```

## 🐛 常见问题排查

### 问题 1：没有看到"记录操作"日志

**原因**：Content script 没有正确发送消息

**解决方法**：
1. 打开页面的开发者工具（F12）
2. 查看 Console 是否有错误
3. 检查 content.js 是否正确加载

### 问题 2：看到"录制未开始"警告

**原因**：Background 和 Content script 状态不同步

**解决方法**：
1. 刷新页面
2. 重新开始录制
3. 确保 popup 没有关闭

### 问题 3：操作数量为 0

**原因**：操作没有被正确记录到 session

**解决方法**：
1. 检查 startRecording 是否成功执行
2. 检查 currentSession 是否正确初始化
3. 查看是否有 JavaScript 错误

### 问题 4：SOP 保存后操作丢失

**原因**：storage.js 中的 addActionToSOP 没有正确保存

**解决方法**：
1. 打开 Chrome DevTools
2. 访问 Application → Local Storage
3. 查看 chrome.storage.local 中的数据
4. 检查 sops 对象中的 actions 数组

## 📊 预期的完整日志流程

### 开始录制
```
[Background] 开始录制，名称：测试 SOP 描述：测试录制
[Background] 创建的 SOP: {
  id: "sop-1710123456789-abc123",
  name: "测试 SOP",
  description: "测试录制",
  actions: [],
  ...
}
[Background] 当前 Session 初始化：{
  sopId: "sop-1710123456789-abc123",
  actions: [],
  startTime: 1710123456789
}
```

### 录制操作
```
[Background] 记录操作：click 当前操作数量：1
[Background] 记录操作：input 当前操作数量：2
[Background] 记录操作：click 当前操作数量：3
```

### 停止录制
```
[Background] 停止录制，当前 session: {
  sopId: "sop-1710123456789-abc123",
  actions: [...],
  startTime: 1710123456789
}
[Background] 从存储获取的 SOP: {
  id: "sop-1710123456789-abc123",
  name: "测试 SOP",
  actions: [...]
}
[Background] Session 中的操作数量：3
[Background] SOP 已保存，操作数量：3
[Background] 录制已停止
```

## 🔧 手动检查数据

### 方法 1：通过 DevTools

1. 打开任意页面的 DevTools（F12）
2. 切换到 Console 标签
3. 输入以下命令：
```javascript
chrome.runtime.sendMessage({ type: 'GET_SOPS' }, (response) => {
  console.log('SOPs:', response);
});
```

### 方法 2：通过 Application 面板

1. 打开 `chrome://extensions/`
2. 点击 AI Recorder 的"Service Worker"
3. 在 DevTools 中切换到 Application 面板
4. 展开 Storage → Local Storage
5. 查看存储的数据

## ✅ 验证修复

### 测试步骤

1. **重新加载扩展**
   ```
   chrome://extensions/ → AI Recorder → 刷新
   ```

2. **打开 Background 控制台**
   ```
   chrome://extensions/ → AI Recorder → Service Worker
   ```

3. **开始录制**
   - 点击 popup 图标
   - 输入 SOP 名称
   - 点击"开始录制"
   - 观察日志

4. **执行操作**
   - 打开一个新页面
   - 点击一些元素
   - 输入一些文本
   - 观察日志中的操作计数

5. **停止录制**
   - 点击"停止录制"
   - 观察日志中的 SOP 保存信息
   - 检查操作数量是否正确

6. **验证结果**
   - 打开 SOP 列表
   - 点击"查看"按钮
   - 检查步骤是否都显示了
   - 导出 Playwright 脚本查看内容

## 🎯 关键检查点

- ✅ startRecording 成功执行
- ✅ currentSession 正确初始化
- ✅ recordAction 被调用
- ✅ actions 数组数量递增
- ✅ stopRecording 正确保存数据
- ✅ SOP 中的 actions 数量正确

## 📝 调试技巧

### 1. 添加更多日志

在关键位置添加 console.log：
```javascript
console.log('[DEBUG] 变量名:', 变量值);
```

### 2. 使用断点

在关键函数中设置断点：
- startRecording
- recordAction
- stopRecording
- addActionToSOP

### 3. 检查消息传递

验证消息是否正确发送和接收：
```javascript
// 在 content.js 中
console.log('发送消息:', message);

// 在 background.js 中
console.log('收到消息:', message);
```

## 🆘 如果问题依然存在

请提供以下信息：

1. **完整的日志输出**
   - 从开始录制到停止录制的所有日志

2. **SOP 数据**
   ```javascript
   chrome.runtime.sendMessage({ type: 'GET_SOPS' }, (response) => {
     console.log(JSON.stringify(response, null, 2));
   });
   ```

3. **浏览器版本**
   ```
   chrome://version/
   ```

4. **扩展版本**
   ```
   chrome://extensions/ → AI Recorder → 版本号
   ```

祝调试顺利！🎉
