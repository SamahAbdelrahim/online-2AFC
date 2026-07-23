const path = require("path");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { logAdminSignIn, listAdminSignIns } = require("./admin-signin-log");

function parseEnvList(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminAuthEnabled() {
  if (process.env.ADMIN_AUTH_DISABLED === "true") {
    return false;
  }
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function getAllowedDomains() {
  const domains = parseEnvList(process.env.ADMIN_ALLOWED_DOMAINS);
  return domains.length > 0 ? domains : ["stanford.edu"];
}

function getAllowedEmails() {
  return parseEnvList(process.env.ADMIN_ALLOWED_EMAILS);
}

function isEmailAllowed(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    return false;
  }

  const allowedEmails = getAllowedEmails();
  if (allowedEmails.includes(normalized)) {
    return true;
  }

  const domain = normalized.split("@").pop();
  return getAllowedDomains().includes(domain);
}

function getSessionSecret() {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  if (isAdminAuthEnabled()) {
    throw new Error("SESSION_SECRET is required when Google admin auth is enabled.");
  }
  return "preview-session-not-used";
}

function getGoogleCallbackUrl() {
  if (process.env.GOOGLE_CALLBACK_URL) {
    return process.env.GOOGLE_CALLBACK_URL;
  }
  const port = Number(process.env.PORT || process.env.PREVIEW_PORT || 3041);
  const baseUrl = process.env.APP_URL || `http://localhost:${port}`;
  return `${baseUrl.replace(/\/$/, "")}/auth/google/callback`;
}

let passportConfigured = false;

function configurePassport() {
  if (passportConfigured) {
    return;
  }
  passportConfigured = true;
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser((user, done) => {
    done(null, user);
  });

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: getGoogleCallbackUrl()
      },
      (_accessToken, _refreshToken, profile, done) => {
        const emailEntry =
          profile.emails?.find((entry) => entry.verified) || profile.emails?.[0];
        const email = emailEntry?.value || "";

        if (!isEmailAllowed(email)) {
          return done(null, false, { message: "This Google account is not allowed to access admin." });
        }

        return done(null, {
          email: email.toLowerCase(),
          name: profile.displayName || email
        });
      }
    )
  );
}

function requireAdmin(req, res, next) {
  if (!isAdminAuthEnabled()) {
    next();
    return;
  }
  if (req.isAuthenticated()) {
    next();
    return;
  }
  res.status(401).json({ ok: false, error: "Authentication required." });
}

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return forwarded || req.ip || "";
}

function createAdminPageHandler(publicDir) {
  const adminHtml = path.join(publicDir, "admin.html");
  const adminLoginHtml = path.join(publicDir, "admin-login.html");

  return (req, res) => {
    if (isAdminAuthEnabled() && !req.isAuthenticated()) {
      res.sendFile(adminLoginHtml);
      return;
    }
    res.sendFile(adminHtml);
  };
}

function registerAdminAuth(app, { publicDir }) {
  const adminPageHandler = createAdminPageHandler(publicDir);

  if (!isAdminAuthEnabled()) {
    app.get("/api/admin/session", (_req, res) => {
      res.json({ auth_enabled: false, authenticated: true });
    });

    return {
      requireAdmin,
      adminPageHandler
    };
  }

  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  configurePassport();

  app.use(
    session({
      name: "sb_admin_session",
      secret: getSessionSecret(),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000
      }
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  app.get(
    "/auth/google",
    passport.authenticate("google", {
      scope: ["profile", "email"],
      session: true
    })
  );

  app.get(
    "/auth/google/callback",
    passport.authenticate("google", {
      failureRedirect: "/admin?error=access_denied",
      session: true
    }),
    (req, res) => {
      if (req.user?.email) {
        logAdminSignIn({
          email: req.user.email,
          name: req.user.name,
          ip: getClientIp(req)
        });
      }
      res.redirect("/admin");
    }
  );

  app.post("/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) {
        next(err);
        return;
      }
      req.session.destroy(() => {
        res.clearCookie("sb_admin_session");
        res.json({ ok: true });
      });
    });
  });

  app.get("/api/admin/session", (req, res) => {
    if (!req.isAuthenticated()) {
      res.json({ auth_enabled: true, authenticated: false });
      return;
    }
    res.json({
      auth_enabled: true,
      authenticated: true,
      email: req.user.email,
      name: req.user.name
    });
  });

  app.get("/api/admin/sign-ins", requireAdmin, (req, res) => {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    res.json({
      ok: true,
      count: limit,
      sign_ins: listAdminSignIns({ limit })
    });
  });

  console.log("Admin Google auth enabled.");
  console.log(`Allowed domains: ${getAllowedDomains().join(", ")}`);
  if (getAllowedEmails().length > 0) {
    console.log(`Allowed emails: ${getAllowedEmails().join(", ")}`);
  }
  console.log(`Google callback URL: ${getGoogleCallbackUrl()}`);
  if (process.env.APP_URL) {
    console.log(`Public app URL: ${process.env.APP_URL.replace(/\/$/, "")}`);
  }

  return {
    requireAdmin,
    adminPageHandler
  };
}

module.exports = {
  registerAdminAuth,
  isAdminAuthEnabled,
  isEmailAllowed,
  getAllowedDomains,
  getAllowedEmails
};
