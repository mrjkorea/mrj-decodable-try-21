# Letter-intro videos (books 21–40)

One mp4 per book. The student app plays it right after the sound card and
before the famous word:

`cousin (sound card) → letter-intro → famous-card → famous → chase → Listen`

The app loads `assets/decodable/letter_intro/<mp4>` through `asset()`, so every
URL gets the `?v=ASSET_V` cache stamp. The file name comes from the book's
`letter_intros[0]` in `assets/align_mlr_dec_0NN.json`; the `LETTER_INTRO` map in
`index.html` is the fallback.

The mp4s are not in git yet. They arrive in a follow-up tar.gz on the same
branch. Unpack it flat into this folder, with no subfolders.

| Book | Sound | File |
| --- | --- | --- |
| mlr_dec_021 | qu | `qu_letter_intro.mp4` |
| mlr_dec_022 | v | `v_letter_intro.mp4` |
| mlr_dec_023 | z | `z_letter_intro.mp4` |
| mlr_dec_024 | -s /s/ /z/ | `s__s___z_letter_intro.mp4` |
| mlr_dec_025 | ff ll ss zz | `ff_ll_ss_zz_letter_intro.mp4` |
| mlr_dec_026 | -all | `all_letter_intro.mp4` |
| mlr_dec_027 | ck | `ck_letter_intro.mp4` |
| mlr_dec_028 | L-blends | `l_blends_letter_intro.mp4` |
| mlr_dec_029 | R-blends | `r_blends_letter_intro.mp4` |
| mlr_dec_030 | S-blends | `s_blends_letter_intro.mp4` |
| mlr_dec_031 | end blends | `end_blends_letter_intro.mp4` |
| mlr_dec_032 | sh | `sh_letter_intro.mp4` |
| mlr_dec_033 | ch | `ch_letter_intro.mp4` |
| mlr_dec_034 | th (thin) | `th_thin_letter_intro.mp4` |
| mlr_dec_035 | th (this) | `th_this_letter_intro.mp4` |
| mlr_dec_036 | wh | `wh_letter_intro.mp4` |
| mlr_dec_037 | ng | `ng_letter_intro.mp4` |
| mlr_dec_038 | nk | `nk_letter_intro.mp4` |
| mlr_dec_039 | tch | `tch_letter_intro.mp4` |
| mlr_dec_040 | dge | `dge_letter_intro.mp4` |

## Adding the media

From the repo root (use your tarball's name; add `--strip-components=1` if the
tarball wraps the files in a top-level folder):

```sh
tar -xzf letter_intros.tar.gz -C assets/decodable/letter_intro
node test/letter-intro.test.js --media   # fails unless all 20 files are here
```

Use H.264 video with AAC audio (like the famous-carpet and chase clips) so the
video plays on iPhone Safari. The video's own soundtrack is the narration, so
the app plays it with the sound on.

## When a file is missing

Students are not blocked. If the video fails to load, the app logs
`letter intro video missing` to the console and unlocks Next, so the student
can go on to the famous word.
