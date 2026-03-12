# 🔍 深度排查指南

## 第一步：确认扩展是否正确加载

### 1. 检查扩展状态

访问：`chrome://extensions/`

**检查项：**
- [ ] AI Recorder 是否存在？
- [ ] 开关是否是蓝色（开启状态）？
- [ ] 有没红色错误提示？
- [ ] 版本号是 1.0.0 吗？

**如果有错误，请截图错误信息！**

### 2. 查看 Service Worker 状态

在 `chrome://extensions/` 页面：
1. 打开 AI Recorder 的"详情"
2. 点击"Service Worker"链接
3. 这会打开一个新的开发者工具窗口

**检查项：**
- [ ] Service Worker 窗口能打开吗？
- [ ] Console 标签有内容吗？
- [ ] 有没错误信息？

### 3. 检查 content script 是否注入

打开任意网页（如 example.com），然后：

**方法 1：查看页面源码**
```
1. 右键 → 查看页面源代码
2. 搜索 "content.js" 或 "AI Recorder"
3. 如果能找到，说明 script 已注入
```

**方法 2：在页面控制台测试**
```
1. 按 F12 打开开发者工具
2. Console 标签
3. 输入：console.log('测试')
4. 能看到输出吗？
```

**方法 3：检查元素**
```
1. 按 F12 打开开发者工具
2. Elements 标签
3. 查看 <head> 或 <body> 中是否有 extension 相关的 script
```

## 第二步：手动测试消息传递

### 测试 1：从页面发送消息

在任意页面的控制台中执行：

```javascript
// 测试能否连接到 background
chrome.runtime.sendMessage(
  chrome.runtime.id, 
  { type: 'TEST' }, 
  (response) => {
    console.log('响应:', response);
    if (chrome.runtime.lastError) {
      console.log('错误:', chrome.runtime.lastError.message);
    }
  }
);
```

**预期结果：**
- ✅ 如果有响应或错误，说明连接正常
- ❌ 如果完全没反应，说明 extension 未加载

### 测试 2：从 popup 发送消息

1. 点击 AI Recorder 图标打开 popup
2. 右键 → 检查
3. Console 标签
4. 输入：

```javascript
chrome.runtime.sendMessage({ type: 'GET_SOPS' }, (response) => {
  console.log('SOPs:', response);
});
```

**预期结果：**
- ✅ 应该看到 SOPs 列表（即使是空的）

### 测试 3：检查 storage

在任意控制台执行：

```javascript
chrome.storage.local.get(null, (result) => {
  console.log('存储内容:', JSON.stringify(result, null, 2));
});
```

**预期结果：**
- ✅ 应该看到存储的数据结构

## 第三步：强制重新加载

### 方法 1：完全重置

```
1. chrome://extensions/
2. 移除 AI Recorder（如果有移除按钮）
3. 点击"加载已解压的扩展程序"
4. 重新选择 AIRecorder 文件夹
5. 刷新所有页面（Ctrl+Shift+R）
```

### 方法 2：清除缓存

```
1. chrome://extensions/
2. 右上角打开"开发者模式"
3. 点击每个扩展的刷新按钮
4. 清除浏览器缓存（Ctrl+Shift+Delete）
5. 重启 Chrome
```

### 方法 3：检查文件权限

在终端执行：

```bash
cd /Users/work/trae-projects/AIRecorder
ls -la
```

**检查项：**
- [ ] 所有文件都存在吗？
- [ ] 文件有读取权限吗？

## 第四步：验证 manifest.json

在 Chrome 地址栏输入：

```
chrome://extensions/
```

找到 AI Recorder，检查：

- [ ] 名称：AI Recorder
- [ ] ID：一串字符（如 abcdefghijklmnop）
- [ ] 来源：已加载的扩展程序
- [ ] 权限：存储、活动标签页、脚本、标签页、上下文菜单

## 第五步：逐步调试

### 步骤 1：最简单的测试

创建一个测试文件 `test.html`：

```html
<!DOCTYPE html>
<html>
<head>
  <title>测试</title>
</head>
<body>
  <h1>测试页面</h1>
  <button id="test-btn">点击我</button>
  
  <script>
    // 检查 extension
    console.log('Extension ID:', chrome.runtime?.id);
    console.log('Can send message:', typeof chrome.runtime.sendMessage);
    
    // 测试按钮
    document.getElementById('test-btn').addEventListener('click', () => {
      console.log('按钮被点击了！');
    });
  </script>
</body>
</html>
```

打开这个页面，检查控制台输出。

### 步骤 2：添加全局日志

在 `content/content.js` 最顶部添加：

```javascript
console.log('[Content] 文件已加载！URL:', window.location.href);
```

然后刷新页面，看是否有输出。

### 步骤 3：检查 background

在 `background/background.js` 最顶部添加：

```javascript
console.log('[Background] Service Worker 已启动！');
```

然后打开 Service Worker 控制台查看。

## 第六步：系统信息

请提供以下信息：

### 1. Chrome 版本
```
chrome://version/
复制完整信息
```

### 2. 扩展详情
```
chrome://extensions/
点击 AI Recorder 的"详情"
截图或复制所有信息
```

### 3. 控制台输出

**Background 控制台：**
```
1. chrome://extensions/ → Service Worker
2. Console 标签
3. 截图或复制所有内容
```

**页面控制台：**
```
1. 打开 example.com
2. F12 → Console
3. 截图或复制所有内容
```

**Popup 控制台：**
```
1. 打开 popup
2. 右键 → 检查
3. Console 标签
4. 截图或复制所有内容
```

### 4. 文件结构

在终端执行：

```bash
cd /Users/work/trae-projects/AIRecorder
find . -type f -name "*.js" -o -name "*.json" -o -name "*.html" | head -20
```

## 第七步：常见问题分析

### 问题 A：扩展未加载

**症状：**
- chrome://extensions/ 看不到 AI Recorder
- 或者看到了但有错误

**解决：**
```
1. 确认文件夹路径正确
2. 重新加载扩展
3. 检查 manifest.json 格式
```

### 问题 B：Content script 未注入

**症状：**
- 页面控制台没有任何 [Content] 日志
- 页面右上角没有录制指示器

**解决：**
```
1. 检查 manifest.json 的 content_scripts 配置
2. 确认 matches: ["<all_urls>"]
3. 确认 run_at: "document_start"
4. 刷新页面（硬刷新 Ctrl+Shift+R）
```

### 问题 C：消息传递失败

**症状：**
- Background 和 Content 无法通信
- sendMessage 没有响应

**解决：**
```
1. 检查 background.js 的 onMessage 监听器
2. 检查消息类型是否匹配
3. 确认 return true 在异步处理中
```

### 问题 D：Storage 无法写入

**症状：**
- SOP 保存失败
- 数据丢失

**解决：**
```
1. 检查 storage 权限
2. 检查 chrome.storage.local 是否可用
3. 清除存储数据重试
```

## 📋 请提供的信息

为了帮你解决问题，请提供：

1. **chrome://extensions/ 截图**
   - 显示 AI Recorder 是否存在
   - 显示是否有错误

2. **Service Worker 控制台截图**
   - 打开 Service Worker 后的 Console 内容

3. **页面控制台截图**
   - 打开 example.com 按 F12 的 Console 内容

4. **Popup 控制台截图**
   - 打开 popup 右键检查的 Console 内容

5. **以下命令的输出：**

```bash
cd /Users/work/trae-projects/AIRecorder
cat manifest.json
```

有了这些信息，我就能准确定位问题！🎯
