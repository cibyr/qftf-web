use anyhow::{Context, Result};
use iroh::{Endpoint, EndpointAddr};
use tracing::level_filters::LevelFilter;
use tracing_subscriber_wasm::MakeConsoleWriter;
use wasm_bindgen::{JsError, prelude::wasm_bindgen};

const ALPN: &[u8] = b"QFTFv0";
const TX_PREFIX: &str = "qftf-tx:";
const RX_PREFIX: &str = "qftf-rx:";

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
pub struct QftfInitiator {
    endpoint: Endpoint,
}

#[wasm_bindgen]
impl QftfInitiator {
    pub async fn spawn() -> Result<Self, JsError> {
        let endpoint = Endpoint::builder()
            .bind()
            .await
            .map_err(to_js_err)?;

        Ok(Self{ endpoint })
    }

    pub fn node_addr(&self) -> String {
        format!("{:?}", self.endpoint.addr())
    }

    async fn do_qftf(&self, txcode: String, rxcode: String) -> Result<()> {
        let tx_json = txcode
            .strip_prefix(TX_PREFIX)
            .context("TXCODE must start with qftf-tx:")?;

        let rx_json = rxcode
            .strip_prefix(RX_PREFIX)
            .context("RXCODE must start with qftf-rx:?")?;
        let rx_addr: EndpointAddr = serde_json::from_str(rx_json).context("couldn't parse rx json")?;

        //  * connect to receiver's endpoint, send FT json
        tracing::info!("Connecting to receiver");
        let connection = self.endpoint.connect(rx_addr, ALPN).await?;
        tracing::info!("Connected!");
        let mut s = connection.open_uni().await?;
        s.write_all(tx_json.as_bytes()).await?;
        s.finish()?;
        s.stopped().await?;

        tracing::info!("Yay!");

        Ok(())
    }

    pub async fn trigger_qftf(&self, txcode: String, rxcode: String) -> Result<(), JsError> {
        self.do_qftf(txcode, rxcode).await.map_err(to_js_err)
    }
}

fn to_js_err(err: impl Into<anyhow::Error>) -> JsError {
    let err: anyhow::Error = err.into();
    JsError::new(&err.to_string())
}
