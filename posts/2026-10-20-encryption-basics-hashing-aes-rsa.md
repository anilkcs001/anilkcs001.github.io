---
title: Encryption explained like a story: hashing, AES, RSA, keys, IV and chaining (Part 1)
date: 2026-10-21
type: snippet
tags: Security, Encryption, Hashing, AES, RSA
summary: No coding knowledge needed. Locked boxes, fingerprints, padlocks and suitcases explain hashing, AES, RSA, public and private keys, IV and chaining in plain words.
---

## The problem: a postman who can read your letters

Imagine you want to send a letter to your bank: *"Please pay 10,000 rupees to Ravi."*

The letter passes through many hands before it reaches the bank. Any of them could:

1. **Read it** and learn your secret.
2. **Change it** to "Please pay 90,000 rupees to Suresh."
3. **Pretend to be you** and send a fake letter.

On the internet, your data also passes through many computers before it arrives. Encryption and its friends solve these three problems. This post explains them with things from daily life. You do not need to know any programming.

## Three words people mix up

Before we start, let us clear up three words that sound similar but are very different.

**Encoding: writing the same thing in a different way.**
Think of writing a Hindi sentence in English letters: *"Aap kaise ho?"* It looks different, but anyone who knows the rule can read it back. Encoding is **not** for secrets. It only makes data easy to carry. (A common one in computers is called *Base64*.)

**Hashing: making a fingerprint.**
Your fingerprint proves it is you, but nobody can build you from your fingerprint. Hashing is the same: it makes a fingerprint of data, and you can never get the data back from it.

**Encryption: putting it in a locked box.**
Nobody can read what is inside unless they have the key. With the right key, you get the exact original back.

| | Can anyone get the original back? |
|---|---|
| Encoding | Yes, anyone |
| Hashing | No, nobody |
| Encryption | Only the person with the key |

## 1. Hashing: the fingerprint

Think of making fresh juice. You put in an orange and get a glass of juice. From the juice, you can never get the orange back. And the same orange always gives the same taste.

A hash works like that. You put in any text, and you get a long code that looks like nonsense. For example, the word **hello** gives:

```text
hello   ->  2cf24dba5fb0a30e26e8...
Hello   ->  185f8db32271fe25f561...
```

Only one letter changed, a small **h** to a capital **H**, and the result is completely different. That is the power of a hash: even the smallest change is easy to see.

**Where you meet it every day: your password.**
When you create an account on a good website, the website does **not** keep your password. It keeps only the fingerprint of it. When you log in, it makes a fingerprint of what you typed and compares the two. If they match, you are in. So even if a thief steals the website's database, they get only fingerprints, not passwords.

To make it even safer, good websites add a **salt**: a random extra bit added to each person's password before making the fingerprint. Like adding a different secret spice to each glass of juice. Two people with the same password then still get different fingerprints.

**A fingerprint with a secret (HMAC).**
Sometimes two companies share a secret word. Before sending a message, the sender makes a fingerprint of *the message plus the secret word*. The receiver does the same. If the fingerprints match, the receiver knows two things: the message was not changed, and it came from someone who knows the secret. Think of it as a wax seal made with your personal ring.

## 2. AES: one key to lock and unlock

Now let us really hide the letter. Think of your house. You lock the door with a key, and you open it with **the same key**. If you want your brother to enter, you give him a copy of that key.

**AES** is a way of locking data that works exactly like this. One key locks it, and the same key unlocks it. This is called **symmetric** encryption, because both sides have the same key.

AES is used almost everywhere: in your phone, your banking app and the websites you visit. It is very fast and very safe.

But it has one big problem: **how do you give a copy of the key to the other person safely?** If you send the key through the same postman, he can copy the key and open everything. Keep this question in mind. We will answer it soon.

## 3. Hiding patterns: the IV and chaining

### The problem with locking each piece the same way

Computers do not lock a long message in one go. They cut it into small pieces and lock each piece.

Imagine a simple secret code where every letter is always replaced the same way: A becomes X, M becomes Q. The word **MAMA** becomes **QXQX**. A thief cannot read it, but he can see a pattern: the first and third letters are the same. If he watches your messages every day, he will learn a lot from these patterns. For example, he can see that today's message is the same as yesterday's.

Locking each piece on its own, in the same way, has exactly this problem. Same pieces give the same locked result.

### The fix: chaining

Think of a chain, where each link is hooked into the one before it. In **chaining** (the technical name is **CBC**, Cipher Block Chaining), each piece is **mixed with the locked piece before it**, and only then locked.

```text
Piece 1  mixed with  a random start   -->  lock  -->  Locked piece 1
Piece 2  mixed with  Locked piece 1   -->  lock  -->  Locked piece 2
Piece 3  mixed with  Locked piece 2   -->  lock  -->  Locked piece 3
```

Now every piece depends on everything before it. Two pieces with the same words come out completely different, and the pattern is gone.

### The IV: a random start

Look at the first line again. The first piece has nothing before it to mix with, so we give it a **random start**. This random start is called the **IV** (Initialization Vector).

Think of a card game. Before every game, you shuffle the cards. Everyone can see that you shuffled, so the shuffle is not a secret. But because of it, no two games start the same way.

The IV is the same:

- A **new random IV** is made for every message, so the same letter sent twice looks different each time.
- The IV is **not a secret**. It is sent together with the locked message, like a note written on the outside of the envelope. Without the key, it does not help a thief.
- The **key** is the only real secret.

## 4. RSA: a padlock anyone can close, but only you can open

Now the answer to our big question: how do you share a key safely?

Think of an **open padlock**. You buy many padlocks that all open with **your** key, and you give the open padlocks to everyone. Anyone can put a letter in a box and click your padlock shut. Once it is shut, only **your** key can open it. Even the person who locked it cannot open it again.

This is how **RSA** works. It uses a pair of keys:

- The **public key** is the open padlock. You can give it to the whole world.
- The **private key** is the key that opens the padlock. Only you keep it, and you never share it.

What the public key locks, only the private key can open. This is called **asymmetric** encryption, because the two sides use different keys.

Another way to picture it: a **letterbox** at your gate. Anyone can drop a letter in through the slot (public key). Only you, with your letterbox key, can take the letters out (private key).

RSA is clever, but it is **slow**, and it can only lock **small** things, like a short note. Not a big file.

### Signatures: proving it is really you

The pair of keys can also be used the other way round, to prove who sent something.

Think of your signature on a cheque. Only you can make it, but the bank can check it against the sample they have. A **digital signature** works the same way: you sign with your **private** key, and anyone can check it with your **public** key. If the check passes, the message really came from you and nobody changed it.

## 5. Putting it all together: the suitcase and the envelope

Now we have:

- **AES**: fast and strong, but both sides need the same key.
- **RSA**: makes sharing safe, but slow and only for small things.

So real systems use **both**, like this:

1. You put your big letter in a **suitcase** and lock it with a fresh AES key. (Fast, works for big things.)
2. You put the small **suitcase key** in a tiny box and lock it with the bank's **open padlock**, their RSA public key.
3. You send both. The postman cannot open either one.
4. The bank opens the tiny box with its private key, takes out the suitcase key, and opens the suitcase.

The big data travels with fast AES. Only the small key travels with RSA.

**You use this every day.** When you see the small **padlock icon** next to a website address in your browser, your browser and the website have done something very similar: used public keys to agree on a shared secret key, and then locked everything with fast encryption like AES. Banking apps, UPI apps and messaging apps use the same ideas.

## Back to the postman

Remember the three dangers from the beginning? Here is how each one is solved:

| Danger | Solution | Daily-life picture |
|--------|----------|--------------------|
| Someone **reads** the letter | Encryption (AES, RSA) | A locked box or suitcase |
| Someone **changes** the letter | Hash or HMAC | A fingerprint or a wax seal |
| Someone **pretends** to be you | Digital signature | Your signature on a cheque |

## Simple rules everyone should know

- **Encoding is not hiding.** Anyone can read it back.
- **A key written in an open place is like a house key under the doormat.** Keep keys in a safe place.
- **Never reuse the same IV.** Shuffle the cards before every game.
- **Do not invent your own secret code.** The standard ones, like AES and RSA, have been tested by experts for many years.
- **Old fingerprint methods, called MD5 and SHA-1, are no longer safe.** Use newer ones like SHA-256.

## In one sentence each

- **Hashing**: a fingerprint of data. You can check it, but never reverse it.
- **AES**: one key that locks and unlocks. Fast.
- **Chaining (CBC)**: each piece is linked to the one before it, so patterns disappear.
- **IV**: a random start, not secret, new every time.
- **RSA**: a public padlock anyone can close, and a private key only you have to open it.
- **Together**: RSA protects the key, AES protects the data.

## Coming in Part 2

In the next post, we will turn these ideas into real code in AL for Business Central: making a fingerprint, locking and unlocking with AES, and using a public key, step by step.
