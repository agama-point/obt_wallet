# OBT Wallet

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-web_app-3178c6.svg)
![Browser](https://img.shields.io/badge/browser-mobile_ready-brightgreen.svg)
![Purpose](https://img.shields.io/badge/purpose-education%20%26%20testing-orange.svg)

**OBT Wallet** is a small educational web wallet for experimenting with the One Byte Toy / BBR playground. It is intentionally tiny, transparent, and test-oriented: the goal is to make keys, toy signatures, UTXO selection, QR scanning, hashing, and API calls easy to inspect and understand.

This is not a production wallet. It is a learning and testing tool.

## Overview

OBT Wallet is a browser-based TypeScript app that works with a toy elliptic-curve signature scheme and a simple BBR API. It lets you:

- derive a toy public address from a small scalar key
- display and scan QR addresses
- fetch balance and UTXO data from the BBR API
- select a UTXO manually
- build and sign a toy transaction
- broadcast the transaction to the test API
- inspect hashes, signatures, and verification details in the developer transaction panel

## Educational Purpose

The project is designed for learning, demonstrations, and controlled testing. It uses deliberately small parameters so that the math and data flow stay visible.

Key ideas demonstrated:

- scalar multiplication on a toy elliptic curve
- public-key address derivation
- small deterministic toy signatures
- transaction message format: `from|prev_txid|to|amount`
- UTXO selection and change handling
- simple hash usage with ASH24
- REST/API interaction from a TypeScript web app

## Toy Crypto

The wallet uses:

- `ess251.js` for the ECC251 toy signature scheme
- `ash24.js` for a compact 24-bit educational hash

These libraries are intentionally small and should be treated as educational code only. The small key space is useful for experiments, but it is not secure.

## App Structure

The TypeScript code is split into small browser-loaded modules:

- `ts_obt_wallet.ts` - app boot, UI flow, keys, send, balance, transaction panel
- `api_client.ts` - BBR API calls
- `qr_scan.ts` - camera and QR scanning via `jsQR`
- `key_cache.ts` - test-only browser cache for the last scalar key

The generated JavaScript is placed in `build/js/`.

## API Experiment

The app talks to the BBR API hosted at:

```text
https://www.agamapoint.com/bbr/
```

Used endpoints include:

```text
GET  /index.php?route=get_balance/{address}
POST /index.php?route=send_transaction
```

The send flow builds a message, hashes it, signs it locally with the toy key, and broadcasts the signed transaction data to the test API.

## Running

The app is a static browser app. Open `index.html` from a web server, or deploy the project to a server.

For QR camera scanning, use HTTPS or localhost. Mobile browsers generally block camera access on plain HTTP.

## Warning

This project is for education and testing only.

---

https://github.com/agama-point/Bit-Block-Rithm



Do not use it with real funds, real private keys, or production cryptography.
