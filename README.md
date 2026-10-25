# Return of the Runners

An unofficial browser fan remake of _Lode Runner: The Legend Returns_ (Presage/Sierra,
1994): dig, grab the gold, dodge the monks, and build your own levels with the built-in
editor. 1–2 players on one keyboard.

**Play:** https://guillaumedd.github.io/return-of-the-runners/

> Status: early development: the runner can move around a first level. See the [roadmap](docs/PRD.md#7-roadmap).

## Development

Requires Node.js 22 (see `.nvmrc`).

```sh
npm ci            # install exact locked dependencies
npm run dev       # local dev server
npm run typecheck && npm run lint && npm test   # must pass before each commit
npm run build     # production build in dist/
npm run e2e       # replays in real browsers (first: npx playwright install chromium firefox webkit)
```

## Documents

- [Product requirements](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Backlog](docs/BACKLOG.md)
- [Asset provenance](ASSETS.md)
- [Contributor and agent rules](CLAUDE.md)

## License

- Code: [GPL-3.0-or-later](LICENSE).
- Project assets and levels: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

This is a non-commercial fan project, not affiliated with or endorsed by the owners
of _Lode Runner_. No original game assets or data are included.
