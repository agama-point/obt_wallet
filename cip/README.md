# CIP | Core Ideas Paper

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Purpose](https://img.shields.io/badge/purpose-education%20%26%20testing-orange.svg)

---

## Short Description

CIP (Core Ideas Paper) is a set of short design documents for **OBT - One Byte Toy**: an educational cryptographic and blockchain model built for explaining core ideas through small, easy-to-check examples.

This repository describes three basic parts of OBT:

- how to encode one byte as a simple mnemonic phrase,
- how to derive a short Toy32 address from a public key,
- how to build, sign, and verify a toy transaction.

These documents are not production specifications. They are a readable outline for testing, explaining, and extending the OBT demo.

---

## CIP Overview

| CIP | Topic | Document |
|-----|-------|----------|
| OBT Mnemonic | Encoding one byte into 3 words with a simple checksum. | [obt_mnemonic.md](obt_mnemonic.md) |
| OBT Address | Deriving a short Toy32 address from a public key. | [obt_address.md](obt_address.md) |
| OBT Transaction | Building, signing, and verifying a simple UTXO transaction. | [obt_transaction.md](obt_transaction.md) |

---

## Contents and Outline

### 1. OBT Mnemonic

[OBT Mnemonic](obt_mnemonic.md) defines how one 8-bit byte is converted into a triplet of words:

- the byte is split into a high nibble and a low nibble,
- the third word carries the checksum `(HIGH + LOW) mod 16`,
- the dictionary contains 16 words, one for each 4-bit value.

This is useful as a first explanation of the relationship between bits, dictionaries, checksums, and decoding.

### 2. OBT Address

[OBT Address](obt_address.md) describes a simple address format inspired by Bech32:

- the public key is represented as a point `[X, Y]`,
- the coordinates are written as hexadecimal data `XXYY`,
- the data is encoded into a Toy32 address with a prefix, for example `a1...`.

The document is connected to the demo implementation in the `obt_address` directory.

### 3. OBT Transaction

[OBT Transaction](obt_transaction.md) summarizes the basic flow of a toy transaction:

- selecting a previous UTXO,
- building the raw message `from|utxo_txid|to|amount`,
- hashing with `ASH24`,
- signing with the toy signature scheme,
- verifying the signature equation over the toy elliptic curve.

This CIP completes the minimal path from a key, through an address, to a signed transaction.
