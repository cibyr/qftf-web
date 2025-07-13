use anyhow::{Context, Result};
use iroh::NodeAddr;
use n0_future::{Stream, StreamExt};
use serde::Serialize;
use tracing::level_filters::LevelFilter;
use tracing_subscriber_wasm::MakeConsoleWriter;
use wasm_bindgen::{prelude::wasm_bindgen, JsError, JsValue};
use wasm_streams::{readable::sys::ReadableStream as JsReadableStream, ReadableStream};

use crate::node;

const ALPN: &[u8] = b"QFTv0";
const TX_PREFIX: &str = "qft-tx:";
const RX_PREFIX: &str = "qft-rx:";

#[wasm_bindgen(start)]
fn start() {
    console_error_panic_hook::set_once();

    tracing_subscriber::fmt()
        .with_max_level(LevelFilter::INFO)
        .with_writer(
            // To avoid trace events in the browser from showing their JS backtrace
            MakeConsoleWriter::default().map_trace_level_to(tracing::Level::DEBUG),
        )
        // If we don't do this in the browser, we get a runtime error.
        .without_time()
        .with_ansi(false)
        .init();

    tracing::info!("(testing logging) Logging setup");
}

#[wasm_bindgen]
pub struct EchoNode(node::EchoNode);

#[wasm_bindgen]
impl EchoNode {
    pub async fn spawn() -> Result<Self, JsError> {
        Ok(Self(node::EchoNode::spawn().await.map_err(to_js_err)?))
    }

    async fn do_qft(&self, txcode: String, rxcode: String) -> Result<()> {
        let tx_json = txcode.strip_prefix(TX_PREFIX).context("TXCODE must start with qft-tx:")?;

        let rx_json = rxcode.strip_prefix(RX_PREFIX).context("RXCODE must start with qft-rx:?")?;
        let rx_addr: NodeAddr = serde_json::from_str(rx_json).context("couldn't parse rx json")?;

        //  * connect to receiver's endpoint, send FT json
        tracing::info!("Connecting to receiver");
        let connection = self.0.endpoint().connect(rx_addr, ALPN).await?;
        tracing::info!("Connected!");
        let mut s = connection.open_uni().await?;
        s.write_all(tx_json.as_bytes()).await?;
        s.finish()?;
        s.stopped().await?;

        tracing::info!("Yay?");

        Ok(())
    }

    pub async fn trigger_qft(&self, txcode: String, rxcode: String) -> Result<(), JsError> {
        self.do_qft(txcode, rxcode).await.map_err(to_js_err)
    }

    pub fn events(&self) -> JsReadableStream {
        let stream = self.0.accept_events();
        into_js_readable_stream(stream)
    }

    pub fn node_id(&self) -> String {
        self.0.endpoint().node_id().to_string()
    }

    pub fn connect(&self, node_id: String, payload: String) -> Result<JsReadableStream, JsError> {
        let node_id = node_id
            .parse()
            .context("failed to parse node id")
            .map_err(to_js_err)?;
        let stream = self.0.connect(node_id, payload);
        Ok(into_js_readable_stream(stream))
    }

    pub fn remote_info(&self) -> Vec<JsValue> {
        self.0
            .endpoint()
            .remote_info_iter()
            .map(|info| serde_wasm_bindgen::to_value(&info).unwrap())
            .collect::<Vec<_>>()
    }
}

fn to_js_err(err: impl Into<anyhow::Error>) -> JsError {
    let err: anyhow::Error = err.into();
    JsError::new(&err.to_string())
}

fn into_js_readable_stream<T: Serialize>(
    stream: impl Stream<Item = T> + 'static,
) -> wasm_streams::readable::sys::ReadableStream {
    let stream = stream.map(|event| Ok(serde_wasm_bindgen::to_value(&event).unwrap()));
    ReadableStream::from_stream(stream).into_raw()
}
