# Vendored models

`bun run vendor-model` fills this folder with the open-weight ONNX models the
in-browser AI engine uses (see `scripts/vendor-model.mjs` for the list). Large
files are split into 45 MB `.partNNN` chunks and described by a `manifest.json`
per model, so the loader can stitch them back together in the browser.

The GitHub Pages workflow runs the script at build time, so this folder can stay
empty in git. Commit it if you prefer the weights pinned inside the repository.
