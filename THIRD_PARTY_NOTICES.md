# Third-party data

## ECDICT

- Project: ECDICT — Free English to Chinese Dictionary Database
- Repository: https://github.com/skywind3000/ECDICT
- Author/maintainer: skywind3000 and contributors
- License: MIT License
- Use in this project: English headwords, phonetics, English definitions, Chinese translations, exam tags, frequency metadata, and word-form exchanges for all generated deck entries

The generated browser dataset is `data/exam-vocab.js`. The original project license and source documentation are copied to `data/ECDICT_LICENSE` and `data/ECDICT_README.md`.

The IELTS, TOEFL, and GRE labels in this project are ECDICT vocabulary tags. They are not official word lists published or endorsed by the respective exam organizations.

## AWL Focus headword dataset

- Project: AWL Focus (`Jianyuanxi/AWL`)
- Repository: https://github.com/Jianyuanxi/AWL
- Pinned source commit: `168c3614f053a67ef0ec5cd115db34c5dc54a345`
- Source file: `assets/words.json`
- Copyright: 2026 frankxi666
- Repository license: MIT License
- Underlying list attribution: Academic Word List, originally developed by Averil Coxhead
- Use in this project: the English headword and AWL sublist for 570 unique Academic Word List entries; upstream phonetics, translations, and examples are not imported

The retained source snapshot is `data/source/PTE/pte-academic-headwords.tsv`; its source note and license are in the same directory. ECDICT supplies the displayed dictionary content for these words.

Academic source: Coxhead, A. (2000). *A New Academic Word List*. TESOL Quarterly, 34(2), 213–238. The copied MIT notice records the repository license for material its author can license; it does not by itself make a claim about every possible upstream right in the AWL selection or sublist arrangement.

The app calls this preparation-oriented set the **PTE Academic core** because it covers cross-disciplinary academic vocabulary. It is not exhaustive, is not an official Pearson PTE vocabulary list, and does not imply Pearson recommendation or endorsement.
