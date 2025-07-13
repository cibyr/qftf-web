import { BarcodeDetectorPolyfill } from '@undecaf/barcode-detector-polyfill'
import init, { EchoNode } from "../public/wasm/qft_web.js";

const el = {}

document
    .querySelectorAll('[id]')
    .forEach(element => el[element.id] = element)

const
    canvas = el.canvas,
    ctx = canvas.getContext('2d', { willReadFrequently: true });

let
    detector,
    requestId = null,
    launched = false;


async function createDetector() {
    detector = new BarcodeDetectorPolyfill({ formats: ['qr_code'] })
}

function log(line, className, parent) {
  const time = new Date().toISOString().substring(11, 22);
  if (!parent) parent = document.querySelector("main");
  const el = document.createElement("div");
  line = `<span class=time>${time}: </span>${line}`;
  el.innerHTML = line;
  if (className) el.classList.add(className);
  parent.appendChild(el);
}

function areWeReady() {
    if (launched && el.txcode.value != '' && el.rxcode.value != '') {
        el.goBtn.disabled = false;
    }
}

function parseQrCode(rawValue) {
    // Parse the code as a URL, look at hash, see if it starts with "#qft-tx:" or "qft-rx:"
    const url = new URL(rawValue);
    const decoded = decodeURIComponent(url.hash.substring(1));
    const $form = document.querySelector("form#qft");
    if (decoded.startsWith("qft-tx:")) {
      el.txcode.value = decoded;
      el.txcode.className = 'good-input';
      return true;
    } else if (decoded.startsWith("qft-rx:")) {
      el.rxcode.value = decoded;
      el.rxcode.className = 'good-input';
      return true;
    }
    return false;
}

function detect(source) {
    return detector
        .detect(source)
        .then(symbols => {
            canvas.width = source.naturalWidth || source.videoWidth || source.width
            canvas.height = source.naturalHeight || source.videoHeight || source.height
            ctx.clearRect(0, 0, canvas.width, canvas.height)

            symbols.forEach(symbol => {
                const qftCode = parseQrCode(symbol.rawValue);
                areWeReady();

                const lastCornerPoint = symbol.cornerPoints[symbol.cornerPoints.length - 1]
                ctx.moveTo(lastCornerPoint.x, lastCornerPoint.y)
                symbol.cornerPoints.forEach(point => ctx.lineTo(point.x, point.y))

                ctx.lineWidth = 3
                if (qftCode) {
                    ctx.strokeStyle = '#00e000ff'
                } else {
                    ctx.strokeStyle = '#e00000ff'
                }
                ctx.stroke();
            })
        })
}


function detectVideo(repeat) {
    if (!repeat) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    if (typeof repeat === 'undefined') {
        repeat = true
    }

    if (repeat) {
        detect(el.video)
            .then(() => requestId = requestAnimationFrame(() => detectVideo(true)))

    } else {
        cancelAnimationFrame(requestId)
        requestId = null
    }
}

createDetector()

el.videoBtn.addEventListener('click', event => {
    if (!requestId) {
        navigator.mediaDevices.getUserMedia({audio: false, video: {facingMode: 'environment'}})
            .then(stream => {
                el.videoBtn.innerHTML = 'Stop Camera';
                el.videoBtn.className = 'button-primary';

                el.video.srcObject = stream;
                detectVideo();
                el.video.requestVideoFrameCallback((now, metadata) => el.goBtn.scrollIntoView());
            })
            .catch(error => {
                log(JSON.stringify(error), "error");
            })

    } else {
        el.videoBtn.innerHTML = 'Start Camera'
        el.videoBtn.className = ''
        detectVideo(false)
        if (el.video.srcObject) {
            el.video.srcObject.getTracks().forEach(track => track.stop())
            el.video.srcObject = null
        }
    }
})

log("Loading...");
await init();
const node = await EchoNode.spawn();
launched = true;
areWeReady();
log("Iroh endpoint launched");
log("Our node id: " + node.node_id());

// initiate QFT on form submit
async function onQftSubmit(e) {
  e.preventDefault();
  const data = new FormData(e.target);
  const txcode = data.get("txcode");
  const rxcode = data.get("rxcode");
  if (!txcode || !rxcode) return;

  try {
    log("QFTing...");
    await node.trigger_qft(txcode, rxcode);
    log("Yay!");
  } catch (err) {
    log(`QFT failed: ${err}`, "error");
  }
}

el.qftForm.onsubmit = onQftSubmit;
