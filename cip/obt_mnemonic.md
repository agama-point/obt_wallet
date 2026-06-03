# OBT Mnemonic - One Byte Toy Mnemonic Encoding

## Principle

One byte (8 bits) is encoded into **3 words** using a 16-word dictionary.

### Step 1 - Split into Nibbles

```text
byte (8 bits) -> HIGH nibble (bits 7-4) + LOW nibble (bits 3-0)
```

Each nibble has a value from 0 to 15 and receives one word from the dictionary.

### Step 2 - Checksum

```text
checksum = (HIGH + LOW) mod 16
```

The checksum is the third nibble and therefore the third word.

### Total Length: 3 Words = 12 Bits (4+4+4)

```text
[WORD_HIGH] [WORD_LOW] [WORD_CHECKSUM]
```

### Example

```text
byte = 0xB7 = 183 = 0b10110111

HIGH = 0b1011 = 11 -> "onyx"
LOW  = 0b0111 =  7 -> "forge"
CHK  = (11 + 7) mod 16 = 2 -> "bloom"

mnemonic: "onyx forge bloom"
```

---

## Dictionary (16 Words)

| Decimal | Binary | Word   |
|---------|--------|--------|
|  0      | 0000   | amber  |
|  1      | 0001   | azure  |
|  2      | 0010   | bloom  |
|  3      | 0011   | comet  |
|  4      | 0100   | fjord  |
|  5      | 0101   | flora  |
|  6      | 0110   | forge  |
|  7      | 0111   | gecko  |
|  8      | 1000   | haven  |
|  9      | 1001   | ingot  |
| 10      | 1010   | lotus  |
| 11      | 1011   | onyx   |
| 12      | 1100   | realm  |
| 13      | 1101   | sepia  |
| 14      | 1110   | topaz  |
| 15      | 1111   | tulip  |

---

## Validation

When decoding:

1. Read three words and get the values H, L, C.
2. Verify: `(H + L) mod 16 == C`.
3. If valid: `byte = (H << 4) | L`.
4. If invalid: report a transcription error or corrupted mnemonic.

---

## Future Extensions

- More bytes mean more word triplets, where each byte is encoded as 3 words.
- Example: a 16-byte key is encoded as 48 words in 16 triplets.
