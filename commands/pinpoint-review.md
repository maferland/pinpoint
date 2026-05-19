---
description: Annotate one or more images and return structured feedback
allowed-tools: Bash(pinpoint:*)
---

## Pinpoint Annotations

!`pinpoint review $ARGUMENTS`

## Your task

Before fixing anything, call `TaskCreate` once with one task per annotation — use `#<number>: <comment>` as the title. Then work through them one at a time, marking each task `in_progress` when you start and `completed` when you finish.

Each entry has a comment and a region (pin or box, as percentages of the image). Treat comments as the source of truth — classify intent and severity yourself from the wording. Do not batch fixes across annotations without tracked tasks; past sessions skipped findings that way.
