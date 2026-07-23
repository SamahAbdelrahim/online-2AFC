# Going Live

When you deploy to a real URL, you only need to set a few environment variables. Everything else (study config, custom links, models) carries over from your local setup.

## 1. Copy your env file

```bash
cp .env.example .env
```

Fill in the **production** section below. Do not commit `.env` to git.

## 2. Set these env vars on your server

```bash
# Your public site URL (no trailing slash)
APP_URL=https://your-domain.com

# Prolific completion code from your Prolific study settings
PROLIFIC_COMPLETION_CODE=YOUR_PROLIFIC_CODE

# Production mode (enables secure cookies)
NODE_ENV=production

# Google admin sign-in
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://your-domain.com/auth/google/callback
SESSION_SECRET=long-random-string

# Who can access /admin
ADMIN_ALLOWED_DOMAINS=stanford.edu

# MongoDB (required for production — saves participant data)
MONGO_URI=mongodb://...
```

That's it for code changes. The experiment reads `PROLIFIC_COMPLETION_CODE` from the server automatically.

## 3. Google Cloud Console

Under **OAuth redirect URIs**, add:

```
https://your-domain.com/auth/google/callback
```

Keep `http://localhost:3041/auth/google/callback` if you still test locally.

## 4. Start the production server

```bash
npm install
npm start
```

Use `npm start` (not `npm run preview`). Preview skips MongoDB.

## 5. Prolific study URLs

Paste these into Prolific (replace `your-domain.com`):

**Complexity study**
```
https://your-domain.com/?PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}
```

**Parent online**
```
https://your-domain.com/online?PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}
```

**Children in person**
```
https://your-domain.com/inperson?PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}
```

**Custom link** (from `/admin`)
```
https://your-domain.com/YOUR_SLUG?PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}
```

## 6. Configure studies

Open `https://your-domain.com/admin`, sign in with Google, and set up your model pairs there. Same UI as local.

## Checklist

- [ ] `APP_URL` set to your live domain
- [ ] `PROLIFIC_COMPLETION_CODE` set to your real Prolific code
- [ ] `GOOGLE_CALLBACK_URL` matches Google Cloud Console
- [ ] `MONGO_URI` configured
- [ ] `NODE_ENV=production`
- [ ] HTTPS enabled on your host
- [ ] `npm start` running (not preview)
- [ ] Test one full participant run on Prolific sandbox first

## Verify

Visit `https://your-domain.com/api/config` — you should see your `completion_code` and `app_url`.
