"use strict";
function jsonpFetch(url, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const cbName = `__jsonp_${Date.now()}`;
        const script = document.createElement("script");
        let settled = false;
        const cleanup = () => {
            var _a;
            settled = true;
            delete window[cbName];
            (_a = script.parentNode) === null || _a === void 0 ? void 0 : _a.removeChild(script);
        };
        const timer = setTimeout(() => { cleanup(); reject(new Error("Timeout")); }, timeout);
        window[cbName] = (data) => {
            clearTimeout(timer);
            cleanup();
            resolve(data);
        };
        script.src = `${url}&callback=${cbName}`;
        script.onerror = () => { clearTimeout(timer); cleanup(); reject(new Error("Script load failed")); };
        document.head.appendChild(script);
    });
}
async function apiFetch(address) {
    const base = balanceApiUrl(address);
    try {
        const res = await fetch(base, {
            cache: "no-store",
            headers: { "Accept": "application/json" }
        });
        if (!res.ok)
            throw new Error(`HTTP ${res.status}`);
        return await res.json();
    }
    catch (_a) {
        return jsonpFetch(base);
    }
}
function balanceApiUrl(address) {
    const route = `/bbr/index.php?route=get_balance/${encodeURIComponent(address)}`;
    const host = window.location.hostname.toLowerCase();
    if (host === "agamapoint.com" || host === "www.agamapoint.com") {
        return route;
    }
    return `https://www.agamapoint.com${route}`;
}
function sendTransactionUrl() {
    const route = "/bbr/index.php?route=send_transaction";
    const host = window.location.hostname.toLowerCase();
    if (host === "agamapoint.com" || host === "www.agamapoint.com") {
        return route;
    }
    return `https://www.agamapoint.com${route}`;
}
async function postSendTransaction(params) {
    const res = await fetch(sendTransactionUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params)
    });
    if (!res.ok)
        throw new Error(`HTTP ${res.status}`);
    return await res.json();
}
//# sourceMappingURL=api_client.js.map