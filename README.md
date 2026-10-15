# WAAAA

## About
**WAAAA (Wins Above Triple-A)** is a fun little baseball metric and visualizer I made to compare an MLB team's 162-game win pace against their Triple-A affiliate's 162-game pace. 

For example, if an MLB team is on pace for 95 wins and its AAA affiliate is on pace for 70, its WAAAA is **+25**. 

A high number might reflect a strong MLB roster, a rebuilding minor-league team, or combination of factors. A low number doesn't necessarily mean an organization is doing anything particularly well, either. 

It's a descriptive stat, not a measure of any significant team competence. Don't take it too seriously. :3

Everything is written in vanilla JavaScript and renders a custom SVG scatter plot with zero external dependencies, so it's super fast and easy to tinker with. 

## How it works
Data is pulled from the public MLB Stats API (`statsapi.mlb.com`), matching big league clubs (`sportId=1`) with their Triple-A affiliates (`sportId=11`) via `parentOrgId` from 2005 onwards (skipping the shortened 2020 season).

Past seasons (2005–2026) are pre-cached in `history.json` so historical records load instantly without spamming the API, while new seasons are fetched dynamically.

## [Check it out!](https://trnjak.github.io/waaaa/)



