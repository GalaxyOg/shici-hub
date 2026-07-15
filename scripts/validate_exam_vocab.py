#!/usr/bin/env python3
"""Validate source fidelity, PTE coverage, and generated headword uniqueness."""

from __future__ import annotations

import argparse
import csv
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "source" / "ECDICT" / "ecdict.csv"
PTE_SOURCE = ROOT / "data" / "source" / "PTE" / "pte-academic-headwords.tsv"
GENERATED = ROOT / "data" / "exam-vocab.js"
WANTED = {"ielts", "toefl", "gre"}
LABELS = {"ielts": "IELTS", "toefl": "TOEFL", "gre": "GRE"}
PTE_PHONETIC_OVERRIDES = {"minimise": "/ˈmɪnɪmaɪz/", "so-called": "/ˌsoʊ ˈkɔːld/"}


def normalize(value: str) -> str:
    value = (value or "").replace("\\n", "\n").replace("\\r", "")
    return "\n".join(line.strip() for line in value.splitlines() if line.strip())


def load_generated() -> tuple[list[dict], dict[str, dict]]:
    text = GENERATED.read_text(encoding="utf-8")
    payload = text[text.index("["):text.rindex("]") + 1]
    items = json.loads(payload)
    return items, {item["w"].casefold(): item for item in items}


def load_pte_headwords(path: Path) -> set[str]:
    words = set()
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        _, word = line.split("\t", 1)
        words.add(word.strip().casefold())
    return words


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=Path(os.environ.get("ECDICT_CSV", SOURCE)))
    parser.add_argument("--pte-source", type=Path, default=PTE_SOURCE)
    args = parser.parse_args()
    items, generated = load_generated()
    pte_headwords = load_pte_headwords(args.pte_source)
    errors: list[str] = []
    if len(items) != len(generated):
        errors.append(f"duplicate generated headwords: {len(items) - len(generated)}")
    checked = 0
    resolved_pte = set()
    with args.source.open("r", encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            tags = set((row.get("tag") or "").lower().split())
            key = (row.get("word") or "").strip().casefold()
            is_pte = key in pte_headwords
            if not tags & WANTED and not is_pte:
                continue
            checked += 1
            item = generated.get(key)
            if not item:
                errors.append(f"missing word: {row['word']}")
                continue
            if is_pte:
                resolved_pte.add(key)
            expected_src = {label for tag, label in LABELS.items() if tag in tags}
            if is_pte:
                expected_src.add("PTE")
            if set(item["src"]) != expected_src:
                errors.append(f"deck membership changed: {row['word']}")
            expected_phonetic = (row.get("phonetic") or "").strip()
            if expected_phonetic and not expected_phonetic.startswith("/"):
                expected_phonetic = f"/{expected_phonetic}/"
            if is_pte and not expected_phonetic:
                expected_phonetic = PTE_PHONETIC_OVERRIDES.get(key, "")
            if item["p"] != expected_phonetic:
                errors.append(f"phonetic changed: {row['word']}")
            expected_en = normalize(row.get("definition", ""))
            if expected_en and item["en"] != expected_en:
                errors.append(f"English definition changed: {row['word']}")
            if item["rawZh"] != normalize(row.get("translation", "")):
                errors.append(f"Chinese translation changed: {row['word']}")
            if set(item["tags"]) != set((row.get("tag") or "").split()):
                errors.append(f"tags changed: {row['word']}")
            for field in ("collins", "oxford", "bnc", "frq"):
                if item[field] != int(row.get(field) or 0):
                    errors.append(f"{field} changed: {row['word']}")
    missing_pte = sorted(pte_headwords - resolved_pte)
    if missing_pte:
        errors.append(f"unresolved PTE headwords: {missing_pte}")
    untraceable_pte = sorted(
        item["w"] for item in items
        if "PTE" in item["src"] and item["w"].casefold() not in pte_headwords
    )
    if untraceable_pte:
        errors.append(f"untraceable PTE entries: {untraceable_pte}")
    if errors:
        print("\n".join(errors[:30]))
        raise SystemExit(f"Validation failed with {len(errors)} errors")
    print(
        f"source fidelity passed: {checked} selected rows, "
        f"{len(generated)} unique generated entries, {len(resolved_pte)} PTE headwords"
    )


if __name__ == "__main__":
    main()
