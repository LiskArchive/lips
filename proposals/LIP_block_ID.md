```
LIP: <LIP number>
Title: Use SHA3-256 hash of block header as blockID
Author: Andreas Kendziorra, andreas.kendziorra@lightcurve.io
Type: Standards Track
Module: Blocks
Created: <YYYY-MM-DD>
Updated: <YYYY-MM-DD>
```

## Abstract

This LIP proposes to take the SHA3-256 hash of the block header as the blockID of a block. This implies an increase of the blockID length and the usage of a different hash function. The motivation of the proposal is to increase the security of the Lisk blockchain.

## Copyright

This LIP is licensed under the [GNU General Public License, version 3](http://www.gnu.org/licenses/gpl-3.0.html "GNU General Public License, version 3").

## Motivation

In the current Lisk protocol, a blockID consists of 8 bytes of the SHA-256 digest of the block header. This small length comes with some advantages, such as less stored data or better visualisation on small displays. However, it comes at the price of providing low resistance to collisions and pre-images. More precisely, the low resistance could be exploited in the following scenario: An attacker could try to find another block with the same blockID for a given block in the blockchain. In the successful case, other community members may be convinced by this altered history, as the altered chain might appear to be valid. We will see that this kind of attack is limited to delegates and currently economically unattractive. However, the length of the blockID shall be increased to prevent this kind of attack also in the future. Moreover, the hash function used to compute the blockID shall be replaced by its successor, namely SHA3-256 (see [below](#Why-SHA-3?) for details).

## Specification

### Current protocol

We briefly recall the current protocol in order to explain the proposed changes.

In the current Lisk protocol, the data of the header of a signed block is put into a data block in a specified way. Afterwards, the data block is used as the input message for SHA-256. The first 8 bytes of the output are reversed and used as the blockID.

Here, we do not want to elaborate on how this data block is generated, especially since the specification may change in the future, e.g. when data fields get added or removed. However, we can assume that there is a specification for it, which we denote by **SPEC**. In Lisk Core 1.0.0, for example, the data block generation is implemented in [Block.prototype.getBytes](https://github.com/LiskHQ/lisk/blob/v1.0.0/logic/block.js#L385).

### Proposed protocol

In the proposed protocol, the blockID is generated as follows:

1. Generate the data block of the header of the signed block according to **SPEC**.
2. Use the data block as the input for SHA3-256. The output is used as the blockID.

The hash function SHA3-256 is an instance of the [KECCAK](https://keccak.team/keccak.html) function. Its form is

```
SHA3-256(M) = KECCAK[512](M||01, 256)
```
for a message M according to NIST [FIPS 202](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf).

#### BlockIDs in JSON objects

In the JSON schema for blocks, the blockID shall be represented in hexadecimal.

#### BlockID verification

During the verification of a received block, the blockID must be verified as correct. If the blockID verification fails, the block has to be rejected.

#### Implementation of SHA3-256

The open source library [js-sha3](https://github.com/emn178/js-sha3) could be forked and integrated into the Lisk source code in order to compute SHA3-256 hashes. If this library is not desired, for any reason, [jsSHA](https://github.com/Caligatio/jsSHA) represents an alternative.
Note that this is only a recommendation. Any correct implementation of SHA3-256 may be used.

## Rationale

### Why 256 bit length?

As mentioned before, an attacker could try to find another block with the same blockID for a given block in the past. If the attacker succeeds, other community members may be convinced by this  altered history, as the altered chain might appear to be valid. Such an attack would, however, only be possible if the attacker possesses the private key of the delegate associated with the time slot of the block. Otherwise, the signature or the time slot would be recognised as invalid during the block validation. Therefore, such an attack would be limited to delegates that have been in the top 101 at some point.
Moreover, finding a new block with the same blockID requires currently 2<sup>64</sup> tries on average. In each try, the attacker creates a block which includes creating the payload, signing the block header and computing the blockID. The signing step is the computationally most expensive step. According to the designers of the signature scheme used in Lisk (Ed25519), a quad-core 2.4 GHz Westmere is able to sign [109,000 messages per second](https://link.springer.com/content/pdf/10.1007%2Fs13389-012-0027-1.pdf). Therefore, one would require 5.4 million years on average to find a new block with this hardware. This makes the attack economically very unattractive, even with more advanced hardware. Furthermore, the attack requires that users synchronise their chain with the faked chain where they copy at least the new block. If the attacker wants to double spend money by deleting a transaction from a block and spending the funds again, then even many delegates have to synchronise their chain with the faked chain in order to get the new transfer verified.

Although the success probability is very low, we want to increase the resistance against such an attack to provide sufficient security also for the future. The resistance against such an attack is determined by the bit length of the blockIDs. I.e., n-bit blockIDs yield n-bit resistance against such an attack.
128 bit is the recommended security level by ECRYPT to provide sufficient security for at least the next [10 years
](http://www.ecrypt.eu.org/csa/documents/D5.4-FinalAlgKeySizeProt.pdf#chapter.2). NIST is recommending 128 bit to be the minimum security level for applications intended to run [beyond 2030](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-57pt1r4.pdf#%5B%7B%22num%22%3A196%2C%22gen%22%3A0%7D%2C%7B%22name%22%3A%22XYZ%22%7D%2C81%2C721%2Cnull%5D). 
With a blockID length of 256 bit, we choose a security level that is beyond the recommendations, and provides great trust that the mentioned attack is infeasible, even for a time span that significantly exceeds the next decade.
Choosing this extra security comes at a low price. We use 128 bit extra compared to the minimum requirement. This sums up to ~50 Mb extra size in the blockchain per year (~100 Mb if blockIDs are stored in hexadecimal representation in character arrays); a small value compared to the overall size of the chain.
Since blockIDs are rarely handled by users, i.e. writing, reading or spelling blockIDs is a rare use case, the extra length does also not yield any significant disadvantages for the user experience.

### Why SHA-3?

The hash function family SHA-3, or rather the  [KECCAK](https://keccak.team/keccak.html) function, was the winner of the public NIST hash function competition. Due to the 5 year long competition and review process, it received fundamental attention and analysis. NIST chose KECCAK to be the winner of the competition due to its security, performance and flexibility aspects. We choose SHA-3 mainly for its high security due to its construction and the heavy analysis it received.

#### Alternatives

##### BLAKE2

The hash function [BLAKE2](https://blake2.net/) received great attention and analysis as well. It is assumed to be as secure as KECCAK, and is even faster than KECCAK. However, we give preference to KECCAK as BLAKE2 did not go through the entire SHA-3 review process.

##### SHA-256

SHA-256 is the currently used hash function for generating blockIDs. Although there are no known weaknesses of this hash function that could be exploited with regard to blockIDs, is has weaknesses due to its construction (these can be exploited in length extension attacks). Therefore, we give a preference to KECCAK, a hash function without known weaknesses.

### Library recommendation

We recommend js-sha3 to be forked and integrated into the Lisk source code because of the following reasons: It comes with a very compact and readable implementation, has a high test coverage and no dependencies. Moreover, it provides implementations for KECCAK, SHAKE and SHA-3 which allows flexible usage of the KECCAK function family also for other use cases in Lisk.

The library jsSHA has a longer history and implements the SHA hash function family from SHA-1 to SHA-3 including SHAKE. However, it does not provide a generic implementation of KECCAK. Moreover, it is less compact and less readable than js-sha3. Therefore, we recommend js-sha3 over jsSHA.

### Representation in JSON objects

A hexadecimal representation is preferred over a decimal representation due to length efficiency. We do not choose Base64 since it contains special characters. Base32 is also not preferred as it could lead to some confusion due to the lack of standardisation.

## Backwards Compatibility

The change introduces a hard fork, because of the following: Blocks forged by nodes following the proposed protocol get rejected by nodes following the current protocol and vice versa.

The proposed protocol will become effective from a certain block height on. Nodes that need to be able to sync blocks below this height need to be able to compute and verify the current and the proposed blockIDs.


