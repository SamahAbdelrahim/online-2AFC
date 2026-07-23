# Plan 004: Choice unlock transition

**Status:** DONE  
**Commit:** no-git  
**Severity:** MEDIUM  
**Category:** Purpose & frequency

## Problem

Choice buttons jump from disabled (opacity 0.35) to enabled with no transition when both models are explored.

## Target

150ms ease-out opacity transition on `.sb-choice-btn`; subtitle crossfade via opacity class swap.
