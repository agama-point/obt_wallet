// ts_obt_wallet.ts – ECC251 toy wallet
// Structure: action tabs (Receive | Send | About) + dev tabs (Keys | Hash | Transaction)

// --- Globals from ess251.js ---
declare function scalar_mult(k: number, P: [number, number]): [number, number] | null;
declare function point_adding(P1: [number, number] | null, P2: [number, number] | null): [number, number] | null;
declare function pubkey_to_addr(pub: [number, number]): string;
declare function hexa_to_toy32(hex: string, prefix?: string): string;
declare function hexa_to_point(hex: string): [number, number];
declare function signToy(
  private_key: number,
  msg_hash: number
): { r: number; s: number; R_point: [number, number] };
declare function sig_to_hexa(signature: { r: number; s: number; R_point: [number, number] }): string;
declare const ECC_PARAMS: {
  p: number; a: number; b: number;
  G: [number, number]; n: number;
};

// --- Globals from ash24.js ---
declare function ASH24(input: string): number;
declare function hex24(v: number): string;

// --- QRCode from qrcodejs CDN ---
declare class QRCode {
  constructor(el: HTMLElement, options: {
    text: string; width: number; height: number;
    colorDark: string; colorLight: string;
  });
  clear(): void;
  makeCode(text: string): void;
}

declare function startCamera(
  video: HTMLVideoElement,
  addrIn: HTMLInputElement,
  btn: HTMLButtonElement
): void;
declare function stopCamera(): void;
declare function isCameraRunning(): boolean;

// ── Shared state ──────────────────────────────────────────────────────────────

let lastAddress: string | null = null;   // hex pubkey address, e.g. "7214"
let txUtxos: Array<{ txid: number; value: number }> = [];
let sendUtxos: ToyUtxo[] = [];
let sendBuiltTx: BuiltSendTx | null = null;
let sendShowAllUtxos = false;
let sendUtxoAddress: string | null = null;
let activeActionTab = "receive";
const EMPTY_ADDRESS_PLACEHOLDER = "*";

// ── Helpers ───────────────────────────────────────────────────────────────────

function isDarkMode(): boolean {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

function qrColors(): { colorDark: string; colorLight: string } {
  return isDarkMode()
    ? { colorDark: "#f0ede8", colorLight: "#1e1e1c" }
    : { colorDark: "#1a1a1a", colorLight: "#ffffff" };
}

function renderQR(boxId: string, text: string | null): void {
  const box = document.getElementById(boxId) as HTMLElement | null;
  if (!box) return;
  box.innerHTML = "";
  if (!text) return;
  new QRCode(box, { text, width: 80, height: 80, ...qrColors() });
}

// ── Tab switching (generic) ───────────────────────────────────────────────────

function initTabGroup(selector: string, panelPrefix: string): void {
  const tabs   = document.querySelectorAll<HTMLButtonElement>(selector);
  const panels = document.querySelectorAll<HTMLElement>(`.tab-panel[id^="${panelPrefix}"]`);

  tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset["tab"]!;

      // Stop camera if leaving Send tab
      if (panelPrefix === "ap-" && target !== "send") stopCamera();
      if (panelPrefix === "ap-") {
        activeActionTab = target;
        updateKeyEditLock();
      }

      tabs.forEach(t   => t.classList.toggle("active", t === btn));
      panels.forEach(p => p.classList.toggle("active", p.id === `${panelPrefix}${target}`));
    });
  });
}

function updateKeyEditLock(): void {
  const locked = activeActionTab === "send";
  const keyInput = document.getElementById("keys-inp") as HTMLInputElement | null;
  const slider = document.getElementById("keys-slider") as HTMLInputElement | null;
  const loadBtn = document.getElementById("keys-load-btn") as HTMLButtonElement | null;
  const cacheStatus = document.getElementById("keys-cache-status") as HTMLElement | null;

  [keyInput, slider, loadBtn].forEach(control => {
    if (!control) return;
    control.disabled = locked;
    control.title = locked ? "Key is locked while Send is open." : "";
  });

  if (cacheStatus) {
    cacheStatus.textContent = locked ? "key locked while sending" : (hasCachedKey() ? "saved key available" : "");
  }
}

function initDevPanels(): void {
  const keysToggle = document.getElementById("keys-toggle") as HTMLButtonElement | null;
  const testsHeading = document.getElementById("dev-tests-heading") as HTMLElement | null;
  const setupPanelLinks = document.querySelectorAll<HTMLButtonElement>("[data-dev-panel]");
  const panels = document.querySelectorAll<HTMLElement>('.tab-panel[id^="dp-"]');

  const showPanel = (name: string, scroll = false): void => {
    const activePanel = document.getElementById(`dp-${name}`);
    const isTestPanel = name === "hash" || name === "transaction";
    panels.forEach(panel => panel.classList.toggle("active", panel === activePanel));
    if (keysToggle) keysToggle.classList.toggle("active", name === "keys");
    if (testsHeading) testsHeading.hidden = !isTestPanel;
    if (scroll) activePanel?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  keysToggle?.addEventListener("click", () => {
    const keysPanel = document.getElementById("dp-keys");
    const isOpen = keysPanel?.classList.contains("active") ?? false;
    if (isOpen) {
      keysPanel?.classList.remove("active");
      keysToggle.classList.remove("active");
      if (testsHeading) testsHeading.hidden = true;
    } else {
      showPanel("keys");
    }
  });

  setupPanelLinks.forEach(link => {
    link.addEventListener("click", () => {
      const panel = link.dataset["devPanel"];
      if (panel) showPanel(panel, true);
    });
  });
}

// ── Theme ─────────────────────────────────────────────────────────────────────

function initTheme(): void {
  const toggle = document.getElementById("toggle") as HTMLButtonElement | null;
  const setupToggle = document.getElementById("setup-toggle") as HTMLButtonElement | null;
  const setupPanel = document.getElementById("setup-panel") as HTMLElement | null;
  if (!toggle || !setupToggle || !setupPanel) return;
  applyTheme(localStorage.getItem("theme") ?? "light", toggle);
  setupToggle.addEventListener("click", () => {
    setupPanel.hidden = !setupPanel.hidden;
    refreshSetupPanel();
  });
  toggle.addEventListener("click", () => {
    const next = isDarkMode() ? "light" : "dark";
    applyTheme(next, toggle);
    localStorage.setItem("theme", next);
    // Re-render all QR codes with new colors
    if (lastAddress) {
      renderQR("receive-qr", lastAddress);
      renderQR("tx-qr", lastAddress);
    }
  });
}

function initSetupMnemonic(): void {
  const btn = document.getElementById("setup-mnemonic-btn") as HTMLButtonElement | null;
  const out = document.getElementById("setup-mnemonic-out") as HTMLElement | null;
  if (!btn || !out) return;

  btn.addEventListener("click", () => {
    const keyInput = document.getElementById("keys-inp") as HTMLInputElement | null;
    const currentKey = keyInput?.value.trim() ?? "";
    const keyValue = currentKey !== "" ? currentKey : loadKeyFromCache();
    if (keyValue === null || keyValue.trim() === "") {
      out.textContent = "no key";
      return;
    }

    const byteValue = Number.parseInt(keyValue.trim(), 10);
    if (!Number.isInteger(byteValue) || byteValue < 0 || byteValue > 255) {
      out.textContent = "invalid byte key";
      return;
    }

    out.textContent = obtMnemonicEncode(byteValue);
  });
}

function clearSetupMnemonic(): void {
  const out = document.getElementById("setup-mnemonic-out") as HTMLElement | null;
  if (out) out.textContent = "";
}

function applyTheme(theme: string, toggle: HTMLButtonElement): void {
  document.documentElement.setAttribute("data-theme", theme);
  toggle.textContent = theme === "dark" ? "switch to light mode" : "switch to dark mode";
}

function refreshSetupPanel(): void {
  const keyCache = document.getElementById("setup-key-cache");
  if (keyCache) keyCache.textContent = hasCachedKey() ? "available" : "none";
}

function getToy32Address(hexAddress: string | null): string {
  if (!hexAddress) return EMPTY_ADDRESS_PLACEHOLDER;
  try {
    return hexa_to_toy32(hexAddress, "a");
  } catch {
    return EMPTY_ADDRESS_PLACEHOLDER;
  }
}

// ── ADDRESS UPDATE (called whenever lastAddress changes) ──────────────────────

function onAddressChange(): void {
  // sync all address displays
  ["tx-addr", "receive-addr"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = lastAddress ?? EMPTY_ADDRESS_PLACEHOLDER;
  });
  const receiveToy32 = document.getElementById("receive-toy32-addr");
  if (receiveToy32) receiveToy32.textContent = getToy32Address(lastAddress);
  const sendFrom = document.getElementById("send-from-addr");
  if (sendFrom) sendFrom.textContent = lastAddress ?? EMPTY_ADDRESS_PLACEHOLDER;
  // QR codes
  renderQR("receive-qr", lastAddress);
  renderQR("tx-qr", lastAddress);
  if (lastAddress) {
    clearMissingKeyStatuses();
  } else {
    resetWalletOutputsForNoKey();
  }
  if (sendUtxoAddress && sendUtxoAddress !== lastAddress) clearSendUtxoSelection();
}

function clearMissingKeyStatuses(): void {
  ["send-status", "receive-status", "tx-status"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (
      el.textContent?.includes("No key computed") ||
      el.textContent?.includes("No sender key computed")
    ) {
      el.textContent = "";
      el.className = "tx-status";
    }
  });
}

function resetWalletOutputsForNoKey(): void {
  ["send-status", "receive-status", "tx-status"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = "No key computed - go to Keys tab first.";
      el.className = "tx-status error";
    }
  });

  ["send-balance", "receive-balance", "tx-balance", "send-sign-result", "tx-sign-result"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });

  ["send-utxo-wrap", "tx-table-wrap"].forEach(id => {
    const el = document.getElementById(id) as HTMLElement | null;
    if (el) el.style.display = "none";
  });

  ["send-utxo-tbody", "tx-tbody"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });

  const sendBtn = document.getElementById("send-broadcast-btn") as HTMLButtonElement | null;
  if (sendBtn) sendBtn.disabled = true;

  txUtxos = [];
  sendUtxos = [];
  sendBuiltTx = null;
  sendUtxoAddress = null;
}

// ══════════════════════════════════════════════════════════════════════════════
// ACTION PANEL: SEND
// ══════════════════════════════════════════════════════════════════════════════

function clearSendUtxoSelection(): void {
  const balEl = document.getElementById("send-balance") as HTMLElement | null;
  const wrap = document.getElementById("send-utxo-wrap") as HTMLElement | null;
  const tbody = document.getElementById("send-utxo-tbody") as HTMLElement | null;
  const resultEl = document.getElementById("send-sign-result") as HTMLElement | null;
  const sendBtn = document.getElementById("send-broadcast-btn") as HTMLButtonElement | null;
  const showCount = document.getElementById("send-utxo-count") as HTMLElement | null;

  if (balEl) balEl.innerHTML = "";
  if (wrap) wrap.style.display = "none";
  if (tbody) tbody.innerHTML = "";
  if (resultEl) resultEl.innerHTML = "";
  if (sendBtn) sendBtn.disabled = true;
  if (showCount) showCount.textContent = "";

  sendUtxos = [];
  sendBuiltTx = null;
  sendUtxoAddress = null;
}

function initSend(): void {
  const qrBtn  = document.getElementById("send-qr-btn")  as HTMLButtonElement | null;
  const video  = document.getElementById("send-video")   as HTMLVideoElement  | null;
  const addrIn = document.getElementById("send-addr-in") as HTMLInputElement  | null;
  const utxoBtn = document.getElementById("send-utxo-btn") as HTMLButtonElement | null;
  const buildBtn = document.getElementById("send-build-btn") as HTMLButtonElement | null;
  const sendBtn = document.getElementById("send-broadcast-btn") as HTMLButtonElement | null;
  const showAllToggle = document.getElementById("send-show-all-utxos") as HTMLInputElement | null;
  const presets = document.querySelectorAll<HTMLButtonElement>("[data-send-recipient]");

  if (!qrBtn || !video || !addrIn || !utxoBtn || !buildBtn || !sendBtn || !showAllToggle) return;

  qrBtn.addEventListener("click", () => {
    if (isCameraRunning()) { stopCamera(); return; }
    startCamera(video, addrIn, qrBtn);
  });
  utxoBtn.addEventListener("click", fetchSendUtxos);
  buildBtn.addEventListener("click", buildSendTransaction);
  sendBtn.addEventListener("click", broadcastSendTransaction);
  showAllToggle.addEventListener("input", () => {
    sendShowAllUtxos = showAllToggle.checked;
    renderSendUtxos();
  });
  presets.forEach(btn => {
    btn.addEventListener("click", () => {
      addrIn.value = btn.dataset["sendRecipient"] ?? "";
      addrIn.focus();
    });
  });
}

async function fetchSendUtxos(): Promise<void> {
  const statusEl = document.getElementById("send-status") as HTMLElement | null;
  const balEl = document.getElementById("send-balance") as HTMLElement | null;
  const wrap = document.getElementById("send-utxo-wrap") as HTMLElement | null;
  const tbody = document.getElementById("send-utxo-tbody") as HTMLElement | null;
  const resultEl = document.getElementById("send-sign-result") as HTMLElement | null;
  const sendBtn = document.getElementById("send-broadcast-btn") as HTMLButtonElement | null;
  const showAllToggle = document.getElementById("send-show-all-utxos") as HTMLInputElement | null;
  const showCount = document.getElementById("send-utxo-count") as HTMLElement | null;

  if (!statusEl || !balEl || !wrap || !tbody || !resultEl || !sendBtn || !showAllToggle || !showCount) return;

  statusEl.textContent = "";
  statusEl.className = "tx-status";
  balEl.innerHTML = "";
  wrap.style.display = "none";
  tbody.innerHTML = "";
  showCount.textContent = "";
  showAllToggle.checked = false;
  sendShowAllUtxos = false;
  resultEl.innerHTML = "";
  sendBtn.disabled = true;
  sendUtxos = [];
  sendBuiltTx = null;
  sendUtxoAddress = null;

  if (!lastAddress) {
    resetWalletOutputsForNoKey();
    return;
  }

  const requestedAddress = lastAddress;
  statusEl.textContent = "Fetching UTXOs...";

  try {
    const data = await apiFetch(requestedAddress);
    if (requestedAddress !== lastAddress) {
      showTxError(statusEl, "Key changed while loading UTXOs. Load them again.");
      return;
    }
    if (data.status !== "ok") throw new Error(`API: ${data.status}`);
    renderBalanceSummary(balEl, data.balance, data.utxo_count);

    sendUtxos = data.unspent_outputs;
    sendUtxoAddress = requestedAddress;
    if (sendUtxos.length === 0) {
      showTxError(statusEl, "No available UTXOs.");
      return;
    }

    renderSendUtxos();
    wrap.style.display = "block";
    statusEl.textContent = `Loaded ${sendUtxos.length} UTXO(s).`;
  } catch (err) {
    showTxError(statusEl, `Error: ${String(err)}`);
  }
}

function renderSendUtxos(selectedTxid?: number): void {
  const tbody = document.getElementById("send-utxo-tbody") as HTMLElement | null;
  const showCount = document.getElementById("send-utxo-count") as HTMLElement | null;
  const resultEl = document.getElementById("send-sign-result") as HTMLElement | null;
  const sendBtn = document.getElementById("send-broadcast-btn") as HTMLButtonElement | null;
  const valueIn = document.getElementById("send-value-in") as HTMLInputElement | null;

  if (!tbody || !showCount) return;

  const visible = sendShowAllUtxos ? sendUtxos : sendUtxos.slice(0, 5);
  const selectedIndex = selectedTxid !== undefined
    ? visible.findIndex(u => u.txid === selectedTxid)
    : 0;
  const checkedIndex = selectedIndex >= 0 ? selectedIndex : 0;

  tbody.innerHTML = visible
    .map((u, i) =>
      `<tr>` +
      `<td><input type="radio" name="send-utxo" value="${i}" ${i === checkedIndex ? "checked" : ""}></td>` +
      `<td>${u.txid}</td><td>${u.value}</td>` +
      `</tr>`
    ).join("");
  bindUtxoRowSelection(tbody, "send-utxo", () => {
    updateSendValueFromSelectedUtxo(valueIn);
    if (resultEl) resultEl.innerHTML = "";
    if (sendBtn) sendBtn.disabled = true;
    sendBuiltTx = null;
  });
  updateSendValueFromSelectedUtxo(valueIn);

  showCount.textContent = sendShowAllUtxos
    ? `showing all ${sendUtxos.length}`
    : `showing ${Math.min(5, sendUtxos.length)} of ${sendUtxos.length}`;

  if (resultEl) resultEl.innerHTML = "";
  if (sendBtn) sendBtn.disabled = true;
  sendBuiltTx = null;
}

function updateSendValueFromSelectedUtxo(valueIn: HTMLInputElement | null): void {
  if (!valueIn) return;
  const selected = document.querySelector<HTMLInputElement>("input[name='send-utxo']:checked");
  if (!selected) return;
  const utxo = sendUtxos[parseInt(selected.value, 10)];
  if (utxo?.value === 1) valueIn.value = "1";
}

function buildSendTransaction(): void {
  const statusEl = document.getElementById("send-status") as HTMLElement | null;
  const recipientIn = document.getElementById("send-addr-in") as HTMLInputElement | null;
  const valueIn = document.getElementById("send-value-in") as HTMLInputElement | null;
  const resultEl = document.getElementById("send-sign-result") as HTMLElement | null;
  const keyIn = document.getElementById("keys-inp") as HTMLInputElement | null;
  const sendBtn = document.getElementById("send-broadcast-btn") as HTMLButtonElement | null;
  const selected = document.querySelector<HTMLInputElement>("input[name='send-utxo']:checked");

  if (!statusEl || !recipientIn || !valueIn || !resultEl || !keyIn || !sendBtn) return;

  resultEl.innerHTML = "";
  sendBtn.disabled = true;
  sendBuiltTx = null;
  statusEl.textContent = "";
  statusEl.className = "tx-status";

  if (!lastAddress) {
    showTxError(statusEl, "No sender key computed - go to Keys tab first.");
    return;
  }
  if (!sendUtxoAddress || sendUtxoAddress !== lastAddress) {
    showTxError(statusEl, "Loaded UTXOs do not match the current key. Load UTXOs again.");
    return;
  }

  const privateKey = parseInt(keyIn.value.trim(), 10);
  if (!Number.isFinite(privateKey) || privateKey <= 0) {
    showTxError(statusEl, "Invalid private key.");
    return;
  }

  if (!selected) {
    showTxError(statusEl, "Select one UTXO first.");
    return;
  }

  const utxo = sendUtxos[parseInt(selected.value, 10)];
  if (!utxo) {
    showTxError(statusEl, "Selected UTXO was not found.");
    return;
  }

  const recipient = recipientIn.value.trim().toLowerCase();
  if (!/^[0-9a-f]{4}$/.test(recipient)) {
    showTxError(statusEl, "Recipient must be a 4-character hex address.");
    return;
  }

  const amount = parseInt(valueIn.value.trim(), 10);
  if (!Number.isFinite(amount) || amount <= 0) {
    showTxError(statusEl, "Value must be a positive integer.");
    return;
  }

  if (amount > utxo.value) {
    showTxError(statusEl, `UTXO value is only ${utxo.value}.`);
    return;
  }

  const senderPoint = scalar_mult(privateKey, ECC_PARAMS.G);
  if (!senderPoint) {
    showTxError(statusEl, "Sender public key is point at infinity.");
    return;
  }

  const sender = pubkey_to_addr(senderPoint);
  if (sender !== sendUtxoAddress) {
    showTxError(statusEl, "Selected UTXO belongs to a different key. Load UTXOs again.");
    return;
  }
  const message = `${sender}|${utxo.txid}|${recipient}|${amount}`;
  const hashRaw = ASH24(message);
  const hashHex = hex24(hashRaw);
  const signature = signToy(privateKey, hashRaw);
  const signatureHex = sig_to_hexa(signature);
  sendBuiltTx = {
    from: sender,
    to: recipient,
    val1: utxo.value,
    val2: amount,
    sig_hex: signatureHex,
    utxo_txid: utxo.txid
  };

  resultEl.innerHTML =
    `<div class="tx-sign-box send-sign-box">` +
      `<pre>` +
      `tx: ${escapeHtml(message)}\n\n` +
      `hash_hex: ${hashHex}\n` +
      `signature: {${signature.r}, ${signature.s}}  ${signatureHex}` +
      `</pre>` +
    `</div>`;
  sendBtn.disabled = false;
  statusEl.textContent = "Transaction built and signed.";
}

async function broadcastSendTransaction(): Promise<void> {
  const statusEl = document.getElementById("send-status") as HTMLElement | null;
  const sendBtn = document.getElementById("send-broadcast-btn") as HTMLButtonElement | null;

  if (!statusEl || !sendBtn) return;

  if (!sendBuiltTx) {
    showTxError(statusEl, "Build and sign the transaction first.");
    return;
  }

  sendBtn.disabled = true;
  statusEl.textContent = "Sending transaction...";
  statusEl.className = "tx-status";

  try {
    const response = await postSendTransaction({
      from: sendBuiltTx.from,
      to: sendBuiltTx.to,
      val1: sendBuiltTx.val1,
      val2: sendBuiltTx.val2,
      sig_hex: sendBuiltTx.sig_hex,
      utxo_txid: sendBuiltTx.utxo_txid
    });

    const statusText = response.status === "ok"
      ? `${response.message}. TXID: ${response.txid}`
      : `Error: ${response.message ?? response.msg ?? "Unknown API response"}`;
    const statusHtml = response.status === "ok"
      ? `${escapeHtml(response.message ?? "Transaction broadcasted successfully.")}<br />` +
        `TXID: ${escapeHtml(String(response.txid ?? ""))} | ` +
        `<a href="https://www.agamapoint.com/bbr/mempool.php?filter=mempool&page=1">obt_mempool</a>`
      : "";
    if (response.status === "ok") {
      statusEl.innerHTML = statusHtml;
      statusEl.className = "tx-status ok";
    } else {
      statusEl.textContent = statusText;
      statusEl.className = "tx-status error";
    }
    if (response.status === "ok") {
      sendBuiltTx = null;
      sendBtn.disabled = true;
      await refreshWalletAfterSend();
      statusEl.innerHTML = statusHtml;
      statusEl.className = "tx-status ok";
    } else {
      sendBtn.disabled = false;
    }
  } catch (err) {
    sendBtn.disabled = false;
    showTxError(statusEl, `Error: ${String(err)}`);
  }
}

async function refreshWalletAfterSend(): Promise<void> {
  await fetchSendUtxos();
  await fetchReceiveBalance();
}

function initReceive(): void {
  const btn = document.getElementById("receive-get-btn") as HTMLButtonElement | null;
  if (!btn) return;

  btn.addEventListener("click", fetchReceiveBalance);
}

async function fetchReceiveBalance(): Promise<void> {
  const statusEl = document.getElementById("receive-status") as HTMLElement | null;
  const balEl = document.getElementById("receive-balance") as HTMLElement | null;

  if (!statusEl || !balEl) return;

  if (!lastAddress) {
    resetWalletOutputsForNoKey();
    return;
  }

  statusEl.textContent = "Fetching...";
  statusEl.className = "tx-status";
  balEl.innerHTML = "";

  try {
    const data = await apiFetch(lastAddress);
    if (data.status !== "ok") throw new Error(`API: ${data.status}`);
    statusEl.textContent = "";
    renderBalanceSummary(balEl, data.balance, data.utxo_count);
  } catch (err) {
    showTxError(statusEl, `Error: ${String(err)}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ACTION PANEL: BALANCE
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// SHARED: fetch balance + render
// ══════════════════════════════════════════════════════════════════════════════

async function fetchBalance(
  addrId: string,
  statusId: string,
  balBlockId: string,
  tbodyId: string,
  tableWrapId: string
): Promise<void> {
  const statusEl   = document.getElementById(statusId)   as HTMLElement | null;
  const balEl      = document.getElementById(balBlockId) as HTMLElement | null;
  const tbody      = document.getElementById(tbodyId)    as HTMLElement | null;
  const tableWrap  = document.getElementById(tableWrapId)as HTMLElement | null;

  if (!statusEl || !balEl || !tbody || !tableWrap) return;

  if (!lastAddress) {
    resetWalletOutputsForNoKey();
    return;
  }

  statusEl.textContent = "Fetching...";
  statusEl.className = "tx-status";
  balEl.textContent = "";
  tbody.innerHTML = "";
  tableWrap.style.display = "none";
  if (tbodyId === "tx-tbody") {
    txUtxos = [];
    const resultEl = document.getElementById("tx-sign-result");
    if (resultEl) resultEl.innerHTML = "";
  }

  try {
    const data = await apiFetch(lastAddress);
    if (data.status !== "ok") throw new Error(`API: ${data.status}`);
    statusEl.textContent = "";
    renderBalanceSummary(balEl, data.balance, data.utxo_count);
    if (tbodyId === "tx-tbody") {
      txUtxos = data.unspent_outputs.slice(0, 5);
      tbody.innerHTML = txUtxos
        .map((u, i) =>
          `<tr>` +
          `<td><input type="radio" name="tx-utxo" value="${u.txid}" ${i === 0 ? "checked" : ""}></td>` +
          `<td>${u.txid}</td><td>${u.value}</td>` +
          `</tr>`
        ).join("");
      bindUtxoRowSelection(tbody, "tx-utxo", () => {
        const resultEl = document.getElementById("tx-sign-result");
        if (resultEl) resultEl.innerHTML = "";
      });
    } else {
      tbody.innerHTML = data.unspent_outputs.slice(0, 5)
        .map(u => `<tr><td>${u.txid}</td><td>${u.value}</td></tr>`).join("");
    }
    tableWrap.style.display = "block";
  } catch (err) {
    statusEl.textContent = `Error: ${String(err)}`;
    statusEl.className = "tx-status error";
  }
}

function renderBalanceSummary(el: HTMLElement, balance: number, utxoCount: number): void {
  el.innerHTML =
    `<span class="tx-label">balance</span>` +
    `<span class="tx-big">${balance}</span>` +
    `<span class="tx-sub">in ${utxoCount} UTXOs</span>`;
}

function bindUtxoRowSelection(tbody: HTMLElement, radioName: string, onChange?: () => void): void {
  tbody.querySelectorAll<HTMLTableRowElement>("tr").forEach(row => {
    const radio = row.querySelector<HTMLInputElement>(`input[name='${radioName}']`);
    radio?.addEventListener("change", () => onChange?.());
    row.addEventListener("click", () => {
      if (!radio || radio.checked) return;
      radio.click();
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// DEV TAB: KEYS
// ══════════════════════════════════════════════════════════════════════════════

function initKeys(): void {
  const inp   = document.getElementById("keys-inp")   as HTMLInputElement | null;
  const slider = document.getElementById("keys-slider") as HTMLInputElement | null;
  const outPt = document.getElementById("keys-point") as HTMLElement | null;
  const outHx = document.getElementById("keys-hex")   as HTMLElement | null;
  const saveBtn = document.getElementById("keys-save-btn") as HTMLButtonElement | null;
  const loadBtn = document.getElementById("keys-load-btn") as HTMLButtonElement | null;
  const clearBtn = document.getElementById("keys-clear-btn") as HTMLButtonElement | null;
  const cacheStatus = document.getElementById("keys-cache-status") as HTMLElement | null;

  if (!inp || !outPt || !outHx) return;

  saveBtn?.addEventListener("click", () => {
    const value = inp.value.trim();
    if (!value) {
      setKeyCacheStatus(cacheStatus, "nothing to save");
      return;
    }
    saveKeyToCache(value);
    setKeyCacheStatus(cacheStatus, "saved in browser");
    refreshSetupPanel();
  });

  loadBtn?.addEventListener("click", () => {
    const value = loadKeyFromCache();
    if (value === null) {
      setKeyCacheStatus(cacheStatus, "no saved key");
      return;
    }
    inp.value = value;
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    setKeyCacheStatus(cacheStatus, "loaded");
  });

  clearBtn?.addEventListener("click", () => {
    clearKeyCache();
    setKeyCacheStatus(cacheStatus, "cache cleared");
    refreshSetupPanel();
  });

  setKeyCacheStatus(cacheStatus, hasCachedKey() ? "saved key available" : "");
  refreshSetupPanel();

  slider?.addEventListener("input", () => {
    clearSetupMnemonic();
    inp.value = slider.value;
    inp.dispatchEvent(new Event("input", { bubbles: true }));
  });

  inp.addEventListener("input", () => {
    clearSetupMnemonic();
    const raw = inp.value.trim();

    if (raw === "") {
      outPt.textContent = "*"; outPt.className = "result-value placeholder";
      outHx.textContent = "";
      lastAddress = null; onAddressChange(); return;
    }

    const k = parseInt(raw, 10);
    if (isNaN(k)) {
      outPt.textContent = "invalid scalar"; outPt.className = "result-value error";
      outHx.textContent = "";
      lastAddress = null; onAddressChange(); return;
    }
    if (slider && k >= 1 && k <= 251) slider.value = String(k);
    if (k === 0) {
      outPt.textContent = "INF"; outPt.className = "result-value";
      outHx.textContent = "";
      lastAddress = null; onAddressChange(); return;
    }

    const point = scalar_mult(k, ECC_PARAMS.G);
    if (point === null) {
      outPt.textContent = "INF (point at infinity)"; outPt.className = "result-value";
      outHx.textContent = "";
      lastAddress = null;
    } else {
      const hex = pubkey_to_addr(point);
      outPt.textContent = `[${point[0]}, ${point[1]}]`;
      outHx.textContent = hex;
      outPt.className = "result-value";
      lastAddress = hex;
    }
    onAddressChange();
  });
}

function setKeyCacheStatus(el: HTMLElement | null, text: string): void {
  if (el) el.textContent = text;
}

// ══════════════════════════════════════════════════════════════════════════════
// DEV TAB: HASH
// ══════════════════════════════════════════════════════════════════════════════

function initHash(): void {
  const inp = document.getElementById("hash-inp") as HTMLInputElement | null;
  const out = document.getElementById("hash-out") as HTMLElement | null;
  if (!inp || !out) return;

  inp.addEventListener("input", () => {
    const raw = inp.value;
    if (raw === "") {
      out.textContent = "*"; out.className = "result-value placeholder"; return;
    }
    out.textContent = `RAW: [${ASH24(raw)}]  |  HEX: ${hex24(ASH24(raw))}`;
    out.className = "result-value hash-result";
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// DEV TAB: TRANSACTION
// ══════════════════════════════════════════════════════════════════════════════

function initTransaction(): void {
  const btn = document.getElementById("tx-get-btn") as HTMLButtonElement | null;
  const buildBtn = document.getElementById("tx-build-btn") as HTMLButtonElement | null;
  if (!btn || !buildBtn) return;
  btn.addEventListener("click", () => fetchBalance(
    "tx-addr", "tx-status", "tx-balance", "tx-tbody", "tx-table-wrap"
  ));
  buildBtn.addEventListener("click", buildAndSignTransaction);
}

function buildAndSignTransaction(): void {
  const statusEl = document.getElementById("tx-status") as HTMLElement | null;
  const recipientIn = document.getElementById("tx-recipient-in") as HTMLInputElement | null;
  const valueIn = document.getElementById("tx-value-in") as HTMLInputElement | null;
  const resultEl = document.getElementById("tx-sign-result") as HTMLElement | null;
  const keyIn = document.getElementById("keys-inp") as HTMLInputElement | null;
  const selected = document.querySelector<HTMLInputElement>("input[name='tx-utxo']:checked");

  if (!statusEl || !recipientIn || !valueIn || !resultEl || !keyIn) return;

  resultEl.innerHTML = "";
  statusEl.textContent = "";
  statusEl.className = "tx-status";

  if (!lastAddress) {
    showTxError(statusEl, "No sender key computed - go to Keys tab first.");
    return;
  }

  const privateKey = parseInt(keyIn.value.trim(), 10);
  if (!Number.isFinite(privateKey) || privateKey <= 0) {
    showTxError(statusEl, "Invalid private key.");
    return;
  }

  if (!selected) {
    showTxError(statusEl, "Select one UTXO first.");
    return;
  }

  const utxo = txUtxos.find(u => String(u.txid) === selected.value);
  if (!utxo) {
    showTxError(statusEl, "Selected UTXO was not found.");
    return;
  }

  const recipient = recipientIn.value.trim().toLowerCase();
  if (!/^[0-9a-f]{4}$/.test(recipient)) {
    showTxError(statusEl, "Recipient must be a 4-character hex address.");
    return;
  }

  const amount = parseInt(valueIn.value.trim(), 10);
  if (!Number.isFinite(amount) || amount <= 0) {
    showTxError(statusEl, "Value must be a positive integer.");
    return;
  }

  if (amount > utxo.value) {
    showTxError(statusEl, "Value is greater than the selected UTXO.");
    return;
  }

  const senderPoint = scalar_mult(privateKey, ECC_PARAMS.G);
  if (!senderPoint) {
    showTxError(statusEl, "Sender public key is point at infinity.");
    return;
  }

  const sender = pubkey_to_addr(senderPoint);
  const message = `${sender}|${utxo.txid}|${recipient}|${amount}`;
  const hashRaw = ASH24(message);
  const hashHex = hex24(hashRaw);
  const signature = signToy(privateKey, hashRaw);
  const signatureHex = sig_to_hexa(signature);
  const e = positiveMod(hashRaw, ECC_PARAMS.n);
  const left = scalar_mult(signature.s, ECC_PARAMS.G);
  const ePub = scalar_mult(e, senderPoint);
  const right = point_adding(signature.R_point, ePub);
  const valid = samePoint(left, right);
  const change = utxo.value - amount;

  resultEl.innerHTML =
    `<div class="tx-sign-box">` +
      `<p class="label">Transaction</p>` +
      `<pre>${escapeHtml(message)}</pre>` +
      `<p class="label">scriptPubKey (Lock recipient UTXO)</p>` +
      `<pre>{pub:${escapeHtml(recipient)},op:OP_CHECKSIG}</pre>` +
      `<p class="label">scriptSig (Unlock sender UTXO)</p>` +
      `<pre>{sig:${escapeHtml(signatureHex)}}</pre>` +
      `<p class="label">Balance</p>` +
      `<pre>In -> ${utxo.value} | Out -> ${amount}\nChange -> ${change}</pre>` +
      `<p class="label">Hash</p>` +
      `<pre>hash_raw: ${hashRaw}\nhash_hex: ${hashHex}</pre>` +
      `<p class="label">Signature</p>` +
      `<pre>PubKey: ${sender} -> ${formatPoint(senderPoint)}\n(r,s): {${signature.r}, ${signature.s}}  ${signatureHex}\nR (Nonce_point): ${formatPoint(signature.R_point)}</pre>` +
      `<p class="label">Verify</p>` +
      `<pre>e = hash mod n = ${e}\nLEFT = s * G = ${formatPoint(left)}\nRIGHT = R + e * PubKey = ${formatPoint(right)}\ne * PubKey = ${formatPoint(ePub)}\nvalid = ${valid}</pre>` +
    `</div>`;
}

function showTxError(statusEl: HTMLElement, message: string): void {
  statusEl.textContent = message;
  statusEl.className = "tx-status error";
}

function positiveMod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function samePoint(a: [number, number] | null, b: [number, number] | null): boolean {
  if (a === null || b === null) return a === b;
  return a[0] === b[0] && a[1] === b[1];
}

function formatPoint(point: [number, number] | null): string {
  return point ? `[${point[0]}, ${point[1]}]` : "INF";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ══════════════════════════════════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initSetupMnemonic();
  initTabGroup(".action-tab-btn", "ap-");
  initDevPanels();
  initKeys();
  initHash();
  initTransaction();
  initSend();
  initReceive();
  updateKeyEditLock();

  const info = document.getElementById("curve-info");
  if (info) {
    const { p, a, b, G, n } = ECC_PARAMS;
    info.textContent = `y^2 = x^3 + ${a}x + ${b} (mod ${p}) | G=[${G}] | n=${n}`;
  }

  if (!lastAddress) resetWalletOutputsForNoKey();
});
