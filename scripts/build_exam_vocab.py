#!/usr/bin/env python3
"""Build the IELTS/TOEFL/GRE/PTE browser vocabulary from licensed sources."""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "source" / "ECDICT" / "ecdict.csv"
PTE_SOURCE = ROOT / "data" / "source" / "PTE" / "pte-academic-headwords.tsv"
OUTPUT = ROOT / "data" / "exam-vocab.js"
STATS = ROOT / "data" / "exam-vocab-stats.json"
PTE_REPORT = ROOT / "data" / "pte-vocab-report.json"
WANTED = {"ielts": "IELTS", "toefl": "TOEFL", "gre": "GRE"}
PTE_PHONETIC_OVERRIDES = {"minimise": "/ˈmɪnɪmaɪz/", "so-called": "/ˌsoʊ ˈkɔːld/"}

POS_MAP = {
    "vt": "vt.", "vi": "vi.", "v": "v.", "n": "n.", "a": "adj.",
    "adj": "adj.", "ad": "adv.", "adv": "adv.", "prep": "prep.",
    "pron": "pron.", "conj": "conj.", "num": "num.", "int": "interj.",
    "interj": "interj.", "art": "art.", "aux": "aux.", "pl": "n. [复数]", "abbr": "abbr.",
}
EXCHANGE_MAP = {
    "p": "过去式", "d": "过去分词", "i": "现在分词", "3": "第三人称单数",
    "r": "比较级", "t": "最高级", "s": "复数", "0": "原形", "1": "原形变体",
}
POS_OVERRIDES = {
    "survivability": "n.", "booklist": "n.", "account for": "phr. v.",
    "bring about": "phr. v.", "drop-out": "n.", "factorable": "adj.",
    "hard-working": "adj.", "heavy-handedness": "n.", "in spite of": "prep. phr.",
    "low-risk": "adj.", "oversecretion": "n.", "per capita": "adv. / adj.",
    "semimolten": "adj.", "space shuttle": "n.", "stereophotograph": "n.",
    "telecommuter": "n.", "water-proof": "adj.", "wollongong": "proper n.",
}


def lines(value: str) -> list[str]:
    value = (value or "").replace("\\n", "\n").replace("\\r", "")
    return [part.strip() for part in value.splitlines() if part.strip()]


def parse_meanings(translation: str, definition: str) -> tuple[str, list[list[str]]]:
    result: list[list[str]] = []
    found_pos: list[str] = []
    for raw in lines(translation):
        field = ""
        text = raw
        domain = re.match(r"^(\[[^\]]+\])\s*", text)
        if domain:
            field = domain.group(1)
            text = text[domain.end():].strip()
        pos_match = re.match(r"^((?:vt|vi|v|n|a|adj|ad|adv|prep|pron|conj|num|int|interj|art|aux|pl|abbr)\.)\s*", text, re.I)
        if pos_match:
            raw_pos = pos_match.group(1).rstrip(".").lower()
            normalized = POS_MAP.get(raw_pos, pos_match.group(1))
            found_pos.append(normalized)
            field = f"{normalized} {field}".strip()
            text = text[pos_match.end():].strip()
        result.append([field or "释义", text or raw])
    if not result:
        for raw in lines(definition):
            result.append(["英文", raw])
    if not found_pos:
        for raw in lines(definition):
            match = re.match(r"^([nvars])(?:\.|\s)\s*", raw, re.I)
            if match:
                code = match.group(1).lower()
                found_pos.append({"s": "adj.", "r": "adv.", "a": "adj."}.get(code, f"{code}."))
    pos = " / ".join(dict.fromkeys(found_pos)) or "未标注"
    return pos, result


def exchange_text(value: str) -> str:
    parts = []
    for item in (value or "").split("/"):
        if ":" not in item:
            continue
        code, word = item.split(":", 1)
        if word:
            parts.append(f"{EXCHANGE_MAP.get(code, code)}：{word}")
    return " · ".join(parts)


def rank(row: dict[str, str]) -> int:
    values = []
    for key in ("frq", "bnc"):
        try:
            value = int(row.get(key) or 0)
            if value > 0:
                values.append(value)
        except ValueError:
            pass
    return min(values) if values else 999999


def load_pte_headwords(path: Path) -> dict[str, dict[str, str]]:
    result: dict[str, dict[str, str]] = {}
    for number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        try:
            sublist, word = line.split("\t", 1)
        except ValueError as exc:
            raise SystemExit(f"Invalid PTE source line {number}: {raw}") from exc
        word = word.strip()
        key = word.casefold()
        if not word or key in result:
            raise SystemExit(f"Invalid or duplicate PTE headword on line {number}: {word!r}")
        result[key] = {"word": word, "sublist": sublist.strip()}
    if len(result) != 570:
        raise SystemExit(f"Expected 570 unique PTE/AWL headwords, found {len(result)}")
    return result


def convert(row: dict[str, str], tags: set[str], is_pte: bool = False) -> dict:
    definition_lines = lines(row.get("definition", ""))
    translation_lines = lines(row.get("translation", ""))
    pos, meanings = parse_meanings(row.get("translation", ""), row.get("definition", ""))
    pos = POS_OVERRIDES.get((row.get("word") or "").strip().casefold(), pos)
    phonetic = (row.get("phonetic") or "").strip()
    if phonetic and not phonetic.startswith("/"):
        phonetic = f"/{phonetic}/"
    if is_pte and not phonetic:
        phonetic = PTE_PHONETIC_OVERRIDES.get((row.get("word") or "").strip().casefold(), "")
    headline = meanings[0][1] if meanings else (translation_lines[0] if translation_lines else "暂无中文释义")
    sources = [label for tag, label in WANTED.items() if tag in tags]
    if is_pte:
        sources.append("PTE")
    return {
        "w": row["word"].strip(),
        "p": phonetic,
        "pos": pos,
        "zh": headline,
        "rawZh": "\n".join(translation_lines),
        "en": "\n".join(definition_lines) or "No English definition is available in the source data.",
        "src": sources,
        "meanings": meanings,
        "family": exchange_text(row.get("exchange", "")) or "暂无词形变化记录",
        "rank": rank(row),
        "collins": int(row.get("collins") or 0),
        "oxford": int(row.get("oxford") or 0),
        "bnc": int(row.get("bnc") or 0),
        "frq": int(row.get("frq") or 0),
        "tags": (row.get("tag") or "").split(),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source",
        type=Path,
        default=Path(os.environ.get("ECDICT_CSV", SOURCE)),
        help="Path to the full ECDICT CSV (defaults to data/source/ECDICT/ecdict.csv)",
    )
    parser.add_argument("--pte-source", type=Path, default=PTE_SOURCE)
    args = parser.parse_args()
    source_path = args.source.resolve()
    pte_source = args.pte_source.resolve()
    if not source_path.exists():
        raise SystemExit(f"Missing source file: {source_path}")
    if not pte_source.exists():
        raise SystemExit(f"Missing PTE source file: {pte_source}")
    pte_headwords = load_pte_headwords(pte_source)
    resolved_pte: set[str] = set()
    by_word: dict[str, dict] = {}
    tag_counts = {label: 0 for label in [*WANTED.values(), "PTE"]}
    with source_path.open("r", encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            tags = set((row.get("tag") or "").lower().split())
            word = (row.get("word") or "").strip()
            key = word.casefold()
            is_pte = key in pte_headwords
            if (not tags & WANTED.keys() and not is_pte) or not word:
                continue
            entry = convert(row, tags, is_pte)
            if is_pte:
                resolved_pte.add(key)
            if key in by_word:
                previous = by_word[key]
                previous["src"] = sorted(set(previous["src"]) | set(entry["src"]))
                if len(entry["en"]) + len(str(entry["meanings"])) > len(previous["en"]) + len(str(previous["meanings"])):
                    entry["src"] = previous["src"]
                    by_word[key] = entry
            else:
                by_word[key] = entry
    entries = sorted(by_word.values(), key=lambda item: (item["rank"], item["w"].casefold()))
    unresolved_pte = sorted(set(pte_headwords) - resolved_pte)
    if unresolved_pte:
        raise SystemExit(f"ECDICT is missing {len(unresolved_pte)} PTE headwords: {unresolved_pte}")
    for entry in entries:
        for label in entry["src"]:
            tag_counts[label] += 1
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(entries, ensure_ascii=False, separators=(",", ":"))
    OUTPUT.write_text(
        "// Generated from ECDICT and a pinned third-party PTE/AWL headword snapshot. Do not edit manually.\n"
        f"const EXAM_VOCAB={payload};\n",
        encoding="utf-8",
    )
    stats = {
        "unique": len(entries),
        "counts": tag_counts,
        "with_phonetic": sum(bool(item["p"]) for item in entries),
        "with_english_definition": sum(not item["en"].startswith("No English") for item in entries),
        "with_chinese_translation": sum(item["zh"] != "暂无中文释义" for item in entries),
        "with_word_forms": sum(item["family"] != "暂无词形变化记录" for item in entries),
        "source": "skywind3000/ECDICT",
        "license": "MIT",
        "deck_sources": {
            "IELTS": "ECDICT tag: ielts",
            "TOEFL": "ECDICT tag: toefl",
            "GRE": "ECDICT tag: gre",
            "PTE": "Academic Word List 570 headwords (pinned third-party snapshot); definitions from ECDICT",
        },
    }
    STATS.write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")
    overlaps: dict[str, int] = {}
    for item in entries:
        if "PTE" not in item["src"]:
            continue
        key = "+".join(item["src"])
        overlaps[key] = overlaps.get(key, 0) + 1
    pte_report = {
        "input_unique": len(pte_headwords),
        "resolved": len(resolved_pte),
        "unresolved": unresolved_pte,
        "pte_only": sum(item["src"] == ["PTE"] for item in entries),
        "overlaps": dict(sorted(overlaps.items())),
        "headword_source": "Jianyuanxi/AWL assets/words.json",
        "headword_source_commit": "168c3614f053a67ef0ec5cd115db34c5dc54a345",
        "headword_source_repository_license": "MIT",
        "dictionary_source": "skywind3000/ECDICT",
    }
    PTE_REPORT.write_text(json.dumps(pte_report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
