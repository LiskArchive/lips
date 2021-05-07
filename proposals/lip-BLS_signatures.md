```
LIP: <LIP number>
Title: BLS signatures
Author: Andreas Kendziorra <andreas.kendziorra@lightcurve.io>
Discussions-To: https://research.lisk.io/t/bls-signatures/
Type: Informational
Created: <YYYY-MM-DD>
Updated: <YYYY-MM-DD>
```

## Abstract

This document specifies how to use BLS signatures within Lisk. In particular, it specifies how to create and validate compact aggregate signatures with BLS. The specification consists mainly of a choice of a ciphersuite, i.e., the choice of a concrete BLS variant including the choice of several parameters. Moreover, some guidelines on how to use it within a blockchain created with the Lisk SDK are given.

This document does not specify any concrete applications of BLS signatures nor does it impose any protocol changes. It is purely informational on how to use them if desired. Specific applications need to be defined in separate LIPs.

## Copyright

This LIP is licensed under the [Creative Commons Zero 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).

## Motivation

The purpose of this LIP is to be prepared for use cases where multisignatures for large sets of signers are required but the size of concatenated Ed25519 signatures is too disadvantageous. Cross chain transactions for a trustless interoperability solution are likely candidates for such use cases.

With the BLS variant we choose, several signatures of the same message can be aggregated into a single compact signature with a size of 96 bytes. If we consider, for example, a transaction that requires signatures from 68 active delegates, concatenated Ed25519 signatures would sum up to more than 4.35 kB which is about 45 times larger than an aggregate BLS signature.

Very recent advancements have pushed the BLS signature scheme to a state that gives sufficient confidence in the theory of BLS signatures and in its implementations: The [IETF standardization process](https://datatracker.ietf.org/doc/draft-irtf-cfrg-bls-signature/history/) was initiated and driven forward, several implementations were developed, matured and partially audited, and last but not least, the Ethereum2 Beacon Chain that started running recently adopted BLS, which results in real-world usage of both the BLS scheme as specified in the latest standard draft (version [4](https://tools.ietf.org/html/draft-irtf-cfrg-bls-signature-04) at the time of writing) and the BLS implementations. Note that [filecoin](https://spec.filecoin.io/algorithms/crypto/signatures/#section-algorithms.crypto.signatures.bls-signatures) is using BLS signatures as well. However, their specification is based on an outdated BLS specification draft.

## Specification

The BLS signature scheme as specified in the IETF draft "[BLS Signatures draft-irtf-cfrg-bls-signature-04](https://tools.ietf.org/html/draft-irtf-cfrg-bls-signature-04)" is used. More specifically, the ciphersuite [BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_](https://tools.ietf.org/html/draft-irtf-cfrg-bls-signature-04#section-4.2.3) is chosen. This ciphersuite uses the _[proof of possession](https://tools.ietf.org/html/draft-irtf-cfrg-bls-signature-04#section-3.3)_ scheme and the _[minimal-pubkey-size](https://tools.ietf.org/html/draft-irtf-cfrg-bls-signature-04#section-2.1)_ variant.

The ciphersuite exposes the following functions:

- [`KeyGen`](https://tools.ietf.org/html/draft-irtf-cfrg-bls-signature-04#section-2.3)
- [`SkToPk`](https://tools.ietf.org/html/draft-irtf-cfrg-bls-signature-04#section-2.4)
- [`Aggregate`](https://tools.ietf.org/html/draft-irtf-cfrg-bls-signature-04#section-2.8)
- `Sign` (identical to [`CoreSign`](https://tools.ietf.org/html/draft-irtf-cfrg-bls-signature-04#section-2.6))
- `Verify` (identical to [`CoreVerify`](https://tools.ietf.org/html/draft-irtf-cfrg-bls-signature-04#section-2.7))
- `AggregateVerify` (identical to [`CoreAggregateVerify`](https://tools.ietf.org/html/draft-irtf-cfrg-bls-signature-04#section-2.9))
- [`FastAggregateVerify`](https://tools.ietf.org/html/draft-irtf-cfrg-bls-signature-04#section-3.3.4)
- [`PopProve`](https://tools.ietf.org/html/draft-irtf-cfrg-bls-signature-04#section-3.3.2)
- [`PopVerify`](https://tools.ietf.org/html/draft-irtf-cfrg-bls-signature-04#section-3.3.3)

The function `AggregateVerify` is, however, not used here. How and when the remaining functions are used is specified in the following subsection.

### Usage

#### Keypair Creation

A secret key is created using `KeyGen`. The input for `KeyGen` must be an infeasible to guess octet string of length at least 32. See the [appendix](#key-management) for a recommendation on how to choose this input and on key management.

The public key for a secret key `sk` is created by `SkToPk(sk)`.

#### Signing and Verifying

Let `m` be a binary message, `tag` the correct message tag for `m` as specified in the LIP ["Use message tags and network identifiers for signatures"][lip-use-message-tags-and-network-identifiers-for-signatures], `networkIdentifier` the correct network identifier of the chain and `sk` a secret key. Then, the signature is computed by `signBLS(sk, tag, networkIdentifier, m)` as defined below. The resulting signature `sig` in combination with the message `m` and the matching public key `pk` is verified by `verifyBLS(pk, tag, networkIdentifier, m, sig)`. In the following, let `tagMessage` be the function defined in the LIP ["Use message tags and network identifiers for signatures"][lip-use-message-tags-and-network-identifiers-for-signatures].

```python
signBLS(sk, tag, networkIdentifier, m):
    taggedMessage = tagMessage(tag, networkIdentifier, m)
    return Sign(sk, taggedMessage)

verifyBLS(pk, tag, networkIdentifier, m, sig):
    taggedMessage = tagMessage(tag, networkIdentifier, m)
    return Verify(pk, taggedMessage, sig).
```

#### Public Key Registration and Proof of Possession

In order to use a BLS keypair `(sk, pk)` for on-chain signatures, the public key `pk` of the keypair must first be registered on-chain via some transaction. Otherwise, every transaction or block that needs to verify a signature for `pk` via `Verify` or `FastAggregateVerify` must be rejected.

The Lisk protocol could contain several transaction types that perform such a registration. In particular, there could be different registration transactions for different keys, e.g, one for validator public keys and one for public keys of regular accounts. This LIP does not specify any registration transactions. Such transaction types must be defined in separate LIPs. In the following, we just assume there exists such a transaction type which we call _register public key transaction_. To register the public key of the key pair `(sk, pk)` by a _register public key transaction_, `registerPublicKeyTransaction`, the transaction must contain `pk` and a proof, `prf`, generated by `PopProve(sk)`. If `prf` does not satisfy `PopVerify(pk, prf) == VALID`, then `registerPublicKeyTransaction` is invalid and must be rejected. Once `registerPublicKeyTransaction` is included, transactions and blocks that require to have a valid signature for `pk` can be included in the blockchain.

**Example (delegate registration)**: Delegates will be required to register their BLS public key on-chain, which may be included in the delegate registration transactions. Hence, a delegate registration transaction needs to contain the BLS public key, `pk`, and a proof, `prf`, generated by `PopProve(sk)`, where `sk` is the matching secret key. During the validation of the delegate registration transaction, it must be checked that `PopVerify(pk, prf)` returns `VALID`.

#### Aggregate Signatures and their Verification

We only consider signature aggregation for the case where several signatures for the same message are aggregated.

Each aggregate signature needs to be accompanied by some information that specifies the set of public keys that correspond to the aggregate signature. Here, this is realized using a bitmap. Assume that `keyList` is a list that includes all potential public keys that could participate in the signature aggregation. The entries must be pairwise distinct. Moreover, let `pubKeySignaturePairs` be a list of pairs of public keys and signatures where all signatures belong to the same message, and all public keys are unique and contained in `keyList`. Then, the corresponding aggregate signature and bitmap can be computed via `createAggSig(keysList, pubKeySignaturePairs)` as in the pseudo code below. To verify if a signature is an aggregate signature of a binary message `m`, the function `verifyAggSig` can be used. `verifyAggSig(keysList, aggregationBits, signature, tag, networkIdentifier, m)` returns `VALID` if and only if `signature` is an aggregate signature of the message `m` for the message tag `tag`, the network identifier `networkIdentifier` and for the public keys in `keyList` defined by `aggregationBits`.

```python
createAggSig(keysList, pubKeySignaturePairs):
    aggregationBits = byte string of length ceil(length(keyList)/8) with all bytes set to 0
    signatures = []
    for pair in pubKeySignaturePairs: 
        signatures.append(pair.sig)
        index = keysList.index(pair.pubkey)
        set bit at position index to 1 in aggregationBits
    signature = Aggregate(signatures)
    return (aggregationBits, signature)

verifyAggSig(keysList, aggregationBits, signature, tag, networkIdentifier, m):
    taggedMessage = convert2BLSSignatureInput(tag, networkIdentifier, m)
    keys = []
    for every i in [0, …, ceil(length(keyList)/8)]:
        if i-th bit of aggregationBits is set to 1:
            keys.append(keysList[i])
    return FastAggregateVerify(keys, taggedMessage, signature)
```

If one wants to additionally validate that the participating public keys satisfy a certain weight threshold, the function `verifyWeightedAggSig` can be used. The function takes additionally a list of weights, `weights`, where the i-th entry specifies the weight for the i-th public key in `keysList` and a weight threshold `threshold`.

```python
verifyWeightedAggSig(keysList, aggregationBits, signature, tag, networkIdentifier, m, weights, threshold):
    taggedMessage = convert2BLSSignatureInput(tag, networkIdentifier, m)
    keys = []
    weightSum = 0
    for every i in [0, …, ceil(length(keyList)/8)]:
        if i-th bit of aggregationBits is set to 1:
            keys.append(keysList[i])
            weightSum += weights[i]
    if weightSum < threshold:
        return INVALID
    return FastAggregateVerify(keys, taggedMessage, signature)
```

Note that the public keys in `pubKeySignaturePairs` need to be distinct when calling `createAggSig.` Otherwise, validation via `verifyAggSig` and `verifyWeightedAggSig` will fail.

## Rationale

### Variant minimal-pubkey-size

We choose the variant _[minimal-pubkey-size](https://tools.ietf.org/html/draft-irtf-cfrg-bls-signature-04#section-2.1)_ because this one is used in Ethereum2 and filecoin and therefore the only variant that found considerable adoption. This means in particular that only the _minimal-pubkey-size_ functionality of BLS libraries is significantly used and tested in practice and can be relied on.

### Proof of Possession scheme

#### Choice of Scheme

We use the _proof of possession_ scheme as we only need the use case of aggregating signatures of the same message, and this scheme allows us to use `FastAggregateVerify` for this case. `FastAggregateVerify`requires only two pairing operations whereas `AggregateVerify` requires `n`+1 pairing operations where `n` is the number of individual signatures that are aggregated. Note that pairing operations are very expensive.

#### Why Proofs of Possession?

Using `FastAggregateVerify` without requiring proofs of possession is insecure as it allows rogue key attacks. See this [blog post](https://medium.com/@coolcottontail/rogue-key-attack-in-bls-signature-and-harmony-security-eac1ea2370ee) for how rogue key attacks work for BLS signatures. To see why simply signing the public key is not a sufficient proof of possession method that defends against powerful attackers (chosen message attack model), see section 4.3 of [this paper](https://www.iacr.org/archive/eurocrypt2007/45150228/45150228.pdf).

## Backwards Compatibility

This LIP is purely informational. Therefore, it does not imply any incompatibilities.

## Appendix

### Key Management

We propose two ways to manage the keys: [using a passphrase](#using-a-passphrase-bip-39-mnemonic) and [storing the encrypted secret key](#storing-encrypted-secret-key). Moreover, we discuss [below](#choosing-the-key-management-method) for which use cases the methods are preferred.

#### Using a Passphrase (BIP 39 Mnemonic)

This approach is similar to the key derivation method for the EdDSA account key pair in Lisk.

To create a new key pair, a passphrase is created according to the [BIP 39 specifications](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki#generating-the-mnemonic), where an initial entropy of 32 bytes is used. In Node.js, this initial entropy can be created, for example, via [crypto.randomBytes](https://nodejs.org/api/crypto.html#crypto_crypto_randombytes_size_callback). The resulting passphrase consists of 24 words.

The passphrase is used as the input for `KeyGen` to derive the secret key, where the passphrase is treated as a single ASCII-encoded string with the space symbol (0x20) between two words. The user needs to remember or store safely the passphrase.

##### Storing Passphrase on a Remote Server

If the secret key is needed on a remote server, the encrypted passphrase must be stored on the server. The passphrase should be encrypted by AES-256-[GCM](https://en.wikipedia.org/wiki/Galois/Counter_Mode), and the encryption key should be derived by [Argon2d](https://en.wikipedia.org/wiki/Argon2). The password used to derive the encryption key should conform to common guidelines for [strong passwords](https://en.wikipedia.org/wiki/Password_strength#Guidelines_for_strong_passwords). On the user interface level, the user should be warned otherwise.

#### Storing Encrypted Secret Key

To create a new key pair, an initial randomness of at least 32 bytes is created, e.g., via crypto.randomBytes. This randomness is used as the input for `KeyGen` to derive the secret key. The secret key is encrypted via AES-256-GCM, where the encryption key is derived by Argon2d. The password used to derive the encryption key should conform to common guidelines for strong passwords. On the user interface level, the user should be warned otherwise. The user needs to store the encrypted secret key (and ideally backs up the encrypted key) and needs to remember or store the password safely.

#### Choosing the Key Management Method

[Using a passphrase](#using-a-passphrase-bip-39-mnemonic) is suitable for users that need their key pair only on local machines, e.g., for singing transactions. Users only need to remember or securely store the passphrase for this approach. [Storing the encrypted secret key](#storing-encrypted-secret-key) is suitable for users that need the key pair only on some remote server, e.g., a forging node on a remote data center. If the key pair is needed on local machines and on remote servers, there is a tradeoff between the two approaches. The first one requires to remember or store secretly a passphrase and a password, but does not require to store and backup any encrypted data locally. The second one requires to store and backup an encrypted file, but needs to remember or secretly store only one password.

### Test Vectors

TBA

[lip-use-message-tags-and-network-identifiers-for-signatures]: https://research.lisk.io/t/use-message-tags-and-network-identifiers-for-signatures/280
