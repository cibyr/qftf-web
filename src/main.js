import { BarcodeDetectorPolyfill } from '@undecaf/barcode-detector-polyfill'
import init, { QftfInitiator } from "../public/js/qftf_web.js";

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
        el.goBtn.className = 'button-primary';
    }
}

function parseHash(hash) {
    const decoded = decodeURIComponent(hash.substring(1));
    if (decoded.startsWith("qftf-tx:")) {
      el.txcode.value = decoded;
      el.txcode.className = 'good-input';
      return true;
    } else if (decoded.startsWith("qftf-rx:")) {
      el.rxcode.value = decoded;
      el.rxcode.className = 'good-input';
      return true;
    }
    return false;
}

function parseQrCode(rawValue) {
    // Parse the code as a URL, look at hash, see if it starts with "#qftf-tx:" or "qftf-rx:"
    const url = new URL(rawValue);
    return parseHash(url.hash);
}

function detect(source) {
    return detector
        .detect(source)
        .then(symbols => {
            canvas.width = source.naturalWidth || source.videoWidth || source.width
            canvas.height = source.naturalHeight || source.videoHeight || source.height
            ctx.clearRect(0, 0, canvas.width, canvas.height)

            symbols.forEach(symbol => {
                const qftfCode = parseQrCode(symbol.rawValue);
                areWeReady();

                const lastCornerPoint = symbol.cornerPoints[symbol.cornerPoints.length - 1]
                ctx.moveTo(lastCornerPoint.x, lastCornerPoint.y)
                symbol.cornerPoints.forEach(point => ctx.lineTo(point.x, point.y))

                ctx.lineWidth = 3
                if (qftfCode) {
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

function stopCamera() {
    el.videoBtn.innerHTML = 'Start Camera'
    el.videoBtn.className = ''
    detectVideo(false)
    if (el.video.srcObject) {
        el.video.srcObject.getTracks().forEach(track => track.stop())
        el.video.srcObject = null
    }
}

parseHash(window.location.hash);
createDetector();

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
        stopCamera();
    }
})

log("Loading...");
await init();
const initiator = await QftfInitiator.spawn();
launched = true;
areWeReady();
log("Iroh endpoint launched");
log("Our addr: " + initiator.node_addr());

// initiate QFTF on form submit
async function onQftfSubmit(e) {
  e.preventDefault();
  const data = new FormData(e.target);
  const txcode = data.get("txcode");
  const rxcode = data.get("rxcode");
  if (!txcode || !rxcode) return;

  stopCamera();

  try {
    log("QFTFing...");
    await initiator.trigger_qftf(txcode, rxcode);
    log("Transfer has started - you can close this page now");
  } catch (err) {
    log(`QFTF failed: ${err}`, "error");
  }
}

el.qftForm.onsubmit = onQftfSubmit;
