"use strict";
// ts_obt_wallet.ts â€“ ECC251 toy wallet
// Structure: action tabs (Receive | Send | About) + dev tabs (Keys | Hash | Transaction)
// â”€â”€ Shared state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let lastAddress = null; // hex pubkey address, e.g. "7214"
let txUtxos = [];
let sendUtxos = [];
let sendBuiltTx = null;
let sendShowAllUtxos = false;
const EMPTY_ADDRESS_PLACEHOLDER = "*";
// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function isDarkMode() {
    return document.documentElement.getAttribute("data-theme") === "dark";
}
function qrColors() {
    return isDarkMode()
        ? { colorDark: "#f0ede8", colorLight: "#1e1e1c" }
        : { colorDark: "#1a1a1a", colorLight: "#ffffff" };
}
function renderQR(boxId, text) {
    const box = document.getElementById(boxId);
    if (!box)
        return;
    box.innerHTML = "";
    if (!text)
        return;
    new QRCode(box, Object.assign({ text, width: 80, height: 80 }, qrColors()));
}
// â”€â”€ Tab switching (generic) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function initTabGroup(selector, panelPrefix) {
    const tabs = document.querySelectorAll(selector);
    const panels = document.querySelectorAll(`.tab-panel[id^="${panelPrefix}"]`);
    tabs.forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.dataset["tab"];
            // Stop camera if leaving Send tab
            if (panelPrefix === "ap-" && target !== "send")
                stopCamera();
            tabs.forEach(t => t.classList.toggle("active", t === btn));
            panels.forEach(p => p.classList.toggle("active", p.id === `${panelPrefix}${target}`));
        });
    });
}
function initDevPanels() {
    const keysToggle = document.getElementById("keys-toggle");
    const testsHeading = document.getElementById("dev-tests-heading");
    const setupPanelLinks = document.querySelectorAll("[data-dev-panel]");
    const panels = document.querySelectorAll('.tab-panel[id^="dp-"]');
    const showPanel = (name, scroll = false) => {
        const activePanel = document.getElementById(`dp-${name}`);
        const isTestPanel = name === "hash" || name === "transaction";
        panels.forEach(panel => panel.classList.toggle("active", panel === activePanel));
        if (keysToggle)
            keysToggle.classList.toggle("active", name === "keys");
        if (testsHeading)
            testsHeading.hidden = !isTestPanel;
        if (scroll)
            activePanel === null || activePanel === void 0 ? void 0 : activePanel.scrollIntoView({ block: "start", behavior: "smooth" });
    };
    keysToggle === null || keysToggle === void 0 ? void 0 : keysToggle.addEventListener("click", () => {
        var _a;
        const keysPanel = document.getElementById("dp-keys");
        const isOpen = (_a = keysPanel === null || keysPanel === void 0 ? void 0 : keysPanel.classList.contains("active")) !== null && _a !== void 0 ? _a : false;
        if (isOpen) {
            keysPanel === null || keysPanel === void 0 ? void 0 : keysPanel.classList.remove("active");
            keysToggle.classList.remove("active");
            if (testsHeading)
                testsHeading.hidden = true;
        }
        else {
            showPanel("keys");
        }
    });
    setupPanelLinks.forEach(link => {
        link.addEventListener("click", () => {
            const panel = link.dataset["devPanel"];
            if (panel)
                showPanel(panel, true);
        });
    });
}
// â”€â”€ Theme â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function initTheme() {
    var _a;
    const toggle = document.getElementById("toggle");
    const setupToggle = document.getElementById("setup-toggle");
    const setupPanel = document.getElementById("setup-panel");
    if (!toggle || !setupToggle || !setupPanel)
        return;
    applyTheme((_a = localStorage.getItem("theme")) !== null && _a !== void 0 ? _a : "light", toggle);
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
function applyTheme(theme, toggle) {
    document.documentElement.setAttribute("data-theme", theme);
    toggle.textContent = theme === "dark" ? "switch to light mode" : "switch to dark mode";
}
function refreshSetupPanel() {
    const keyCache = document.getElementById("setup-key-cache");
    if (keyCache)
        keyCache.textContent = hasCachedKey() ? "available" : "none";
}
// â”€â”€ ADDRESS UPDATE (called whenever lastAddress changes) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function onAddressChange() {
    // sync all address displays
    ["tx-addr", "receive-addr"].forEach(id => {
        const el = document.getElementById(id);
        if (el)
            el.textContent = lastAddress !== null && lastAddress !== void 0 ? lastAddress : EMPTY_ADDRESS_PLACEHOLDER;
    });
    const sendFrom = document.getElementById("send-from-addr");
    if (sendFrom)
        sendFrom.textContent = lastAddress !== null && lastAddress !== void 0 ? lastAddress : EMPTY_ADDRESS_PLACEHOLDER;
    // QR codes
    renderQR("receive-qr", lastAddress);
    renderQR("tx-qr", lastAddress);
    if (lastAddress) {
        clearMissingKeyStatuses();
    }
    else {
        resetWalletOutputsForNoKey();
    }
}
function clearMissingKeyStatuses() {
    ["send-status", "receive-status", "tx-status"].forEach(id => {
        var _a, _b;
        const el = document.getElementById(id);
        if (!el)
            return;
        if (((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.includes("No key computed")) ||
            ((_b = el.textContent) === null || _b === void 0 ? void 0 : _b.includes("No sender key computed"))) {
            el.textContent = "";
            el.className = "tx-status";
        }
    });
}
function resetWalletOutputsForNoKey() {
    ["send-status", "receive-status", "tx-status"].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = "No key computed - go to Keys tab first.";
            el.className = "tx-status error";
        }
    });
    ["send-balance", "receive-balance", "tx-balance", "send-sign-result", "tx-sign-result"].forEach(id => {
        const el = document.getElementById(id);
        if (el)
            el.innerHTML = "";
    });
    ["send-utxo-wrap", "tx-table-wrap"].forEach(id => {
        const el = document.getElementById(id);
        if (el)
            el.style.display = "none";
    });
    ["send-utxo-tbody", "tx-tbody"].forEach(id => {
        const el = document.getElementById(id);
        if (el)
            el.innerHTML = "";
    });
    const sendBtn = document.getElementById("send-broadcast-btn");
    if (sendBtn)
        sendBtn.disabled = true;
    txUtxos = [];
    sendUtxos = [];
    sendBuiltTx = null;
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ACTION PANEL: SEND
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function initSend() {
    const qrBtn = document.getElementById("send-qr-btn");
    const video = document.getElementById("send-video");
    const addrIn = document.getElementById("send-addr-in");
    const utxoBtn = document.getElementById("send-utxo-btn");
    const buildBtn = document.getElementById("send-build-btn");
    const sendBtn = document.getElementById("send-broadcast-btn");
    const showAllToggle = document.getElementById("send-show-all-utxos");
    const presets = document.querySelectorAll("[data-send-recipient]");
    if (!qrBtn || !video || !addrIn || !utxoBtn || !buildBtn || !sendBtn || !showAllToggle)
        return;
    qrBtn.addEventListener("click", () => {
        if (isCameraRunning()) {
            stopCamera();
            return;
        }
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
            var _a;
            addrIn.value = (_a = btn.dataset["sendRecipient"]) !== null && _a !== void 0 ? _a : "";
            addrIn.focus();
        });
    });
}
async function fetchSendUtxos() {
    const statusEl = document.getElementById("send-status");
    const balEl = document.getElementById("send-balance");
    const wrap = document.getElementById("send-utxo-wrap");
    const tbody = document.getElementById("send-utxo-tbody");
    const resultEl = document.getElementById("send-sign-result");
    const sendBtn = document.getElementById("send-broadcast-btn");
    const showAllToggle = document.getElementById("send-show-all-utxos");
    const showCount = document.getElementById("send-utxo-count");
    if (!statusEl || !balEl || !wrap || !tbody || !resultEl || !sendBtn || !showAllToggle || !showCount)
        return;
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
    if (!lastAddress) {
        resetWalletOutputsForNoKey();
        return;
    }
    statusEl.textContent = "Fetching UTXOs...";
    try {
        const data = await apiFetch(lastAddress);
        if (data.status !== "ok")
            throw new Error(`API: ${data.status}`);
        renderBalanceSummary(balEl, data.balance, data.utxo_count);
        sendUtxos = data.unspent_outputs;
        if (sendUtxos.length === 0) {
            showTxError(statusEl, "No available UTXOs.");
            return;
        }
        renderSendUtxos();
        wrap.style.display = "block";
        statusEl.textContent = `Loaded ${sendUtxos.length} UTXO(s).`;
    }
    catch (err) {
        showTxError(statusEl, `Error: ${String(err)}`);
    }
}
function renderSendUtxos(selectedTxid) {
    const tbody = document.getElementById("send-utxo-tbody");
    const showCount = document.getElementById("send-utxo-count");
    const resultEl = document.getElementById("send-sign-result");
    const sendBtn = document.getElementById("send-broadcast-btn");
    const valueIn = document.getElementById("send-value-in");
    if (!tbody || !showCount)
        return;
    const visible = sendShowAllUtxos ? sendUtxos : sendUtxos.slice(0, 5);
    const selectedIndex = selectedTxid !== undefined
        ? visible.findIndex(u => u.txid === selectedTxid)
        : 0;
    const checkedIndex = selectedIndex >= 0 ? selectedIndex : 0;
    tbody.innerHTML = visible
        .map((u, i) => `<tr>` +
        `<td><input type="radio" name="send-utxo" value="${i}" ${i === checkedIndex ? "checked" : ""}></td>` +
        `<td>${u.txid}</td><td>${u.value}</td>` +
        `</tr>`).join("");
    bindUtxoRowSelection(tbody, "send-utxo", () => {
        updateSendValueFromSelectedUtxo(valueIn);
        if (resultEl)
            resultEl.innerHTML = "";
        if (sendBtn)
            sendBtn.disabled = true;
        sendBuiltTx = null;
    });
    updateSendValueFromSelectedUtxo(valueIn);
    showCount.textContent = sendShowAllUtxos
        ? `showing all ${sendUtxos.length}`
        : `showing ${Math.min(5, sendUtxos.length)} of ${sendUtxos.length}`;
    if (resultEl)
        resultEl.innerHTML = "";
    if (sendBtn)
        sendBtn.disabled = true;
    sendBuiltTx = null;
}
function updateSendValueFromSelectedUtxo(valueIn) {
    if (!valueIn)
        return;
    const selected = document.querySelector("input[name='send-utxo']:checked");
    if (!selected)
        return;
    const utxo = sendUtxos[parseInt(selected.value, 10)];
    if ((utxo === null || utxo === void 0 ? void 0 : utxo.value) === 1)
        valueIn.value = "1";
}
function buildSendTransaction() {
    const statusEl = document.getElementById("send-status");
    const recipientIn = document.getElementById("send-addr-in");
    const valueIn = document.getElementById("send-value-in");
    const resultEl = document.getElementById("send-sign-result");
    const keyIn = document.getElementById("keys-inp");
    const sendBtn = document.getElementById("send-broadcast-btn");
    const selected = document.querySelector("input[name='send-utxo']:checked");
    if (!statusEl || !recipientIn || !valueIn || !resultEl || !keyIn || !sendBtn)
        return;
    resultEl.innerHTML = "";
    sendBtn.disabled = true;
    sendBuiltTx = null;
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
async function broadcastSendTransaction() {
    var _a, _b, _c, _d;
    const statusEl = document.getElementById("send-status");
    const sendBtn = document.getElementById("send-broadcast-btn");
    if (!statusEl || !sendBtn)
        return;
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
            : `Error: ${(_b = (_a = response.message) !== null && _a !== void 0 ? _a : response.msg) !== null && _b !== void 0 ? _b : "Unknown API response"}`;
        const statusHtml = response.status === "ok"
            ? `${escapeHtml((_c = response.message) !== null && _c !== void 0 ? _c : "Transaction broadcasted successfully.")}<br />` +
                `TXID: ${escapeHtml(String((_d = response.txid) !== null && _d !== void 0 ? _d : ""))} | ` +
                `<a href="https://www.agamapoint.com/bbr/mempool.php?filter=mempool&page=1">obt_mempool</a>`
            : "";
        if (response.status === "ok") {
            statusEl.innerHTML = statusHtml;
            statusEl.className = "tx-status ok";
        }
        else {
            statusEl.textContent = statusText;
            statusEl.className = "tx-status error";
        }
        if (response.status === "ok") {
            sendBuiltTx = null;
            sendBtn.disabled = true;
            await refreshWalletAfterSend();
            statusEl.innerHTML = statusHtml;
            statusEl.className = "tx-status ok";
        }
        else {
            sendBtn.disabled = false;
        }
    }
    catch (err) {
        sendBtn.disabled = false;
        showTxError(statusEl, `Error: ${String(err)}`);
    }
}
async function refreshWalletAfterSend() {
    await fetchSendUtxos();
    await fetchReceiveBalance();
}
function initReceive() {
    const btn = document.getElementById("receive-get-btn");
    if (!btn)
        return;
    btn.addEventListener("click", fetchReceiveBalance);
}
async function fetchReceiveBalance() {
    const statusEl = document.getElementById("receive-status");
    const balEl = document.getElementById("receive-balance");
    if (!statusEl || !balEl)
        return;
    if (!lastAddress) {
        resetWalletOutputsForNoKey();
        return;
    }
    statusEl.textContent = "Fetching...";
    statusEl.className = "tx-status";
    balEl.innerHTML = "";
    try {
        const data = await apiFetch(lastAddress);
        if (data.status !== "ok")
            throw new Error(`API: ${data.status}`);
        statusEl.textContent = "";
        renderBalanceSummary(balEl, data.balance, data.utxo_count);
    }
    catch (err) {
        showTxError(statusEl, `Error: ${String(err)}`);
    }
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ACTION PANEL: BALANCE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SHARED: fetch balance + render
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
async function fetchBalance(addrId, statusId, balBlockId, tbodyId, tableWrapId) {
    const statusEl = document.getElementById(statusId);
    const balEl = document.getElementById(balBlockId);
    const tbody = document.getElementById(tbodyId);
    const tableWrap = document.getElementById(tableWrapId);
    if (!statusEl || !balEl || !tbody || !tableWrap)
        return;
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
        if (resultEl)
            resultEl.innerHTML = "";
    }
    try {
        const data = await apiFetch(lastAddress);
        if (data.status !== "ok")
            throw new Error(`API: ${data.status}`);
        statusEl.textContent = "";
        renderBalanceSummary(balEl, data.balance, data.utxo_count);
        if (tbodyId === "tx-tbody") {
            txUtxos = data.unspent_outputs.slice(0, 5);
            tbody.innerHTML = txUtxos
                .map((u, i) => `<tr>` +
                `<td><input type="radio" name="tx-utxo" value="${u.txid}" ${i === 0 ? "checked" : ""}></td>` +
                `<td>${u.txid}</td><td>${u.value}</td>` +
                `</tr>`).join("");
            bindUtxoRowSelection(tbody, "tx-utxo", () => {
                const resultEl = document.getElementById("tx-sign-result");
                if (resultEl)
                    resultEl.innerHTML = "";
            });
        }
        else {
            tbody.innerHTML = data.unspent_outputs.slice(0, 5)
                .map(u => `<tr><td>${u.txid}</td><td>${u.value}</td></tr>`).join("");
        }
        tableWrap.style.display = "block";
    }
    catch (err) {
        statusEl.textContent = `Error: ${String(err)}`;
        statusEl.className = "tx-status error";
    }
}
function renderBalanceSummary(el, balance, utxoCount) {
    el.innerHTML =
        `<span class="tx-label">balance</span>` +
            `<span class="tx-big">${balance}</span>` +
            `<span class="tx-sub">in ${utxoCount} UTXOs</span>`;
}
function bindUtxoRowSelection(tbody, radioName, onChange) {
    tbody.querySelectorAll("tr").forEach(row => {
        const radio = row.querySelector(`input[name='${radioName}']`);
        radio === null || radio === void 0 ? void 0 : radio.addEventListener("change", () => onChange === null || onChange === void 0 ? void 0 : onChange());
        row.addEventListener("click", () => {
            if (!radio || radio.checked)
                return;
            radio.click();
        });
    });
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// DEV TAB: KEYS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function initKeys() {
    const inp = document.getElementById("keys-inp");
    const slider = document.getElementById("keys-slider");
    const outPt = document.getElementById("keys-point");
    const outHx = document.getElementById("keys-hex");
    const saveBtn = document.getElementById("keys-save-btn");
    const loadBtn = document.getElementById("keys-load-btn");
    const clearBtn = document.getElementById("keys-clear-btn");
    const cacheStatus = document.getElementById("keys-cache-status");
    if (!inp || !outPt || !outHx)
        return;
    saveBtn === null || saveBtn === void 0 ? void 0 : saveBtn.addEventListener("click", () => {
        const value = inp.value.trim();
        if (!value) {
            setKeyCacheStatus(cacheStatus, "nothing to save");
            return;
        }
        saveKeyToCache(value);
        setKeyCacheStatus(cacheStatus, "saved in browser");
        refreshSetupPanel();
    });
    loadBtn === null || loadBtn === void 0 ? void 0 : loadBtn.addEventListener("click", () => {
        const value = loadKeyFromCache();
        if (value === null) {
            setKeyCacheStatus(cacheStatus, "no saved key");
            return;
        }
        inp.value = value;
        inp.dispatchEvent(new Event("input", { bubbles: true }));
        setKeyCacheStatus(cacheStatus, "loaded");
    });
    clearBtn === null || clearBtn === void 0 ? void 0 : clearBtn.addEventListener("click", () => {
        clearKeyCache();
        setKeyCacheStatus(cacheStatus, "cache cleared");
        refreshSetupPanel();
    });
    setKeyCacheStatus(cacheStatus, hasCachedKey() ? "saved key available" : "");
    refreshSetupPanel();
    slider === null || slider === void 0 ? void 0 : slider.addEventListener("input", () => {
        inp.value = slider.value;
        inp.dispatchEvent(new Event("input", { bubbles: true }));
    });
    inp.addEventListener("input", () => {
        const raw = inp.value.trim();
        if (raw === "") {
            outPt.textContent = "*";
            outPt.className = "result-value placeholder";
            outHx.textContent = "";
            lastAddress = null;
            onAddressChange();
            return;
        }
        const k = parseInt(raw, 10);
        if (isNaN(k)) {
            outPt.textContent = "invalid scalar";
            outPt.className = "result-value error";
            outHx.textContent = "";
            lastAddress = null;
            onAddressChange();
            return;
        }
        if (slider && k >= 1 && k <= 251)
            slider.value = String(k);
        if (k === 0) {
            outPt.textContent = "INF";
            outPt.className = "result-value";
            outHx.textContent = "";
            lastAddress = null;
            onAddressChange();
            return;
        }
        const point = scalar_mult(k, ECC_PARAMS.G);
        if (point === null) {
            outPt.textContent = "INF (point at infinity)";
            outPt.className = "result-value";
            outHx.textContent = "";
            lastAddress = null;
        }
        else {
            const hex = pubkey_to_addr(point);
            outPt.textContent = `[${point[0]}, ${point[1]}]`;
            outHx.textContent = hex;
            outPt.className = "result-value";
            lastAddress = hex;
        }
        onAddressChange();
    });
}
function setKeyCacheStatus(el, text) {
    if (el)
        el.textContent = text;
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// DEV TAB: HASH
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function initHash() {
    const inp = document.getElementById("hash-inp");
    const out = document.getElementById("hash-out");
    if (!inp || !out)
        return;
    inp.addEventListener("input", () => {
        const raw = inp.value;
        if (raw === "") {
            out.textContent = "*";
            out.className = "result-value placeholder";
            return;
        }
        out.textContent = `RAW: [${ASH24(raw)}]  |  HEX: ${hex24(ASH24(raw))}`;
        out.className = "result-value hash-result";
    });
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// DEV TAB: TRANSACTION
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function initTransaction() {
    const btn = document.getElementById("tx-get-btn");
    const buildBtn = document.getElementById("tx-build-btn");
    if (!btn || !buildBtn)
        return;
    btn.addEventListener("click", () => fetchBalance("tx-addr", "tx-status", "tx-balance", "tx-tbody", "tx-table-wrap"));
    buildBtn.addEventListener("click", buildAndSignTransaction);
}
function buildAndSignTransaction() {
    const statusEl = document.getElementById("tx-status");
    const recipientIn = document.getElementById("tx-recipient-in");
    const valueIn = document.getElementById("tx-value-in");
    const resultEl = document.getElementById("tx-sign-result");
    const keyIn = document.getElementById("keys-inp");
    const selected = document.querySelector("input[name='tx-utxo']:checked");
    if (!statusEl || !recipientIn || !valueIn || !resultEl || !keyIn)
        return;
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
function showTxError(statusEl, message) {
    statusEl.textContent = message;
    statusEl.className = "tx-status error";
}
function positiveMod(n, m) {
    return ((n % m) + m) % m;
}
function samePoint(a, b) {
    if (a === null || b === null)
        return a === b;
    return a[0] === b[0] && a[1] === b[1];
}
function formatPoint(point) {
    return point ? `[${point[0]}, ${point[1]}]` : "INF";
}
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// BOOT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initTabGroup(".action-tab-btn", "ap-");
    initDevPanels();
    initKeys();
    initHash();
    initTransaction();
    initSend();
    initReceive();
    const info = document.getElementById("curve-info");
    if (info) {
        const { p, a, b, G, n } = ECC_PARAMS;
        info.textContent = `y^2 = x^3 + ${a}x + ${b} (mod ${p}) | G=[${G}] | n=${n}`;
    }
    if (!lastAddress)
        resetWalletOutputsForNoKey();
});
