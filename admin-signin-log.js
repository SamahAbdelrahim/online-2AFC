const fs = require("fs");
const path = require("path");

const LOG_DIR = path.join(__dirname, "logs");
const LOG_FILE = path.join(LOG_DIR, "admin_signins.jsonl");

function formatPstTimestamp(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  const tz =
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      timeZoneName: "short"
    })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value || "PT";

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}.${ms} ${tz}`;
}

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function logAdminSignIn({ email, name = "", ip = "" }) {
  const entry = {
    email: String(email || "").toLowerCase(),
    name: String(name || ""),
    ip: String(ip || ""),
    timestamp_pst: formatPstTimestamp(),
    timestamp_utc: new Date().toISOString()
  };

  ensureLogDir();
  fs.appendFileSync(LOG_FILE, `${JSON.stringify(entry)}\n`, "utf8");
  console.log(`[admin-signin] ${entry.timestamp_pst} ${entry.email}${entry.ip ? ` (${entry.ip})` : ""}`);

  return entry;
}

function listAdminSignIns({ limit = 100 } = {}) {
  if (!fs.existsSync(LOG_FILE)) {
    return [];
  }

  const lines = fs
    .readFileSync(LOG_FILE, "utf8")
    .split(/\r?\n/)
    .filter(Boolean);

  const max = Math.max(1, Number(limit) || 100);
  return lines
    .slice(-max)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .reverse();
}

module.exports = {
  formatPstTimestamp,
  logAdminSignIn,
  listAdminSignIns,
  LOG_FILE
};
