# OBT Transaction - Building, Signing, and Verification

## Principle

An OBT transaction spends one previous unspent output (UTXO) and creates a new payment to a recipient address.

The current toy wallet signs a short raw message:

```text
raw = from|utxo_txid|to|amount
```

where:

- `from` is the sender public-key address in hex, for example `0a4c`
- `utxo_txid` is the id of the spent UTXO
- `to` is the recipient public-key address in hex, for example `83ca`
- `amount` is the number of OBT units to send

Example:

```text
raw = 0a4c|12|83ca|3
```

---

## Building

1. Select one UTXO that belongs to the sender address.
2. Choose the recipient address and amount.
3. Build the raw transaction message:

```js
const raw = `${from}|${utxo_txid}|${to}|${amount}`;
```

4. Hash the raw message:

```js
const h = ASH24(raw);
const hHex = hex24(h);
```

The hash is the compact digest that will be signed.

---

## Signing

The sender signs the hash with the private scalar `k`:

```js
const sig = signToy(k, h);
const sigHex = sig_to_hexa(sig);
```

The toy signature contains:

```text
sig = { r, s, R_point }
```

For transport, the wallet stores the compact hexadecimal form:

```text
sig_hex
```

The broadcast payload currently contains:

```text
from
to
val1       original UTXO value
val2       sent amount
utxo_txid
sig_hex
```

---

## Verification

To verify a transaction, the receiver or node reconstructs the same raw message:

```text
raw = from|utxo_txid|to|amount
```

Then it hashes it again:

```js
const h = ASH24(raw);
```

The sender public key is recovered from `from`:

```js
const pub = hexa_to_point(from);
```

The signature is valid when the ESS251 signature equation holds:

```text
s * G == R_point + e * pub
```

where:

```text
e = h mod n
```

In wallet code this is checked as:

```js
const e = positiveMod(h, ECC_PARAMS.n);
const left = scalar_mult(sig.s, ECC_PARAMS.G);
const ePub = scalar_mult(e, pub);
const right = point_adding(sig.R_point, ePub);
const valid = samePoint(left, right);
```

---

## Notes

- This is an educational toy transaction format, not a production blockchain format.
- The current raw message signs only the selected input id, sender, recipient, and amount.
- A future transaction format can add version, fee, change output, locktime, address type, and canonical serialization.
