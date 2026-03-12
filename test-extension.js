// 在 Chrome 控制台执行此代码测试扩展

console.log('=== AI Recorder 扩展测试 ===\n');

// 测试 1：检查 Chrome API
console.log('1. 检查 Chrome API:');
console.log('   chrome.runtime:', chrome.runtime ? '✅' : '❌');
console.log('   chrome.runtime.id:', chrome.runtime?.id || '未找到');
console.log('   chrome.runtime.sendMessage:', typeof chrome.runtime.sendMessage);
console.log('   chrome.storage:', chrome.storage ? '✅' : '❌');

// 测试 2：发送测试消息
console.log('\n2. 测试消息传递:');
chrome.runtime.sendMessage({ type: 'TEST' }, (response) => {
  if (chrome.runtime.lastError) {
    console.log('   ❌ 错误:', chrome.runtime.lastError.message);
  } else {
    console.log('   ✅ 响应:', response);
  }
});

// 测试 3：检查存储
console.log('\n3. 检查存储:');
chrome.storage.local.get(null, (result) => {
  console.log('   存储内容:', Object.keys(result));
  console.log('   SOPs:', result.sops ? '✅' : '❌');
  console.log('   Settings:', result.settings ? '✅' : '❌');
});

// 测试 4：获取 SOP 列表
console.log('\n4. 获取 SOP 列表:');
chrome.runtime.sendMessage({ type: 'GET_SOPS' }, (response) => {
  console.log('   SOP 数量:', response?.sops ? Object.keys(response.sops).length : 0);
});

// 测试 5：检查录制状态
console.log('\n5. 检查录制状态:');
chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATE' }, (response) => {
  console.log('   是否录制中:', response?.isRecording || false);
  console.log('   Session:', response?.session ? '✅' : '❌');
});

console.log('\n=== 测试完成 ===');
