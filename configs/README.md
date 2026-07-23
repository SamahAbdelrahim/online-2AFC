# Configuration

## Global config (`comparison_survey.json`)

Controls the main study links: `/`, `/online`, and `/inperson`.

Edit via `/admin` → **Save Configuration**, or edit this file directly.

| Field | What it does |
|-------|----------------|
| `pair_mode` | `"fixed"` or `"random"` |
| `fixed_pairs` | List of `{ "left": "file.glb", "right": "other.fbx" }` trials |
| `trial_count` | Number of trials in random mode |
| `shuffle_trials` | Randomize trial order per participant |
| `allow_repeat_pairs` | Allow the same pair twice in random mode |
| `model_sources` | Folders to scan: `models`, `glb`, `stl` |
| `model_pool` | Optional subset of files for random mode |
| `prompt` | Question shown on the complexity study |

Pair order is deterministic per participant (seeded from Prolific IDs). Left/right placement is counterbalanced each trial.

## Custom study links (`custom_studies.json`)

Managed via `/admin` → **Custom Study Links**. Do not edit by hand unless you know what you are doing.

Each entry has:

- `slug` — private URL path (e.g. `/agn5xnx`)
- `label` — name shown in admin
- `study_variant` — `complexity`, `online`, or `inperson`
- `comparison` — same fields as the global config
- `copy_overrides` — optional text overrides for trial title, subtitle, and button labels
- `active` — set to `false` to deactivate a link

Custom links are independent of the global config. Changing **Save Configuration** does not affect existing custom links.

## Admin authentication

When `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set, `/admin` and all admin APIs require Google sign-in.

| Variable | Purpose |
|----------|---------|
| `ADMIN_ALLOWED_DOMAINS` | Email domains allowed (default: `stanford.edu`) |
| `ADMIN_ALLOWED_EMAILS` | Optional explicit email allowlist |
| `ADMIN_AUTH_DISABLED` | Set to `true` to skip auth even if Google creds exist |
| `SESSION_SECRET` | Signs admin session cookies (required when auth is on) |
| `GOOGLE_CALLBACK_URL` | OAuth redirect URI (defaults to `APP_URL/auth/google/callback`) |

### Rate limiting

Participant routes are rate limited to reduce spam:

| Route | Limit | Key |
|-------|-------|-----|
| Study pages (`/`, `/online`, etc.) | 80 / 15 min | IP |
| `GET /api/comparison-trials` | 20 / 15 min | Prolific session, else IP |
| `POST /api/log` | 120 / hour | Prolific session, else IP |

`/admin` is not rate limited. Set `RATE_LIMIT_DISABLED=true` to turn limits off locally.

Optional tuning: `RATE_LIMIT_STUDY_PAGES_MAX`, `RATE_LIMIT_TRIALS_MAX`, `RATE_LIMIT_LOG_MAX`

### Sign-in log

Every successful admin Google sign-in is logged to:

- **Terminal:** `[admin-signin] 2026-07-21 13:06:45.123 PDT user@stanford.edu`
- **File:** `logs/admin_signins.jsonl` (one JSON entry per line, PST timestamp included)

To view recent sign-ins while signed in:

```
GET /api/admin/sign-ins?limit=50
```

Or read the file directly:

```bash
cat logs/admin_signins.jsonl
```
