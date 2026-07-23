# Shape Bias 3D Comparison Study

Developing an online A 2AFC (two-alternative forced-choice) task to use with adults and children.

An experiment where participants compare pairs of 3D objects and choose which looks more complex (or easier to draw, depending on study type).

## Quick start (local preview)

```bash
npm install
npm run preview
```

Open **http://localhost:3041**

## Study URLs

| URL | Who it's for |
|-----|----------------|
| `/` | Adults — complexity comparison |
| `/online` | Parents helping children online — "easier to draw" |
| `/inperson` | Children in person — "easier to draw" |
| `/admin` | Configure models, pairs, and custom links |
| `/abc1234` | Private custom link (random slug from admin) |

Debug without Prolific:

```
http://localhost:3041/?PROLIFIC_PID=debug&STUDY_ID=debug&SESSION_ID=debug
```

## Admin page (`/admin`)

Use the admin page to configure trials without editing JSON by hand or going into the repository.

**Save Configuration** updates the main study links (`/`, `/online`, `/inperson`).

**Custom Study Links** creates a private URL with its own model pairs and settings. Custom links do not change the main site. Each link gets a random slug like `/agn5xnx`.

**Preview Trials** validates your settings and shows the trial list without saving.

### Sign in (production)

`/admin` is protected with **Sign in with Google** when these env vars are set:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SESSION_SECRET`

By default, any `@stanford.edu` Google account can access admin. To allow specific people later, set `ADMIN_ALLOWED_EMAILS`. To allow extra domains, set `ADMIN_ALLOWED_DOMAINS`.

Local preview skips auth unless Google credentials are configured. To force auth off locally, set `ADMIN_AUTH_DISABLED=true`.

Copy `.env.example` to `.env` and fill in your Google OAuth credentials. In Google Cloud Console, add this redirect URI:

```
http://localhost:3041/auth/google/callback
```

For production, also add your deployed URL, e.g. `https://your-domain.com/auth/google/callback`, and set `APP_URL` or `GOOGLE_CALLBACK_URL`.

## 3D model files

Place models in these folders at the project root:

| Folder | Formats |
|--------|---------|
| `models/` | `.stl`, `.glb`, `.gltf`, `.obj`, `.fbx`, `.dae`, `.ply`, `.3mf` |
| `glb/` | `.glb`, `.gltf` |
| `stl/` | `.stl` |

FBX textures go in `models/textures/`.

## Configuring comparisons

### Option 1: Admin UI

Open `/admin`, set pairing mode, pick models, and click **Save Configuration**.

### Option 2: Edit JSON directly

Edit `configs/comparison_survey.json`. Restart the server after changes if it is already running.

**Fixed pairs** — each row is one trial:

```json
{
  "pair_mode": "fixed",
  "shuffle_trials": true,
  "fixed_pairs": [
    { "left": "car2.glb", "right": "datsun240k.fbx" }
  ],
  "model_sources": ["models"]
}
```

**Random pairs** — sample from a model pool:

```json
{
  "pair_mode": "random",
  "trial_count": 15,
  "shuffle_trials": true,
  "allow_repeat_pairs": false,
  "model_sources": ["models", "glb", "stl"],
  "prompt": "Which object looks more complex?"
}
```

See `configs/README.md` for full config reference.

## Production run (with MongoDB logging)

See **[DEPLOY.md](DEPLOY.md)** for the full go-live checklist.

```bash
npm install
npm start
```

Set `APP_URL`, `PROLIFIC_COMPLETION_CODE`, Google OAuth vars, and `MONGO_URI` in `.env`. The experiment pulls the completion code from the server automatically — no code changes needed when you get a custom URL.

Runs on **http://localhost:3041** by default (or whatever `PORT` you set).

### MongoDB setup

Connection priority:

1. `MONGO_URI` environment variable, or
2. `mongo_auth.json` in the project root with `username` and `password`

Optional env vars: `MONGO_DB`, `MONGO_HOST`, `MONGO_PORT`, `PORT`, `PROLIFIC_COMPLETION_CODE`

## How a trial works

1. Two 3D objects appear side by side (Object A / Object B)
2. Participant drags each object to explore it
3. Choice buttons unlock after both objects have been dragged (or after a short fallback delay)
4. Participant makes their choice
5. Response is logged to MongoDB (or console in preview mode)

## Project layout

```
public/
  index.html          # Experiment page
  experiment.js       # jsPsych timeline and trial logic
  experiment.css      # Shared styling
  model-viewer.js     # Three.js model renderer
  study-variants.js   # Copy for each study type
  admin.html/js/css   # Admin configuration UI
comparison-survey.js  # Trial generation from config
custom-studies.js     # Custom link management
study-server-routes.js
server.js             # Production server (MongoDB)
server.local-preview.js
configs/
  comparison_survey.json   # Global study config
  custom_studies.json      # Private custom link configs
models/               # 3D model files
stl/                  # STL files
glb/                  # GLB files
```

## URL parameters

Standard Prolific params: `PROLIFIC_PID`, `STUDY_ID`, `SESSION_ID`

## Related docs

| Topic | File |
|-------|------|
| **About this project** | `ABOUT.md` |
| **Going live / custom URL** | `DEPLOY.md` |
| Config reference | `configs/README.md` |
| Human protocol rationale | `HUMAN_PROTOCOL_RATIONALE.md` |
