# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Web interface for [QFTF](https://github.com/cibyr/qftf) (QR-Code File Transfer). It runs entirely in the browser: scan the sender's and receiver's QR codes, then act as the *initiator* that opens an [iroh](https://www.iroh.computer/) P2P connection to the receiver and hands it the sender's transfer descriptor. The actual file bytes never flow through this page — it only brokers the connection.

## Architecture

Two halves bridged by `wasm-bindgen`:

- **Rust → WASM (`src/lib.rs`)** — compiled to `wasm32-unknown-unknown`. Exposes `QftfInitiator` to JS:
  - `spawn()` builds an iroh `Endpoint`.
  - `trigger_qftf(txcode, rxcode)` strips the `qftf-tx:` / `qftf-rx:` prefixes, parses the rx code as an `EndpointAddr` (JSON), connects over ALPN `QFTFv0`, opens a uni stream, writes the tx descriptor, and waits for the receiver to ack via `stopped()`.
  - `start()` (`#[wasm_bindgen(start)]`) installs the panic hook and tracing-to-console logging. Tracing must use `.without_time()` — `std::time` panics in the browser.
- **JS glue (`src/main.js`)** — the entry point bundled by esbuild. Drives the camera (`getUserMedia`), runs QR detection via `@undecaf/barcode-detector-polyfill` (zbar WASM), draws detection boxes on a canvas overlay (green = recognized qftf code, red = not), and calls into the WASM module. Codes are read either from scanned QR URLs (`#qftf-tx:`/`#qftf-rx:` in the URL hash) or pasted into the form.

### The two-WASM-module gotcha

There are **two independent WASM artifacts** loaded at runtime:
1. The Rust app, emitted by `wasm-bindgen` into `public/js/qftf_web*` (`qftf_web.js` loader + `qftf_web_bg.wasm`). `main.js` imports `init, QftfInitiator` from `../public/js/qftf_web.js`.
2. zbar's QR-decoding WASM, pulled in transitively by the barcode-detector polyfill.

`main.js` imports the wasm-bindgen output by relative path, so **`npm run build` must regenerate `public/js/qftf_web.js` before esbuild bundles `main.js`** — the build script already orders these steps; don't run esbuild alone after touching Rust.

## Build

The `build` scripts chain three tools in order: `cargo build` (→ wasm) → `wasm-bindgen` (→ JS bindings in `public/js/`) → `node esbuild.config.js` (→ bundled `public/js/main.js`). There is no `npm run dev`/watch.

```
npm install            # JS deps (one time)
npm run build          # debug build
npm run build:release  # release: adds wasm-opt -Os + minify, no debug bindings
```

Prerequisites beyond `npm install`:
- `rustup target add wasm32-unknown-unknown`
- `cargo install wasm-bindgen-cli` (must match the `wasm-bindgen = "=0.2.106"` pin in `Cargo.toml`)
- `cargo install wasm-opt --locked` (release only)

There are no tests and no linter configured beyond `cargo`/`clippy`.

## Running locally

Serve the contents of `public/` over **HTTPS** — `getUserMedia()` only works in a secure context, so plain `http://` (other than `localhost`) won't give camera access.

## Deployment

GitHub Pages deploys the `public/` directory on every push to the **`pages`** branch (`.github/workflows/pages.yaml`). There is no build step in CI — the workflow uploads `public/` as-is. **Consequence: the built artifacts in `public/js/` are committed to the repo**, and you must rebuild and commit them for changes to ship. Commits like "Build for GH pages" are these checked-in build outputs.

Note `pages` is not the same as the development/`main` branch; the `lulz` branch is merged into `pages` for deployment.
