# PTE Academic core headwords

This directory contains the headword membership list used by the app's `PTE` deck.

- Upstream dataset: `assets/words.json` from [Jianyuanxi/AWL](https://github.com/Jianyuanxi/AWL)
- Pinned commit: `168c3614f053a67ef0ec5cd115db34c5dc54a345`
- Upstream SHA-256: `97C9897A0D0B8763E0822B0B05078BE5699753FF0DFE2A6214C22FF72574A5EE`
- Repository license notice: MIT (copied in `LICENSE`)
- Original AWL attribution: Averil Coxhead; Coxhead, A. (2000), *A New Academic Word List*, TESOL Quarterly, 34(2), 213–238
- Retained fields: English headword and Academic Word List sublist only; `so called` is normalized to the dictionary headword `so-called`
- Size: 570 unique headwords across 10 AWL sublists

The application uses this list as a preparation-oriented **PTE Academic core** because it covers cross-disciplinary academic vocabulary. It is not an official Pearson word list, does not claim to be exhaustive, and does not imply Pearson recommendation or endorsement.

The copied MIT notice records the repository's license for material its author can license. The underlying AWL headword selection and sublist arrangement originate with Averil Coxhead and are attributed separately above; the repository license should not be read as eliminating every possible upstream database or compilation right.

Deck membership comes from this file. Phonetics, bilingual definitions, parts of speech, word forms, and frequency metadata come from the separately licensed ECDICT source. Overlapping IELTS, TOEFL, GRE, and PTE membership is merged into one canonical headword.

ECDICT has no phonetic value for `minimise` and `so-called`; the build script supplies the reviewed pronunciations `/ˈmɪnɪmaɪz/` and `/ˌsoʊ ˈkɔːld/` so every PTE entry has a readable phonetic form.

Recreate the tracked TSV from the pinned upstream JSON with:

```powershell
python scripts/import_pte_awl.py path\to\words.json
```
