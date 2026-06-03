// =======   BECH32 CORE  ======
// ver. 0.1 | AgamaPoint 2025/11

const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function bech32_polymod(values) {
    const GENERATOR = [
        0x3b6a57b2,
        0x26508e6d,
        0x1ea119fa,
        0x3d4233dd,
        0x2a1462b3
    ];
    let chk = 1;
    for (let p = 0; p < values.length; p++) {
        const top = chk >> 25;
        chk = ((chk & 0x1ffffff) << 5) ^ values[p];
        for (let i = 0; i < 5; i++) {
            if ((top >> i) & 1) {
                chk ^= GENERATOR[i];
            }
        }
    }
    return chk;
}

function bech32_hrp_expand(hrp) {
    const ret = [];
    for (let i = 0; i < hrp.length; i++) {
        ret.push(hrp.charCodeAt(i) >> 5);
    }
    ret.push(0);
    for (let i = 0; i < hrp.length; i++) {
        ret.push(hrp.charCodeAt(i) & 31);
    }
    return ret;
}

function bech32_create_checksum(hrp, data) {
    const values = bech32_hrp_expand(hrp).concat(data).concat([0,0,0,0,0,0]);
    const polymod = bech32_polymod(values) ^ 1;
    const ret = [];
    for (let i = 0; i < 6; i++) {
        ret.push((polymod >> (5 * (5 - i))) & 31);
    }
    return ret;
}

function convertbits(data, frombits, tobits, pad = true) {
    let acc = 0;
    let bits = 0;
    const ret = [];
    const maxv = (1 << tobits) - 1;
    for (let value of data) {
        acc = (acc << frombits) | value;
        bits += frombits;
        while (bits >= tobits) {
            bits -= tobits;
            ret.push((acc >> bits) & maxv);
        }
    }
    if (pad && bits > 0) {
        ret.push((acc << (tobits - bits)) & maxv);
    }
    return ret;
}

function bech32_encode(hrp, data) {
    const checksum = bech32_create_checksum(hrp, data);
    const combined = data.concat(checksum);
    let ret = hrp + "1";
    for (let d of combined) {
        ret += BECH32_CHARSET[d];
    }
    return ret;
}

// ==========

function hexa_to_bech32(hexa, prefix) {
    if (hexa.length % 2 !== 0) {
        throw new Error("Invalid hex length.");
    }

    // hex â†’ bytes
    const bytes = [];
    for (let i = 0; i < hexa.length; i += 2) {
        bytes.push(parseInt(hexa.slice(i, i + 2), 16));
    }

    // 8bit â†’ 5bit
    const data5 = convertbits(bytes, 8, 5);

    return bech32_encode(prefix.toLowerCase(), data5);
}

//==============================

const TOY_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function convertbitsToy(data, frombits, tobits, pad = true) {
    let acc = 0, bits = 0;
    const ret = [];
    const maxv = (1 << tobits) - 1;

    for (let value of data) {
        acc = (acc << frombits) | value;
        bits += frombits;
        while (bits >= tobits) {
            bits -= tobits;
            ret.push((acc >> bits) & maxv);
        }
    }

    if (pad && bits > 0) {
        ret.push((acc << (tobits - bits)) & maxv);
    }

    return ret;
}

function hexa_to_toy32(hex, prefix = "a") {
    if (hex.length % 2 !== 0) throw new Error("Invalid hex.");

    const bytes = [];
    for (let i = 0; i < hex.length; i += 2)
        bytes.push(parseInt(hex.slice(i, i + 2), 16));

    const data5 = convertbitsToy(bytes, 8, 5);

    let out = prefix.toLowerCase() + "1";
    for (let v of data5) out += TOY_CHARSET[v];

    return out;
}

function toy32_to_hexa(addr) {
    //const sep = addr.indexOf("1");
    const sep = addr.lastIndexOf("1");

    if (sep === -1) throw new Error("Invalid toy32.");

    const dataPart = addr.slice(sep + 1);

    const data5 = [];
    for (let ch of dataPart) {
        const v = TOY_CHARSET.indexOf(ch);
        if (v === -1) throw new Error("Invalid character.");
        data5.push(v);
    }

    const bytes = convertbitsToy(data5, 5, 8, false);

    let hex = "";
    for (let b of bytes)
        hex += b.toString(16).padStart(2, "0");

    return hex;
}

