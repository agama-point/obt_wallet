# OBT Address - Toy32 Address for One Byte Toy

## Principle

An OBT address can be derived from a public key by encoding its binary/hexadecimal representation into a short text form inspired by Bech32.

The example in `all251.html` uses the `agama_bech32.js` library and the function:

```js
hexa_to_toy32(hexRaw, "a")
```

The resulting address has the form:

```text
prefix + "1" + toy32_data
```

For the OBT demo, the proposed prefix is:

```text
a
```

The address therefore starts with:

```text
a1...
```

Similar to Bitcoin, which uses for example the `bc` prefix and addresses such as `bc1q...`, the OBT demo uses the short prefix `a` and addresses such as `a1...`.

---

## Input Data

In `all251.html`, the public key is represented as a point on a toy elliptic curve:

```text
[X, Y]
```

The address is assembled from two bytes:

```text
hex = XXYY
```

where:

- `XX` is the `X` coordinate encoded as one byte in hex
- `YY` is the `Y` coordinate encoded as one byte in hex

Example:

```text
[10, 76] -> 0x0A4C
```

---

## Toy32 Encoding

The `hexa_to_toy32` function:

1. Reads the hex string in pairs of characters as bytes.
2. Converts 8-bit bytes into 5-bit values.
3. Encodes each 5-bit value as a character from the Bech32 charset:

```text
qpzry9x8gf2tvdw0s3jn54khce6mua7l
```

4. Prepends the prefix and the separator `1`.

In the current demo version, `hexa_to_toy32` does not add a Bech32 checksum. It is an intentionally simple Toy32 variant suitable for OBT examples. For a future full address standard, `hexa_to_bech32` can be considered, because it calculates a Bech32 checksum in `agama_bech32.js`.

---

## Proposed Address Format

```text
obt_address = hrp + "1" + toy32(hex_public_key)
```

For the current OBT demo:

```text
hrp = "a"
```

Therefore:

```text
obt_address = "a1" + toy32_data
```

---

## Examples

| Private key | Public point `[X, Y]` | Public key hex | OBT address |
|-------------|-----------------------|----------------|-------------|
| 1           | `[10, 76]`            | `0x0A4C`       | `a1pfxq`    |
| 123         | `[203, 68]`           | `0xCB44`       | `a1edzq`    |

---

## JavaScript Example

```js
const pubPoint = scalar_mult(k, G_POINT);
const hexRaw = pubkey_to_addr(pubPoint);
const address = hexa_to_toy32(hexRaw, "a");
```

For key `1`:

```text
k = 1
pubPoint = [10, 76]
hexRaw = "0a4c"
address = "a1pfxq"
```

For key `123`:

```text
k = 123
pubPoint = [203, 68]
hexRaw = "cb44"
address = "a1edzq"
```

---

## Validation

Basic validation of a Toy32 address:

1. Find the separator `1`.
2. Verify the prefix, for example `a`.
3. Verify that all characters after the separator belong to the Toy32 charset.
4. Convert the 5-bit values back to bytes.
5. Recover the original public key hex.

The `agama_bech32.js` file provides a function for reverse conversion:

```js
toy32_to_hexa(addr)
```

---

## Future Extensions

- Define a fixed OBT prefix, for example `obt`, or keep the demo prefix `a`.
- Distinguish testnet/mainnet addresses with different prefixes.
- Add a checksum using full Bech32 encoding.
- Define the public key length and structure for larger OBT curves.
- Add an address type or format version to the payload.
