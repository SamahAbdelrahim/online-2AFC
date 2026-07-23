# Plan 001: Motion tokens and button easing

**Status:** DONE  
**Commit:** no-git  
**Severity:** HIGH  
**Category:** Cohesion & tokens / Easing

## Problem

Buttons use generic `ease` at `0.14s` with no shared motion tokens. Hover feels slightly mushy for a crisp research UI.

## Target

- `--motion-ease-out: cubic-bezier(0.16, 1, 0.3, 1)`
- `--motion-duration-fast: 150ms`
- Button `background-color` transitions use tokens only.
