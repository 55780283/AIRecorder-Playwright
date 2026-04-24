const SELECTOR_PRIORITY = [
  'data-testid',
  'data-test',
  'data-cy',
  'data-automation-id',
  'id',
  'aria-label',
  'name',
  'placeholder',
  'title',
  'role',
];

const UNSTABLE_PATTERNS = [
  /nth-child\(\d+\)/,
  /:nth-of-type/,
  /:first-child/,
  /:last-child/,
  /\[class\*=/,
  /\.css-/,
  /\.scss-/,
  /\._[a-f0-9]+/,
];

export function optimizeSelector(selector, element) {
  if (!selector) return selector;
  
  if (isStableSelector(selector)) {
    return selector;
  }
  
  const alternatives = generateAlternativeSelectors(selector, element);
  
  if (alternatives.length > 0) {
    // 从候选中选择评分最高的
    return selectBestSelector(alternatives) || alternatives[0];
  }
  
  return selector;
}

export function optimizeSelectors(actions) {
  return actions.map(action => {
    if (!action.selector) return action;
    
    const optimizedSelector = optimizeSelector(action.selector, null);
    
    return {
      ...action,
      originalSelector: action.selector,
      selector: optimizedSelector,
      selectorAlternatives: generateAlternativeSelectors(action.selector, null)
    };
  });
}

function isStableSelector(selector) {
  for (const pattern of UNSTABLE_PATTERNS) {
    if (pattern.test(selector)) {
      return false;
    }
  }
  return true;
}

function generateAlternativeSelectors(selector, element) {
  const alternatives = [];
  
  // ID 优先级最高
  const idMatch = selector.match(/#([a-zA-Z][a-zA-Z0-9_-]*)/);
  if (idMatch) {
    alternatives.push(`#${idMatch[1]}`);
  }
  
  // 属性选择器
  const attrMatch = selector.match(/\[([a-zA-Z-]+)="([^"]+)"\]/);
  if (attrMatch) {
    const [, attr, value] = attrMatch;
    if (SELECTOR_PRIORITY.includes(attr)) {
      alternatives.push(`[${attr}="${value}"]`);
    }
  }
  
  // 从原有选择器提取已有的文本
  const textMatch = selector.match(/:has-text\("([^"]+)"\)/);
  if (textMatch) {
    alternatives.push(`:has-text("${textMatch[1]}")`);
    alternatives.push(`:text("${textMatch[1]}")`);
  }
  
  // 对于按钮，优先使用文本选择器 - 这比 nth-child 稳定多了
  if (selector.includes('button') || selector.toLowerCase().includes('span')) {
    const buttonText = extractButtonText(selector);
    if (buttonText && buttonText.trim().length > 0) {
      alternatives.push(`:has-text("${buttonText.trim()}")`);
      alternatives.push(`:text("${buttonText.trim()}")`);
    }
  }
  
  // 对于链接，同样优先文本选择器
  if (selector.includes('a') || selector.includes('link')) {
    const linkText = extractLinkText(selector);
    if (linkText && linkText.trim().length > 0) {
      alternatives.push(`a:has-text("${linkText.trim()}")`);
      alternatives.push(`:has-text("${linkText.trim()}")`);
    }
  }
  
  if (selector.includes('input') || selector.includes('textarea')) {
    const inputName = extractAttribute(selector, 'name');
    const inputPlaceholder = extractAttribute(selector, 'placeholder');
    
    if (inputName) {
      alternatives.push(`[name="${inputName}"]`);
    }
    if (inputPlaceholder) {
      alternatives.push(`[placeholder="${inputPlaceholder}"]`);
    }
  }
  
  return [...new Set(alternatives)].filter(s => s && s.length > 0);
}

function extractButtonText(selector) {
  const patterns = [
    /button[^>]*>([^<]+)</,
    /:has-text\("([^"]+)"\)/,
  ];
  
  for (const pattern of patterns) {
    const match = selector.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

function extractAttribute(selector, attr) {
  const pattern = new RegExp(`\\[${attr}="([^"]+)"\\]`);
  const match = selector.match(pattern);
  return match ? match[1] : null;
}

function extractLinkText(selector) {
  const patterns = [
    /a[^>]*>([^<]+)</,
    /:has-text\("([^"]+)"\)/,
  ];
  
  for (const pattern of patterns) {
    const match = selector.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

export function validateSelector(selector) {
  const issues = [];
  
  if (!selector) {
    issues.push('Empty selector');
    return { valid: false, issues };
  }
  
  for (const pattern of UNSTABLE_PATTERNS) {
    if (pattern.test(selector)) {
      issues.push(`Unstable pattern detected: ${pattern.source}`);
    }
  }
  
  if (selector.split('>').length > 5) {
    issues.push('Selector too deep (>5 levels)');
  }
  
  if (selector.includes('nth-child') && selector.includes('nth-child')) {
    issues.push('Multiple nth-child usage');
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

export function getSelectorScore(selector) {
  let score = 100;
  
  for (const pattern of UNSTABLE_PATTERNS) {
    if (pattern.test(selector)) {
      score -= 20;
    }
  }
  
  if (selector.startsWith('#')) {
    score += 30;
  }
  
  if (SELECTOR_PRIORITY.some(attr => selector.includes(`[${attr}=`))) {
    score += 25;
  }
  
  if (selector.includes(':has-text') || selector.includes(':text')) {
    score += 15;
  }
  
  const depth = selector.split(/[>\s]+/).length;
  score -= Math.max(0, (depth - 2) * 5);
  
  return Math.max(0, Math.min(100, score));
}

export function selectBestSelector(selectors) {
  if (!selectors || selectors.length === 0) return null;
  
  const scored = selectors.map(s => ({
    selector: s,
    score: getSelectorScore(s)
  }));
  
  scored.sort((a, b) => b.score - a.score);
  
  return scored[0].selector;
}
