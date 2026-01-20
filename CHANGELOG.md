# vifdk

## 0.1.0

### Minor Changes

- [#6](https://github.com/mangrovedao/vifdk/pull/6) [`0f35a39`](https://github.com/mangrovedao/vifdk/commit/0f35a39fb0a73186d81b128256dbcc058a347c34) Thanks [@maxencerb](https://github.com/maxencerb)! - Restructure repository from monorepo to single-package

  - Remove multi-package structure, publish core SDK from root
  - Co-locate tests next to source files
  - Switch from bunup to tsc for builds (ESM, CJS, types outputs)
  - Migrate from bun:test to vitest with parallel test execution
  - Replace bumpp with changesets for version management
  - Add vitest fixtures for isolated test execution per test
