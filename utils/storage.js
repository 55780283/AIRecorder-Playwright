const DEFAULT_STORAGE_DATA = {
  sops: {},
  settings: {
    defaultTimeout: 30000,
    autoScroll: true,
    recordWait: true,
    minWaitDuration: 100,
  },
  recentExports: [],
};

export async function initialize() {
  const data = await getData();
  if (!data.settings) {
    await setData(DEFAULT_STORAGE_DATA);
  }
}

export async function getData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (result) => {
      resolve(Object.keys(result).length ? result : DEFAULT_STORAGE_DATA);
    });
  });
}

export async function setData(data) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

export async function getSOPs() {
  const data = await getData();
  return data.sops || {};
}

export async function getSOP(id) {
  const sops = await getSOPs();
  return sops[id] || null;
}

export async function saveSOP(sop) {
  const data = await getData();
  data.sops = data.sops || {};
  data.sops[sop.id] = {
    ...sop,
    updatedAt: Date.now(),
  };
  await setData(data);
}

export async function createSOP(name, description = '') {
  const sop = {
    id: `sop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    description,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    actions: [],
    tags: [],
    variables: [],
  };
  await saveSOP(sop);
  return sop;
}

export async function deleteSOP(id) {
  const data = await getData();
  delete data.sops[id];
  await setData(data);
}

export async function addActionToSOP(sopId, action) {
  const sop = await getSOP(sopId);
  if (sop) {
    sop.actions.push(action);
    await saveSOP(sop);
  }
}

export async function updateSOPActions(sopId, actions) {
  const sop = await getSOP(sopId);
  if (sop) {
    sop.actions = actions;
    await saveSOP(sop);
  }
}

export async function updateSettings(settings) {
  const data = await getData();
  data.settings = { ...data.settings, ...settings };
  await setData(data);
}

export async function getSettings() {
  const data = await getData();
  return data.settings;
}
