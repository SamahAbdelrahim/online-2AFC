const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { normalizeComparisonConfig, validateComparisonConfig } = require("./comparison-survey");

const SLUG_PATTERN = /^[a-z][a-z0-9]{5,11}$/;

const RESERVED_SLUGS = new Set([
  "admin",
  "online",
  "inperson",
  "api",
  "human-experiment",
  "general_assets",
  "stimuli_pipe",
  "stl",
  "glb",
  "models",
  "vendor",
  "favicon.ico"
]);

function getCustomStudiesPath(repoRoot) {
  return path.join(repoRoot, "configs", "custom_studies.json");
}

function loadCustomStudiesStore(repoRoot) {
  const storePath = getCustomStudiesPath(repoRoot);
  if (!fs.existsSync(storePath)) {
    return { studies: {} };
  }
  const raw = JSON.parse(fs.readFileSync(storePath, "utf8"));
  return {
    studies: raw.studies && typeof raw.studies === "object" ? raw.studies : {}
  };
}

function saveCustomStudiesStore(repoRoot, store) {
  const storePath = getCustomStudiesPath(repoRoot);
  fs.writeFileSync(storePath, `${JSON.stringify({ studies: store.studies }, null, 2)}\n`, "utf8");
}

function isCustomStudySlug(slug) {
  return Boolean(slug && SLUG_PATTERN.test(slug) && !RESERVED_SLUGS.has(slug));
}

function generateCustomStudySlug(existingStudies) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (let attempt = 0; attempt < 80; attempt += 1) {
    let slug = "a";
    for (let i = 0; i < 6; i += 1) {
      slug += alphabet[crypto.randomInt(0, alphabet.length)];
    }
    if (!RESERVED_SLUGS.has(slug) && !existingStudies[slug]) {
      return slug;
    }
  }
  throw new Error("Could not generate a unique custom study URL.");
}

function normalizeCopyOverrides(raw = {}) {
  const clean = (value) => {
    const text = String(value || "").trim();
    return text || null;
  };
  return {
    trial_title: clean(raw.trial_title),
    trial_subtitle: clean(raw.trial_subtitle),
    choice_button_a: clean(raw.choice_button_a),
    choice_button_b: clean(raw.choice_button_b),
    choice_prompt_locked: clean(raw.choice_prompt_locked),
    choice_prompt_unlocked: clean(raw.choice_prompt_unlocked)
  };
}

function normalizeCustomStudyRecord(raw = {}, slug = "") {
  const studyVariant = ["complexity", "online", "inperson"].includes(raw.study_variant)
    ? raw.study_variant
    : "complexity";
  const comparisonSource = raw.comparison && typeof raw.comparison === "object"
    ? raw.comparison
    : raw;
  return {
    slug,
    label: String(raw.label || "").trim() || "Untitled Study",
    study_variant: studyVariant,
    active: raw.active !== false,
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    comparison: normalizeComparisonConfig(comparisonSource),
    copy_overrides: normalizeCopyOverrides(raw.copy_overrides || {})
  };
}

function summarizeCustomStudy(record) {
  return {
    slug: record.slug,
    label: record.label,
    study_variant: record.study_variant,
    active: record.active,
    created_at: record.created_at,
    updated_at: record.updated_at,
    pair_mode: record.comparison.pair_mode,
    trial_count: record.comparison.pair_mode === "fixed"
      ? record.comparison.fixed_pairs.length
      : record.comparison.trial_count,
    url_path: `/${record.slug}`
  };
}

function listCustomStudies(repoRoot, { activeOnly = false } = {}) {
  const store = loadCustomStudiesStore(repoRoot);
  return Object.values(store.studies)
    .filter((study) => (activeOnly ? study.active : true))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map(summarizeCustomStudy);
}

function getCustomStudy(repoRoot, slug) {
  if (!isCustomStudySlug(slug)) return null;
  const store = loadCustomStudiesStore(repoRoot);
  return store.studies[slug] || null;
}

function getActiveCustomStudy(repoRoot, slug) {
  const study = getCustomStudy(repoRoot, slug);
  if (!study || !study.active) return null;
  return study;
}

function createCustomStudy(repoRoot, payload) {
  const store = loadCustomStudiesStore(repoRoot);
  const slug = generateCustomStudySlug(store.studies);
  const draft = normalizeCustomStudyRecord(payload, slug);
  draft.comparison = validateComparisonConfig(draft.comparison, repoRoot);
  draft.created_at = new Date().toISOString();
  draft.updated_at = draft.created_at;
  store.studies[slug] = draft;
  saveCustomStudiesStore(repoRoot, store);
  return draft;
}

function updateCustomStudy(repoRoot, slug, payload) {
  if (!isCustomStudySlug(slug)) {
    throw new Error("Invalid custom study URL.");
  }
  const store = loadCustomStudiesStore(repoRoot);
  const existing = store.studies[slug];
  if (!existing) {
    throw new Error(`Custom study not found: ${slug}`);
  }
  const draft = normalizeCustomStudyRecord(
    {
      ...existing,
      ...payload,
      comparison: payload.comparison || existing.comparison,
      copy_overrides: {
        ...existing.copy_overrides,
        ...(payload.copy_overrides || {})
      },
      created_at: existing.created_at
    },
    slug
  );
  draft.comparison = validateComparisonConfig(draft.comparison, repoRoot);
  if (typeof payload.active === "boolean") {
    draft.active = payload.active;
  }
  store.studies[slug] = draft;
  saveCustomStudiesStore(repoRoot, store);
  return draft;
}

function deactivateCustomStudy(repoRoot, slug) {
  return updateCustomStudy(repoRoot, slug, { active: false });
}

function publicCustomStudyMeta(study) {
  if (!study) return null;
  return {
    slug: study.slug,
    label: study.label,
    study_variant: study.study_variant,
    copy_overrides: study.copy_overrides,
    comparison: {
      prompt: study.comparison.prompt
    }
  };
}

module.exports = {
  RESERVED_SLUGS,
  SLUG_PATTERN,
  isCustomStudySlug,
  listCustomStudies,
  getCustomStudy,
  getActiveCustomStudy,
  createCustomStudy,
  updateCustomStudy,
  deactivateCustomStudy,
  publicCustomStudyMeta,
  summarizeCustomStudy
};
