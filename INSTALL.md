# AI Recorder 快速安装指南

## 第一步：确认项目文件

确保项目目录包含以下文件：

```
AIRecorder/
├── manifest.json          ✓
├── background/
│   └── background.js      ✓
├── content/
│   └── content.js         ✓
├── popup/
│   ├── popup.html         ✓
│   ├── popup.css          ✓
│   └── popup.js           ✓
├── utils/
│   ├── helpers.js         ✓
│   ├── selector.js        ✓
│   ├── storage.js         ✓
│   └── playwright-generator.js  ✓
└── icons/
    ├── icon16.png         ✓
    ├── icon48.png         ✓
    └── icon128.png        ✓
```

## 第二步：安装扩展

### Chrome 浏览器

1. 打开 Chrome 浏览器
2. 在地址栏输入：`chrome://extensions/` 并回车
3. 在页面右上角，打开"开发者模式"开关
4. 点击"加载已解压的扩展程序"按钮
5. 在文件选择器中，找到并选择 `AIRecorder` 文件夹
6. 扩展将出现在扩展列表中
7. 在工具栏中找到 AI Recorder 图标（蓝色圆形图标）

### Edge 浏览器

1. 打开 Edge 浏览器
2. 在地址栏输入：`edge://extensions/` 并回车
3. 在左侧打开"开发人员模式"开关
4. 点击"加载解压的扩展程序"按钮
5. 选择 `AIRecorder` 文件夹
6. 扩展安装完成

## 第三步：测试扩展

### 测试录制功能

1. **开始录制**
   - 点击浏览器工具栏中的 AI Recorder 图标
   - 在弹出窗口中输入 SOP 名称，如"测试登录流程"
   - 点击"开始录制"按钮
   - 页面右上角应该出现红色的"Recording..."指示器

2. **执行操作**
   - 打开一个新的网页，如 `https://www.example.com`
   - 点击页面上的链接或按钮
   - 在输入框中输入文字
   - 滚动页面

3. **停止录制**
   - 回到 AI Recorder 弹出窗口
   - 点击"停止录制"按钮
   - 录制指示器消失
   - SOP 列表中显示刚才录制的 SOP

4. **查看 SOP**
   - 点击 SOP 列表中的"查看"按钮
   - 查看录制的操作步骤
   - 每个步骤显示操作类型和选择器

### 测试导出功能

1. **导出 Playwright 脚本**
   - 在 SOP 详情页面点击"导出 Playwright"
   - 浏览器将下载 `.spec.ts` 文件
   - 用文本编辑器打开查看生成的代码

2. **导出 JSON**
   - 点击"导出 JSON"
   - 下载 JSON 文件
   - 查看结构化的操作步骤数据

3. **导出摘要**
   - 点击"导出摘要"
   - 下载 Markdown 文件
   - 查看人类可读的操作步骤文档

## 常见问题

### Q: 扩展图标不显示？
A: 点击浏览器工具栏右上角的拼图图标，在扩展管理中找到 AI Recorder，点击图钉图标固定到工具栏。

### Q: 点击"开始录制"没有反应？
A: 
1. 检查是否在正确的页面上（不能是 chrome:// 页面）
2. 刷新页面后重试
3. 检查浏览器控制台是否有错误

### Q: 录制的操作不准确？
A: 
1. 确保页面完全加载后再开始录制
2. 避免快速连续操作
3. 尽量使用稳定的元素（有 ID 或 data-testid 的元素）

### Q: 导出的脚本无法运行？
A: 
1. 确保已安装 Playwright：`npm install -D @playwright/test`
2. 检查 Playwright 配置
3. 可能需要调整选择器以适应具体环境

## 下一步

- 尝试录制一个完整的用户流程（如登录、搜索、下单）
- 导出生成的 Playwright 脚本并在项目中运行
- 将 JSON 格式的操作步骤集成到 AI 系统中
- 根据需要自定义脚本生成逻辑

## 技术支持

如遇到问题，请检查：
1. 浏览器版本是否支持 Manifest V3 扩展
2. 所有项目文件是否完整
3. 浏览器控制台和扩展管理页面的错误信息

祝使用愉快！
