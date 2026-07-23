const path = require("path");
const {
  loadComparisonConfig,
  listAvailableModels,
  buildComparisonTrials,
  saveComparisonConfig,
  validateComparisonConfig
} = require("./comparison-survey");
const {
  isCustomStudySlug,
  getActiveCustomStudy,
  getCustomStudy,
  listCustomStudies,
  createCustomStudy,
  updateCustomStudy,
  deactivateCustomStudy,
  publicCustomStudyMeta,
  summarizeCustomStudy
} = require("./custom-studies");

function registerStudyPageRoutes(app, publicDir, options = {}) {
  const { adminPageHandler, studyPageLimiter } = options;
  const limitStudyPage = studyPageLimiter || ((_req, _res, next) => next());
  const indexHtml = path.join(publicDir, "index.html");
  const defaultAdminHandler = (_req, res) => {
    res.sendFile(path.join(publicDir, "admin.html"));
  };

  app.get("/", limitStudyPage, (_req, res) => {
    res.sendFile(indexHtml);
  });

  app.get("/online", limitStudyPage, (_req, res) => {
    res.sendFile(indexHtml);
  });

  app.get("/inperson", limitStudyPage, (_req, res) => {
    res.sendFile(indexHtml);
  });

  app.get("/admin", adminPageHandler || defaultAdminHandler);

  app.get("/:slug", limitStudyPage, (req, res, next) => {
    const { slug } = req.params;
    if (!isCustomStudySlug(slug)) {
      next();
      return;
    }
    const study = getCustomStudy(app.locals.repoRoot, slug);
    if (!study) {
      next();
      return;
    }
    res.sendFile(indexHtml);
  });
}

function registerComparisonApiRoutes(app, repoRoot, options = {}) {
  const {
    requireAdmin = (_req, _res, next) => next(),
    comparisonTrialsLimiter
  } = options;
  const limitComparisonTrials = comparisonTrialsLimiter || ((_req, _res, next) => next());
  app.locals.repoRoot = repoRoot;

  app.put("/api/comparison-config", requireAdmin, (req, res) => {
    try {
      const config = saveComparisonConfig(repoRoot, req.body || {});
      res.json({ ok: true, config });
    } catch (err) {
      res.status(400).json({ ok: false, error: String(err.message || err) });
    }
  });

  app.post("/api/comparison-config/preview", requireAdmin, (req, res) => {
    try {
      const result = buildComparisonTrials({
        repoRoot,
        participantSeed: "admin-preview",
        configOverride: req.body || {}
      });
      res.json({
        ok: true,
        trial_count: result.trials.length,
        config: result.config,
        trials: result.trials.map((trial) => ({
          model_a: `${trial.model_a.source}/${trial.model_a.filename}`,
          model_b: `${trial.model_b.source}/${trial.model_b.filename}`
        }))
      });
    } catch (err) {
      res.status(400).json({ ok: false, error: String(err.message || err) });
    }
  });

  app.get("/api/comparison-config", requireAdmin, (_req, res) => {
    try {
      const config = loadComparisonConfig(repoRoot);
      res.json({ config });
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.get("/api/models", requireAdmin, (req, res) => {
    try {
      const config = loadComparisonConfig(repoRoot);
      const requestedSources = String(req.query.sources || "")
        .split(",")
        .map((source) => source.trim())
        .filter(Boolean);
      const modelSources = requestedSources.length > 0 ? requestedSources : config.model_sources;
      const models = listAvailableModels(repoRoot, modelSources);
      res.json({ count: models.length, models, model_sources: modelSources });
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.get("/api/comparison-trials", limitComparisonTrials, (req, res) => {
    try {
      const customSlug = String(req.query.custom_study || "").trim();
      let customStudy = null;
      let configOverride = null;

      if (customSlug) {
        customStudy = getActiveCustomStudy(repoRoot, customSlug);
        if (!customStudy) {
          res.status(404).json({ error: `Custom study not found: ${customSlug}` });
          return;
        }
        configOverride = customStudy.comparison;
      }

      const participantSeed = [
        String(req.query.prolific_pid || "debug_pid"),
        String(req.query.study_id || "debug_study"),
        String(req.query.session_id || "debug_session"),
        customSlug || "default"
      ].join("|");

      const result = buildComparisonTrials({
        repoRoot,
        participantSeed,
        configOverride
      });

      res.json({
        config: result.config,
        model_count: result.models.length,
        count: result.trials.length,
        trials: result.trials,
        custom_study: publicCustomStudyMeta(customStudy)
      });
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });
}

function registerCustomStudyApiRoutes(app, repoRoot, options = {}) {
  const { requireAdmin = (_req, _res, next) => next() } = options;
  app.get("/api/custom-studies", requireAdmin, (req, res) => {
    try {
      const activeOnly = req.query.active === "1" || req.query.active === "true";
      const studies = listCustomStudies(repoRoot, { activeOnly });
      res.json({ ok: true, count: studies.length, studies });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err.message || err) });
    }
  });

  app.get("/api/custom-studies/:slug", requireAdmin, (req, res) => {
    try {
      const study = getCustomStudy(repoRoot, req.params.slug);
      if (!study) {
        res.status(404).json({ ok: false, error: "Custom study not found." });
        return;
      }
      res.json({ ok: true, study });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err.message || err) });
    }
  });

  app.post("/api/custom-studies", requireAdmin, (req, res) => {
    try {
      const study = createCustomStudy(repoRoot, req.body || {});
      res.status(201).json({
        ok: true,
        study,
        summary: summarizeCustomStudy(study)
      });
    } catch (err) {
      res.status(400).json({ ok: false, error: String(err.message || err) });
    }
  });

  app.put("/api/custom-studies/:slug", requireAdmin, (req, res) => {
    try {
      const body = req.body || {};
      if (body.comparison) {
        body.comparison = validateComparisonConfig(body.comparison, repoRoot);
      }
      const study = updateCustomStudy(repoRoot, req.params.slug, body);
      res.json({ ok: true, study, summary: summarizeCustomStudy(study) });
    } catch (err) {
      res.status(400).json({ ok: false, error: String(err.message || err) });
    }
  });

  app.post("/api/custom-studies/:slug/deactivate", requireAdmin, (req, res) => {
    try {
      const study = deactivateCustomStudy(repoRoot, req.params.slug);
      res.json({ ok: true, study, summary: summarizeCustomStudy(study) });
    } catch (err) {
      res.status(400).json({ ok: false, error: String(err.message || err) });
    }
  });
}

module.exports = {
  registerStudyPageRoutes,
  registerComparisonApiRoutes,
  registerCustomStudyApiRoutes
};
