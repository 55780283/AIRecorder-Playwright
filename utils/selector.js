const MAX_SELECTOR_DEPTH = 5;

export function generateSelector(element) {
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  const uniqueAttr = findUniqueAttribute(element);
  if (uniqueAttr) {
    return uniqueAttr;
  }

  const path = getElementPath(element);
  return path;
}

function findUniqueAttribute(element) {
  const uniqueAttributes = [
    'data-testid',
    'data-test',
    'data-cy',
    'data-automation-id',
    'aria-label',
    'name',
    'placeholder',
    'title',
  ];

  for (const attr of uniqueAttributes) {
    const value = element.getAttribute(attr);
    if (value) {
      const selector = `[${attr}="${CSS.escape(value)}"]`;
      if (isUniqueSelector(selector)) {
        return selector;
      }
    }
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    if (element.placeholder) {
      const selector = `[placeholder="${CSS.escape(element.placeholder)}"]`;
      if (isUniqueSelector(selector)) {
        return selector;
      }
    }
  }

  return null;
}

function getElementPath(element) {
  const path = [];
  let current = element;
  let depth = 0;

  while (current && current !== document.documentElement && depth < MAX_SELECTOR_DEPTH) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector = `#${current.id}`;
      path.unshift(selector);
      break;
    }

    const siblings = current.parentElement?.children;
    if (siblings && siblings.length > 1) {
      const index = Array.from(siblings).indexOf(current) + 1;
      selector += `:nth-child(${index})`;
    }

    path.unshift(selector);
    current = current.parentElement;
    depth++;
  }

  return path.join(' > ');
}

function isUniqueSelector(selector) {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

export function getElementDescription(element, action) {
  const tagName = element.tagName.toLowerCase();
  const type = element.getAttribute('type');
  const text = getElementText(element);
  const name = element.getAttribute('name');
  const placeholder = element.getAttribute('placeholder');
  const ariaLabel = element.getAttribute('aria-label');

  const parts = [action];

  if (tagName === 'input' || tagName === 'textarea') {
    parts.push(type || tagName);
    if (placeholder) parts.push(`"${placeholder}"`);
    if (name) parts.push(`(name: ${name})`);
  } else if (tagName === 'button' || tagName === 'a') {
    parts.push(text || ariaLabel || tagName);
  } else if (tagName === 'select') {
    parts.push('dropdown');
    if (name) parts.push(`(name: ${name})`);
  } else {
    parts.push(tagName);
    if (text) parts.push(`"${text.slice(0, 30)}"`);
  }

  return parts.join(' ');
}

function getElementText(element) {
  const text = element.textContent?.trim() || '';
  return text.replace(/\s+/g, ' ').slice(0, 50);
}

export function isInteractiveElement(element) {
  const interactiveTags = ['a', 'button', 'input', 'select', 'textarea', 'option'];
  const tagName = element.tagName.toLowerCase();

  if (interactiveTags.includes(tagName)) {
    return true;
  }

  if (element.getAttribute('role')) {
    const interactiveRoles = ['button', 'link', 'checkbox', 'radio', 'tab', 'menuitem'];
    if (interactiveRoles.includes(element.getAttribute('role') || '')) {
      return true;
    }
  }

  if (element.getAttribute('onclick') || element.getAttribute('ng-click')) {
    return true;
  }

  const style = window.getComputedStyle(element);
  if (style.cursor === 'pointer') {
    return true;
  }

  return false;
}
