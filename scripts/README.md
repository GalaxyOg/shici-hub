# Vocabulary build scripts

`build_exam_vocab.py` extracts ECDICT entries tagged `ielts`, `toefl`, or `gre`, plus all headwords in the tracked 570-word PTE Academic core list. It normalizes parts of speech, keeps the complete bilingual ECDICT definitions and metadata, merges overlapping deck membership by headword, and writes `data/exam-vocab.js`.

`validate_exam_vocab.py` compares every generated entry with the source CSV and fails if definitions, translations, tags, deck membership, frequency metadata, PTE coverage, or headword uniqueness changed.

The PTE source is `data/source/PTE/pte-academic-headwords.tsv`. It is a pinned snapshot of 570 Academic Word List headwords from a repository carrying an MIT license notice. `scripts/import_pte_awl.py` verifies the pinned JSON SHA-256 before recreating the TSV; only the English headword and AWL sublist are retained. The original AWL attribution and upstream-rights boundary are documented in `THIRD_PARTY_NOTICES.md`. PTE is a preparation-oriented project deck, not an official Pearson vocabulary list.

To rebuild:

1. Clone https://github.com/skywind3000/ECDICT into `data/source/ECDICT`, or keep its CSV elsewhere.
2. Run `python scripts/build_exam_vocab.py --source path\to\ecdict.csv`.
3. Run `python scripts/validate_exam_vocab.py --source path\to\ecdict.csv`.

The large source clone is intentionally not retained in the application directory after generation. The generated dataset and ECDICT license are retained.
