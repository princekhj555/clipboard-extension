const STORAGE_KEY = "clipboardEntries";
const PRIVATE_PASSCODE = "0000";
let entries = [];
let activeId = null;
let activeMode = null;
let activeTab = "general";
let privateUnlocked = false;
let draftEntry = null;
const selectedIds = new Set();

const elements = {
  list: document.querySelector("#entries"),
  empty: document.querySelector("#empty-state"),
  emptyTitle: document.querySelector("#empty-state h2"),
  emptyDescription: document.querySelector("#empty-state p"),
  count: document.querySelector("#entry-count"),
  status: document.querySelector("#status"),
  selectionBar: document.querySelector("#selection-bar"),
  selectionCount: document.querySelector("#selection-count"),
  selectAll: document.querySelector("#select-all"),
  search: document.querySelector("#search"),
  importFile: document.querySelector("#import-file"),
  generalTab: document.querySelector("#general-tab"),
  privateTab: document.querySelector("#private-tab"),
  lockPrivate: document.querySelector("#lock-private"),
  privateGate: document.querySelector("#private-gate"),
  privateGateForm: document.querySelector("#private-gate-form"),
  privatePasscode: document.querySelector("#private-passcode"),
  privateError: document.querySelector("#private-error")
};

function makeEntry(title = "", content = "") {
  return { id: crypto.randomUUID(), title, content, isPrivate: activeTab === "private", updatedAt: Date.now() };
}

async function loadEntries() {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  entries = Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY].map((entry) => ({
    id: String(entry.id || crypto.randomUUID()),
    title: String(entry.title || "Untitled entry"),
    content: String(entry.content || ""),
    isPrivate: Boolean(entry.isPrivate),
    updatedAt: Number(entry.updatedAt) || 0
  })) : [];
  sortEntries();
  render();
}

function sortEntries() { entries.sort((a, b) => b.updatedAt - a.updatedAt); }

async function persist() {
  await browser.storage.local.set({ [STORAGE_KEY]: entries });
}

function setStatus(message) {
  elements.status.textContent = message;
  if (message) setTimeout(() => { elements.status.textContent = ""; }, 2200);
}

function entriesForActiveTab() {
  return entries.filter((entry) => entry.isPrivate === (activeTab === "private"));
}

function setActiveTab(tab) {
  activeTab = tab;
  selectedIds.clear();
  activeId = null;
  activeMode = null;
  elements.generalTab.setAttribute("aria-selected", String(tab === "general"));
  elements.privateTab.setAttribute("aria-selected", String(tab === "private"));
  elements.privateTab.title = privateUnlocked ? "Private entries" : "Unlock private entries";
  elements.privateTab.setAttribute("aria-label", privateUnlocked ? "Private entries" : "Private entries, locked");
  elements.privateTab.querySelector(".button-icon").className = `button-icon icon-${privateUnlocked ? "lock-open" : "lock"}`;
  elements.lockPrivate.hidden = !privateUnlocked || tab !== "private";
  elements.lockPrivate.querySelector(".button-icon").className = `button-icon icon-lock`;
  elements.list.setAttribute("aria-labelledby", tab === "private" ? "private-tab" : "general-tab");
  render();
}

function render() {
  const query = elements.search.value.trim().toLowerCase();
  const currentEntries = entriesForActiveTab();
  const visible = currentEntries.filter((entry) => `${entry.title} ${entry.content}`.toLowerCase().includes(query));
  const currentDraft = draftEntry?.isPrivate === (activeTab === "private") ? draftEntry : null;
  const hasContent = currentEntries.length > 0 || Boolean(currentDraft);
  elements.list.innerHTML = "";
  elements.empty.hidden = hasContent;
  elements.list.hidden = !hasContent;
  elements.count.textContent = `${currentEntries.length} ${currentEntries.length === 1 ? "entry" : "entries"}`;
  elements.emptyTitle.textContent = activeTab === "private" ? "Your private cabinet is clear." : "Your cabinet is clear.";
  elements.emptyDescription.textContent = activeTab === "private" ? "Private snippets stay in this collection until you move or export them." : "Save the words you reach for often. They stay on this device until you export them.";
  currentEntries.forEach((entry) => { if (!visible.some((item) => item.id === entry.id)) selectedIds.delete(entry.id); });
  elements.selectAll.checked = currentEntries.length > 0 && currentEntries.every((entry) => selectedIds.has(entry.id));
  elements.selectAll.indeterminate = selectedIds.size > 0 && !elements.selectAll.checked;
  updateSelectionBar();

  if (currentEntries.length > 0 && visible.length === 0) {
    elements.list.innerHTML = '<p class="empty-state">No entries match that search.</p>';
    return;
  }

  if (currentDraft) elements.list.appendChild(renderEntry(currentDraft));
  visible.forEach((entry) => elements.list.appendChild(renderEntry(entry)));
}

function renderEntry(entry) {
  const article = document.createElement("article");
  article.className = "entry";
  const head = document.createElement("div");
  head.className = "entry-head";
  const select = document.createElement("input");
  select.className = "entry-select";
  select.type = "checkbox";
  select.checked = selectedIds.has(entry.id);
  select.title = "Select entry";
  select.setAttribute("aria-label", `Select ${entry.title || "Untitled entry"}`);
  select.addEventListener("click", (event) => event.stopPropagation());
  select.addEventListener("change", () => {
    if (select.checked) selectedIds.add(entry.id);
    else selectedIds.delete(entry.id);
    updateSelectionBar();
  });
  const title = document.createElement("h2");
  title.className = "entry-title";
  title.textContent = entry.title || "Untitled entry";
  const actions = document.createElement("div");
  actions.className = "entry-actions";
  const isDraft = draftEntry?.id === entry.id;
  const deleteEntryButton = makeAction(isDraft ? "Cancel" : "Delete", isDraft ? "x" : "trash-2", () => {
    if (draftEntry?.id === entry.id) {
      draftEntry = null;
      activeId = null;
      activeMode = null;
      render();
    } else deleteEntry(entry.id);
  }, "delete");
  const copyButton = makeAction("Copy", "copy", (event) => copyEntry(entry, event.currentTarget));
  const editButton = makeAction("Edit", "pencil", () => toggleEntry(entry.id, "edit"));
  if (activeId === entry.id && activeMode === "open") actions.append(editButton, deleteEntryButton, copyButton);
  else actions.append(copyButton);
  head.append(select, title, actions);
  article.appendChild(head);

  const preview = document.createElement("p");
  preview.className = "entry-preview";
  preview.textContent = entry.content || "Empty content";
  article.appendChild(preview);
  article.addEventListener("dblclick", (event) => {
    if (!event.target.closest("button, input")) toggleEntry(entry.id, "open");
  });
  if (activeId === entry.id && activeMode === "open") article.appendChild(renderViewPanel(entry));
  if (activeId === entry.id && activeMode === "view") article.appendChild(renderViewPanel(entry));
  if (activeId === entry.id && activeMode === "edit") article.appendChild(renderEditForm(entry));
  return article;
}

function updateSelectionBar() {
  const selectedCount = selectedIds.size;
  elements.selectionBar.hidden = selectedCount === 0;
  elements.selectionCount.textContent = `${selectedCount} selected`;
}

function toggleEntry(id, mode) {
  if (activeId === id && activeMode === mode) {
    activeId = null;
    activeMode = null;
  } else {
    activeId = id;
    activeMode = mode;
  }
  render();
}

function makeAction(label, icon, handler, extraClass = "") {
  const button = document.createElement("button");
  button.className = `action-button ${extraClass}`;
  button.type = "button";
  button.title = label;
  button.setAttribute("aria-label", label);
  const iconElement = document.createElement("span");
  iconElement.className = `button-icon icon-${icon}`;
  iconElement.setAttribute("aria-hidden", "true");
  button.appendChild(iconElement);
  button.addEventListener("click", handler);
  return button;
}

function renderViewPanel(entry) {
  const panel = document.createElement("div");
  panel.className = "view-panel";
  const content = document.createElement("p");
  content.className = "view-content";
  content.textContent = entry.content || "Empty content";
  panel.appendChild(content);
  return panel;
}

function renderEditForm(entry) {
  const form = document.createElement("form");
  form.className = "edit-form";
  const isDraft = draftEntry?.id === entry.id;
  form.innerHTML = `<div class="form-heading"><h3>${isDraft ? "New entry" : "Edit entry"}</h3><p>${isDraft ? "Keep it useful and easy to scan" : "Changes save instantly"}</p></div><label class="field">Title<input name="title" maxlength="120" placeholder="e.g. Standup update" required></label><label class="field">Content<textarea name="content" maxlength="10000" placeholder="Paste the reusable text here..." required></textarea><span class="character-count">0 / 10,000</span></label><label class="privacy-toggle"><input name="isPrivate" type="checkbox"><span class="button-icon icon-lock" aria-hidden="true"></span> Private entry</label><div class="form-actions"><button type="button" class="button button-quiet cancel"><span class="button-icon icon-x" aria-hidden="true"></span> Cancel</button><button type="submit" class="button button-primary"><span class="button-icon icon-check" aria-hidden="true"></span> ${isDraft ? "Add entry" : "Save changes"}</button></div>`;
  form.elements.title.value = entry.title;
  form.elements.content.value = entry.content;
  form.elements.isPrivate.checked = entry.isPrivate;
  const count = form.querySelector(".character-count");
  const updateCount = () => { count.textContent = `${form.elements.content.value.length.toLocaleString()} / 10,000`; };
  form.elements.content.addEventListener("input", updateCount);
  updateCount();
  form.querySelector(".cancel").addEventListener("click", () => { draftEntry = null; activeId = null; activeMode = null; render(); });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    entry.title = form.elements.title.value.trim();
    entry.content = form.elements.content.value;
    entry.isPrivate = form.elements.isPrivate.checked;
    entry.updatedAt = Date.now();
    if (isDraft) {
      entries.unshift(entry);
      draftEntry = null;
    }
    activeId = null;
    activeMode = null;
    sortEntries();
    await persist();
    render();
    setStatus("Changes saved");
  });
  return form;
}

async function copyEntry(entry, button) {
  try { await navigator.clipboard.writeText(entry.content); }
  catch { copyWithFallback(entry.content); }
  button.title = "Copied";
  button.setAttribute("aria-label", "Copied");
  button.firstElementChild.className = "button-icon icon-check";
  setTimeout(() => {
    button.title = "Copy";
    button.setAttribute("aria-label", "Copy");
    button.firstElementChild.className = "button-icon icon-copy";
  }, 1400);
}

function copyWithFallback(text) {
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}

async function deleteEntry(id) {
  const entry = entries.find((item) => item.id === id);
  if (!entry || !confirm(`Delete “${entry.title || "Untitled entry"}”?`)) return;
  entries = entries.filter((item) => item.id !== id);
  selectedIds.delete(id);
  await persist();
  render();
  setStatus("Entry deleted");
}

async function deleteSelected() {
  const selected = entriesForActiveTab().filter((entry) => selectedIds.has(entry.id));
  if (!selected.length || !confirm(`Delete ${selected.length} selected ${selected.length === 1 ? "entry" : "entries"}?`)) return;
  const deletedIds = new Set(selected.map((entry) => entry.id));
  entries = entries.filter((entry) => !deletedIds.has(entry.id));
  selectedIds.clear();
  activeId = null;
  activeMode = null;
  await persist();
  render();
  setStatus(`${selected.length} ${selected.length === 1 ? "entry" : "entries"} deleted`);
}

function clearSelection() {
  selectedIds.clear();
  render();
}

function startNewEntry() {
  draftEntry = makeEntry();
  activeId = draftEntry.id;
  activeMode = "edit";
  render();
  document.querySelector(".edit-form input")?.focus();
}

async function exportEntries() {
  const file = new Blob([JSON.stringify({ version: 1, entries: entriesForActiveTab() }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(file);
  await browser.downloads.download({ url, filename: "clipboard-backup.json", saveAs: true });
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus("Backup exported");
}

async function importEntries(file) {
  let parsed;
  try { parsed = JSON.parse(await file.text()); }
  catch { alert("That file is not valid JSON."); return; }
  const imported = Array.isArray(parsed) ? parsed : parsed.entries;
  if (!Array.isArray(imported)) { alert("This backup does not contain an entries list."); return; }
  const targetIsPrivate = activeTab === "private";
  const normalized = imported.filter((entry) => entry && typeof entry === "object" && typeof entry.content === "string").map((entry) => ({
    id: String(entry.id || crypto.randomUUID()), title: String(entry.title || "Untitled entry"), content: entry.content, isPrivate: targetIsPrivate, updatedAt: Number(entry.updatedAt) || Date.now()
  }));
  const mode = prompt("Type merge to append entries (skipping duplicate IDs), or replace to replace this collection.", "merge");
  if (mode !== "merge" && mode !== "replace") return;
  if (mode === "replace") entries = [...entries.filter((entry) => entry.isPrivate !== targetIsPrivate), ...normalized];
  else entries = [...entries, ...normalized.filter((entry) => !entries.some((current) => current.id === entry.id))];
  sortEntries();
  await persist();
  render();
  setStatus(`${normalized.length} entries imported`);
}

document.querySelector("#new-entry").addEventListener("click", startNewEntry);
document.querySelector("#empty-new-entry").addEventListener("click", startNewEntry);
document.querySelector("#export").addEventListener("click", exportEntries);
document.querySelector("#import").addEventListener("click", () => elements.importFile.click());
document.querySelector("#delete-selected").addEventListener("click", deleteSelected);
document.querySelector("#clear-selection").addEventListener("click", clearSelection);
elements.generalTab.addEventListener("click", () => setActiveTab("general"));
elements.privateTab.addEventListener("click", () => {
  if (privateUnlocked) setActiveTab("private");
  else {
    elements.privateError.textContent = "";
    elements.privatePasscode.value = "";
    elements.privateGate.showModal();
    elements.privatePasscode.focus();
  }
});
elements.lockPrivate.addEventListener("click", () => {
  privateUnlocked = false;
  setActiveTab("general");
});
document.querySelector("#cancel-private").addEventListener("click", () => elements.privateGate.close());
elements.privateGateForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (elements.privatePasscode.value !== PRIVATE_PASSCODE) {
    elements.privateError.textContent = "That passcode is incorrect.";
    elements.privatePasscode.select();
    return;
  }
  privateUnlocked = true;
  elements.privateGate.close();
  setActiveTab("private");
});
elements.selectAll.addEventListener("change", () => {
  if (elements.selectAll.checked) entriesForActiveTab().forEach((entry) => selectedIds.add(entry.id));
  else entriesForActiveTab().forEach((entry) => selectedIds.delete(entry.id));
  render();
});
elements.importFile.addEventListener("change", () => { if (elements.importFile.files[0]) importEntries(elements.importFile.files[0]); elements.importFile.value = ""; });
elements.search.addEventListener("input", render);
browser.storage.onChanged.addListener((changes, area) => { if (area === "local" && changes[STORAGE_KEY]) loadEntries(); });
loadEntries();