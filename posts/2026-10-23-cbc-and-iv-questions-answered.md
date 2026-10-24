---
title: How CBC and the IV really work: 10 questions everyone asks, answered with one real example
date: 2026-10-23
type: snippet
tags: Security, Encryption, AES, CBC, IV
summary: Why is the message cut into pieces? Doesn't mixing 16 + 16 bytes give 32? Where does the IV go, and how does the receiver decrypt? One real AES example, followed step by step.
---

## Before we start

In the [previous post](#/post/2026-10-20-encryption-basics-hashing-aes-rsa) we saw the idea of chaining (CBC) and the IV with everyday pictures. When you try to really understand it, questions come up. These are the exact questions I had myself, so I answer them one by one with **one real example**.

All the numbers below are real. They come from AES-256 run on the message below.

**Our example message:**

```text
Pay 10000 to Ravi
```

It has 17 characters. In computers, one English letter, digit or space is **1 byte**, so the message is **17 bytes**.

Two small notes before we go:

- Computers often show bytes as two characters from `0-9` and `a-f`, called **hex**. For example, the letter `P` is shown as `50`. You do not need to calculate in hex. Just see it as the "name" of a byte.
- We use a secret **key** (shared by both sides) and an **IV** (16 random bytes). Our IV is:

```text
a1 b2 c3 d4 e5 f6 07 18 29 3a 4b 5c 6d 7e 8f 90
```

---

## Question 1: Why is the message cut into pieces?

**Answer:** AES can only lock **exactly 16 bytes at a time**. Not 15, not 17. So a longer message is cut into pieces of 16 bytes, called **blocks**.

**Example:** our 17-byte message becomes:

| Piece | Content | Size |
|-------|---------|------|
| Piece 1 | `Pay 10000 to Rav` | 16 bytes, full |
| Piece 2 | `i` | 1 byte, 15 short |

---

## Question 2: The last piece is too short. What happens?

**Answer:** it is filled up to 16 bytes. This is called **padding**. The usual rule (named PKCS7) is simple: if you need **N** extra bytes, add N bytes that each have the value **N**.

**Example:** piece 2 needs 15 more bytes. 15 is written `0f`, so we add fifteen `0f`:

```text
Piece 2:  i  0f 0f 0f 0f 0f 0f 0f 0f 0f 0f 0f 0f 0f 0f 0f
          ^  \____________ 15 bytes of padding _________/
```

Now we have **2 pieces of 16 bytes = 32 bytes**.

**And if the message is exactly 16 bytes?** Then a whole extra piece of 16 padding bytes is added anyway. Why? The receiver always looks at the last byte to know how much padding to remove. If there were no padding, it could remove a real letter by mistake. So padding is always there, from 1 to 16 bytes.

---

## Question 3: We "mix" piece 1 (16 bytes) with the IV (16 bytes). Doesn't that make 32 bytes?

**Answer:** no. Mixing does **not** mean putting them side by side. It means combining them **byte by byte, position by position**. The first byte with the first byte, the second with the second, and so on. 16 pairs give 16 results.

**Example:**

```text
Position:    1    2    3   ...  16
Piece 1:     50   61   79  ...  76      ("P" "a" "y" ... "v")
IV:          a1   b2   c3  ...  90
             --   --   --       --
Mixed:       f1   d3   ba  ...  e6
```

`50` mixed with `a1` gives `f1`. One byte plus one byte gives **one** byte.

**Real life:** think of two rows of 16 light switches. For each position, you compare the two switches and set a third switch. You still end up with one row of 16 switches, not 32. (The technical name for this mixing is **XOR**.)

---

## Question 4: What exactly is mixed with what?

**Answer:** each piece is mixed with the **locked result of the piece before it**. The first piece has nothing before it, so it is mixed with the IV.

**Example:**

```text
Step 1:  Piece 1 mixed with IV          -> lock with key -> C1
Step 2:  Piece 2 mixed with C1          -> lock with key -> C2
```

The real results:

```text
C1 = 5367d28520c3c6f55ae6d9a2d15dab45
C2 = 16490bf74eda1ee468451f0f7aa9558a
```

Notice the order inside each step: first **mix**, then **lock**. And the next piece is mixed with the **locked** result (C1), not with the mixed value. That is the "chain" in Cipher Block **Chaining**.

---

## Question 5: What is the size of each locked piece?

**Answer:** always **16 bytes**. Locking with AES never changes the size of a piece. 16 bytes go in, 16 bytes come out.

**Example:** C1 is 16 bytes, C2 is 16 bytes. Count them above: each has 32 hex characters, and every 2 hex characters are 1 byte.

---

## Question 6: So what is the final message that is sent?

**Answer:** all the locked pieces, one after another. Usually the IV is put in front, because the receiver needs it.

**Example:**

```text
IV (16 bytes)  +  C1 (16 bytes)  +  C2 (16 bytes)  =  48 bytes
```

To send bytes inside JSON or XML, they are turned into normal text with **Base64**. 48 bytes become 64 characters:

```text
obLD1OX2BxgpOktcbX6PkFNn0oUgw8b1WubZotFdq0UWSQv3Ttoe5GhFHw96qVWK
```

Here the pieces **are** put side by side, so here the sizes **do** add up. Mixing (question 3) is byte by byte. Building the final message (this question) is joining end to end.

---

## Question 7: Does the message become smaller after encryption?

**Answer:** no, never. It always becomes a little **bigger**:

1. Padding rounds it up to the next multiple of 16.
2. The IV adds 16 more bytes.
3. Base64 makes it about one third longer again.

**Example:** our message grows like this:

```text
17 bytes  ->  32 bytes (padding)  ->  48 bytes (with IV)  ->  64 characters (Base64)
```

A few more sizes:

| Original message | After padding | With IV |
|------------------|---------------|---------|
| 2 bytes (`Hi`) | 16 | 32 |
| 16 bytes | 32 | 48 |
| 17 bytes | 32 | 48 |
| 200 bytes | 208 | 224 |
| 500 bytes | 512 | 528 |

A long message simply has more pieces: C1, C2, C3 ... C32. The extra size is always small, between 17 and 32 bytes before Base64.

---

## Question 8: Where is the IV shared? Inside the message?

**Answer:** both ways are used. The sender and receiver just have to agree.

- **In front of the message** (most common): the first 16 bytes are the IV, the rest is C1, C2 ... The receiver cuts off the first 16 bytes.
- **In a separate field**: for example, in JSON:

```json
{
  "iv": "obLD1OX2BxgpOktcbX6PkA==",
  "data": "U2fShSDDxvVa5tmi0V2rRRZJC/dO2h7kaEUfD3qpVYo="
}
```

Here `data` contains only C1 and C2. Some APIs even send the IV in a header.

The IV is **not a secret**, so it is fine to send it openly. The **key** is the secret, and it is never sent with the data.

**Tip:** when you connect to an API, read its documentation for exactly this: where it expects the IV. A wrong IV place is one of the most common reasons why decryption fails.

---

## Question 9: If the IV comes in a separate field and the data starts from C1, how does the receiver decrypt?

**Answer:** the same way. It does not matter where the IV comes from, only that it is the **same IV** the sender used. The receiver already has the secret key.

To decrypt, each step is done in the opposite direction: first **unlock**, then **mix**.

**Example:**

```text
Step 1:  unlock C1 with key  -> mix with IV  -> Piece 1  = "Pay 10000 to Rav"
Step 2:  unlock C2 with key  -> mix with C1  -> Piece 2  = "i" + 15 x 0f
Step 3:  the last byte is 0f = 15, so remove the last 15 bytes
Result:  "Pay 10000 to Ravi"
```

See the pattern: to get a piece back, you need the **key** to unlock it, and the **block before it** to un-mix it:

| To get back | Unlock with | Then mix with |
|-------------|-------------|---------------|
| Piece 1 | Key | IV |
| Piece 2 | Key | C1 |
| Piece 3 | Key | C2 |

So each locked piece works like the IV for the next one.

---

## Question 10: Must the receiver decrypt in reverse order? After using C1, is it gone?

**Answer:** no. Unlocking C1 does not use it up. The receiver received the whole message, so C1, C2 and C3 are all still there. It unlocks C1 to get piece 1, and then uses the same C1 again to fix piece 2.

In fact, the receiver can decrypt the pieces **in any order**, even all at the same time, because each piece needs only its own block and the block before it, and both were received.

Only **encryption** must go strictly in order: C2 cannot be made before C1 exists.

---

## Bonus: why a new IV every time?

Here is the **same message with the same key**, encrypted twice with two different IVs:

```text
IV a1b2c3d4...   ->  C1 = 5367d285...  C2 = 16490bf7...
IV 5e1f00c2...   ->  C1 = 41f029c3...  C2 = 7b900d2e...
```

Completely different results. Someone watching the network cannot even tell that you sent the same message twice. That is the whole job of the IV. If you always use the same IV, the same message always looks the same, and this protection is lost.

---

## The whole story in five lines

1. Cut the message into 16-byte pieces, and pad the last piece.
2. Mix piece 1 with the IV, lock it: **C1**.
3. Mix piece 2 with C1, lock it: **C2**. Continue the chain.
4. Send **IV + C1 + C2 + ...**, usually as Base64.
5. The receiver unlocks each piece with the key, un-mixes it with the block before it, and removes the padding.

In the next post, we will write this in AL for Business Central.
