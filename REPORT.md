# Word-click TTS fix — books 21–40

## Root cause

Read-mode taps load `assets/books/<book_id>/audio/words/<lemma>.mp3` via `playWord(lemma)` (`index.html`). For band 21–40, most clips were **not isolated word TTS**. They were **mis-labeled podcast fragments**: the filename matched the on-page lemma, but the bytes were a **wrong slice** from the Friendly Podcast Host page narration (Fish/Eleven voice `57785406027844b29b63a772a8477bc2`), or a homophone/wrong word from batch slicing.

This is the same failure class as books **41–60** (merged in `mrj-decodable-try-41`): wrong content under the correct lemma path — not primarily missing plurals or silent 404s.

### Proof: `squid` (book 21, Squids)

| Check | Before fix | After fix |
|-------|------------|-----------|
| Path | `assets/books/mlr_dec_021/audio/words/squid.mp3` | same |
| Size | 11,283 B | ~22 KB (isolated TTS) |
| Duration | ~0.71 s | ~0.7 s |
| MD5 | `00d36468d71290aec1fccfbdbe672354` | `080835e527031c53e9a9c9297161ae46` (matches fixed canon from band 41–60) |
| Whisper (tiny) | **"Gwed."** / homophone (**not** /skwɪd/) | **"Squid."** |
| HTTP | 200 (file existed; content wrong) | 200 |

See `tools/squid-proof.json` for the pre-fix snapshot.

## Fix

1. **`playWord`**: `encodeURIComponent(lem)` in the mp3 path (possessives like `baby's`).
2. **Regenerated 398 lemmas** for band 21–40 with isolated word TTS:
   - Voice target: Clear American Male `851d4a3a36814f8faef50db1884e1ef6` via ElevenLabs when `XI_API_KEY` / `ELEVENLABS_API_KEY` is set.
   - **This run**: no API key in CI/agent env → **edge-tts** (`en-US-AndrewNeural`) + ffmpeg → 44.1 kHz mono 192 kbps (same pipeline as books 41–60 fallback).
3. Copied cache into every book that uses each lemma (**732** file copies across 20 books).
4. Published **`assets/word_tts_canon_b21-40.json`** (398 lemma MD5s).
5. Audit: `node scripts/audit-word-tts-21-40.mjs --md docs/WORD_TTS_AUDIT_21-40.md`
6. CI: `node test/word-tts-21-40.test.js`

### Regen tooling

```bash
python3 tools/build-word-tts-regen-list-21-40.py
python3 tools/regen-word-tts.py
python3 tools/apply-word-tts-cache-21-40.py
node scripts/audit-word-tts-21-40.mjs --md docs/WORD_TTS_AUDIT_21-40.md
```

## Audit summary (books 21–40)

| Metric | Count |
|--------|------:|
| Unique on-page lemmas | 398 |
| Lemmas with MD5 ≠ post-fix b41–60 canon (shared vocabulary) | 174 |
| Missing mp3 before fix | 1 (`their` on p08) |
| Clips regenerated | 398 |
| Books | 20 (mlr_dec_021 … mlr_dec_040) |
| Post-fix audit status | all **ok** (no missing, no dup hashes, canon match) |

Full per-book table: `docs/WORD_TTS_AUDIT_21-40.md`.

## Live verification (after merge to `gh-pages`)

1. Open https://mrjkorea.github.io/mrj-decodable-try-21/
2. Squids → Read → tap **squid** on any page → hear **squid** (/skwɪd/), not quit/homophone.
3. Book 21 p08 → tap **Their** → `their.mp3` plays (no silent 404).
4. Spot-check network: `…/audio/words/squid.mp3` → 200, MD5 `080835e5…`.

## Remaining suspects

None in band 21–40 after regen. Re-run audit after any manual mp3 edits. For production voice parity with band 41–60, re-run `tools/regen-word-tts.py` with `XI_API_KEY` set and re-apply cache (optional quality pass).
