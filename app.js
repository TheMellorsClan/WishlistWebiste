const STORAGE_KEY = "wishlist.items.v1";
const SESSION_KEY = "wishlist.items.session.v1";
const HISTORY_STATE_KEY = "wishlistItems";
const ACTIVE_LIST_KEY = "wishlist.activeList.v1";
const PROJECTS_STATE_KEY = "wishlist.projectGroups.v1";
const PROJECTS_SESSION_KEY = "wishlist.projectGroups.session.v1";
const PROJECTS_HISTORY_KEY = "projectGroups";
const ACTIVE_PROJECT_KEY = "wishlist.activeProject.v1";
const RESTORE_CODE_PREFIX = "WISHLIST-V1:";
const SHARE_PARAM_FIELDS = ["title", "url", "store", "price", "category", "priority", "image", "notes"];
const LISTS = {
  wishlist: {
    label: "Wishlist",
    storageKey: STORAGE_KEY,
    sessionKey: SESSION_KEY,
    historyKey: HISTORY_STATE_KEY,
  },
  projects: {
    label: "Projects",
    storageKey: "wishlist.projects.v1",
    sessionKey: "wishlist.projects.session.v1",
    historyKey: "projectItems",
    stateKey: PROJECTS_STATE_KEY,
    stateSessionKey: PROJECTS_SESSION_KEY,
    stateHistoryKey: PROJECTS_HISTORY_KEY,
  },
};

const form = document.querySelector("#wish-form");
const appTitle = document.querySelector("#app-title");
const listButtons = document.querySelectorAll("[data-list]");
const editingInput = document.querySelector("#editing-id");
const formTitle = document.querySelector("#form-title");
const titleInput = document.querySelector("#item-title");
const urlInput = document.querySelector("#item-url");
const storeInput = document.querySelector("#item-store");
const priceInput = document.querySelector("#item-price");
const categoryInput = document.querySelector("#item-category");
const priorityInput = document.querySelector("#item-priority");
const imageInput = document.querySelector("#item-image");
const notesInput = document.querySelector("#item-notes");
const submitButton = document.querySelector("#submit-button");
const cancelEditButton = document.querySelector("#cancel-edit");
const clearFormButton = document.querySelector("#clear-form");
const searchInput = document.querySelector("#search-input");
const categoryFilter = document.querySelector("#category-filter");
const statusFilter = document.querySelector("#status-filter");
const sortSelect = document.querySelector("#sort-select");
const projectControls = document.querySelector("#project-controls");
const projectSelect = document.querySelector("#project-select");
const newProjectButton = document.querySelector("#new-project");
const renameProjectButton = document.querySelector("#rename-project");
const workspaceEl = document.querySelector(".workspace");
const listEl = document.querySelector("#wish-list");
const listHeading = document.querySelector("#list-heading");
const emptyState = document.querySelector("#empty-state");
const cardTemplate = document.querySelector("#wish-card-template");
const statCount = document.querySelector("#stat-count");
const statHigh = document.querySelector("#stat-high");
const statPurchased = document.querySelector("#stat-purchased");
const exportPdfButton = document.querySelector("#export-pdf");
const importCodeButton = document.querySelector("#import-code");
const importInput = document.querySelector("#import-data");
const feedbackEl = document.querySelector("#form-feedback");
const restoreModal = document.querySelector("#restore-modal");
const restoreCodeInput = document.querySelector("#restore-code-input");
const restoreFeedback = document.querySelector("#restore-feedback");
const restoreSubmitButton = document.querySelector("#restore-submit");
const restoreCancelButton = document.querySelector("#restore-cancel");
const restoreCloseButton = document.querySelector("#restore-close");

const priorityWeight = {
  High: 3,
  Medium: 2,
  Low: 1,
};

const REMOVE_ANIMATION_MS = 280;
const LIST_REFRESH_ANIMATION_MS = 520;
const WORKSPACE_ANIMATION_MS = 520;
const EXPORT_RESET_DELAY_MS = 900;
const exportPdfButtonLabel = exportPdfButton?.textContent || "Export PDF";

let storageAvailable = true;
let activeListKey = getInitialListKey();
let projectState = loadProjectState();
let activeProjectId = getInitialProjectId();
let items = loadItems(activeListKey);
let recentlyAddedItemId = "";
let recentlyToggledItemId = "";
let listRefreshTimer = 0;
let workspaceAnimationTimer = 0;

function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `wish-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeStoredItems(value) {
  if (!Array.isArray(value)) return [];

  return value.map((item) => ({
    id: item.id || createId(),
    title: item.title || "Untitled item",
    url: item.url || "",
    store: item.store || "",
    price: item.price || "",
    category: item.category || "General",
    priority: item.priority || "Medium",
    image: item.image || "",
    notes: item.notes || "",
    purchased: Boolean(item.purchased),
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
  }));
}

function getNewestItemTime(itemList) {
  return itemList.reduce((newest, item) => {
    const timestamp = new Date(item.updatedAt || item.createdAt || 0).getTime();
    return Number.isFinite(timestamp) ? Math.max(newest, timestamp) : newest;
  }, 0);
}

function getProjectStateTime(state) {
  if (!state?.projects?.length) return 0;

  return Math.max(
    new Date(state.updatedAt || 0).getTime() || 0,
    ...state.projects.map((project) => getNewestItemTime(project.items || [])),
  );
}

function getListConfig(listKey = activeListKey) {
  return LISTS[listKey] || LISTS.wishlist;
}

function getInitialListKey() {
  const params = new URLSearchParams(window.location.search);
  const requestedList = params.get("list");

  if (LISTS[requestedList]) return requestedList;

  try {
    const savedList = getBrowserStorage("localStorage")?.getItem(ACTIVE_LIST_KEY);
    if (LISTS[savedList]) return savedList;
  } catch {
    // Fall through to the default list.
  }

  return "wishlist";
}

function getBrowserStorage(name) {
  try {
    return window[name];
  } catch {
    storageAvailable = false;
    return null;
  }
}

function readStoredItems(storage, key) {
  if (!storage) return [];

  try {
    return normalizeStoredItems(JSON.parse(storage.getItem(key)) || []);
  } catch {
    return [];
  }
}

function normalizeProjectState(value) {
  if (Array.isArray(value)) {
    return {
      activeProjectId: "project-default",
      updatedAt: new Date().toISOString(),
      projects: [
        {
          id: "project-default",
          name: "General Project",
          items: normalizeStoredItems(value),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };
  }

  if (!value || !Array.isArray(value.projects)) {
    return {
      activeProjectId: "project-default",
      updatedAt: new Date().toISOString(),
      projects: [
        {
          id: "project-default",
          name: "General Project",
          items: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };
  }

  const projects = value.projects.map((project, index) => ({
    id: project.id || `project-${index + 1}`,
    name: String(project.name || `Project ${index + 1}`),
    items: normalizeStoredItems(project.items || []),
    createdAt: project.createdAt || new Date().toISOString(),
    updatedAt: project.updatedAt || project.createdAt || new Date().toISOString(),
  }));

  if (!projects.length) {
    projects.push({
      id: "project-default",
      name: "General Project",
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return {
    activeProjectId: projects.some((project) => project.id === value.activeProjectId)
      ? value.activeProjectId
      : projects[0].id,
    projects,
    updatedAt: value.updatedAt || new Date().toISOString(),
  };
}

function readProjectState(storage, key) {
  if (!storage) return null;

  try {
    const stored = JSON.parse(storage.getItem(key));
    return stored ? normalizeProjectState(stored) : null;
  } catch {
    return null;
  }
}

function readHistoryItems(listKey) {
  try {
    return normalizeStoredItems(window.history?.state?.[getListConfig(listKey).historyKey] || []);
  } catch {
    return [];
  }
}

function readProjectStateFromHistory() {
  try {
    const stored = window.history?.state?.[PROJECTS_HISTORY_KEY];
    return stored ? normalizeProjectState(stored) : null;
  } catch {
    return null;
  }
}

function loadProjectState() {
  const localStore = getBrowserStorage("localStorage");
  const sessionStore = getBrowserStorage("sessionStorage");
  const states = [
    readProjectState(localStore, PROJECTS_STATE_KEY),
    readProjectState(sessionStore, PROJECTS_SESSION_KEY),
    readProjectStateFromHistory(),
  ].filter(Boolean);

  const restoredState = states.sort((a, b) => getProjectStateTime(b) - getProjectStateTime(a))[0];
  if (restoredState) return restoredState;

  const legacyItems = [
    readStoredItems(localStore, LISTS.projects.storageKey),
    readStoredItems(sessionStore, LISTS.projects.sessionKey),
    readHistoryItems("projects"),
  ]
    .filter((entry) => entry.length > 0)
    .sort((a, b) => getNewestItemTime(b) - getNewestItemTime(a))[0];

  return normalizeProjectState(legacyItems || null);
}

function getInitialProjectId() {
  const params = new URLSearchParams(window.location.search);
  const requestedProject = params.get("project");
  if (projectState.projects.some((project) => project.id === requestedProject)) return requestedProject;

  try {
    const savedProject = getBrowserStorage("localStorage")?.getItem(ACTIVE_PROJECT_KEY);
    if (projectState.projects.some((project) => project.id === savedProject)) return savedProject;
  } catch {
    // Fall through to stored project state.
  }

  return projectState.activeProjectId || projectState.projects[0].id;
}

function getActiveProject() {
  let project = projectState.projects.find((entry) => entry.id === activeProjectId);

  if (!project) {
    project = projectState.projects[0];
    activeProjectId = project.id;
  }

  return project;
}

function loadItems(listKey = activeListKey) {
  if (listKey === "projects") {
    return [...getActiveProject().items];
  }

  const config = getListConfig(listKey);
  const localStore = getBrowserStorage("localStorage");
  const sessionStore = getBrowserStorage("sessionStorage");
  const localItems = readStoredItems(localStore, config.storageKey);
  const sessionItems = readStoredItems(sessionStore, config.sessionKey);
  const historyItems = readHistoryItems(listKey);
  const restoredItems = [localItems, sessionItems, historyItems]
    .filter((entry) => entry.length > 0)
    .sort((a, b) => getNewestItemTime(b) - getNewestItemTime(a))[0];

  if (restoredItems) return restoredItems;

  storageAvailable = Boolean(localStore || sessionStore);

  return [];
}

function saveToStorage(storage, key, value = items) {
  if (!storage) return false;

  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function saveActiveListSetting(storage) {
  if (!storage) return;

  try {
    storage.setItem(ACTIVE_LIST_KEY, activeListKey);
  } catch {
    // The active list can fall back to Wishlist if storage is unavailable.
  }
}

function saveActiveProjectSetting(storage) {
  if (!storage) return;

  try {
    storage.setItem(ACTIVE_PROJECT_KEY, activeProjectId);
  } catch {
    // The active project can fall back to the first project if storage is unavailable.
  }
}

function saveToHistoryState() {
  try {
    if (activeListKey === "projects") {
      window.history.replaceState(
        {
          ...(window.history.state || {}),
          [PROJECTS_HISTORY_KEY]: projectState,
        },
        "",
        window.location.href,
      );
      return true;
    }

    const config = getListConfig();
    window.history.replaceState(
      {
        ...(window.history.state || {}),
        [config.historyKey]: items,
      },
      "",
      window.location.href,
    );
    return true;
  } catch {
    return false;
  }
}

function saveItems() {
  const localStore = getBrowserStorage("localStorage");
  const sessionStore = getBrowserStorage("sessionStorage");

  if (activeListKey === "projects") {
    const project = getActiveProject();
    project.items = [...items];
    project.updatedAt = new Date().toISOString();
    projectState.activeProjectId = activeProjectId;
    projectState.updatedAt = new Date().toISOString();
    const savedLocally = saveToStorage(localStore, PROJECTS_STATE_KEY, projectState);
    const savedForSession = saveToStorage(sessionStore, PROJECTS_SESSION_KEY, projectState);
    const savedInHistory = saveToHistoryState();
    saveActiveListSetting(localStore);
    saveActiveProjectSetting(localStore);
    storageAvailable = savedLocally || savedForSession || savedInHistory;
    return storageAvailable;
  }

  const config = getListConfig();
  const savedLocally = saveToStorage(localStore, config.storageKey);
  const savedForSession = saveToStorage(sessionStore, config.sessionKey);
  const savedInHistory = saveToHistoryState();
  saveActiveListSetting(localStore);
  storageAvailable = savedLocally || savedForSession || savedInHistory;
  return storageAvailable;
}

function showFeedback(message, isWarning = false) {
  if (!feedbackEl) return;
  feedbackEl.textContent = message;
  feedbackEl.classList.toggle("warning", isWarning);
}

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

function triggerListRefreshAnimation() {
  if (!listEl || prefersReducedMotion()) return;

  window.clearTimeout(listRefreshTimer);
  listEl.classList.remove("is-refreshing");
  void listEl.offsetWidth;
  listEl.classList.add("is-refreshing");
  listRefreshTimer = window.setTimeout(() => {
    listEl.classList.remove("is-refreshing");
  }, LIST_REFRESH_ANIMATION_MS);
}

function triggerWorkspaceAnimation() {
  if (!workspaceEl || prefersReducedMotion()) return;

  window.clearTimeout(workspaceAnimationTimer);
  workspaceEl.classList.remove("is-switching");
  void workspaceEl.offsetWidth;
  workspaceEl.classList.add("is-switching");
  workspaceAnimationTimer = window.setTimeout(() => {
    workspaceEl.classList.remove("is-switching");
  }, WORKSPACE_ANIMATION_MS);
}

function renderWithWorkspaceAnimation() {
  render();
  triggerWorkspaceAnimation();
}

function setExportButtonBusy(isBusy) {
  if (!exportPdfButton) return;

  exportPdfButton.classList.toggle("is-exporting", isBusy);
  exportPdfButton.disabled = isBusy;
  exportPdfButton.textContent = isBusy ? "Preparing..." : exportPdfButtonLabel;
}

function resetExportButton(delay = 0) {
  window.setTimeout(() => setExportButtonBusy(false), delay);
}

function getActiveListLabel() {
  return getListConfig().label;
}

function getProjectLabel() {
  return getActiveProject().name;
}

function renderProjectOptions() {
  projectSelect.replaceChildren();

  projectState.projects.forEach((project) => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name;
    projectSelect.append(option);
  });

  projectSelect.value = activeProjectId;
}

function updateListChrome() {
  const label = getActiveListLabel();
  appTitle.textContent = label;
  projectControls.hidden = activeListKey !== "projects";
  if (activeListKey === "projects") renderProjectOptions();
  listHeading.textContent = activeListKey === "projects" ? `${getProjectLabel()} items` : "Your wishlist items";
  searchInput.placeholder = activeListKey === "projects" ? "Search projects" : "Search wishlist";
  formTitle.textContent = editingInput.value
    ? "Edit item"
    : activeListKey === "projects"
      ? "Add project item"
      : "Add item";

  listButtons.forEach((button) => {
    const isActive = button.dataset.list === activeListKey;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function switchProject(projectId) {
  if (!projectState.projects.some((project) => project.id === projectId)) return;

  saveItems();
  activeProjectId = projectId;
  projectState.activeProjectId = activeProjectId;
  items = loadItems("projects");
  resetForm();
  showAllItems();
  saveItems();
  renderWithWorkspaceAnimation();
  showFeedback(`Switched to ${getProjectLabel()}.`);
}

function createProject() {
  const name = window.prompt?.("Project name:");
  if (!name?.trim()) return;

  saveItems();
  const now = new Date().toISOString();
  const project = {
    id: createId(),
    name: name.trim(),
    items: [],
    createdAt: now,
    updatedAt: now,
  };
  projectState.projects.push(project);
  activeProjectId = project.id;
  projectState.activeProjectId = project.id;
  projectState.updatedAt = now;
  items = [];
  resetForm();
  showAllItems();
  saveItems();
  renderWithWorkspaceAnimation();
  showFeedback(`${project.name} created.`);
}

function renameProject() {
  const project = getActiveProject();
  const name = window.prompt?.("Rename project:", project.name);
  if (!name?.trim()) return;

  project.name = name.trim();
  project.updatedAt = new Date().toISOString();
  projectState.updatedAt = project.updatedAt;
  saveItems();
  render();
  showFeedback(`Project renamed to ${project.name}.`);
}

function switchList(listKey) {
  if (!LISTS[listKey] || listKey === activeListKey) return;

  saveItems();
  activeListKey = listKey;
  saveActiveListSetting(getBrowserStorage("localStorage"));
  items = loadItems(activeListKey);
  resetForm();
  showAllItems();
  renderWithWorkspaceAnimation();
  showFeedback(`Switched to ${getActiveListLabel()}.`);
}

function normalizeUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function getDomain(value) {
  try {
    return new URL(normalizeUrl(value)).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function openItemUrl(url) {
  if (!url) return;
  saveItems();
  const destination = normalizeUrl(url);
  const opened = window.open(destination, "_blank");

  if (opened) {
    try {
      opened.opener = null;
    } catch {
      // Some embedded browsers do not allow touching the opened window.
    }
    return;
  }

  window.location.href = destination;
}

function getInitials(title) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function collectFormData() {
  return {
    title: titleInput.value,
    url: urlInput.value,
    store: storeInput.value,
    price: priceInput.value.trim(),
    category: categoryInput.value,
    priority: priorityInput.value,
    image: imageInput.value,
    notes: notesInput.value,
  };
}

function normalizeItemData(data) {
  const url = normalizeUrl(data.url || "");
  const image = normalizeUrl(data.image || "");
  const store = String(data.store || "").trim() || getDomain(url);
  const title = String(data.title || "").trim() || store || "Wishlist item";
  const priority = ["Low", "Medium", "High"].includes(data.priority) ? data.priority : "Medium";

  return {
    title,
    url,
    store,
    price: String(data.price || "").trim(),
    category: String(data.category || "General").trim() || "General",
    priority,
    image,
    notes: String(data.notes || "").trim(),
  };
}

function hasItemContent(data) {
  return [data.title, data.url, data.store, data.price, data.image, data.notes].some((value) =>
    String(value || "").trim(),
  );
}

function findMatchingItem(data) {
  const url = normalizeUrl(data.url || "");
  const title = String(data.title || "").trim().toLowerCase();

  return items.find((item) => {
    if (url && normalizeUrl(item.url || "") === url) return true;
    return title && item.title.trim().toLowerCase() === title;
  });
}

function addOrUpdateItem(data) {
  const normalized = normalizeItemData(data);
  const existing = editingInput.value
    ? items.find((item) => item.id === editingInput.value)
    : findMatchingItem(normalized);

  if (existing) {
    Object.assign(existing, normalized, { updatedAt: new Date().toISOString() });
    return { item: existing, created: false };
  }

  const item = {
    id: createId(),
    ...normalized,
    purchased: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  items.unshift(item);
  return { item, created: true };
}

function getSharedItemFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const hasSharedItem = SHARE_PARAM_FIELDS.some((field) => params.has(field));

  if (!hasSharedItem) return null;

  return {
    title: params.get("title") || "",
    url: params.get("url") || "",
    store: params.get("store") || "",
    price: params.get("price") || "",
    category: params.get("category") || "General",
    priority: params.get("priority") || "Medium",
    image: params.get("image") || "",
    notes: params.get("notes") || "",
  };
}

function fillFormFromSharedItem() {
  const sharedItem = getSharedItemFromUrl();
  if (!sharedItem) return false;

  titleInput.value = sharedItem.title;
  urlInput.value = sharedItem.url;
  storeInput.value = sharedItem.store;
  priceInput.value = sharedItem.price;
  categoryInput.value = [...categoryInput.options].some((option) => option.value === sharedItem.category)
    ? sharedItem.category
    : "General";
  priorityInput.value = ["Low", "Medium", "High"].includes(sharedItem.priority)
    ? sharedItem.priority
    : "Medium";
  imageInput.value = sharedItem.image;
  notesInput.value = sharedItem.notes;
  showFeedback("Item details loaded. Click Add item to save it.");
  return true;
}

function clearSharedItemFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const hasSharedItem = SHARE_PARAM_FIELDS.some((field) => params.has(field));

  if (!hasSharedItem) return;

  try {
    const cleanUrl = new URL(window.location.href);
    SHARE_PARAM_FIELDS.forEach((field) => cleanUrl.searchParams.delete(field));
    window.history.replaceState(window.history.state || {}, "", cleanUrl.href);
  } catch {
    // If the embedded browser rejects history changes, the app can still work.
  }
}

function addSharedItemFromUrl() {
  const sharedItem = getSharedItemFromUrl();
  if (!sharedItem || !hasItemContent(sharedItem)) return false;

  const { item, created } = addOrUpdateItem(sharedItem);
  if (created) recentlyAddedItemId = item.id;
  const saved = saveItems();
  clearSharedItemFromUrl();
  showAllItems();
  render();
  showFeedback(
    saved
      ? `${item.title} added to ${getActiveListLabel()}.`
      : `${item.title} added, but this browser is blocking saved storage.`,
    !saved,
  );
  return true;
}

function resetForm() {
  form.reset();
  editingInput.value = "";
  categoryInput.value = "General";
  priorityInput.value = "Medium";
  formTitle.textContent = activeListKey === "projects" ? "Add project item" : "Add item";
  submitButton.querySelector("span:last-child").textContent = "Add item";
  cancelEditButton.hidden = true;
}

function showAllItems() {
  searchInput.value = "";
  categoryFilter.value = "all";
  statusFilter.value = "all";
  sortSelect.value = "newest";
}

function upsertItem(event) {
  event.preventDefault();
  const formData = collectFormData();

  if (!hasItemContent(formData)) {
    titleInput.focus();
    return;
  }

  const { item, created } = addOrUpdateItem(formData);
  if (created) recentlyAddedItemId = item.id;
  const saved = saveItems();
  resetForm();
  clearSharedItemFromUrl();
  showAllItems();
  render();
  showFeedback(
    saved
      ? `${item.title} added to ${getActiveListLabel()}.`
      : `${item.title} added, but this browser is blocking saved storage.`,
    !saved,
  );
}

function editItem(id) {
  const item = items.find((entry) => entry.id === id);
  if (!item) return;

  editingInput.value = item.id;
  titleInput.value = item.title;
  urlInput.value = item.url;
  storeInput.value = item.store;
  priceInput.value = item.price;
  categoryInput.value = item.category;
  priorityInput.value = item.priority;
  imageInput.value = item.image;
  notesInput.value = item.notes;
  formTitle.textContent = "Edit item";
  submitButton.querySelector("span:last-child").textContent = "Save changes";
  cancelEditButton.hidden = false;
  titleInput.focus();
}

function getCardElement(id) {
  return [...listEl.querySelectorAll(".wish-card")].find((card) => card.dataset.itemId === id);
}

function disableCardControls(card) {
  card.querySelectorAll("a, button").forEach((control) => {
    control.setAttribute("aria-disabled", "true");
    if ("disabled" in control) control.disabled = true;
  });
}

function finishDeleteItem(id) {
  const item = items.find((entry) => entry.id === id);
  if (!item) return;

  items = items.filter((item) => item.id !== id);
  if (editingInput.value === id) resetForm();
  const saved = saveItems();
  render();
  showFeedback(saved ? "Item deleted." : "Item deleted for this session only.", !saved);
}

function deleteItem(id) {
  const card = getCardElement(id);
  if (card?.classList.contains("is-removing")) return;

  if (card && !prefersReducedMotion()) {
    card.classList.add("is-removing");
    disableCardControls(card);
    window.setTimeout(() => finishDeleteItem(id), REMOVE_ANIMATION_MS);
    return;
  }

  finishDeleteItem(id);
}

function togglePurchased(id) {
  const item = items.find((entry) => entry.id === id);
  if (!item) return;

  item.purchased = !item.purchased;
  item.updatedAt = new Date().toISOString();
  recentlyToggledItemId = item.id;
  const saved = saveItems();
  render();
  showFeedback(saved ? `${getActiveListLabel()} updated.` : `${getActiveListLabel()} updated for this session only.`, !saved);
}

function itemMatchesSearch(item, term) {
  if (!term) return true;
  const searchable = [
    item.title,
    item.store,
    item.price,
    item.category,
    item.priority,
    item.notes,
    getDomain(item.url),
  ]
    .join(" ")
    .toLowerCase();
  return searchable.includes(term);
}

function getVisibleItems() {
  const term = searchInput.value.trim().toLowerCase();
  const category = categoryFilter.value;
  const status = statusFilter.value;
  const sort = sortSelect.value;

  return items
    .filter((item) => itemMatchesSearch(item, term))
    .filter((item) => category === "all" || item.category === category)
    .filter((item) => {
      if (status === "active") return !item.purchased;
      if (status === "purchased") return item.purchased;
      return true;
    })
    .sort((a, b) => {
      if (sort === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
      if (sort === "priority") {
        return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
      }
      if (sort === "category") {
        return (
          a.category.localeCompare(b.category) ||
          a.title.localeCompare(b.title) ||
          new Date(b.createdAt) - new Date(a.createdAt)
        );
      }
      if (sort === "title") return a.title.localeCompare(b.title);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
}

function renderCategoryOptions() {
  const selected = categoryFilter.value;
  const categories = [...new Set(items.map((item) => item.category).filter(Boolean))].sort();
  categoryFilter.innerHTML = '<option value="all">All categories</option>';

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.append(option);
  });

  categoryFilter.value = categories.includes(selected) ? selected : "all";
}

function renderStats() {
  statCount.textContent = items.length;
  statHigh.textContent = items.filter((item) => item.priority === "High").length;
  statPurchased.textContent = items.filter((item) => item.purchased).length;
}

function renderCard(item, index = 0) {
  const card = cardTemplate.content.firstElementChild.cloneNode(true);
  const media = card.querySelector(".item-media");
  const title = card.querySelector("h3");
  const store = card.querySelector(".item-store");
  const notes = card.querySelector(".item-notes");
  const priority = card.querySelector(".priority-badge");
  const meta = card.querySelector(".item-meta");
  const openLink = card.querySelector(".link-button");
  const editButton = card.querySelector(".edit-item");
  const toggleButton = card.querySelector(".toggle-item");
  const deleteButton = card.querySelector(".delete-item");

  card.dataset.itemId = item.id;
  card.style.setProperty("--item-delay", `${Math.min(index, 8) * 35}ms`);
  card.classList.toggle("purchased", item.purchased);
  if (item.id === recentlyAddedItemId) {
    card.classList.add("is-new");
  }
  if (item.id === recentlyToggledItemId) {
    card.classList.add(item.purchased ? "is-purchased-now" : "is-wanted-again");
  }
  title.textContent = item.title;
  store.textContent = item.store || getDomain(item.url) || "No store";
  notes.textContent = item.notes || "No description";
  priority.textContent = item.priority;
  priority.classList.add(item.priority.toLowerCase());

  if (item.image) {
    const image = document.createElement("img");
    image.alt = item.title;
    image.loading = "lazy";
    image.addEventListener("load", () => {
      image.classList.add("is-loaded");
    }, { once: true });
    image.addEventListener("error", () => {
      media.textContent = getInitials(item.title);
    });
    image.src = item.image;
    media.append(image);
    if (image.complete) image.classList.add("is-loaded");
  } else {
    media.textContent = getInitials(item.title);
  }

  const metaValues = [
    item.category && `Category: ${item.category}`,
    item.price && `Price: ${item.price}`,
    item.purchased ? "Purchased" : "Still wanted",
  ].filter(Boolean);

  metaValues.forEach((value) => {
    const pill = document.createElement("span");
    pill.className = "meta-pill";
    pill.textContent = value;
    meta.append(pill);
  });

  if (item.url) {
    openLink.href = normalizeUrl(item.url);
    openLink.addEventListener("click", (event) => {
      event.preventDefault();
      openItemUrl(item.url);
    });
  } else {
    openLink.removeAttribute("href");
    openLink.setAttribute("aria-disabled", "true");
  }

  editButton.addEventListener("click", () => editItem(item.id));
  toggleButton.textContent = item.purchased ? "Want again" : "Purchased";
  toggleButton.addEventListener("click", () => togglePurchased(item.id));
  deleteButton.addEventListener("click", () => deleteItem(item.id));

  return card;
}

function renderList({ animateRefresh = false } = {}) {
  const visibleItems = getVisibleItems();
  listEl.replaceChildren(...visibleItems.map(renderCard));
  emptyState.hidden = visibleItems.length > 0;
  if (animateRefresh && visibleItems.length) triggerListRefreshAnimation();
  recentlyAddedItemId = "";
  recentlyToggledItemId = "";
}

function render() {
  updateListChrome();
  renderCategoryOptions();
  renderStats();
  renderList();
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}

function getShareableItems() {
  return [...items].sort((a, b) => {
    if (a.purchased !== b.purchased) return Number(a.purchased) - Number(b.purchased);
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

function getDatedFilename(extension) {
  return `wishlist-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function toBase64Url(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function getRestoreCode() {
  return `${RESTORE_CODE_PREFIX}${toBase64Url(JSON.stringify(getShareableItems()))}`;
}

function formatRestoreCodeForDisplay(code) {
  const [prefix, payload] = code.split(":");
  const chunks = payload.match(/.{1,72}/g) || [];
  return `${prefix}:\n${chunks.join("\n")}`;
}

function normalizeRestoreText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
}

function tryDecodeRestorePayload(payload) {
  const compact = payload.replace(/\s/g, "").replace(/[^A-Za-z0-9_-]/g, "");

  for (let end = compact.length; end >= 8; end -= 1) {
    try {
      const parsed = JSON.parse(fromBase64Url(compact.slice(0, end)));
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Keep trimming; copied PDF text may include extra words after the code.
    }
  }

  throw new Error("Wishlist restore code is not valid.");
}

function decodeRestoreCode(value) {
  const text = normalizeRestoreText(value);
  const prefixMatch = text.match(/WISHLIST\s*-\s*V1\s*:/i);

  if (prefixMatch) {
    return tryDecodeRestorePayload(text.slice(prefixMatch.index + prefixMatch[0].length));
  }

  const codeOnly = text.replace(/\s/g, "");
  if (/^[A-Za-z0-9_-]+$/.test(codeOnly)) {
    return tryDecodeRestorePayload(codeOnly);
  }

  throw new Error("No wishlist restore code found.");
}

function normalizeImportedItems(imported) {
  if (!Array.isArray(imported)) throw new Error("Wishlist import must be an array.");

  return imported.map((item) => ({
    id: item.id || createId(),
    title: String(item.title || "Untitled item"),
    url: normalizeUrl(String(item.url || "")),
    store: String(item.store || ""),
    price: String(item.price || ""),
    category: String(item.category || "General"),
    priority: ["Low", "Medium", "High"].includes(item.priority) ? item.priority : "Medium",
    image: normalizeUrl(String(item.image || "")),
    notes: String(item.notes || ""),
    purchased: Boolean(item.purchased),
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString(),
  }));
}

function restoreWishlistItems(imported, successMessage) {
  items = normalizeImportedItems(imported);
  const saved = saveItems();
  showAllItems();
  render();
  showFeedback(
    saved ? successMessage : `${successMessage} This browser is blocking saved storage.`,
    !saved,
  );
}

function getPdfPrintHtml() {
  const shareItems = getShareableItems();
  const restoreCode = getRestoreCode();
  const displayRestoreCode = formatRestoreCodeForDisplay(restoreCode);
  const listLabel = activeListKey === "projects" ? getProjectLabel() : getActiveListLabel();
  const regularFontUrl = new URL("fonts/opendyslexic3-regular.ttf", window.location.href).href;
  const boldFontUrl = new URL("fonts/opendyslexic3-bold.ttf", window.location.href).href;
  const exportedAt = new Date().toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const cards = shareItems
    .map((item, index) => {
      const url = item.url ? normalizeUrl(item.url) : "";
      const image = item.image ? normalizeUrl(item.image) : "";
      const meta = [
        ["Store", item.store || getDomain(item.url)],
        ["Price", item.price],
        ["Category", item.category],
        ["Priority", item.priority],
        ["Status", item.purchased ? "Purchased" : "Still wanted"],
      ]
      .filter(([, value]) => value)
      .map(
          ([label, value]) => `
            <div class="meta-row">
              <dt>${escapeHtml(label)}</dt>
              <dd>${escapeHtml(value)}</dd>
            </div>
          `,
        )
        .join("");

      return `
        <article class="item">
          <div class="image-wrap">
            ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.title)}">` : `<div class="placeholder">${escapeHtml(getInitials(item.title))}</div>`}
          </div>
          <div class="item-copy">
            <p class="item-number">Item ${index + 1}</p>
            <h2>${escapeHtml(item.title)}</h2>
            <dl class="meta">${meta}</dl>
            <section>
              <h3>Description</h3>
              <p>${escapeHtml(item.notes || "No description added.")}</p>
            </section>
            ${
              url
                ? `<section>
                    <h3>Product link</h3>
                    <a href="${escapeHtml(url)}">${escapeHtml(url)}</a>
                  </section>`
                : ""
            }
          </div>
        </article>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(listLabel)}</title>
    <style>
      @font-face {
        font-family: "OpenDyslexic";
        src: url("${escapeHtml(regularFontUrl)}") format("truetype");
        font-weight: 400;
        font-style: normal;
      }
      @font-face {
        font-family: "OpenDyslexic";
        src: url("${escapeHtml(boldFontUrl)}") format("truetype");
        font-weight: 700;
        font-style: normal;
      }
      @page { margin: 14mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #ffffff;
        color: #17211d;
        font-family: "OpenDyslexic", Arial, sans-serif;
        font-size: 12px;
      }
      main { width: 100%; }
      header {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        align-items: end;
        padding-bottom: 14px;
        border-bottom: 2px solid #17211d;
        margin-bottom: 16px;
      }
      h1 { margin: 0; font-size: 34px; line-height: 1; }
      .summary { color: #61706a; font-weight: 700; text-align: right; line-height: 1.45; }
      .item {
        display: grid;
        grid-template-columns: 34mm 1fr;
        gap: 12px;
        padding: 12px 0;
        border-bottom: 1px solid #d9e0dd;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .image-wrap { width: 34mm; }
      img,
      .placeholder {
        width: 34mm;
        height: 34mm;
        border: 1px solid #d9e0dd;
        border-radius: 6px;
        object-fit: contain;
        background: #f4f6f5;
      }
      .placeholder {
        display: grid;
        place-items: center;
        color: #075d55;
        font-size: 24px;
        font-weight: 800;
      }
      .item-number {
        margin: 0 0 3px;
        color: #61706a;
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
      }
      h2 { margin: 0 0 8px; font-size: 18px; line-height: 1.2; }
      h3 {
        margin: 10px 0 3px;
        color: #61706a;
        font-size: 10px;
        text-transform: uppercase;
      }
      p { margin: 0; color: #34413c; line-height: 1.45; }
      .meta {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 5px 10px;
        margin: 0 0 6px;
      }
      .meta-row { min-width: 0; }
      dt { color: #61706a; font-size: 9px; font-weight: 800; text-transform: uppercase; }
      dd { margin: 1px 0 0; font-weight: 800; overflow-wrap: anywhere; }
      a { color: #075d55; font-weight: 800; overflow-wrap: anywhere; }
      .restore {
        margin-top: 18px;
        padding-top: 12px;
        border-top: 2px solid #17211d;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .restore h2 { margin-bottom: 6px; font-size: 16px; }
      .restore p { margin-bottom: 8px; color: #61706a; }
      pre {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        border: 1px solid #d9e0dd;
        border-radius: 6px;
        padding: 8px;
        background: #f4f6f5;
        color: #17211d;
        font-family: "Courier New", monospace;
        font-size: 7px;
        line-height: 1.35;
      }
      @media print {
        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>${escapeHtml(listLabel)}</h1>
        <div class="summary">
          <div>${shareItems.length} item${shareItems.length === 1 ? "" : "s"}</div>
          <div>Exported ${escapeHtml(exportedAt)}</div>
        </div>
      </header>
      ${cards || "<p>No wishlist items yet.</p>"}
      <section class="restore">
        <h2>Restore Code</h2>
        <p>To import this list later, copy the code below and paste it into the app with Import code.</p>
        <pre>${escapeHtml(displayRestoreCode)}</pre>
      </section>
    </main>
  </body>
</html>`;
}

function waitForPrintImages(doc) {
  const images = [...doc.images];

  if (!images.length) return Promise.resolve();

  return new Promise((resolve) => {
    let remaining = images.length;
    let settled = false;
    const finish = () => {
      if (settled) return;
      remaining -= 1;
      if (remaining <= 0) {
        settled = true;
        resolve();
      }
    };

    setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve();
      }
    }, 4500);

    images.forEach((image) => {
      if (image.complete) {
        finish();
        return;
      }
      image.addEventListener("load", finish, { once: true });
      image.addEventListener("error", finish, { once: true });
    });
  });
}

function waitForDocumentLoad(doc) {
  if (doc.readyState === "complete") return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    doc.defaultView?.addEventListener("load", finish, { once: true });
    setTimeout(finish, 1500);
  });
}

function waitForFonts(doc) {
  if (!doc.fonts?.ready) return Promise.resolve();
  return Promise.race([doc.fonts.ready, new Promise((resolve) => setTimeout(resolve, 1200))]);
}

function waitForFrames(targetWindow, count = 2) {
  return new Promise((resolve) => {
    const step = (remaining) => {
      if (remaining <= 0) {
        resolve();
        return;
      }

      if (targetWindow.requestAnimationFrame) {
        targetWindow.requestAnimationFrame(() => step(remaining - 1));
        return;
      }

      setTimeout(() => step(remaining - 1), 50);
    };

    step(count);
  });
}

async function waitForPrintReady(printWindow) {
  const doc = printWindow.document;
  await waitForDocumentLoad(doc);
  await waitForFonts(doc);
  await waitForPrintImages(doc);
  await waitForFrames(printWindow, 3);
  await new Promise((resolve) => setTimeout(resolve, 350));
}

function printWindowContent(printWindow, html) {
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  waitForPrintReady(printWindow)
    .then(() => {
      printWindow.focus();
      printWindow.print();
      showFeedback("Print dialog opened. Choose Save as PDF. The PDF includes a restore code.");
      resetExportButton(EXPORT_RESET_DELAY_MS);
    })
    .catch(() => {
      downloadFile(getDatedFilename("html"), html, "text/html");
      showFeedback("Print was blocked, so a print-ready HTML file was downloaded.", true);
      resetExportButton();
    });
}

function exportPdf() {
  if (!items.length) {
    showFeedback("Add at least one item before exporting.", true);
    return;
  }

  const html = getPdfPrintHtml();
  setExportButtonBusy(true);
  showFeedback("Preparing PDF export...");
  const printWindow = window.open("", "_blank");

  if (printWindow?.document) {
    try {
      printWindowContent(printWindow, html);
      return;
    } catch {
      printWindow.close?.();
    }
  }

  const frame = document.createElement("iframe");
  frame.title = "Wishlist PDF export";
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "1px";
  frame.style.height = "1px";
  frame.style.opacity = "0";
  frame.style.border = "0";

  frame.addEventListener("load", () => {
    const printWindow = frame.contentWindow;
    const printDocument = frame.contentDocument;

    if (!printWindow || !printDocument) {
      downloadFile(getDatedFilename("html"), html, "text/html");
      showFeedback("Print was blocked, so a print-ready HTML file was downloaded.", true);
      resetExportButton();
      return;
    }

    waitForPrintReady(printWindow)
      .then(() => {
        try {
          printWindow.focus();
          printWindow.print();
          showFeedback("Print dialog opened. Choose Save as PDF. The PDF includes a restore code.");
          resetExportButton(EXPORT_RESET_DELAY_MS);
          setTimeout(() => frame.remove(), 60000);
        } catch {
          downloadFile(getDatedFilename("html"), html, "text/html");
          showFeedback("Print was blocked, so a print-ready HTML file was downloaded.", true);
          resetExportButton();
        }
      })
      .catch(() => {
        downloadFile(getDatedFilename("html"), html, "text/html");
        showFeedback("Print was blocked, so a print-ready HTML file was downloaded.", true);
        resetExportButton();
      });
  });

  document.body.append(frame);
  frame.srcdoc = html;
}

function openRestoreModal() {
  restoreCodeInput.value = "";
  restoreFeedback.textContent = "";
  restoreModal.hidden = false;
  restoreCodeInput.focus();
}

function closeRestoreModal() {
  restoreModal.hidden = true;
}

function importRestoreCode() {
  const code = restoreCodeInput.value;
  if (!code) return;

  try {
    restoreWishlistItems(decodeRestoreCode(code), `${getActiveListLabel()} restored from PDF restore code.`);
    closeRestoreModal();
  } catch (error) {
    restoreFeedback.textContent = error.message || "That restore code could not be imported.";
  }
}

function importData(event) {
  const [file] = event.target.files;
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const imported = JSON.parse(reader.result);
      restoreWishlistItems(imported, `${getActiveListLabel()} imported.`);
      importInput.value = "";
    } catch (error) {
      alert(error.message);
    }
  });
  reader.readAsText(file);
}

form.addEventListener("submit", upsertItem);
submitButton.addEventListener("click", upsertItem);
cancelEditButton.addEventListener("click", resetForm);
clearFormButton.addEventListener("click", resetForm);
searchInput.addEventListener("input", () => renderList({ animateRefresh: true }));
categoryFilter.addEventListener("change", () => renderList({ animateRefresh: true }));
statusFilter.addEventListener("change", () => renderList({ animateRefresh: true }));
sortSelect.addEventListener("change", () => renderList({ animateRefresh: true }));
listButtons.forEach((button) => {
  button.addEventListener("click", () => switchList(button.dataset.list));
});
projectSelect.addEventListener("change", () => switchProject(projectSelect.value));
newProjectButton.addEventListener("click", createProject);
renameProjectButton.addEventListener("click", renameProject);
exportPdfButton.addEventListener("click", exportPdf);
importCodeButton.addEventListener("click", openRestoreModal);
restoreSubmitButton.addEventListener("click", importRestoreCode);
restoreCancelButton.addEventListener("click", closeRestoreModal);
restoreCloseButton.addEventListener("click", closeRestoreModal);
restoreModal.addEventListener("click", (event) => {
  if (event.target === restoreModal) closeRestoreModal();
});
restoreCodeInput.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    importRestoreCode();
  }
});
importInput.addEventListener("change", importData);

urlInput.addEventListener("blur", () => {
  if (!storeInput.value.trim()) {
    storeInput.value = getDomain(urlInput.value);
  }
});

if (!addSharedItemFromUrl()) {
  fillFormFromSharedItem();
  render();
}

if (!storageAvailable) {
  showFeedback("This browser is blocking saved storage, but items can still be added for this session.", true);
}
