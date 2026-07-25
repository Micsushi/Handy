import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildVocabulary,
  discoverProjectTerms,
  loadCuratedTerms,
  mergeVocabulary,
  writeVocabularySettings,
} from "./sync-handy-vocabulary.ts";

test("discovers repo and vault project names but skips generic folders", async () => {
  const root = await mkdtemp(join(tmpdir(), "handy-vocabulary-"));
  const reposRoot = join(root, "repos");
  const vaultProjectsRoot = join(root, "vault", "Wiki", "Projects");

  for (const name of [
    "BugMe",
    "onWatch",
    "flapstack",
    "src",
    "temp",
    ".git",
    "cl",
    "pul",
    "up",
    "tmp",
    "Hunt",
    "hunt-worktrees",
    "merge-worktrees",
    "noise-suppression-for-voice",
    "server_ansible_setup",
    "ansible_homelab",
    "career-ops",
    "VibeKanbanFork",
    "start-with-making-the-vault-with-2",
  ]) {
    await mkdir(join(reposRoot, name), { recursive: true });
  }
  for (const name of ["Career Ops", "PoEProject", "projects_index.md"]) {
    const path = join(vaultProjectsRoot, name);
    if (name.endsWith(".md")) {
      await mkdir(vaultProjectsRoot, { recursive: true });
      await writeFile(path, "# Projects\n");
    } else {
      await mkdir(path, { recursive: true });
    }
  }

  const terms = await discoverProjectTerms({ reposRoot, vaultProjectsRoot });

  assert.deepEqual(
    terms.filter((term) =>
      ["BugMe", "onWatch", "flapstack", "Career Ops", "PoEProject"].includes(
        term,
      ),
    ),
    ["BugMe", "Career Ops", "flapstack", "onWatch", "PoEProject"],
  );
  assert.equal(terms.includes("src"), false);
  assert.equal(terms.includes("temp"), false);
  assert.equal(terms.includes(".git"), false);
  assert.equal(terms.includes("cl"), false);
  assert.equal(terms.includes("pul"), false);
  assert.equal(terms.includes("up"), false);
  assert.equal(terms.includes("tmp"), false);
  assert.equal(terms.includes("Hunt"), false);
  assert.equal(terms.includes("hunt-worktrees"), false);
  assert.equal(terms.includes("merge-worktrees"), false);
  assert.equal(terms.includes("noise-suppression-for-voice"), false);
  assert.equal(terms.includes("server_ansible_setup"), false);
  assert.equal(terms.includes("ansible_homelab"), false);
  assert.equal(terms.includes("career-ops"), false);
  assert.equal(terms.includes("VibeKanbanFork"), false);
  assert.equal(terms.includes("start-with-making-the-vault-with-2"), false);
});

test("merges terms without deleting existing words or duplicating casing", () => {
  const merged = mergeVocabulary(
    ["PersonalName", "Linux"],
    ["linux", "Codex", "Claude Code"],
    ["BugMe", "onWatch"],
  );

  assert.deepEqual(merged, [
    "PersonalName",
    "Linux",
    "Codex",
    "Claude Code",
    "BugMe",
    "onWatch",
  ]);
});

test("prune mode drops obsolete existing terms", () => {
  const existing = ["OldGeneratedTerm", "GraphQL"];
  const curated = ["Codex"];
  const discovered = ["BugMe"];

  assert.deepEqual(buildVocabulary(existing, curated, discovered, false), [
    "OldGeneratedTerm",
    "Codex",
    "BugMe",
  ]);
  assert.deepEqual(buildVocabulary(existing, curated, discovered, true), [
    "Codex",
    "BugMe",
  ]);
});

test("removes blocked false-positive terms from every vocabulary source", () => {
  const merged = mergeVocabulary(
    ["iOS", "GraphQL", "Workday", "Existing"],
    ["ONNX", "WebView", "Anthropic", "Codex"],
    ["CentOS", "BugMe"],
  );

  assert.deepEqual(merged, ["Existing", "Codex", "BugMe"]);
});

test("curated vocabulary contains core dictation terms", async () => {
  const terms = await loadCuratedTerms();

  assert.ok(
    terms.length <= 100,
    `curated vocabulary has ${terms.length} terms; expected at most 100`,
  );
  for (const expected of [
    "Codex",
    "Claude",
    "Claude Code",
    "Linux",
    "Ubuntu",
    "GitHub",
    "Kubernetes",
    "OpenSpec",
    "OpenClaw",
    "Fletcher",
    "bugz",
    "hunterctl",
  ]) {
    assert.equal(terms.includes(expected), true, expected);
  }
  assert.equal(terms.includes("codecs"), false);
  assert.equal(terms.includes("GraphQL"), false);
  assert.equal(terms.includes("WebView"), false);
  assert.equal(terms.includes("Anthropic"), false);
  assert.equal(terms.includes("Workday"), false);
  assert.equal(terms.includes("frontend"), false);
  assert.equal(terms.includes("backend"), false);
  assert.equal(terms.includes("codebase"), false);
});

test("applies vocabulary while preserving settings and creates a backup", async () => {
  const root = await mkdtemp(join(tmpdir(), "handy-settings-"));
  const settingsPath = join(root, "settings_store.json");
  const original = {
    settings: {
      custom_words: ["Existing"],
      selected_model: "parakeet",
      bindings: { transcribe: { current_binding: "f13" } },
    },
  };
  await writeFile(settingsPath, `${JSON.stringify(original, null, 2)}\n`);

  const result = await writeVocabularySettings(settingsPath, [
    "Existing",
    "Codex",
    "BugMe",
  ]);

  const updated = JSON.parse(await readFile(settingsPath, "utf8"));
  const backup = JSON.parse(await readFile(result.backupPath, "utf8"));

  assert.deepEqual(updated.settings.custom_words, [
    "Existing",
    "Codex",
    "BugMe",
  ]);
  assert.equal(updated.settings.selected_model, "parakeet");
  assert.equal(updated.settings.bindings.transcribe.current_binding, "f13");
  assert.deepEqual(backup, original);
});
