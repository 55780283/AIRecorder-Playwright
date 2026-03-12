let actionIdCounter = 0;

export function generateId() {
  return `${Date.now()}-${++actionIdCounter}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateSOPId() {
  return `sop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
