const ACTION_MERGE_THRESHOLD_MS = 300;
const INPUT_MERGE_THRESHOLD_MS = 500;

export function optimizeActions(actions) {
  if (!actions || actions.length === 0) return [];

  let optimized = [...actions];
  
  optimized = removeDuplicateActions(optimized);
  optimized = mergeConsecutiveInputs(optimized);
  optimized = removeRedundantScrolls(optimized);
  optimized = addSmartWaits(optimized);
  optimized = identifyActionIntent(optimized);

  return optimized;
}

function sameActionContext(a, b) {
  if ((a.tabId ?? null) !== (b.tabId ?? null)) return false;
  const fa = JSON.stringify(a.frameChain || []);
  const fb = JSON.stringify(b.frameChain || []);
  if (fa !== fb) return false;
  return true;
}

function removeDuplicateActions(actions) {
  const result = [];
  
  for (let i = 0; i < actions.length; i++) {
    const current = actions[i];
    const next = actions[i + 1];
    
    // 处理连续相同 URL 的导航（SPA 路由跳转可能触发多次）
    if (next && 
        current.type === 'navigation' && 
        next.type === 'navigation' &&
        current.url === next.url &&
        sameActionContext(current, next)) {
      // 保留最后一次导航，跳过前面重复的
      continue;
    }
    
    // 处理其他类型的重复操作
    if (next && 
        current.type === next.type && 
        current.selector === next.selector &&
        current.type !== 'scroll' &&
        sameActionContext(current, next)) {
      const timeDiff = (next.timestamp || 0) - (current.timestamp || 0);
      if (timeDiff < ACTION_MERGE_THRESHOLD_MS) {
        continue;
      }
    }
    
    result.push(current);
  }
  
  return result;
}

function mergeConsecutiveInputs(actions) {
  const result = [];
  let currentInput = null;
  
  for (const action of actions) {
    if (action.type === 'input') {
      if (currentInput && 
          currentInput.selector === action.selector &&
          sameActionContext(currentInput, action) &&
          (action.timestamp || 0) - (currentInput.timestamp || 0) < INPUT_MERGE_THRESHOLD_MS) {
        currentInput = {
          ...action,
          value: action.value,
          timestamp: action.timestamp
        };
      } else {
        if (currentInput) {
          result.push(currentInput);
        }
        currentInput = { ...action };
      }
    } else {
      if (currentInput) {
        result.push(currentInput);
        currentInput = null;
      }
      result.push(action);
    }
  }
  
  if (currentInput) {
    result.push(currentInput);
  }
  
  return result;
}

function removeRedundantScrolls(actions) {
  const result = [];
  let lastScroll = null;
  
  for (const action of actions) {
    if (action.type === 'scroll') {
      lastScroll = action;
    } else {
      if (lastScroll) {
        result.push(lastScroll);
        lastScroll = null;
      }
      result.push(action);
    }
  }
  
  return result;
}

function addSmartWaits(actions) {
  const result = [];
  
  for (let i = 0; i < actions.length; i++) {
    const current = actions[i];
    const prev = actions[i - 1];
    const next = actions[i + 1];
    
    // 只在连续导航的最后一个导航后添加等待，避免每个导航都加
    if (current.type === 'navigation' && (!next || next.type !== 'navigation') && (!prev || prev.type !== 'navigation')) {
      result.push({
        type: 'wait',
        waitType: 'networkidle',
        description: 'Wait for page load',
        timestamp: current.timestamp,
        tabId: current.tabId,
      });
    } else if (current.type === 'navigation' && next && next.type !== 'navigation') {
      // 当前是导航，下一个不是导航，说明是连续导航的最后一个
      result.push(current);
      result.push({
        type: 'wait',
        waitType: 'networkidle',
        description: 'Wait for page load',
        timestamp: current.timestamp,
        tabId: current.tabId,
      });
      continue;
    }
    
    if (current.type === 'click' && 
        current.selector?.toLowerCase().includes('submit') ||
        current.selector?.toLowerCase().includes('button[type="submit"]')) {
      result.push(current);
      result.push({
        type: 'wait',
        waitType: 'networkidle',
        description: 'Wait for form submission',
        timestamp: current.timestamp + 100,
        tabId: current.tabId,
      });
      continue;
    }
    
    result.push(current);
  }
  
  return result;
}

function identifyActionIntent(actions) {
  const intents = detectIntents(actions);
  
  return actions.map((action, index) => ({
    ...action,
    intent: intents[index] || null
  }));
}

function detectIntents(actions) {
  const intents = {};
  
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const selector = (action.selector || '').toLowerCase();
    const value = (action.value || '').toLowerCase();
    
    if (selector.includes('login') || selector.includes('signin') || 
        selector.includes('username') || selector.includes('password')) {
      intents[i] = 'login';
    }
    
    if (selector.includes('search') || selector.includes('query') || 
        action.type === 'input' && (value.includes('search') || selector.includes('search'))) {
      intents[i] = 'search';
    }
    
    if (selector.includes('submit') || selector.includes('save') || 
        selector.includes('confirm') || selector.includes('button[type="submit"]')) {
      intents[i] = 'submit';
    }
    
    if (selector.includes('add') || selector.includes('create') || 
        selector.includes('new')) {
      intents[i] = 'create';
    }
    
    if (selector.includes('delete') || selector.includes('remove')) {
      intents[i] = 'delete';
    }
  }
  
  return intents;
}

export function getOptimizationStats(originalActions, optimizedActions) {
  return {
    originalCount: originalActions.length,
    optimizedCount: optimizedActions.length,
    removedCount: originalActions.length - optimizedActions.length,
    removedPercent: Math.round((1 - optimizedActions.length / originalActions.length) * 100)
  };
}

export function generateOptimizationReport(originalActions, optimizedActions) {
  const stats = getOptimizationStats(originalActions, optimizedActions);
  const lines = [];
  
  lines.push('# SOP Optimization Report');
  lines.push('');
  lines.push(`## Statistics`);
  lines.push(`- Original actions: ${stats.originalCount}`);
  lines.push(`- Optimized actions: ${stats.optimizedCount}`);
  lines.push(`- Removed actions: ${stats.removedCount} (${stats.removedPercent}%)`);
  lines.push('');
  
  const intents = new Set();
  optimizedActions.forEach(a => {
    if (a.intent) intents.add(a.intent);
  });
  
  if (intents.size > 0) {
    lines.push(`## Detected Intents`);
    lines.push(`- ${Array.from(intents).join(', ')}`);
    lines.push('');
  }
  
  return lines.join('\n');
}
