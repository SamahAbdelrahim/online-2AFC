const rateLimit = require("express-rate-limit");

function isRateLimitEnabled() {
  return process.env.RATE_LIMIT_DISABLED !== "true";
}

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return forwarded || req.ip || "unknown";
}

function participantRateLimitKey(req) {
  const prolificPid = req.body?.prolific_pid || req.query?.prolific_pid;
  const studyId = req.body?.study_id || req.query?.study_id;
  const sessionId = req.body?.session_id || req.query?.session_id;

  if (prolificPid && studyId && sessionId) {
    return `participant:${prolificPid}|${studyId}|${sessionId}`;
  }

  return `ip:${getClientIp(req)}`;
}

function jsonRateLimitHandler(_req, res) {
  res.status(429).json({
    ok: false,
    error: "Too many requests. Please wait and try again."
  });
}

function htmlRateLimitHandler(_req, res) {
  res
    .status(429)
    .type("text/plain")
    .send("Too many requests. Please wait and try again.");
}

function noopMiddleware(_req, _res, next) {
  next();
}

function createLimiter(options) {
  if (!isRateLimitEnabled()) {
    return noopMiddleware;
  }
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    ...options
  });
}

function configureRateLimitProxy(app) {
  if (process.env.NODE_ENV === "production" || process.env.TRUST_PROXY === "true") {
    app.set("trust proxy", 1);
  }
}

function createParticipantRateLimits() {
  return {
    studyPages: createLimiter({
      windowMs: 15 * 60 * 1000,
      max: Number(process.env.RATE_LIMIT_STUDY_PAGES_MAX || 80),
      keyGenerator: (req) => `ip:${getClientIp(req)}`,
      handler: htmlRateLimitHandler
    }),
    comparisonTrials: createLimiter({
      windowMs: 15 * 60 * 1000,
      max: Number(process.env.RATE_LIMIT_TRIALS_MAX || 20),
      keyGenerator: participantRateLimitKey,
      handler: jsonRateLimitHandler
    }),
    trialLog: createLimiter({
      windowMs: 60 * 60 * 1000,
      max: Number(process.env.RATE_LIMIT_LOG_MAX || 120),
      keyGenerator: participantRateLimitKey,
      handler: jsonRateLimitHandler
    })
  };
}

module.exports = {
  configureRateLimitProxy,
  createParticipantRateLimits,
  participantRateLimitKey,
  getClientIp
};
