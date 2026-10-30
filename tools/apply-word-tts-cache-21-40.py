#!/usr/bin/env python3
"""Copy cached/regenerated clips into all books 21-40 that use each lemma."""
import hashlib
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BAND = range(21, 41)


def read_units(text):
    return [m.group(0).lower() for m in re.finditer(r"[A-Za-z']+", text or "")]


def md5(p):
    return hashlib.md5(p.read_bytes()).hexdigest()


def main():
    cache = ROOT / "assets" / "word_tts_cache"
    regen_list = ROOT / "tools" / "word-tts-regen-list-21-40.json"
    lemmas = json.loads(regen_list.read_text())
    copied = 0
    for lem in lemmas:
        src = cache / f"{lem}.mp3"
        if not src.is_file():
            print("missing cache", lem)
            continue
        for n in BAND:
            bid = f"mlr_dec_{n:03d}"
            align = json.loads((ROOT / "assets" / f"align_{bid}.json").read_text())
            need = set()
            for p in align.get("pages", []):
                need.update(read_units(p.get("text", "")))
            if lem not in need:
                continue
            dest = ROOT / "assets" / "books" / bid / "audio" / "words" / f"{lem}.mp3"
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)
            copied += 1
    canon = {}
    for n in BAND:
        bid = f"mlr_dec_{n:03d}"
        align = json.loads((ROOT / "assets" / f"align_{bid}.json").read_text())
        for p in align.get("pages", []):
            for lem in read_units(p.get("text", "")):
                fp = ROOT / "assets" / "books" / bid / "audio" / "words" / f"{lem}.mp3"
                if fp.is_file() and lem not in canon:
                    canon[lem] = md5(fp)
    doc = {
        "source": "books 21-40 after word TTS regen (Clear American Male / ElevenLabs voice 851d4a3a)",
        "voice_id": "851d4a3a36814f8faef50db1884e1ef6",
        "lemmas": dict(sorted(canon.items())),
    }
    (ROOT / "assets" / "word_tts_canon_b21-40.json").write_text(json.dumps(doc, indent=2) + "\n")
    print("copied", copied, "canon", len(canon))


if __name__ == "__main__":
    main()
