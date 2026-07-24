import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  discoverProjectTerms,
  loadCuratedTerms,
  mergeVocabulary,
  writeVocabularySettings,
} from "./sync-handy-vocabulary";

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

test("removes blocked false-positive terms from every vocabulary source", () => {
  const merged = mergeVocabulary(
    ["iOS", "Existing"],
    ["ONNX", "Codex"],
    ["CentOS", "BugMe"],
  );

  assert.deepEqual(merged, ["Existing", "Codex", "BugMe"]);
});

test("curated vocabulary contains core dictation terms", async () => {
  const terms = await loadCuratedTerms();

  for (const expected of [
    "Codex",
    "Claude",
    "Claude Code",
    "Linux",
    "Ubuntu",
    "GitHub",
    "Kubernetes",
    "Workday",
    "OpenSpec",
    "OpenClaw",
    "Fletcher",
    "bugz",
    "hunterctl",
  ]) {
    assert.equal(terms.includes(expected), true, expected);
  }
  assert.equal(terms.includes("codecs"), false);
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
