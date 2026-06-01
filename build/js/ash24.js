// js/ash24.js
// mini Merkle–Damgård
// ASH24 = Agama simple hash 24 bit

const ASH24_VER = "0.17 | 2026/01";


(function () {

    function bytesToBin24(b) {
        let s = "";
        for (let i = 0; i < b.length; i++) {
            s += b[i].toString(2).padStart(8, "0");
        }
        return s.padStart(24, "0");
    }

    function rol8(x, r) {
        return ((x << r) | (x >>> (8 - r))) & 0xFF;
    }

    function ASH24(input, debug = false) {

        let data;

        if (typeof input === "string") {
            data = Array.from(input, c => c.charCodeAt(0) & 0xFF);
        } 
        else if (input instanceof Uint8Array) {
            data = Array.from(input);
        } 
        else if (Array.isArray(input)) {
            data = input.slice();
        } 
        else {
            throw new Error("Unsupported input type");
        }

        const IV8 = [0x6a,0xbb,0x3c,0xa5,0x51,0x9b,0x05,0x1f];

        // --- padding ---
        const originalLen = data.length;

        data.push(0x80);

        while ((data.length + 2) % 2 !== 0) {
            data.push(0x00);
        }

        data.push((originalLen >>> 8) & 0xFF);
        data.push(originalLen & 0xFF);

        let A = IV8[0];
        let B = IV8[1];
        let C = IV8[2];

        for (let blockIndex = 0; blockIndex < data.length; blockIndex += 2) {

            const m0 = data[blockIndex];
            const m1 = data[blockIndex + 1];

            A ^= m0;
            B ^= m1;
            C ^= (m0 + m1) & 0xFF;

            for (let i = 0; i < 16; i++) {

                A ^= IV8[(i + blockIndex) % IV8.length];
                B ^= rol8(C, 2);
                C ^= rol8(A, 3);
                A = (A + C) & 0xFF;

                A ^= B;
                B ^= C;
                C ^= A;

                [A, B, C] = [B, C, A];
            }
        }

        return ((A << 16) | (B << 8) | C) & 0xFFFFFF;
    }

    function hex24(v) {
        //return "0x" + (v & 0xFFFFFF).toString(16).padStart(6, "0");
        //return (v & 0xFFFFFF).toString(16).padStart(6, "0");
        return (v & 0xFFFFFF).toString(16).padStart(6, "0"); 
    }

    function bin24(v) {
        return (v & 0xFFFFFF).toString(2).padStart(24, "0");
    }

    window.ASH24 = ASH24;
    window.hex24 = hex24;
    window.bin24 = bin24;
    window.bytesToBin24 = bytesToBin24;
    window.ASH24_VER = ASH24_VER;

})();
