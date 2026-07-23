# Plan 003: Trial enter and loading fade

**Status:** DONE  
**Commit:** no-git  
**Severity:** MEDIUM  
**Category:** Missed opportunities / Physicality

## Problem

Trial screens and 3D viewers pop in instantly after load. Jarring on a flow that otherwise feels deliberate.

## Target

- Trial view: fade + 8px rise, 220ms ease-out
- Model canvas: fade in when ready (no scale from 0)
- Loading status: opacity transition
