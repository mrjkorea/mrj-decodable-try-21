# Letter-intro videos (books 21–40)

One mp4 per book. The student app plays it right after the sound card and
before the famous word:

`cousin (sound card) → letter-intro → famous-card → famous → chase → Listen`

The app loads `assets/decodable/letter_intro/<mp4>` through `asset()`, so every
URL gets the `?v=ASSET_V` cache stamp. The file name comes from the book's
`letter_intros[0]` in `assets/align_mlr_dec_0NN.json`; the `LETTER_INTRO` map in
`index.html` is the fallback.

The files come unchanged from the GitHub release `letter-intros-wire-20261030`:
portrait 720×1280, H.264 + AAC, 39–47 seconds each, about 101 MB for all 20.

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

## Replacing the media

Keep the same file names. From the repo root:

```sh
gh release download <tag> --repo mrjkorea/mrj-decodable-try-21 -p '*.mp4' -D assets/decodable/letter_intro --clobber
npm test   # letter-intro.test.js fails unless this folder holds exactly these 20 mp4s
```

Use H.264 video with AAC audio (like the famous-carpet and chase clips) so the
video plays on iPhone Safari. The video's own soundtrack is the narration, so
the app plays it with the sound on.

Keep the files small. With these 20 videos the published site is about 942 MB,
and GitHub Pages will not publish a site over 1 GB. GitHub also rejects any
single file over 100 MB.

## When a file is missing

Students are not blocked. If the video fails to load, the app logs
`letter intro video missing` to the console and unlocks Next, so the student
can go on to the famous word.
