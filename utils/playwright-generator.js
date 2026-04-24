const DEFAULT_OPTIONS = {
  headless: false,
  slowMo: 100,
  timeout: 30000,
  screenshot: false,
  video: false,
};

export function generatePlaywrightScript(sop, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lines = [];
  const actions = sop.actions || [];
  const ctx = buildCodegenContext(actions);

  lines.push(`import { test, expect } from '@playwright/test';`);
  lines.push('');
  lines.push(`test.describe('${escapeString(sop.name)}', () => {`);
  lines.push(`  test('${escapeString(sop.name)}', async ({ page }) => {`);

  if (opts.timeout) {
    lines.push(`    test.setTimeout(${opts.timeout});`);
    lines.push('');
  }

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const actionLines = generateActionCode(action, opts, ctx, i);
    lines.push(...actionLines.map(line => `    ${line}`));
    lines.push('');
  }

  lines.push(`  });`);
  lines.push(`});`);

  return lines.join('\n');
}

export function generateSkill(sop) {
  const lines = [];

  const skillName = sop.name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30) || 'recorded-action';

  const intents = [...new Set(sop.actions.filter(a => a.intent).map(a => a.intent))];
  const description = intents.length > 0 
    ? `Executes ${sop.name} workflow (${intents.join(', ')}). Invoke when user wants to perform this recorded workflow.`
    : `Executes ${sop.name}. Invoke when user wants to perform this recorded workflow or automate this specific task.`;

  lines.push(`---`);
  lines.push(`name: "${skillName}"`);
  lines.push(`description: "${description}"`);
  lines.push(`---`);
  lines.push('');
  lines.push(`# ${sop.name}`);
  lines.push('');
  
  if (sop.description) {
    lines.push(sop.description);
    lines.push('');
  }

  if (sop.optimizationStats) {
    lines.push(`## Optimization`);
    lines.push(`- Original steps: ${sop.optimizationStats.originalCount}`);
    lines.push(`- Optimized steps: ${sop.optimizationStats.optimizedCount}`);
    lines.push(`- Reduced: ${sop.optimizationStats.removedPercent}%`);
    lines.push('');
  }

  lines.push(`## Purpose`);
  lines.push(`Automates the workflow: ${sop.name}`);
  lines.push('');

  const parameters = extractParameters(sop);
  if (parameters.length > 0) {
    lines.push(`## Parameters`);
    lines.push('');
    parameters.forEach(param => {
      lines.push(`- \`${param.name}\`: ${param.description}`);
    });
    lines.push('');
  }

  lines.push(`## Steps`);
  lines.push('');

  for (let i = 0; i < sop.actions.length; i++) {
    const action = sop.actions[i];
    lines.push(`${i + 1}. **${getActionTitle(action.type)}**: ${action.description}`);
    lines.push(`   - Selector: \`${action.selector}\``);
    if (action.value) {
      lines.push(`   - Value: \`${action.value}\``);
    }
    if (action.intent) {
      lines.push(`   - Intent: ${action.intent}`);
    }
    lines.push('');
  }

  lines.push(`## Example Usage`);
  lines.push('');
  lines.push(`"Please execute the ${sop.name} workflow"`);
  lines.push('');
  lines.push(`"Run the ${skillName} skill"`);

  return lines.join('\n');
}

export function generateCompleteSkill(sop) {
  const lines = [];

  const skillName = sop.name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30) || 'recorded-action';

  const intents = [...new Set(sop.actions.filter(a => a.intent).map(a => a.intent))];
  const description = intents.length > 0 
    ? `Executes ${sop.name} workflow (${intents.join(', ')}). Invoke when user wants to perform this recorded workflow.`
    : `Executes ${sop.name}. Invoke when user wants to perform this recorded workflow or automate this specific task.`;

  lines.push(`---`);
  lines.push(`name: "${skillName}"`);
  lines.push(`description: "${description}"`);
  lines.push(`version: "1.0"`);
  lines.push(`author: "AI Recorder"`);
  lines.push(`generated: "${new Date().toISOString()}"`);
  lines.push(`---`);
  lines.push('');
  lines.push(`# ${sop.name}`);
  lines.push('');
  
  if (sop.description) {
    lines.push(sop.description);
    lines.push('');
  }

  lines.push(`## Overview`);
  lines.push('');
  lines.push(`This skill automates the **${sop.name}** workflow using Playwright.`);
  lines.push('');

  if (sop.optimizationStats) {
    lines.push(`### Optimization Stats`);
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Original Steps | ${sop.optimizationStats.originalCount} |`);
    lines.push(`| Optimized Steps | ${sop.optimizationStats.optimizedCount} |`);
    lines.push(`| Reduction | ${sop.optimizationStats.removedPercent}% |`);
    if (intents.length > 0) {
      lines.push(`| Detected Intents | ${intents.join(', ')} |`);
    }
    lines.push('');
  }

  const parameters = extractParameters(sop);
  if (parameters.length > 0) {
    lines.push(`## Parameters`);
    lines.push('');
    lines.push('| Parameter | Description | Default |');
    lines.push('|-----------|-------------|---------|');
    parameters.forEach(param => {
      const defaultMatch = param.description.match(/\(default: (.+)\)/);
      const defaultValue = defaultMatch ? defaultMatch[1] : '-';
      lines.push(`| \`${param.name}\` | ${param.description.replace(/\(default: .+\)/, '').trim()} | ${defaultValue} |`);
    });
    lines.push('');
  }

  lines.push(`## Workflow Steps`);
  lines.push('');
  lines.push('| Step | Action | Description | Selector |');
  lines.push('|------|--------|-------------|----------|');
  for (let i = 0; i < sop.actions.length; i++) {
    const action = sop.actions[i];
    lines.push(`| ${i + 1} | ${getActionTitle(action.type)} | ${action.description} | \`${action.selector}\` |`);
  }
  lines.push('');

  lines.push(`## Playwright Script`);
  lines.push('');
  lines.push(`\`\`\`typescript`);
  const script = generatePlaywrightScriptWithComments(sop);
  lines.push(script);
  lines.push(`\`\`\``);
  lines.push('');

  lines.push(`## JSON Definition`);
  lines.push('');
  lines.push(`\`\`\`json`);
  const json = generatePlaywrightScriptForAI(sop);
  lines.push(json);
  lines.push(`\`\`\``);
  lines.push('');

  lines.push(`## Usage Examples`);
  lines.push('');
  lines.push(`### Command Line`);
  lines.push(`\`\`\`bash`);
  lines.push(`# Run with Playwright`);
  lines.push(`npx playwright test ${skillName}.spec.ts`);
  lines.push(`\`\`\``);
  lines.push('');

  lines.push(`### AI Assistant`);
  lines.push(`\`\`\`text`);
  lines.push(`"Please execute the ${sop.name} workflow"`);
  lines.push(`"Run the ${skillName} skill"`);
  lines.push(`"Automate ${sop.name} using the recorded steps"`);
  lines.push(`\`\`\``);
  lines.push('');

  lines.push(`## Prerequisites`);
  lines.push('');
  lines.push(`- Node.js 18+`);
  lines.push(`- Playwright installed (\`npm init playwright@latest\`)`);
  lines.push('');

  lines.push(`## Notes`);
  lines.push('');
  lines.push(`- All selectors have been optimized for stability`);
  lines.push(`- Smart waits are added before element interactions`);
  lines.push(`- The script waits for elements to be visible before acting`);
  lines.push('');

  return lines.join('\n');
}

function extractParameters(sop) {
  const parameters = [];
  const seenParams = new Set();

  for (const action of sop.actions) {
    if (action.type === 'navigation' && action.url) {
      const paramName = 'url';
      if (!seenParams.has(paramName)) {
        seenParams.add(paramName);
        parameters.push({
          name: paramName,
          description: `Target URL (default: ${action.url})`
        });
      }
    }
    
    if (action.type === 'input' && action.value) {
      const paramName = action.selector.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      if (!seenParams.has(paramName) && action.value.length < 50) {
        seenParams.add(paramName);
        parameters.push({
          name: paramName,
          description: `Input value (default: ${action.value})`
        });
      }
    }
  }

  return parameters;
}

function getActionTitle(type) {
  const titles = {
    click: 'CLICK',
    dblclick: 'DOUBLE CLICK',
    input: 'INPUT',
    select: 'SELECT',
    scroll: 'SCROLL',
    keydown: 'KEY PRESS',
    navigation: 'NAVIGATE',
    wait: 'WAIT',
  };
  return titles[type] || type.toUpperCase();
}

function buildTabIdToPageVarMap(actions) {
  const order = [];
  const seen = new Set();
  for (const a of actions) {
    const key = a.tabId == null ? '__NONE__' : String(a.tabId);
    if (!seen.has(key)) {
      seen.add(key);
      order.push(a.tabId);
    }
  }
  const map = new Map();
  if (order.length === 0) {
    map.set(undefined, 'page');
    return map;
  }
  order.forEach((tid, i) => {
    map.set(tid, i === 0 ? 'page' : `page${i}`);
  });
  return map;
}

function pageVarForAction(action, tabIdToVar) {
  const v = tabIdToVar.get(action.tabId);
  if (v) return v;
  return tabIdToVar.get(undefined) || 'page';
}

function iframeLocatorString(frame) {
  if (frame.name) {
    return `iframe[name="${escapeString(frame.name)}"]`;
  }
  if (frame.srcSnippet) {
    return `iframe[src*='${escapeString(frame.srcSnippet)}']`;
  }
  return 'iframe';
}

function applyFrameChain(baseExpr, frameChain) {
  if (!frameChain || frameChain.length === 0) return baseExpr;
  let s = baseExpr;
  for (const f of frameChain) {
    const loc = iframeLocatorString(f);
    const nth = f.nth > 0 ? `.nth(${f.nth})` : '';
    s = `${s}.locator(${JSON.stringify(loc)})${nth}.contentFrame()`;
  }
  return s;
}

function pageExprForInteraction(action, tabIdToVar) {
  const pv = pageVarForAction(action, tabIdToVar);
  return applyFrameChain(pv, action.frameChain);
}

function findPopupWrapByClickIndex(actions, tabIdToVar) {
  const map = new Map();
  for (let i = 0; i < actions.length - 1; i++) {
    const cur = actions[i];
    const next = actions[i + 1];
    if (cur.type !== 'click' && cur.type !== 'dblclick') continue;
    if (cur.tabId == null || next.tabId == null) continue;
    if (cur.tabId === next.tabId) continue;
    if (next.openerTabId !== cur.tabId) continue;
    const openerVar = tabIdToVar.get(cur.tabId) || 'page';
    const newVar = tabIdToVar.get(next.tabId);
    if (!newVar || newVar === openerVar) continue;
    map.set(i, { openerVar, newVar });
  }
  return map;
}

function buildCodegenContext(actions) {
  const tabIdToVar = buildTabIdToPageVarMap(actions);
  const popupWrapByClickIndex = findPopupWrapByClickIndex(actions, tabIdToVar);
  return { tabIdToVar, popupWrapByClickIndex };
}

function buildRoleOptionsStr(semantic) {
  const parts = [];
  if (semantic.name != null && semantic.name !== '') {
    parts.push(`name: '${escapeString(semantic.name)}'`);
  }
  if (semantic.exact) {
    parts.push('exact: true');
  }
  return parts.length ? `{ ${parts.join(', ')} }` : '{}';
}

function emitCssInteractionLines(baseExpr, action, verb) {
  if (!action.selector) {
    return [`// ${action.description || 'missing selector'}`];
  }
  const selLit = JSON.stringify(action.selector);
  const loc = `await ${baseExpr}.locator(${selLit}).waitFor({ state: 'visible' });`;
  if (verb === 'fill' && action.value != null) {
    return [
      loc,
      `await ${baseExpr}.locator(${selLit}).fill('${escapeString(action.value)}');`,
    ];
  }
  if (verb === 'selectOption' && action.value != null) {
    return [
      loc,
      `await ${baseExpr}.locator(${selLit}).selectOption('${escapeString(action.value)}');`,
    ];
  }
  return [
    loc,
    `await ${baseExpr}.locator(${selLit}).${verb}();`,
  ];
}

function emitSemanticClickLines(baseExpr, action, verb) {
  const sem = action.semantic;
  if (sem && sem.kind === 'role' && sem.role) {
    if ((sem.name == null || sem.name === '') && sem.role !== 'img') {
      return emitCssInteractionLines(baseExpr, action, verb);
    }
    const opts = buildRoleOptionsStr(sem);
    return [`await ${baseExpr}.getByRole('${sem.role}', ${opts}).${verb}();`];
  }
  if (sem && sem.kind === 'text' && sem.text) {
    const exactArg = sem.exact ? `, { exact: true }` : '';
    const first = sem.first ? '.first()' : '';
    return [`await ${baseExpr}.getByText('${escapeString(sem.text)}'${exactArg})${first}.${verb}();`];
  }
  return emitCssInteractionLines(baseExpr, action, verb);
}

function emitSemanticFillLines(baseExpr, action) {
  const sem = action.semantic;
  if (sem && sem.kind === 'role' && sem.role === 'textbox' && sem.name) {
    const opts = buildRoleOptionsStr(sem);
    return [
      `await ${baseExpr}.getByRole('textbox', ${opts}).fill('${escapeString(action.value)}');`,
    ];
  }
  return emitCssInteractionLines(baseExpr, action, 'fill');
}

function emitSemanticSelectLines(baseExpr, action) {
  const sem = action.semantic;
  if (sem && sem.kind === 'role' && sem.role === 'combobox' && sem.name) {
    const opts = buildRoleOptionsStr(sem);
    return [
      `await ${baseExpr}.getByRole('combobox', ${opts}).selectOption('${escapeString(action.value)}');`,
    ];
  }
  return emitCssInteractionLines(baseExpr, action, 'selectOption');
}

function generateActionCode(action, options, ctx, actionIndex) {
  const lines = [];
  const tabIdToVar = ctx.tabIdToVar;
  const popupWrap = ctx.popupWrapByClickIndex.get(actionIndex);

  const appendClickWithMaybePopup = (verb) => {
    const targetExpr = pageExprForInteraction(action, tabIdToVar);
    if (popupWrap) {
      lines.push(`const ${popupWrap.newVar}Promise = ${popupWrap.openerVar}.waitForEvent('popup');`);
    }
    lines.push(...emitSemanticClickLines(targetExpr, action, verb));
    if (popupWrap) {
      lines.push(`const ${popupWrap.newVar} = await ${popupWrap.newVar}Promise;`);
    }
  };

  switch (action.type) {
    case 'navigation': {
      const pv = pageVarForAction(action, tabIdToVar);
      lines.push(`await ${pv}.goto('${escapeString(action.url)}');`);
      break;
    }

    case 'click':
      appendClickWithMaybePopup('click');
      break;

    case 'dblclick':
      appendClickWithMaybePopup('dblclick');
      break;

    case 'input':
      if (action.value) {
        const targetExpr = pageExprForInteraction(action, tabIdToVar);
        lines.push(...emitSemanticFillLines(targetExpr, action));
      }
      break;

    case 'select':
      if (action.value) {
        const targetExpr = pageExprForInteraction(action, tabIdToVar);
        lines.push(...emitSemanticSelectLines(targetExpr, action));
      }
      break;

    case 'keydown':
      if (action.keyInfo) {
        const pv = pageVarForAction(action, tabIdToVar);
        const modifiers = [];
        if (action.keyInfo.ctrlKey) modifiers.push('Control');
        if (action.keyInfo.shiftKey) modifiers.push('Shift');
        if (action.keyInfo.altKey) modifiers.push('Alt');
        if (action.keyInfo.metaKey) modifiers.push('Meta');

        if (modifiers.length > 0) {
          const keyCombo = [...modifiers, action.keyInfo.key].join('+');
          lines.push(`await ${pv}.keyboard.press('${escapeString(keyCombo)}');`);
        } else {
          lines.push(`await ${pv}.keyboard.press('${escapeString(action.keyInfo.key)}');`);
        }
      }
      break;

    case 'scroll':
      if (action.scrollPosition) {
        const { x, y } = action.scrollPosition;
        const pe = pageExprForInteraction(action, tabIdToVar);
        lines.push(`await ${pe}.locator('body').evaluate(() => window.scrollTo(${x}, ${y}));`);
      }
      break;

    case 'wait':
      if (action.selector) {
        const targetExpr = pageExprForInteraction(action, tabIdToVar);
        lines.push(`await ${targetExpr}.locator(${JSON.stringify(action.selector)}).waitFor({ state: 'visible' });`);
      } else if (action.waitType === 'networkidle') {
        const pv = pageVarForAction(action, tabIdToVar);
        lines.push(`await ${pv}.waitForLoadState('networkidle');`);
      } else {
        const pv = pageVarForAction(action, tabIdToVar);
        lines.push(`await ${pv}.waitForLoadState('domcontentloaded');`);
      }
      break;

    default:
      lines.push(`// ${action.description}`);
  }

  return lines;
}

function escapeString(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

export function generatePlaywrightScriptWithComments(sop, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lines = [];

  lines.push(`import { test, expect } from '@playwright/test';`);
  lines.push('');
  lines.push(`/**`);
  lines.push(` * SOP: ${sop.name}`);
  if (sop.description) {
    lines.push(` * Description: ${sop.description}`);
  }
  lines.push(` * Generated: ${new Date().toISOString()}`);
  lines.push(` * Total Steps: ${sop.actions.length}`);
  lines.push(` */`);
  lines.push('');
  lines.push(`test.describe('${escapeString(sop.name)}', () => {`);
  lines.push(`  test('${escapeString(sop.name)}', async ({ page }) => {`);

  if (opts.timeout) {
    lines.push(`    test.setTimeout(${opts.timeout});`);
    lines.push('');
  }

  const actions = sop.actions || [];
  const ctx = buildCodegenContext(actions);
  let stepNumber = 1;
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    lines.push(`    // Step ${stepNumber}: ${action.description}`);
    const actionLines = generateActionCode(action, opts, ctx, i);
    lines.push(...actionLines.map(line => `    ${line}`));
    lines.push('');
    stepNumber++;
  }

  lines.push(`  });`);
  lines.push(`});`);

  return lines.join('\n');
}

export function generatePlaywrightScriptForAI(sop) {
  const steps = sop.actions.map(action => {
    const result = {
      step: action.type,
      selector: action.selector,
      description: action.description,
    };

    if (action.url) result.url = action.url;
    if (action.value) result.value = action.value;
    if (action.keyInfo) result.key = action.keyInfo.key;
    if (action.scrollPosition) result.scrollTo = action.scrollPosition;
    if (action.waitDuration) result.waitMs = action.waitDuration;
    if (action.tabId != null) result.tabId = action.tabId;
    if (action.openerTabId != null) result.openerTabId = action.openerTabId;
    if (action.frameChain) result.frameChain = action.frameChain;
    if (action.semantic) result.semantic = action.semantic;

    return result;
  });

  return JSON.stringify({
    name: sop.name,
    description: sop.description,
    steps,
  }, null, 2);
}

export function generateSOPSummary(sop) {
  const lines = [];

  lines.push(`# ${sop.name}`);
  lines.push('');
  if (sop.description) {
    lines.push(sop.description);
    lines.push('');
  }
  lines.push(`**Total Steps:** ${sop.actions.length}`);
  lines.push('');
  lines.push(`## Steps`);
  lines.push('');

  for (let i = 0; i < sop.actions.length; i++) {
    const action = sop.actions[i];
    lines.push(`${i + 1}. **${action.type.toUpperCase()}**: ${action.description}`);
    lines.push(`   - Selector: \`${action.selector}\``);
    if (action.value) {
      lines.push(`   - Value: \`${action.value}\``);
    }
    lines.push('');
  }

  return lines.join('\n');
}
