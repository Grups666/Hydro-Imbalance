# Literature Alignment Audit

Date: 2026-05-24

## Purpose

The OpenAlex harvest expands coverage, but broad searches can pull in papers that only weakly match the assigned hydrological mode. This audit checks local metadata against mode-specific keywords and records an alignment status for every catalog entry.

## Current Result

Total literature records: 2,851

Alignment summary:

| Mode | High | Medium | Low | Total |
|---|---:|---:|---:|---:|
| dryIrrigation | 709 | 42 | 0 | 751 |
| reservoir | 423 | 75 | 6 | 504 |
| monsoon | 320 | 0 | 0 | 320 |
| tropical | 209 | 1 | 0 | 210 |
| boreal | 189 | 0 | 0 | 189 |
| humid | 184 | 0 | 0 | 184 |
| dryNatural | 201 | 21 | 0 | 222 |
| snow | 141 | 13 | 0 | 154 |
| mountain | 116 | 0 | 0 | 116 |
| lowHumanImpact | 27 | 63 | 0 | 90 |
| mixed | 70 | 25 | 9 | 104 |
| managed | 2 | 4 | 1 | 7 |

Low-alignment records: 16.

## Frontend Behavior

- Curated basin/mode references are still shown.
- Harvested OpenAlex records are shown by mode only when `alignment_status` is not `low`.
- Reference details show `Mode alignment` and score so questionable records are visible rather than hidden silently.

## Caveat

This is a keyword audit, not a human systematic review. It catches obvious mismatches but cannot fully replace manual screening. The next step should add stronger filters using OpenAlex concepts, journal/source domains, and basin-region text matching.
