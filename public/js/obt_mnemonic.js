"use strict";
const OBT_MNEMONIC_WORDLIST = [
    "amber",
    "azure",
    "bloom",
    "comet",
    "fjord",
    "flora",
    "forge",
    "gecko",
    "haven",
    "ingot",
    "lotus",
    "onyx",
    "realm",
    "sepia",
    "topaz",
    "tulip",
];
const OBT_MNEMONIC_WORD_TO_INDEX = OBT_MNEMONIC_WORDLIST.reduce((acc, word, index) => {
    acc[word] = index;
    return acc;
}, {});
function obtMnemonicWordlist() {
    return [...OBT_MNEMONIC_WORDLIST];
}
function obtMnemonicEncodeByte(byteValue) {
    if (!Number.isInteger(byteValue) || byteValue < 0 || byteValue > 255) {
        throw new RangeError(`Value ${byteValue} is not a valid byte (0-255).`);
    }
    const high = (byteValue >> 4) & 0xf;
    const low = byteValue & 0xf;
    const checksum = (high + low) % 16;
    return [
        OBT_MNEMONIC_WORDLIST[high],
        OBT_MNEMONIC_WORDLIST[low],
        OBT_MNEMONIC_WORDLIST[checksum],
    ];
}
function obtMnemonicEncode(byteValue) {
    return obtMnemonicEncodeByte(byteValue).join(" ");
}
function obtMnemonicDecode(mnemonic) {
    const words = mnemonic.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length !== 3) {
        throw new Error(`Mnemonic must have exactly 3 words, got ${words.length}.`);
    }
    const indices = words.map(word => {
        const index = OBT_MNEMONIC_WORD_TO_INDEX[word];
        if (index === undefined) {
            throw new Error(`Unknown mnemonic word: '${word}'.`);
        }
        return index;
    });
    const [high, low, checksum] = indices;
    const expectedChecksum = (high + low) % 16;
    if (checksum !== expectedChecksum) {
        throw new Error(`Checksum mismatch: '${words[2]}' (${checksum}) != expected ${expectedChecksum} ` +
            `('${OBT_MNEMONIC_WORDLIST[expectedChecksum]}').`);
    }
    return (high << 4) | low;
}
function obtMnemonicValidate(mnemonic) {
    try {
        obtMnemonicDecode(mnemonic);
        return true;
    }
    catch (_a) {
        return false;
    }
}
