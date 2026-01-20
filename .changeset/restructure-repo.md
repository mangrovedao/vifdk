---
"vifdk": minor
---

Restructure repository from monorepo to single-package

- Remove multi-package structure, publish core SDK from root
- Co-locate tests next to source files
- Switch from bunup to tsc for builds (ESM, CJS, types outputs)
- Migrate from bun:test to vitest with parallel test execution
- Replace bumpp with changesets for version management
- Add vitest fixtures for isolated test execution per test
