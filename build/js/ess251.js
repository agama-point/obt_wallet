// ESS251: Elliptic Signature Scheme for p=251
// Educational ECC toy library

const ESS251_VER = "0.33 | 2026/03";
window.ESS251_VER = ESS251_VER;

const P_MOD = 251;
const A_PARAM = 0;
const B_PARAM = 7;
const G_POINT = [10, 76]; //[1, 192]; max_order
const ORDER_N = 252;

window.ECC_PARAMS = {
  p: P_MOD,
  a: A_PARAM,
  b: B_PARAM,
  G: G_POINT,
  n: ORDER_N
};


// --- ALWAYS NON-NEGATIVE MODULO ---
function modN(n, m) {
    return ((n % m) + m) % m;
}

// Modular inverse
function inv_mod(x, mod_val) {
    x = modN(x, mod_val);
    for (let i = 1; i < mod_val; i++) {
        if ((x * i) % mod_val === 1) return i;
    }
    return null;
}

// Point doubling
function point_doubling(P, a = A_PARAM, p = P_MOD) {
    if (P === null) return null;
    let [x, y] = P;
    if (y === 0) return null;
    let num = modN(3 * x * x + a, p);
    let den = inv_mod(2 * y, p);
    if (den === null) return null;
    let slope = modN(num * den, p);
    let x3 = modN(slope * slope - 2 * x, p);
    let y3 = modN(slope * (x - x3) - y, p);
    return [x3, y3];
}

// Point addition
function point_adding(P1, P2, p = P_MOD, a = A_PARAM) {
    if (P1 === null) return P2;
    if (P2 === null) return P1;
    let [x1, y1] = P1;
    let [x2, y2] = P2;
    if (x1 === x2 && y1 !== y2) return null;
    if (x1 === x2) return point_doubling(P1, a, p);

    let num = modN(y2 - y1, p);
    let den = inv_mod(modN(x2 - x1, p), p);
    if (den === null) return null;
    let slope = modN(num * den, p);
    let x3 = modN(slope * slope - x1 - x2, p);
    let y3 = modN(slope * (x1 - x3) - y1, p);
    return [x3, y3];
}

// Scalar multiplication
function scalar_mult(k, P, a = A_PARAM, p = P_MOD, n = ORDER_N) {
    let result = null;
    let addend = P;
    k = modN(k, n);
    while (k > 0) {
        if (k & 1) result = point_adding(result, addend, p, a);
        addend = point_doubling(addend, a, p);
        k >>= 1;
    }
    return result;
}

// --- Idealized toy-signing function ---
function signToy(private_key, msg_hash, debug = false) {
    if (debug) console.log("\n[DEBUG-SIGN] Starting signing process...");

    // Convert string hex or decimal input to integer
    if (typeof msg_hash === "string") {
        msg_hash = msg_hash.startsWith("0x") ? parseInt(msg_hash, 16) : parseInt(msg_hash, 16);
    }

    // Deterministic toy nonce (must be non-zero)
    let k = (msg_hash ^ 0x55) % ORDER_N;
    if (k === 0) k = 1;

    // Compute R = k * G
    let R_point = scalar_mult(k, G_POINT, A_PARAM, P_MOD, ORDER_N);
    let r = modN(R_point[0], ORDER_N); // x-coordinate mod n

    // Compute e = msg_hash mod n
    let e = modN(msg_hash, ORDER_N);

    // Compute s = (k + e * priv) mod n
    let s = modN(k + e * private_key, ORDER_N);

    if (debug) {
        console.log(`[DEBUG-SIGN] msg_hash = ${msg_hash}`);
        console.log(`[DEBUG-SIGN] Nonce k = ${k}`);
        console.log(`[DEBUG-SIGN] R_point = [${R_point}]`);
        console.log(`[DEBUG-SIGN] r = ${r}, s = ${s}`);
    }

    return { r: r, s: s, R_point: R_point };
}


function verifyToy(pubKeyPoint, msgHash, signature, debug = false) {
    if (typeof msgHash === "string") {
        msgHash = msgHash.startsWith("0x") ? parseInt(msgHash,16) : parseInt(msgHash,16);
    }

    if (debug) console.log("\n[DEBUG-VERIFY] Starting verification process...");

    let { r, s, R_point } = signature;
    let e = modN(msgHash, ORDER_N);

    // Left side: s * G
    let L = scalar_mult(s, G_POINT);

    // Right side: R + e*PubKey
    let ePubKey = scalar_mult(e, pubKeyPoint);
    let P = point_adding(R_point, ePubKey);

    if (debug) {
        const fmt = (pt) => pt ? `[${pt[0]}, ${pt[1]}]` : "INF";
        console.log(`[DEBUG-VERIFY] Challenge e: ${e}`);
        console.log(`[DEBUG-VERIFY] L = s*G: ${fmt(L)}`);
        console.log(`[DEBUG-VERIFY] e*PubKey: ${fmt(ePubKey)}`);
        console.log(`[DEBUG-VERIFY] P = R + e*PubKey: ${fmt(P)}`);
    }

    // Handle Infinity points
    if (L === null || P === null) return L === P;

    const isValid = (L[0] === P[0] && L[1] === P[1]);
    if (debug) console.log(`[DEBUG-VERIFY] Match: ${isValid ? "YES ✅" : "NO ❌"}`);

    return isValid;
}



function sig_to_hexa(signature){
    let rHex = signature.r.toString(16).padStart(2,'0');
    let sHex = signature.s.toString(16).padStart(2,'0');
    return rHex + sHex;
}

// Pubkey hexa
function pubkey_to_addr(pub){
        return pub[0].toString(16).padStart(2,'0') +
               pub[1].toString(16).padStart(2,'0');
    }

function hexa_to_point(hex) {
    if (hex.length !== 4) {
        throw new Error("Hex string must have length 4.");
    }
    const x = parseInt(hex.slice(0, 2), 16);
    const y = parseInt(hex.slice(2, 4), 16);

    if (Number.isNaN(x) || Number.isNaN(y)) {
        throw new Error("Invalid hex string.");
    }
    return [x, y];
}


