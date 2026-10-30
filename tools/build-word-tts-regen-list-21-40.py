#!/usr/bin/env python3
"""List every on-page lemma in books 21-40 for word TTS regen + reasons snapshot."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BAND = range(21, 41)
CANON_B41 = Path("/tmp/word_tts_canon_b41-60.json")


def read_units(text: str) -> list[str]:
    return [m.group(0).lower() for m in re.finditer(r"[A-Za-z']+", text or "")]


def md5_file(p: Path) -> str:
    return hashlib.md5(p.read_bytes()).hexdigest()


def main():
    canon = {}
    if CANON_B41.is_file():
        canon = json.loads(CANON_B41.read_text()).get("lemmas", {})

    need: set[str] = set()
    for n in BAND:
        align = json.loads((ROOT / "assets" / f"align_mlr_dec_{n:03d}.json").read_text())
        for p in align.get("pages", []):
            need.update(read_units(p.get("text", "")))

    reasons: dict[str, list[str]] = {}
    for lem in sorted(need):
        fp = None
        for n in BAND:
            cand = ROOT / "assets" / "books" / f"mlr_dec_{n:03d}" / "audio" / "words" / f"{lem}.mp3"
            if cand.is_file():
                fp = cand
                break
        if not fp:
            reasons[lem] = ["missing"]
            continue
        rs = []
        if lem in canon and md5_file(fp) != canon[lem]:
            rs.append("canon_mismatch_b41-60")
        if lem not in canon:
            rs.append("no_canon_entry_band21-40_only")
        if not rs:
            rs.append("regen_band_refresh")
        reasons[lem] = rs

    regen = sorted(need)
    (ROOT / "tools" / "word-tts-regen-list-21-40.json").write_text(json.dumps(regen, indent=2) + "\n")
    (ROOT / "tools" / "word-tts-regen-reasons-21-40.json").write_text(
        json.dumps(reasons, indent=2) + "\n"
    )
    print("lemmas", len(regen))
    print("missing", sum(1 for v in reasons.values() if "missing" in v))
    print("canon_mismatch", sum(1 for v in reasons.values() if "canon_mismatch_b41-60" in v))


if __name__ == "__main__":
    main()
