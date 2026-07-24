import { copyFile, readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CURATED_TERMS_PATH = fileURLToPath(
  new URL("./handy-vocabulary.json", import.meta.url),
);

const IGNORED_PROJECT_NAMES = new Set([
  "build",
  "dist",
  "cl",
  "node_modules",
  "lo",
  "look-into-the-poe-overlay-ii",
  "projects",
  "pul",
  "src",
  "start-with-making-the-vault-with-2",
  "temp",
  "temporary",
  "test",
  "tests",
  "up",
  "vendor",
]);

const BLOCKED_FALSE_POSITIVE_TERMS = new Set([
  "centos",
  "graphql",
  "ios",
  "onnx",
  "webview",
]);

export interface ProjectRoots {
  reposRoot?: string;
  vaultProjectsRoot?: string;
}

interface VocabularyFile {
  sources: string[];
  terms: string[];
}

interface HandySettingsStore {
  settings: {
    custom_words?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

const normalizedKey = (term: string) => term.trim().toLocaleLowerCase("en-US");

const validTerm = (term: string) => {
  const trimmed = term.trim();
  return (
    trimmed.length > 1 &&
    trimmed.length <= 50 &&
    /[A-Za-z]/.test(trimmed) &&
    !trimmed.startsWith(".") &&
    !BLOCKED_FALSE_POSITIVE_TERMS.has(normalizedKey(trimmed)) &&
    !IGNORED_PROJECT_NAMES.has(normalizedKey(trimmed))
  );
};

async function directoryNames(root?: string) {
  if (!root) return [];

  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && validTerm(entry.name))
      .map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function discoverProjectTerms({
  reposRoot,
  vaultProjectsRoot,
}: ProjectRoots) {
  const terms = [
    ...(await directoryNames(reposRoot)),
    ...(await directoryNames(vaultProjectsRoot)),
  ];

  return [...new Map(terms.map((term) => [normalizedKey(term), term])).values()]
    .filter(validTerm)
    .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

export async function loadCuratedTerms() {
  const parsed = JSON.parse(
    await readFile(CURATED_TERMS_PATH, "utf8"),
  ) as VocabularyFile;

  if (!Array.isArray(parsed.terms)) {
    throw new Error(`${CURATED_TERMS_PATH} does not contain a terms array`);
  }

  return parsed.terms.filter(validTerm);
}

export function mergeVocabulary(...groups: string[][]) {
  const merged = new Map<string, string>();

  for (const term of groups.flat()) {
    const trimmed = term.trim();
    if (validTerm(trimmed) && !merged.has(normalizedKey(trimmed))) {
      merged.set(normalizedKey(trimmed), trimmed);
    }
  }

  return [...merged.values()];
}

export function buildVocabulary(
  existing: string[],
  curated: string[],
  discovered: string[],
  prune: boolean,
) {
  return prune
    ? mergeVocabulary(curated, discovered)
    : mergeVocabulary(existing, curated, discovered);
}

export async function loadSettingsWords(settingsPath: string) {
  const parsed = JSON.parse(
    await readFile(settingsPath, "utf8"),
  ) as HandySettingsStore;
  return Array.isArray(parsed.settings?.custom_words)
    ? parsed.settings.custom_words
    : [];
}

export async function writeVocabularySettings(
  settingsPath: string,
  words: string[],
) {
  const raw = await readFile(settingsPath, "utf8");
  const parsed = JSON.parse(raw) as HandySettingsStore;

  if (!parsed.settings || typeof parsed.settings !== "object") {
    throw new Error(`${settingsPath} does not contain a settings object`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(
    dirname(settingsPath),
    `${basename(settingsPath, ".json")}.vocabulary-backup-${stamp}.json`,
  );
  await copyFile(settingsPath, backupPath);

  parsed.settings.custom_words = words;
  await writeFile(settingsPath, `${JSON.stringify(parsed, null, 2)}\n`);

  return { backupPath };
}

interface CliOptions {
  apply: boolean;
  json: boolean;
  prune: boolean;
  reposRoot: string;
  settingsPath: string;
  vaultProjectsRoot: string;
}

function defaultOptions(): CliOptions {
  const userHome = homedir();
  const appData = process.env.APPDATA;

  return {
    apply: false,
    json: false,
    prune: false,
    reposRoot: join(userHome, "Documents", "Github"),
    settingsPath: appData
      ? join(appData, "com.pais.handy", "settings_store.json")
      : join(
          userHome,
          ".local",
          "share",
          "com.pais.handy",
          "settings_store.json",
        ),
    vaultProjectsRoot: join(
      userHome,
      "Documents",
      "agentsvault",
      "Wiki",
      "Projects",
    ),
  };
}

function parseArgs(args: string[]) {
  const options = defaultOptions();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === "--apply") options.apply = true;
    else if (arg === "--prune") options.prune = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--repos" && next) {
      options.reposRoot = next;
      index += 1;
    } else if (arg === "--vault-projects" && next) {
      options.vaultProjectsRoot = next;
      index += 1;
    } else if (arg === "--settings" && next) {
      options.settingsPath = next;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Sync project and tech terms into Handy Custom Words.

Usage:
  bun scripts/sync-handy-vocabulary.ts [options]

Options:
  --apply                  Back up and update Handy settings
  --prune                  Drop existing terms not in curated/project sources
  --repos <directory>      Root containing local Git repositories
  --vault-projects <dir>   agentsvault Wiki/Projects directory
  --settings <file>        Handy settings_store.json path
  --json                   Print the result as JSON
  --help                   Show this help

Without --apply, the command only previews changes.`);
      return null;
    } else {
      throw new Error(`Unknown or incomplete option: ${arg}`);
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options) return;

  const [existing, curated, discovered] = await Promise.all([
    loadSettingsWords(options.settingsPath),
    loadCuratedTerms(),
    discoverProjectTerms({
      reposRoot: options.reposRoot,
      vaultProjectsRoot: options.vaultProjectsRoot,
    }),
  ]);
  const merged = buildVocabulary(existing, curated, discovered, options.prune);
  const existingKeys = new Set(existing.map(normalizedKey));
  const added = merged.filter((term) => !existingKeys.has(normalizedKey(term)));

  const result: Record<string, unknown> = {
    applied: options.apply,
    pruned: options.prune,
    existing: existing.length,
    added: added.length,
    total: merged.length,
    discoveredProjects: discovered,
  };

  if (options.apply) {
    Object.assign(
      result,
      await writeVocabularySettings(options.settingsPath, merged),
    );
  }

  if (options.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(
      `${options.apply ? "Applied" : "Preview"}: ${added.length} new terms, ${merged.length} total.`,
    );
    console.log(`Project terms: ${discovered.join(", ")}`);
    if (result.backupPath) console.log(`Backup: ${result.backupPath}`);
  }
}

if (import.meta.main) {
  await main();
}
