type BalanceResponse = {
  status: string;
  address: string;
  balance: number;
  utxo_count: number;
  unspent_outputs: ToyUtxo[];
};

type ToyUtxo = {
  id?: number;
  utxo_id?: number;
  rowid?: number;
  txid: number;
  value: number;
};

type BuiltSendTx = {
  from: string;
  to: string;
  val1: number;
  val2: number;
  sig_hex: string;
  utxo_txid: number;
};

type SendTransactionResponse = {
  status: string;
  message?: string;
  msg?: string;
  txid?: number;
};

function jsonpFetch(url: string, timeout = 5000): Promise<BalanceResponse> {
  return new Promise((resolve, reject) => {
    const cbName = `__jsonp_${Date.now()}`;
    const script = document.createElement("script");
    let settled = false;
    const cleanup = () => {
      settled = true;
      delete (window as unknown as Record<string, unknown>)[cbName];
      script.parentNode?.removeChild(script);
    };
    const timer = setTimeout(() => { cleanup(); reject(new Error("Timeout")); }, timeout);
    (window as unknown as Record<string, unknown>)[cbName] = (data: BalanceResponse) => {
      clearTimeout(timer); cleanup(); resolve(data);
    };
    script.src = `${url}&callback=${cbName}`;
    script.onerror = () => { clearTimeout(timer); cleanup(); reject(new Error("Script load failed")); };
    document.head.appendChild(script);
  });
}

async function apiFetch(address: string): Promise<BalanceResponse> {
  const base = balanceApiUrl(address);
  try {
    const res = await fetch(base, {
      cache: "no-store",
      headers: { "Accept": "application/json" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as BalanceResponse;
  } catch {
    return jsonpFetch(base);
  }
}

function balanceApiUrl(address: string): string {
  const route = `/bbr/index.php?route=get_balance/${encodeURIComponent(address)}`;
  const host = window.location.hostname.toLowerCase();

  if (host === "agamapoint.com" || host === "www.agamapoint.com") {
    return route;
  }

  return `https://www.agamapoint.com${route}`;
}

function sendTransactionUrl(): string {
  const route = "/bbr/index.php?route=send_transaction";
  const host = window.location.hostname.toLowerCase();

  if (host === "agamapoint.com" || host === "www.agamapoint.com") {
    return route;
  }

  return `https://www.agamapoint.com${route}`;
}

async function postSendTransaction(params: Record<string, string | number>): Promise<SendTransactionResponse> {
  const res = await fetch(sendTransactionUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json() as SendTransactionResponse;
}
