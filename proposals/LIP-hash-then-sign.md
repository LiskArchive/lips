```
LIP: <LIP number>
Title: Remove pre-hashing for block and transaction signatures
Author: Andreas Kendziorra <andreas.kendziorra@lightcurve.io>
Type: Standards Track
Status: Draft
Module: Blocks, Transactions
Created: 2018-10-16
Updated: 2018-11-21
```

## Abstract

This LIP proposes to remove the hash-then-sign paradigm for block and transaction signatures in the Lisk protocol. That means, block or transaction data should be signed instead of the hash digest of block or transaction data. We elaborate on why this paradigm is typically used, and why it provides more disadvantages than advantages in the Lisk protocol, where Ed25519-SHA-512 is used.

## Copyright

This LIP is licensed under the [GNU General Public License, version 3](http://www.gnu.org/licenses/gpl-3.0.html "GNU General Public License, version 3").

## Motivation

Currently, when signing transactions and blocks in Lisk, the hash-then-sign (also called hash-and-sign or pre-hashing) paradigm is applied. That means, the information to be signed is first hashed, and only the hash digest is signed afterwards. This paradigm may have advantages for some signature schemes (e.g. RSA), such as better performance or higher security. However, for the signature scheme used in Lisk, namely [Ed25519-SHA-512](https://link.springer.com/content/pdf/10.1007%2Fs13389-012-0027-1.pdf), these advantages do not apply or have negligible impact. In fact, the hash-then-paradigm applied to Ed25519-SHA-512 does even reduce security to a very small degree, and may also reduce the performance for certain inputs. Therefore, the paradigm shall not be applied anymore.

## Specification

### Block signatures

#### Current protocol

We look briefly into the current protocol in order to understand the proposed changes.

In the current protocol, all information of the block supposed to be signed is put into a data block in a specified way. Afterwards, the SHA-256 hash digest of this data block is computed. The hash digest in turn is used as the input message for Ed25519-SHA-512, where the delegate's secret key is used for signing.

In this proposal, we do not want to elaborate on how this initial data block is generated, especially since the specification may change in the future, e.g. when data fields get added or removed. However, we can assume that there is a specification for it, which we denote by **B-SPEC**. In Lisk Core 1.0.0, for example, the data block generation is implemented in [Block.prototype.getBytes](https://github.com/LiskHQ/lisk/blob/de766a70d1c507c60c2893007263907fb428af45/logic/block.js#L385).

#### Proposed protocol

In this proposal, a block signature shall be generated as follows:

1. Generate the data block of all block information to be signed according to **B-SPEC**.
2. Use the data block as the input message for Ed25519-SHA-512, where the delegate's secret key is used for signing.

Hence, the current protocol differs to the proposed one only by taking the SHA-256 hash digest of the data block described above as the input message for Ed25519-SHA-512.

### Transaction signatures

#### Single signature transactions

##### Current protocol

We look again into the current protocol to understand the proposed changes.

Transaction signatures are created similarly to block signatures in the current protocol. First, all information to be signed is put into a data block in a specified way. Afterwards, the SHA-256 hash digest of this data block is computed. The hash digest in turn is used as the input message for Ed25519-SHA-512, where the issuer's secret key is used for signing.

As in the case of block signatures, we do not want to elaborate on the specification of the initial data block generation. We only assume that there is a specification for it which we denote by **T-SPEC**. In Lisk elements 1.0.0, for example, the data block generation is implemented in [getTransactionBytes](https://github.com/LiskHQ/lisk-elements/blob/065ac5aedad44db1c326247d258770b89da368cd/src/transactions/utils/get_transaction_bytes.js#L145). In Lisk core 1.0.0, it is implemented in [Transaction.getBytes](https://github.com/LiskHQ/lisk/blob/de766a70d1c507c60c2893007263907fb428af45/logic/transaction.js#L155).

##### Proposed protocol

In this proposal, a transaction signature shall be generated as follows:

1. Generate the data block of all transaction information to be signed according to **T-SPEC**.
2. Use the data block as the input message for Ed25519-SHA-512, where the issuer's secret key is used for signing.

Again, the current protocol differs to the proposed one only by taking the SHA-256 hash digest of the data block described above as the input message for Ed25519-SHA-512.

#### Second signatures

##### Current protocol

In the current protocol, second signatures get computed in the same way as first signatures, with the differences that the issuer's second private key is used and the data block taken as the input for SHA-256 contains the first signature. We denote the specification to generate this data block by **ST-SPEC**.

Note that for Lisk Elements 1.0.0, the data block generation for second signatures is also implemented in [getTransactionBytes](https://github.com/LiskHQ/lisk-elements/blob/065ac5aedad44db1c326247d258770b89da368cd/src/transactions/utils/get_transaction_bytes.js#L145), and for Lisk Core 1.0.0 also in [Transaction.getBytes](https://github.com/LiskHQ/lisk/blob/de766a70d1c507c60c2893007263907fb428af45/logic/transaction.js#L155).

##### Proposed protocol

Second signatures get computed similarly to first signatures in the proposed protocol:

1. Generate the data block of all transaction information to be signed according to **ST-SPEC**.
2. Use the data block as the input message for Ed25519-SHA-512, where the issuer's second secret key is used for signing.

#### Multisignatures

##### Current protocol

A signature for a multisignature transaction gets created in the same way as for a single signature transaction in the current protocol. In particular, the initial data block is generated according to **T-SPEC**, no matter how many other signatures were already applied to the transaction. In other words, the initial data block used as the input for SHA-256 does not contain any signatures.

##### Proposed protocol

In the proposed protocol, a signature for a multisignature transaction is generated in the same way as for single signature transactions:

1. Generate the data block of all transaction information to be signed according to **T-SPEC**.
2. Use the data block as the input message for Ed25519-SHA-512, where the signer's secret key is used for signing.

## Rationale

The hash-then-sign paradigm is typically used to achieve better performance, ensure integrity and to avoid existential forgery attacks. In the following, we show why this can work for some signature schemes, and why these improvements do not apply in combination with Ed25519-SHA-512 or have negligible impact. Moreover, we show that pre-hashing reduces the security of EdDSA.

It is worth mentioning that none of the points discussed below are critical. That means, the current protocol is secure, and there are no drastic performance issues. Nevertheless, using pre-hashing adds minor disadvantages with respect to security and performance, and adds unnecessary complexity to the protocol and implementation.

### Performance

Some signature schemes, e.g. RSA, have a limited input length. Hence, if a message *m* exceeds the input length, it has to be split into several messages *m*<sub>1</sub>, ..., *m*<sub>*k*</sub> that do not exceed the input length, and each *m<sub>i</sub>* has to be signed separately. Consequently, one has to apply the signature scheme *k* times. To avoid this, one can use a hash function *H* with an output length smaller or equal than the input length of the signature scheme, and sign *H*(*m*) instead of *m*. Hence, hash-then-sign reduces the number of signatures from *k* to 1.

Also, a signature scheme's complexity might depend heavily on the message’s length. Applying a hash function to a long message is often faster then signing a long message. Therefore, hashing a long message plus signing a relatively small hash digest may be faster then only signing a long message.

#### Performance with respect to EdDSA

We briefly recall the [EdDSA signature scheme](https://link.springer.com/content/pdf/10.1007%2Fs13389-012-0027-1.pdf) in a simplified version. Despite the many technical details, we will see soon that only steps 4, 6 and 9 of the description below are of interest for the performance analysis. Let *b* be an integer larger than 10, *H* a cryptographic hash function with 2*b*-bit output length, **F** a finite field, *p* a large prime number between 2<sup>*b*-4</sup> and 2<sup>*b*-3</sup> and *B* an element in the group of **F**-rational points of the given elliptic curve. Moreover, let *k* be a secret key, i.e., *k* is a *b*-bit string. Computing the signature of a message *m* under the secret key *k* can be split into the following steps:

1. Let *H*(*k*) = (*h*<sub>0</sub>, ..., *h*<sub>2*b*-1</sub>) be the hash of the secret key
2. Let *a* = 2<sup>3</sup>*h*<sub>3</sub> + 2<sup>4</sup>*h*<sub>4</sub> + ... + 2<sup>*b*-3</sup>*h*<sub>*b*-3</sub> +  2<sup>*b*-2</sup>
3. Let *A* = *aB* and let **A** be the *b*-bit encoding of *A* (**A** is the public key)
4. Let *r* = *H*(*h*<sub>*b*</sub>, ..., *h*<sub>2*b*-1</sub>, *m*) interpreted as integer in little endian
5. Let *R* = *rB* and let **R** be the *b*-bit encoding of *R*
6. Let *S* = (*r* + *H*(**R**, **A**, *m*)*a*) mod *p*
7. (**R**, **S**) is the signature, where **S** is the *b*-bit little-endian encoding of *S*.

To verify the signature (**R**, **S**) for the message *m*, one has to do the following steps:

8. Obtain the curve points *A* and *R* from **A** and **R**, and the integer *S* from **S**. If obtaining *A* or *R* fails, or if 0 < *S* < *p*-1 is violated, reject the signature and stop here.
9. Compute *D* = *H*(**R**, **A**, *m*)
10. Check if 8*SB* = 8*R* + 8*DA* holds. Reject the signature if this equation does not hold.

The first observation is that there is no limit on the size of the input message. Hence, there is no need to split the input message in the case of no pre-hashing.

Next, we look at the computational impact of the length of the input message *m*. For signing, the message *m* is used only in the steps 4 and 6 to compute the variables *r* and *S*. Although *R*, **R** and **S** depend on *m*, the effort to compute them is independent of the size of *m*. Therefore, the only computational impact of the size of *m* on the signing process is in adding some length to the input of *H* in step 4 and step 6. For verification, the computational impact of the size of *m* is in adding some length to the input of *H* in step 9.

In the case of pre-hashing, one has to compute one additional hash digest. This holds for signing and verifying. The messages to be signed within the Lisk protocol are rather small. For block signatures, the message contains ~180 bytes. For transactions, the message size varies between 53 bytes and 2198 bytes, whereas most of the transactions currently contained in the Lisk blockchain consist of 53 bytes. Therefore, it is not to be expected that pre-hashing reduces the workload for the steps 4 and 6 significantly. Hence, we believe that EdDSA without pre-hashing is slightly faster due to the missing hashing step. Overall, the performance impact is negligible since the scalar multiplications dominate the signature and verification times for the used message sizes. For example, signing a message or verifying a signature with Ed25519-SHA-512 can be a few hundred times slower than computing a SHA-256 hash digest for inputs of equal size (compare [signature benchmarks](https://bench.cr.yp.to/results-sign.html) with [hashing benchmarks](https://bench.cr.yp.to/results-hash.html)). Moreover, the number of verifications per second a standard computer can perform is in the 5 to 6-digit range. Therefore, signature verifications performed by nodes will not be a bottleneck in the future.

### Integrity

As described before, an input message *m* may has to be split into several messages *m*<sub>1</sub>, ..., *m*<sub>*k*</sub> if the length of *m* exceeds the input limit of a signature scheme. Consequently, there are *k* signatures *s*<sub>1</sub>, ..., *s*<sub>*k*</sub> where *s*<sub>*i*</sub> is the signature of *m*<sub>*i*</sub> for every *i*=1,...,*k*. Now, the message *m* can be modified by reordering the partial messages *m*<sub>1</sub>, ..., *m*<sub>*k*</sub>, and/or omitting some partial messages, while one can still provide a valid signature by reordering the partial signatures *s*<sub>1</sub>, ..., *s*<sub>*k*</sub> accordingly, or omitting the partial messages. If an adversary is in possession of another message-signature pair (*m'*, *s'*) of the issuer, he may even alter the message by adding this one to the original sequence while still being able to provide a valid signature.
This implies that a receiver cannot be sure if he received all parts of the intended message, and if he received them in the right order. Hashing the input message to a digest that is smaller or equal then the input limit of the signature scheme avoids these problems, as only one input message (the hash digest) and one signature is used.

#### Integrity with respect to EdDSA

As observed already in the performance section, EdDSA can handle any input length without splitting the original message into partial messages. Therefore, all the mentioned integrity aspects are fulfilled automatically, and there is no need to hash the message before.

### Existential forgery attack

In an existential forgery attack, the attacker is able to create a pair (*m*, *s*), where *m* is a message and *s* a valid signature of *m*. This attack does not imply that the attacker can find a valid signature for a given message. It only states that he/she can find such a pair. Such an attack is easy to perform, for example, for textbook RSA.

If, however, pre-hashing with a hash function *h* is used, then the capabilities of the attacker are reduced to producing a pair (*d*, *s*), where *s* is a valid signature for the signature scheme's input *d*. However, the attacker still needs to find a pre-image *m'* with *h*(*m'*)=*d* to a have a pair consisting of a message and a valid signature.

#### Existential forgery attack in EdDSA

There is no known existential forgery attack for EdDSA, and it is conjectured to be existential unforgeable (there is also a [claim](http://www.mi.fu-berlin.de/inf/groups/ag-idm/theseses/2016-Jung-MSc1.pdf) that an existential forgery attack for EdDSA implies a polynomial time attack to solve the discrete logarithm problem in the corresponding elliptic curve).

Besides that, an existential forgery attack would have no consequences for block and transaction signatures in Lisk, as this attack does not imply any control over the message. That means, if an attacker finds a valid message-signature pair (*m*, *s*), the probability that the message *m* represents a valid transaction or block is negligible. Consequently, the message would be rejected by the protocol.

### Collisions and pre-images in the pre-hash function

Using a pre-hash function *H'* for EdDSA reduces the security of the signature scheme: Assume an attacker finds messages *m*<sub>1</sub> and  *m*<sub>2</sub> with *H'*(*m*<sub>1</sub>)=*H'*(*m*<sub>2</sub>), i.e. a collision in *H'*, and convinces an legitimate signer to sign *m*<sub>1</sub>. Then, the resulting signature would be valid for *m*<sub>2</sub> as well and could be exploited by the attacker. For this reason, also the [designers of EdDSA discourage](http://ed25519.cr.yp.to/eddsa-20150704.pdf) to use hash-then-sign for EdDSA.

Moreover, a successful pre-image attack on *H'* could be exploited. If an attacker knows some message-signature pairs (*m*<sub>1</sub>, *s*<sub>1</sub>), ..., (*m*<sub>*k*</sub>, *s*<sub>*k*</sub>) of a legitimate signer, then he can also compute easily all digest *H'*(*m*<sub>1</sub>), ..., *H'*(*m*<sub>*k*</sub>). If he finds any message *m* with *H'*(*m*)=*H'*(*m*<sub>*i*</sub>) for an *i* in {1,...,*k*}, then *s*<sub>*i*</sub> would be a valid signature for *m*, which could be exploited.
In the specific case of the Lisk network, the legitimate signer could be an exchange platform, as they may have many transactions, i.e. many publicly known message-signature pairs, and many funds. The attacker may then brute force through the set of transactions in which funds get transferred from the exchange account to the attacker's account. If the attacker finds such a transaction, the probability that the two transaction IDs are equal is very low. Therefore, the found transaction would be accepted by the Lisk protocol due to the valid signature and the unique transaction ID.

In contrast, these two attacks are not possible when using EdDSA without hash-the-sign. Also, EdDSA is resistant to collisions in the hash function *H*, and any pre-image knowledge with regard to *H* would not yield any advantage for an attacker.

The currently used pre-hash function, SHA-256, has collision resistance of 128 bit and pre-image resistance of 256 bit. That said, using Ed25519-SHA-512 with pre-hash function SHA-256 can still be considered as secure. Nevertheless, pre-hashing reduces the security of EdDSA unnecessarily.

## Backwards Compatibility

The changes introduce a hard fork because block and transaction signatures derived from the current protocol (using hash-then-sign) are rejected in the proposed protocol, and vice versa.
