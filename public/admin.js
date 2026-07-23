const form = document.getElementById("sb-admin-form");
const pairRowsEl = document.getElementById("sb-pair-rows");
const modelPoolEl = document.getElementById("sb-model-pool");
const fixedPanel = document.getElementById("sb-fixed-panel");
const randomPanel = document.getElementById("sb-random-panel");
const statusEl = document.getElementById("sb-admin-status");
const previewEl = document.getElementById("sb-admin-preview");
const previewBtn = document.getElementById("sb-preview-btn");
const saveBtn = document.getElementById("sb-save-btn");
const customStudyListEl = document.getElementById("sb-custom-study-list");
const createCustomLinkBtn = document.getElementById("sb-create-custom-link");
const adminUserEl = document.getElementById("sb-admin-user");
const adminUserEmailEl = document.getElementById("sb-admin-user-email");
const logoutBtn = document.getElementById("sb-admin-logout");

const fetchOptions = { credentials: "same-origin" };

async function adminFetch(url, options = {}) {
  const res = await fetch(url, { ...fetchOptions, ...options });
  if (res.status === 401) {
    window.location.href = "/admin";
    throw new Error("Your admin session expired. Please sign in again.");
  }
  return res;
}

async function loadSession() {
  const res = await fetch("/api/admin/session", fetchOptions);
  const session = await res.json();
  if (session.auth_enabled && !session.authenticated) {
    window.location.href = "/admin";
    return false;
  }
  if (session.auth_enabled && session.email && adminUserEl && adminUserEmailEl) {
    adminUserEmailEl.textContent = session.email;
    adminUserEl.hidden = false;
  }
  return true;
}

let availableModels = [];
let savedModelPool = [];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

async function readJson(res) {
  const payload = await res.json();
  if (!res.ok) {
    const message = payload.error || payload.message || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return payload;
}

function modelKey(model) {
  return `${model.source}/${model.filename}`;
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("sb-admin-status--error", isError);
}

function setBusy(isBusy) {
  previewBtn.disabled = isBusy;
  saveBtn.disabled = isBusy;
  if (createCustomLinkBtn) {
    createCustomLinkBtn.disabled = isBusy;
  }
}

function getSelectedModelSources() {
  return [...form.querySelectorAll('input[name="model_sources"]:checked')].map(
    (input) => input.value
  );
}

function getPairMode() {
  return form.querySelector('input[name="pair_mode"]:checked')?.value || "fixed";
}

function updateModePanels() {
  const isFixed = getPairMode() === "fixed";
  fixedPanel.classList.toggle("sb-admin-card--hidden", !isFixed);
  randomPanel.classList.toggle("sb-admin-card--hidden", isFixed);
}

function buildModelOptions(selectedValue = "") {
  const options = ['<option value="">Select a file…</option>'];
  for (const model of availableModels) {
    const value = modelKey(model);
    const label = `${model.source}/${model.filename} (${model.format})`;
    const selected =
      value === selectedValue ||
      model.filename === selectedValue ||
      value.toLowerCase() === String(selectedValue).toLowerCase()
        ? " selected"
        : "";
    options.push(
      `<option value="${escapeAttr(value)}"${selected}>${escapeHtml(label)}</option>`
    );
  }
  return options.join("");
}

function createPairRow(left = "", right = "") {
  const row = document.createElement("div");
  row.className = "sb-pair-row";
  row.innerHTML = `
    <label class="sb-admin-field sb-pair-field">
      <span class="sb-admin-label">Object A</span>
      <select class="sb-pair-left">${buildModelOptions(left)}</select>
    </label>
    <label class="sb-admin-field sb-pair-field">
      <span class="sb-admin-label">Object B</span>
      <select class="sb-pair-right">${buildModelOptions(right)}</select>
    </label>
    <button type="button" class="sb-admin-btn sb-admin-btn--ghost sb-pair-remove" aria-label="Remove pair">
      Remove
    </button>
  `;
  row.querySelector(".sb-pair-remove").addEventListener("click", () => {
    row.remove();
    if (pairRowsEl.children.length === 0) {
      addPairRow();
    }
  });
  return row;
}

function addPairRow(left = "", right = "") {
  pairRowsEl.appendChild(createPairRow(left, right));
}

function refreshPairRowOptions() {
  for (const row of pairRowsEl.querySelectorAll(".sb-pair-row")) {
    const left = row.querySelector(".sb-pair-left");
    const right = row.querySelector(".sb-pair-right");
    const leftValue = left.value;
    const rightValue = right.value;
    left.innerHTML = buildModelOptions(leftValue);
    right.innerHTML = buildModelOptions(rightValue);
  }
}

function renderModelPool(selectedPool = savedModelPool) {
  const selected = new Set(selectedPool.map((entry) => entry.toLowerCase()));
  if (availableModels.length === 0) {
    const sources = getSelectedModelSources();
    modelPoolEl.innerHTML = sources.length === 0
      ? '<p class="sb-admin-hint sb-admin-hint--last">Select at least one model folder.</p>'
      : '<p class="sb-admin-hint sb-admin-hint--last">No model files found in the selected folders.</p>';
    return;
  }

  modelPoolEl.innerHTML = availableModels
    .map((model) => {
      const value = modelKey(model);
      const checked = selected.has(value.toLowerCase()) || selected.has(model.filename.toLowerCase())
        ? " checked"
        : "";
      return `
        <label class="sb-admin-check sb-model-pool-item">
          <input type="checkbox" name="model_pool" value="${escapeAttr(value)}"${checked} />
          <span>${escapeHtml(value)} <em>(${escapeHtml(model.format)})</em></span>
        </label>
      `;
    })
    .join("");
}

async function loadModels() {
  const sources = getSelectedModelSources();
  if (sources.length === 0) {
    availableModels = [];
    refreshPairRowOptions();
    renderModelPool(savedModelPool);
    return;
  }

  const query = `?sources=${encodeURIComponent(sources.join(","))}`;
  const res = await adminFetch(`/api/models${query}`);
  const payload = await readJson(res);
  availableModels = payload.models || [];
  refreshPairRowOptions();
  renderModelPool(savedModelPool);
}

function resolveModelValue(value) {
  if (!value) return "";
  if (availableModels.some((model) => modelKey(model) === value)) {
    return value;
  }
  const match = availableModels.find(
    (model) =>
      model.filename === value ||
      model.filename.toLowerCase() === String(value).toLowerCase() ||
      modelKey(model).toLowerCase() === String(value).toLowerCase()
  );
  return match ? modelKey(match) : value;
}

function syncPairRowValues() {
  for (const row of pairRowsEl.querySelectorAll(".sb-pair-row")) {
    const left = row.querySelector(".sb-pair-left");
    const right = row.querySelector(".sb-pair-right");
    left.value = resolveModelValue(left.value);
    right.value = resolveModelValue(right.value);
  }
}

function validateConfig(config) {
  if (!config.model_sources.length) {
    throw new Error("Select at least one model folder.");
  }

  if (config.pair_mode === "fixed") {
    if (config.fixed_pairs.length === 0) {
      throw new Error("Add at least one complete fixed pair.");
    }
    const sameFile = config.fixed_pairs.find((pair) => pair.left === pair.right);
    if (sameFile) {
      throw new Error("Each pair must use two different files.");
    }
    return;
  }

  const poolSize = config.model_pool.length > 0
    ? config.model_pool.length
    : availableModels.length;
  if (poolSize < 2) {
    throw new Error("Random pairing needs at least two model files in the pool.");
  }
}

function collectCopyOverrides() {
  const value = (id) => document.getElementById(id)?.value.trim() || "";
  return {
    trial_title: value("custom-trial-title"),
    trial_subtitle: value("custom-trial-subtitle"),
    choice_button_a: value("custom-choice-a"),
    choice_button_b: value("custom-choice-b")
  };
}

function collectCustomStudyPayload() {
  const comparison = collectConfig();
  const { pair_mode, trial_count, shuffle_trials, allow_repeat_pairs, model_sources, prompt, fixed_pairs, model_pool } = comparison;
  return {
    label: document.getElementById("custom-study-label")?.value.trim() || "Untitled Study",
    study_variant: document.getElementById("custom-study-variant")?.value || "complexity",
    comparison: {
      pair_mode,
      trial_count,
      shuffle_trials,
      allow_repeat_pairs,
      model_sources,
      prompt,
      fixed_pairs,
      model_pool
    },
    copy_overrides: collectCopyOverrides()
  };
}

function renderCustomStudyList(studies) {
  if (!customStudyListEl) return;
  if (!studies.length) {
    customStudyListEl.innerHTML = '<p class="sb-custom-study-empty">No active custom links yet.</p>';
    return;
  }

  customStudyListEl.innerHTML = studies
    .map((study) => {
      const url = `${window.location.origin}${study.url_path}`;
      const variantLabel = {
        complexity: "Complexity Study",
        online: "Parent Online",
        inperson: "Children In Person"
      }[study.study_variant] || study.study_variant;
      const slug = escapeHtml(study.slug);
      const label = escapeHtml(study.label);
      const urlPath = escapeHtml(study.url_path);
      const safeUrl = escapeHtml(url);
      return `
        <article class="sb-custom-study-item">
          <div class="sb-custom-study-item-head">
            <h4 class="sb-custom-study-item-title">${label}</h4>
            <code>/${slug}</code>
          </div>
          <p class="sb-custom-study-item-meta">
            ${escapeHtml(variantLabel)} · ${escapeHtml(study.pair_mode)} · ${study.trial_count} trial(s)
          </p>
          <div class="sb-custom-study-item-actions">
            <a class="sb-admin-btn sb-admin-btn--secondary" href="${urlPath}" target="_blank" rel="noopener noreferrer">Open</a>
            <button type="button" class="sb-admin-btn sb-admin-btn--secondary" data-copy-url="${safeUrl}">Copy URL</button>
            <button type="button" class="sb-admin-btn sb-admin-btn--ghost" data-deactivate-slug="${slug}">Deactivate</button>
          </div>
        </article>
      `;
    })
    .join("");

}

function handleCustomStudyListClick(event) {
  const copyBtn = event.target.closest("[data-copy-url]");
  if (copyBtn) {
    navigator.clipboard
      .writeText(copyBtn.dataset.copyUrl)
      .then(() => setStatus("Custom link copied to clipboard."))
      .catch(() => setStatus("Could not copy the link. Copy it manually from the address bar.", true));
    return;
  }

  const deactivateBtn = event.target.closest("[data-deactivate-slug]");
  if (deactivateBtn) {
    deactivateCustomStudy(deactivateBtn.dataset.deactivateSlug).catch((err) =>
      setStatus(err.message, true)
    );
  }
}

async function loadCustomStudies() {
  const res = await adminFetch("/api/custom-studies?active=1");
  const payload = await readJson(res);
  if (payload.ok === false) {
    throw new Error(payload.error || "Failed to load custom links.");
  }
  renderCustomStudyList(payload.studies || []);
}

async function createCustomStudyLink() {
  const body = collectCustomStudyPayload();
  setBusy(true);
  try {
    const res = await adminFetch("/api/custom-studies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await readJson(res);
    if (payload.ok === false) {
      throw new Error(payload.error || "Create failed.");
    }
    const url = `${window.location.origin}/${payload.summary.slug}`;
    previewEl.classList.add("sb-admin-preview--hidden");
    setStatus(`Custom link created: ${url}`);
    document.getElementById("custom-study-label").value = "";
    await loadCustomStudies();
  } finally {
    setBusy(false);
  }
}

async function deactivateCustomStudy(slug) {
  const res = await adminFetch(`/api/custom-studies/${encodeURIComponent(slug)}/deactivate`, {
    method: "POST"
  });
  const payload = await readJson(res);
  if (payload.ok === false) {
    throw new Error(payload.error || "Deactivate failed.");
  }
  setStatus(`Deactivated /${slug}.`);
  await loadCustomStudies();
}

function collectConfig() {
  const pairMode = getPairMode();
  const modelSources = getSelectedModelSources();
  const config = {
    pair_mode: pairMode,
    trial_count: Math.max(1, Number(form.trial_count.value) || 15),
    shuffle_trials: form.shuffle_trials.checked,
    allow_repeat_pairs: form.allow_repeat_pairs.checked,
    model_sources: modelSources,
    prompt: form.prompt.value.trim() || "Which object looks more complex?",
    fixed_pairs: [],
    model_pool: []
  };

  if (pairMode === "fixed") {
    config.fixed_pairs = [...pairRowsEl.querySelectorAll(".sb-pair-row")]
      .map((row) => ({
        left: row.querySelector(".sb-pair-left").value,
        right: row.querySelector(".sb-pair-right").value
      }))
      .filter((pair) => pair.left && pair.right);
  } else {
    config.model_pool = [...form.querySelectorAll('input[name="model_pool"]:checked')].map(
      (input) => input.value
    );
  }

  validateConfig(config);
  return config;
}

function normalizePairValue(ref) {
  if (!ref) return "";
  if (typeof ref === "string") return ref;
  const filename = ref.file || ref.filename || ref.name || "";
  return ref.source ? `${ref.source}/${filename}` : filename;
}

function applyConfig(config) {
  const pairMode = config.pair_mode === "random" ? "random" : "fixed";
  form.querySelector(`input[name="pair_mode"][value="${pairMode}"]`).checked = true;
  form.trial_count.value = String(config.trial_count || 15);
  form.shuffle_trials.checked = config.shuffle_trials !== false;
  form.allow_repeat_pairs.checked = config.allow_repeat_pairs === true;
  form.prompt.value = config.prompt || "Which object looks more complex?";
  savedModelPool = Array.isArray(config.model_pool) ? config.model_pool : [];

  for (const input of form.querySelectorAll('input[name="model_sources"]')) {
    input.checked = (config.model_sources || []).includes(input.value);
  }

  updateModePanels();

  pairRowsEl.innerHTML = "";
  const pairs = Array.isArray(config.fixed_pairs) ? config.fixed_pairs : [];
  if (pairs.length === 0) {
    addPairRow();
  } else {
    for (const pair of pairs) {
      addPairRow(normalizePairValue(pair.left || pair.a), normalizePairValue(pair.right || pair.b));
    }
  }
}

async function refreshFromConfig(config) {
  applyConfig(config);
  await loadModels();
  syncPairRowValues();
  renderModelPool(savedModelPool);
}

async function loadConfig() {
  const res = await adminFetch("/api/comparison-config");
  const payload = await readJson(res);
  await refreshFromConfig(payload.config || {});
  setStatus("Current configuration loaded.");
}

async function previewConfig() {
  const config = collectConfig();
  setBusy(true);
  try {
    const res = await adminFetch("/api/comparison-config/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config)
    });
    const payload = await readJson(res);
    if (payload.ok === false) {
      throw new Error(payload.error || "Preview failed.");
    }
    previewEl.classList.remove("sb-admin-preview--hidden");
    previewEl.textContent = payload.trials
      .map((trial, index) => `${index + 1}. ${trial.model_a}  vs  ${trial.model_b}`)
      .join("\n");
    setStatus(`${payload.trial_count} trial(s) ready. Review the list below.`);
  } finally {
    setBusy(false);
  }
}

async function saveConfig(event) {
  event.preventDefault();
  const config = collectConfig();
  setBusy(true);
  try {
    const res = await adminFetch("/api/comparison-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config)
    });
    const payload = await readJson(res);
    if (payload.ok === false) {
      throw new Error(payload.error || "Save failed.");
    }
    await refreshFromConfig(payload.config);
    previewEl.classList.add("sb-admin-preview--hidden");
    setStatus("Saved. The study links below now use this configuration.");
  } finally {
    setBusy(false);
  }
}

form.addEventListener("change", (event) => {
  if (event.target.name === "pair_mode") {
    updateModePanels();
    previewEl.classList.add("sb-admin-preview--hidden");
  }
  if (event.target.name === "model_sources") {
    loadModels()
      .then(() => {
        syncPairRowValues();
        setStatus("Model list updated for the selected folders.");
      })
      .catch((err) => setStatus(err.message, true));
  }
  if (event.target.name === "model_pool") {
    savedModelPool = [...form.querySelectorAll('input[name="model_pool"]:checked')].map(
      (input) => input.value
    );
  }
});

document.getElementById("sb-add-pair").addEventListener("click", () => addPairRow());
previewBtn.addEventListener("click", () => {
  previewConfig().catch((err) => setStatus(err.message, true));
});
form.addEventListener("submit", (event) => {
  saveConfig(event).catch((err) => setStatus(err.message, true));
});

createCustomLinkBtn?.addEventListener("click", () => {
  createCustomStudyLink().catch((err) => setStatus(err.message, true));
});

customStudyListEl?.addEventListener("click", handleCustomStudyListClick);

logoutBtn?.addEventListener("click", async () => {
  try {
    await fetch("/auth/logout", { method: "POST", credentials: "same-origin" });
  } finally {
    window.location.href = "/admin";
  }
});

loadSession()
  .then(async (ok) => {
    if (!ok) return;
    await Promise.all([loadConfig(), loadCustomStudies()]);
  })
  .catch((err) => setStatus(err.message, true));
