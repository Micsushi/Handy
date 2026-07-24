# Custom Vocabulary False-Positive Guard Implementation Plan

> REQUIRED SUB-SKILL: Use superpowers:executing-plans.

**Goal:** Prevent ordinary speech from being rewritten into rare short technology terms while preserving high-value custom corrections.

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
