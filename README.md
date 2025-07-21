## qftf-web

This is the web interface for [QFTF](https://github.com/cibyr/qftf), a QR-Code File Transfer. All that this piece does is scan QR codes and initiate the transfer.

### Building

You'll need:

* a Rust toolchain with WASM support (`rustup target add wasm32-unknown-unknown`)
* [wasm-bindgen](https://github.com/rustwasm/wasm-bindgen) (`cargo install wasm-bindgen-cli`)
* `npm` (I'm using node.js v24, installed via [`nvm`](https://github.com/nvm-sh/nvm))
* `wasm-opt` for release builds (`cargo install wasm-opt --locked`)

Run `npm install` to get the JavaScript dependencies.

For a debug build, run:

```
npm run build
```

Or for a release build, do:

```
npm run build:release
```

Then feed the contents of of `public/` to your favorite web server. Note that the HTML5 camera API [`getUserMedia()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) only works in secure contexts, so you'll need HTTPS.

All the build outputs end up in `public/js/`. 
