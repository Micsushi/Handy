# Custom Vocabulary False-Positive Guard Design

## Problem

Handy's fuzzy custom-word correction treats every configured term as equally eligible. Soundex can reduce a poor edit-distance match enough that common speech is rewritten into rare technical terms:

- `is` becomes `iOS`
- `on` becomes `ONNX`
- `sent us` becomes `CentOS`

The active vocabulary contains 294 terms, including broad technology names the user does not say. Removing only the three observed terms would leave the same failure mode available to other short or rare entries.

## Approved behavior

Use two defenses:

1. Prune `iOS`, `ONNX`, and `CentOS` from the curated vocabulary and from the active settings.
2. Make fuzzy matching conservative by candidate shape:
   - Normalized custom-word keys shorter than five characters are exact-match only.
   - Multi-word candidates may fuzzy-match only normalized keys of seven or more characters.
   - Exact normalized matches remain allowed at every length.

This keeps useful behavior such as `codecs` to `Codex`, `Charge B` to `ChargeBee`, and `Chat G P T` to `ChatGPT`.

## Data flow

`apply_custom_words` already knows the candidate n-gram length and each normalized custom-word key. It will pass the candidate word count into `find_best_match`, which will reject unsafe fuzzy comparisons before Soundex scoring.

The vocabulary synchronization script will maintain a blocked-term set. Its normal validation path will filter blocked terms from curated, discovered, existing, and merged vocabulary sources, so a later sync cannot restore the removed terms.

## Verification

- Rust regression tests prove the three false-positive examples remain ordinary speech.
- Rust regression tests prove exact short terms and existing useful corrections still work.
- Bun tests prove blocked terms are removed even when supplied as existing settings.
- The active settings file is backed up before pruning.
- Handy is rebuilt, restarted, and its loaded-settings log confirms the blocked terms are absent.
