import esbuild from 'esbuild'
import { ZBAR_WASM_REPOSITORY } from '@undecaf/barcode-detector-polyfill/zbar-wasm'

const options = {
    entryPoints: ['./src/main.js'],
    bundle: true,
    outfile: './public/js/main.js',
    format: 'esm',
    target: 'es2022',
    minify: true,
    sourcemap: true,
}

console.log(await esbuild.build(options))
