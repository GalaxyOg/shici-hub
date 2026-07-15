#!/usr/bin/env python3
"""Convert the pinned MIT AWL JSON snapshot into the tracked PTE headword TSV."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "data" / "source" / "PTE" / "pte-academic-headwords.tsv"
SOURCE_COMMIT = "168c3614f053a67ef0ec5cd115db34c5dc54a345"
SOURCE_SHA256 = "97C9897A0D0B8763E0822B0B05078BE5699753FF0DFE2A6214C22FF72574A5EE"
CANONICAL_OVERRIDES = {"so called": "so-called"}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path, help="Downloaded assets/words.json from Jianyuanxi/AWL")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    raw_source = args.input.read_bytes()
    actual_sha256 = hashlib.sha256(raw_source).hexdigest().upper()
    if actual_sha256 != SOURCE_SHA256:
        raise SystemExit(
            f"Unexpected source SHA-256: {actual_sha256}; expected {SOURCE_SHA256}"
        )
    groups = json.loads(raw_source.decode("utf-8"))
    rows: list[tuple[int, str]] = []
    for group in groups:
        title = str(group.get("title", ""))
        try:
            sublist = int(title.rsplit(" ", 1)[1])
        except (IndexError, ValueError) as exc:
            raise SystemExit(f"Invalid sublist title: {title!r}") from exc
        rows.extend(
            (sublist, CANONICAL_OVERRIDES.get(str(item.get("english", "")).strip(), str(item.get("english", "")).strip()))
            for item in group.get("words", [])
        )
    keys = [word.casefold() for _, word in rows]
    if len(rows) != 570 or len(set(keys)) != 570 or any(not word for _, word in rows):
        raise SystemExit("Expected exactly 570 non-empty unique AWL headwords")
    lines = [
        "# PTE Academic core headwords based on the 570-headword Academic Word List.",
        "# Source: https://github.com/Jianyuanxi/AWL/blob/"
        f"{SOURCE_COMMIT}/assets/words.json",
        f"# Source SHA-256: {SOURCE_SHA256}",
        "# Source repository license notice: MIT; see LICENSE and README.md for AWL attribution.",
        "# Format: AWL sublist<TAB>headword",
        *[f"{sublist}\t{word}" for sublist, word in rows],
        "",
    ]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {len(rows)} PTE/AWL headwords to {args.output}")


if __name__ == "__main__":
    main()
