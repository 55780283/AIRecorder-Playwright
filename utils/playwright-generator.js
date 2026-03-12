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

  lines.push(`import { test, expect, Page } from '@playwright/test';`);
  lines.push('');
  lines.push(`test.describe('${escapeString(sop.name)}', () => {`);
  lines.push(`  test('${escapeString(sop.name)}', async ({ page }) => {`);

  if (opts.timeout) {
    lines.push(`    test.setTimeout(${opts.timeout});`);
    lines.push('');
  }

  for (const action of sop.actions) {
    const actionLines = generateActionCode(action, opts);
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

  lines.push(`---`);
  lines.push(`name: "${skillName}"`);
  lines.push(`description: "Executes ${sop.name}. Invoke when user wants to perform this recorded workflow or automate this specific task."`);
  lines.push(`---`);
  lines.push('');
  lines.push(`# ${sop.name}`);
  lines.push('');
  
  if (sop.description) {
    lines.push(sop.description);
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
    lines.push('');
  }

  lines.push(`## Example Usage`);
  lines.push('');
  lines.push(`"Please execute the ${sop.name} workflow"`);
  lines.push('');
  lines.push(`"Run the ${skillName} skill"`);

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

function generateActionCode(action, options) {
  const lines = [];

  if (action.waitDuration && action.waitDuration > 100) {
    lines.push(`await page.waitForTimeout(${action.waitDuration});`);
  }

  switch (action.type) {
    case 'navigation':
      lines.push(`await page.goto('${escapeString(action.url)}');`);
      break;

    case 'click':
      lines.push(`await page.locator('${escapeString(action.selector)}').click();`);
      break;

    case 'dblclick':
      lines.push(`await page.locator('${escapeString(action.selector)}').dblclick();`);
      break;

    case 'input':
      if (action.value) {
        lines.push(`await page.locator('${escapeString(action.selector)}').fill('${escapeString(action.value)}');`);
      }
      break;

    case 'select':
      if (action.value) {
        lines.push(`await page.locator('${escapeString(action.selector)}').selectOption('${escapeString(action.value)}');`);
      }
      break;

    case 'keydown':
      if (action.keyInfo) {
        const modifiers = [];
        if (action.keyInfo.ctrlKey) modifiers.push('Control');
        if (action.keyInfo.shiftKey) modifiers.push('Shift');
        if (action.keyInfo.altKey) modifiers.push('Alt');
        if (action.keyInfo.metaKey) modifiers.push('Meta');

        if (modifiers.length > 0) {
          const keyCombo = [...modifiers, action.keyInfo.key].join('+');
          lines.push(`await page.keyboard.press('${escapeString(keyCombo)}');`);
        } else {
          lines.push(`await page.keyboard.press('${escapeString(action.keyInfo.key)}');`);
        }
      }
      break;

    case 'scroll':
      if (action.scrollPosition) {
        lines.push(`await page.evaluate(() => window.scrollTo(${action.scrollPosition.x}, ${action.scrollPosition.y}));`);
      }
      break;

    case 'wait':
      if (action.waitDuration) {
        lines.push(`await page.waitForTimeout(${action.waitDuration});`);
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

  lines.push(`import { test, expect, Page } from '@playwright/test';`);
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

  let stepNumber = 1;
  for (const action of sop.actions) {
    lines.push(`    // Step ${stepNumber}: ${action.description}`);
    const actionLines = generateActionCode(action, opts);
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
