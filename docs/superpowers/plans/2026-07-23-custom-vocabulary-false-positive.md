# Custom Vocabulary False-Positive Guard Implementation Plan

> REQUIRED SUB-SKILL: Use superpowers:executing-plans.

**Goal:** Prevent ordinary speech from being rewritten into unused technology terms while preserving high-value custom corrections.

**Architecture:** Add candidate-shape gates before Soundex scoring in the Rust fallback matcher. Centralize blocked vocabulary terms in the Bun synchronization script so every vocabulary source is filtered consistently, then prune the active settings through the existing backup-producing workflow.

**Tech Stack:** Rust, Bun/TypeScript, Node test runner, Tauri settings store.

## Task 1: Matcher regression tests

**Files:** Modify `src-tauri/src/audio_toolkit/text.rs`.

- [ ] Add tests asserting `is`, `on`, and `sent us` are not rewritten by `iOS`, `ONNX`, and `CentOS`.
- [ ] Add tests asserting exact `ios` still formats as `iOS` and `codecs` still corrects to `Codex`.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml audio_toolkit::text::tests::test_custom_word_false_positive_guards -- --exact` and confirm the false-positive assertions fail before production changes.
- [ ] Pass candidate word count into `find_best_match`; reject non-exact fuzzy matches for keys shorter than five characters and multi-word fuzzy matches for keys shorter than seven.
- [ ] Rerun the focused Rust tests and confirm they pass.

## Task 2: Vocabulary pruning tests

**Files:** Modify `scripts/sync-handy-vocabulary.test.ts`, `scripts/sync-handy-vocabulary.ts`, and `scripts/handy-vocabulary.json`.

- [ ] Add a Bun test asserting `mergeVocabulary(["iOS", "ONNX", "CentOS", "Codex"])` returns only `Codex`.
- [ ] Run `bun test scripts/sync-handy-vocabulary.test.ts` and confirm the new assertion fails.
- [ ] Add a normalized blocked-term set and apply it in `validTerm`.
- [ ] Remove the three terms from `scripts/handy-vocabulary.json`.
- [ ] Rerun the vocabulary test and confirm it passes.

## Task 3: Full verification and active profile

**Files:** Modify active `%APPDATA%\com.pais.handy\settings_store.json` through the vocabulary script.

- [ ] Run the complete Rust text tests and Bun vocabulary tests.
- [ ] Run frontend lint, TypeScript/Vite build, scoped Prettier, Cargo formatting, and `git diff --check`.
- [ ] Run the vocabulary sync with `--apply`; confirm it creates a backup and removes the blocked terms.
- [ ] Build Handy with `bun run tauri build --debug --no-bundle`.
- [ ] Restart Handy and AudioFixer.
- [ ] Confirm the live Handy process uses the rebuilt executable and the loaded-settings log excludes `iOS`, `ONNX`, and `CentOS`.

## Task 4: Prune the generated technology glossary

**Files:** Modify `scripts/sync-handy-vocabulary.test.ts`,
`scripts/sync-handy-vocabulary.ts`, and `scripts/handy-vocabulary.json`.

- [x] Extend the blocked-term test with `GraphQL` and `WebView`, and add a
      curated-list size regression test that fails while the broad glossary
      remains.
- [x] Run `node --test scripts/sync-handy-vocabulary.test.ts` and confirm the
      new assertions fail for the intended reasons.
- [x] Add an explicit `--prune` option that builds the result from curated and
      discovered terms instead of retaining obsolete existing generated terms.
- [x] Replace the broad glossary with a focused list of recurring personal
      products, projects, tools, and safe common acronyms.
- [x] Rerun the script tests and confirm they pass.

## Task 5: Apply and verify the focused active vocabulary

**Files:** Modify active
`%APPDATA%\com.pais.handy\settings_store.json` through the vocabulary script.

- [x] Run the script test, frontend formatting check, and `git diff --check`.
- [x] Preview `--prune --json`; confirm `GraphQL` and `WebView` are absent and
      the active count drops substantially.
- [x] Run `--prune --apply`; confirm a backup is created.
- [x] Restart the existing Handy debug executable with `--start-hidden`.
- [x] Confirm the live process path and active settings exclude all five
      blocked terms.
