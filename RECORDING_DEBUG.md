# 录制功能调试指南

## 🔍 快速诊断步骤

### 步骤 1：打开所有控制台

1. **Background Service Worker 控制台**
   ```
   chrome://extensions/ → AI Recorder → Service Worker
   ```

2. **页面控制台**
   ```
   打开任意网页 → F12 → Console
   ```

3. **Popup 控制台**（如果打开 popup）
   ```
   点击 popup → 右键 → 检查
   ```

### 步骤 2：开始录制并观察日志

#### 点击"开始录制"后，应该看到：

**Background 控制台：**
```
[Background] 开始录制，名称：xxx 描述：xxx
[Background] 创建的 SOP: {id: "sop-xxx", name: "xxx"}
[Background] 当前 Session 初始化：{sopId: "sop-xxx", actions: []}
```

**页面控制台：**
```
[Content] 检查录制状态...
[Content] 录制状态响应：{isRecording: true}
[Content] 开始录制！
```

### 步骤 3：执行操作并观察

#### 点击页面元素后：

**页面控制台：**
```
[Content] 发送录制动作：click click 登录按钮
```

**Background 控制台：**
```
[Background] 记录操作：click 当前操作数量：1
```

**如果没有看到这些日志，说明录制有问题！**

## 🐛 常见问题排查

### 问题 1：点击"开始录制"后没有任何反应

**检查点：**
1. Background 控制台有日志吗？
2. Popup 控制台有错误吗？

**可能原因：**
- Background Service Worker 未启动
- 消息传递失败

**解决方法：**
```
1. chrome://extensions/ → 重新加载扩展
2. 刷新所有页面
3. 重新尝试
```

### 问题 2：页面控制台显示"未录制，忽略操作"

**检查点：**
1. 页面控制台有 `[Content] 检查录制状态...` 吗？
2. 有 `[Content] 开始录制！` 吗？

**可能原因：**
- Content script 没有收到 START_RECORDING 消息
- isRecording 状态没有正确设置

**解决方法：**
```
1. 刷新页面
2. 确保页面右上角出现红色录制指示器
3. 如果没有，重新点击"开始录制"
```

### 问题 3：Background 显示"录制未开始，无法记录操作"

**检查点：**
1. currentSession 是否为 null？
2. startRecording 是否成功执行？

**可能原因：**
- startRecording 失败
- session 被意外清除

**解决方法：**
```
1. 查看 startRecording 的日志
2. 确认 SOP 创建成功
3. 重新录制
```

### 问题 4：录制指示器不显示

**检查点：**
1. 页面控制台有错误吗？
2. content.js 是否正确加载？

**可能原因：**
- Content script 未注入
- DOM 操作失败

**解决方法：**
```
1. 刷新页面
2. 检查 manifest.json 中 content_scripts 配置
3. 确认 matches: ["<all_urls>"]
```

## ✅ 完整的录制流程日志

### 正常的录制过程应该看到：

```
=== 开始录制 ===
[Background] 开始录制，名称：测试 SOP 描述：测试
[Background] 创建的 SOP: {id: "sop-123", name: "测试 SOP"}
[Background] 当前 Session 初始化：{sopId: "sop-123", actions: []}

=== 页面加载 ===
[Content] 检查录制状态...
[Content] 录制状态响应：{isRecording: true}
[Content] 开始录制！

=== 执行操作 ===
[Content] 发送录制动作：click click 登录按钮
[Background] 记录操作：click 当前操作数量：1
[Content] 发送录制动作：input input username
[Background] 记录操作：input 当前操作数量：2

=== 停止录制 ===
[Background] 停止录制，当前 session: {...}
[Background] 从存储获取的 SOP: {...}
[Background] Session 中的操作数量：2
[Background] SOP 已保存，操作数量：2
[Background] 录制已停止
```

## 🔧 手动测试录制

### 测试步骤：

1. **打开测试页面**
   ```
   https://www.example.com
   ```

2. **打开页面控制台**
   ```
   F12 → Console
   ```

3. **开始录制**
   - 点击 AI Recorder 图标
   - 输入 SOP 名称
   - 点击"开始录制"

4. **观察日志**
   - 页面控制台应该显示 `[Content] 开始录制！`
   - 页面右上角应该出现红色指示器

5. **执行操作**
   - 点击页面上的链接
   - 在输入框输入文字
   - 观察控制台日志

6. **检查结果**
   - 每次操作都应该有日志
   - Background 控制台显示操作数量递增

## 📊 验证录制成功

### 录制成功后检查：

1. **SOP 列表**
   ```
   打开 popup → 查看 SOP 列表 → 应该有刚录制的 SOP
   ```

2. **SOP 详情**
   ```
   点击"查看" → 应该看到录制的步骤
   ```

3. **导出的脚本**
   ```
   点击"导出 Playwright" → 打开文件 → 应该有录制的内容
   ```

## 🎯 关键检查点

### Content Script 检查
- [ ] 页面加载时检查录制状态
- [ ] 收到 START_RECORDING 消息
- [ ] isRecording 设置为 true
- [ ] 显示录制指示器
- [ ] 点击操作触发 recordAction
- [ ] 发送 RECORD_ACTION 消息

### Background 检查
- [ ] 收到 START_RECORDING 消息
- [ ] 创建 SOP
- [ ] 初始化 currentSession
- [ ] 收到 RECORD_ACTION 消息
- [ ] 更新 currentSession.actions
- [ ] 保存到 storage
- [ ] 停止录制时正确保存

### Popup 检查
- [ ] 点击"开始录制"发送消息
- [ ] 更新 UI 状态
- [ ] 点击"停止录制"发送消息
- [ ] 等待数据保存
- [ ] 刷新 SOP 列表

## 💡 调试技巧

### 1. 添加临时日志

在关键位置添加：
```javascript
console.log('[DEBUG] 函数名，参数:', 参数值);
```

### 2. 检查消息传递

测试消息是否能正常发送和接收：
```javascript
// 在页面控制台执行
chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATE' }, (response) => {
  console.log('状态:', response);
});
```

### 3. 检查 storage 数据

```javascript
// 在页面控制台执行
chrome.storage.local.get(null, (result) => {
  console.log('存储数据:', JSON.stringify(result, null, 2));
});
```

### 4. 强制开始录制

如果自动检测失败，可以手动触发：
```javascript
// 在页面控制台执行
chrome.runtime.sendMessage({ type: 'START_RECORDING' }, () => {
  console.log('录制已开始');
});
```

## 🆘 终极解决方案

### 如果所有方法都失败：

1. **完全重置扩展**
   ```
   chrome://extensions/ → 移除 AI Recorder
   重新加载扩展
   刷新所有页面
   ```

2. **清除存储数据**
   ```javascript
   // 在任意页面控制台执行
   chrome.storage.local.clear(() => {
     console.log('存储已清除');
     location.reload();
   });
   ```

3. **重新安装扩展**
   ```
   删除扩展
   重新加载未打包的扩展
   ```

## 📝 报告问题模板

如果问题依然存在，请提供以下信息：

```
### 环境信息
- Chrome 版本：
- 扩展版本：1.0.0
- 操作系统：

### 问题描述
[详细描述遇到的问题]

### Background 日志
[复制完整的日志输出]

### 页面控制台日志
[复制完整的日志输出]

### 复现步骤
1. 
2. 
3. 

### 已尝试的解决方法
1. 
2. 
3. 
```

祝调试顺利！🎉
