# About

Developing an online A 2AFC (two-alternative forced-choice) task to use with adults and children.

This project is a Prolific-ready web experiment built for the Stanford Department of Psychology. Participants view pairs of 3D objects side by side and choose between two alternatives on each trial.

## Study variants

| Variant | Audience | Task |
|---------|----------|------|
| `/` | Adults | Which object looks more complex? |
| `/online` | Parents with children (online) | Which object is easier to draw? |
| `/inperson` | Children (in person) | Which object is easier to draw? |

Researchers configure model pairs, trial order, and study settings from `/admin`.

## Tech stack

- **Frontend:** jsPsych, Three.js
- **Backend:** Node.js, Express
- **Data:** MongoDB (production) or console logging (local preview)

See [README.md](README.md) for setup and [DEPLOY.md](DEPLOY.md) for going live.
