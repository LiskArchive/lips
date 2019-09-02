```
LIP: <LIP number>
Title: Make multisignature accounts more flexible, prevent spamming, and prevent signature mutability
Author: Andreas Kendziorra <andreas.kendziorra@lightcurve.io>
Discussions-To: https://research.lisk.io/t/make-multisignature-accounts-more-flexible-prevent-spamming-and-make-signature-sets-immutable/186
Type: Standards Track
Created: <YYYY-MM-DD>
Updated: <YYYY-MM-DD>
Requires: 0015
```

## Abstract

This LIP proposes some improvements for the multisignature system in Lisk. The first improvement is that only valid transactions from multisignature accounts, i.e. transactions with all required signatures, are accepted and allowed to be forwarded by nodes. This will prevent spamming of the network and the transaction pool. Next, the settings for the account rules become more flexible. This allows, for example, to create accounts that require signatures for _m_ arbitrary public keys from a set of _n_ public keys without making the signature for any public key mandatory. Moreover, the upper bound on the number of participating keys is increased to 64 and the set of signatures of a transaction included in a block becomes immutable. The rules for the existing multisignature accounts do not change with this proposal. 

## Copyright

This LIP is licensed under the [Creative Commons Zero 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).

## Motivation

The current multisignature system in Lisk has several shortcomings:

1. It is possible to spam the network and the transaction pool of the nodes by sending transactions from multisignature accounts without all required signatures. Both sending the transactions and sending the signatures is free as long as the transaction does not receive the required amount of signatures. This is possible in the current protocol because
    - transactions from multisignature accounts are broadcast by nodes even if they do not contain the required signatures, and
    - the signatures for a transaction from a multisignature account are collected by the nodes after the transaction was send to the network.

    The queue for transactions from multisignature accounts in a transaction pool could also be easily flooded without any malicious acting, because pending transactions from multisignature accounts can be very large and they can pend for up to 72 hours. Whenever the limit of the queue is reached due to too many pending transactions, all newly arriving transactions from multisignature accounts get rejected.

2. There is little flexibility for the account rules. More precisely: 
    - A signature by the key pair that registered the multisignature account is always mandatory for a transaction.
    - A signature by a specific key pair from the keys group cannot be made mandatory (unless it is mandatory for every key in the keys group).

    This prevents, for example, creating an account shared among several users in which everyone has equal rights. Also, it is not possible for a single user to create an account that requires signatures for two out of three (or more) public keys. This would increase the security of an account, similar to a second passphrase account, but permits to lose one key without losing access to the account.

3. Users that register a multisignature account need a second key pair/passphrase if they want to have a personal account as well. In other words, the account creators cannot use a single key pair for their personal account and for the multisignature accounts they create.
4. The number of keys participating in the account is upper bounded by 16.
5. The set of signatures for a transaction from a multisignature account is mutable. There is no way to prove that a specific set of signatures was used during the transaction verification and during the inclusion into a block. This is because the signatures are neither included into the transactionID computation nor in the payload hash computation of a block.

## Rationale

### Prevent Spamming

An easy solution to prevent spamming in the network and in the transaction pools is to reject every transaction that does not contain the required signatures. In other words, transactions from multisignature accounts are treated as every other transaction: if they are not valid, they are rejected and not forwarded.

Besides removing the risk of spamming, this approach has the following advantages:

*   A transaction pool can treat a transaction from a multisignature account like any other transaction. Thus, there is no extra queue required anymore.
*   Multisignature accounts do not require the `lifetime` property anymore. This simplifies the registration process of multisignature accounts and allows an unlimited time span between transaction creation and signing.

#### Facilitate the Collection of Signatures

When signatures have to be collected from several users before sending a transaction to the network, some supporting functionalities could improve the user experience significantly. For example, a centralized service could be created (e.g. run by Lisk Foundation or a third party) at which one can upload an unsigned transaction and collect the signatures. The signers could get the transaction object from the server, sign it locally and send the signature to the service. An integration of this service into wallets (e.g., Lisk Hub and Lisk Mobile) is possible as well.

### Increase Flexibility of Account Rules

When increasing the flexibility for the account rules, it has to be ensured that the rules for the existing multisignature accounts do not change. Therefore, we propose that each multisignature account has a set of mandatory keys, a set of optional keys and a `numberOfSignatures` property which defines how many signatures a transaction from this account requires (the reason to not call it `min` property as in the current protocol is explained [below](#making-the-signatures-set-immutable)). For a transaction to be valid, one signature for each mandatory key and _k_ signatures for _k_ distinct optional keys are required, where _k_ equals the `numberOfSignatures` value of the account minus the number of mandatory keys. An account should be allowed to have only optional or only mandatory keys. For example, an _m_-out-of-_n_ multisignature account has _n_ optional keys, no mandatory keys and the `numberOfSignatures` value equals _m_. Existing multisignature accounts get converted to a multisignature account with exactly one mandatory key (the key that registered the account), some optional keys (all keys specified in `keysgroup`) and the `numberOfSignatures` value equals the `min` value. If an existing multisignature account is additionally registered as a second signature account, then it gets converted into a multisignature account with two mandatory keys (see [below](#existing-combinations) for more details).

#### Adding Sender Address to Transaction Objects

With the flexibility described above, it is possible that the key pair that registered the multisignature account, and from which the address of the account is derived, does not sign a transaction. In order to deduce the sender account (or rather the sender address) from a transaction object originating from a multisignature account, we propose that also for transactions from multisignature accounts the `senderPublicKey` property has to be provided. The value of this property has to be the public key used for registering the multisignature account.

#### Key Weights

One could increase the flexibility for the account rules even more by using weights for the keys. That means, one associates a weight to each key of the keys group and defines a weight threshold. Then, a transaction requires a set of signatures such that the sum of the weights of the corresponding keys is larger than the weight threshold. Such a system is used, for instance, in [BitShares](https://docs.bitshares.org/en/master/user_guide/accounts/bts_multi-sign.html). However, this approach lacks simplicity and the proposed system is considered to be a better tradeoff between flexibility and simplicity while preserving the rules for the existing accounts.

### Allow the Usage of a Single Key Pair for Each User

We propose to not require that the public key that registered the multisignature account belongs to the group of keys of the multisignature account, neither to the group of mandatory nor to the group of optional keys. This allows the following: Let **U**={_U<sub>1</sub>_, ..., _U<sub>n</sub>_} be a set of users where each user possesses a key pair for their “personal” account. Moreover, the users in **U** want to create a shared multisignature account. However, each user in **U** wants to add its existing public key to the multisignature account because nobody wants to handle a second private key (or passphrase). Then, one of the users, say _U<sub>k</sub>_, creates a temporary key pair, _KP<sub>temp</sub>_, transfers some Lisk tokens to the corresponding address of _KP<sub>temp</sub>_ and registers this account as a multisignature account. During the registration, _U<sub>k</sub>_ adds the public keys for every user in **U** to the keys group, including its own public key (which is not the one from _KP<sub>temp</sub>_). Once the registration is included in the blockchain, _U<sub>k</sub>_ can “forget” the private key of _KP<sub>temp</sub>_ (or the corresponding passphrase) since this private key cannot be used anymore to access the funds. Note that the participants still need to "remember" the public key of _KP<sub>temp</sub>_ to issue transactions (see [above](#adding-sender-address-to-transaction-objects)). But it does not need be kept secret, and front end tools like Lisk Hub could do this job for the user.

#### Multisignature Accounts as Delegate Accounts

In the current protocol, it is possible that an account is both a multisignature account and a delegate account. Since such accounts exist, this flexibility has to be kept. We propose that if a multisignature account is registered to be a delegate account (or if a delegate account is registered to be a multisignature account), then the public key that performed the multisignature registration is the delegate key. Block signatures have to be done by this key pair, even if the delegate key does not belong to the keys group. Note that in the example above, the user _U<sub>k</sub>_ should not forget the key pair _KP<sub>temp</sub>_ if the account is supposed to be a delegate account because _KP<sub>temp</sub>_ is needed for signing blocks.

### Increase Upper Bound on Keys Group

A small upper bound on the number keys for a multisignature account is useful in a static fee system to prevent users from including transactions of huge size (due to a large number of signatures) into the blockchain without paying a fee higher than for a transaction with a single signature. However, a small upper bound becomes superfluous if the following requirements are fulfilled:

1. The fee of a transaction is proportional to the number of signatures.
2. The storage required to store a transaction on a node is proportional to the number of signatures.
3. The number of computational steps to verify a transaction is proportional to the number of signatures.

In other words, if the fee for a transaction is proportional to the required computational and storage resources then there is no harm in allowing a high number of signatures. In practice, we cannot achieve exact proportionality, but linear dependencies which we consider to be sufficient. Point 1 is achieved by a dynamic fee system in which the fee depends linearly on the size of a transaction, e.g., the one [currently proposed](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0013.md) for Lisk. Point 2 is already fulfilled in the current protocol. To achieve point 3 as well, we propose to define an order on the set of public keys of a multisignature account such that each public key has a distinct index. Then, a transaction originating from a multisignature account does not contain a list of signatures, but a list of pairs where each pair contains a signature and the index of the corresponding public key (see [below](#indexes-of-public-keys) for details). This allows to verify all signatures by iterating only once through the list of pairs. Note that users should not be required to manage the indexes by themselves. This should be done by the tools used to create the transactions (either the wallet or 
[the tools used for collecting](#facilitate-the-collection-of-signatures) the signatures).

There are, however, still some limitations that disallow arbitrarily large numbers of keys. The block size limit proposed in [LIP 0002](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0002.md) is 15 kB. Hence, no transaction can be larger than 15 kB if LIP 0002 gets implemented. To keep a generous buffer for potential protocol changes in the future that introduce transactions with a very large payload, we propose a rather conservative limit of at most 64 keys per account. 64 signatures require 4.1 kB of size which leaves more than 10 kB for the maximum payload size of a transaction. Note that this upper limit can easily be increased in the future by simply changing a constant.

### Making the Signatures Set Immutable

The byte array of a transaction used for computing the transactionID and used in the payload hash of a block is not containing the value of the `signatures` property in the current protocol. This makes the set of signatures for a transaction from a multisignature account mutable. To avoid any mutable data contained in transactions, we propose to add the signatures to the byte array.

This has, however, the consequence that a transaction from a multisignature account can have several transactionsIDs. For example, if there is a transaction, `tx`, from a 2-out-of-3 multisignature account with 3 signatures, then 4 different transactionIDs are possible (3 transactionIDs for picking 2 out of 3 signatures and one for taking all signatures). To avoid that this can be exploited, we require that [LIP 0015](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0015.md) is implemented. LIP 0015 replaces the uniqueness requirement of transactionIDs by a uniqueness requirement for _nonces_. If LIP 0015 is not implemented, then it will be possible to replay a transaction. For example, the transaction `tx` could be replayed 3 times with the given signature set (in fact, a cosigner can replay `tx` almost arbitrarily often since signatures are not unique for a given key pair and message). 

Moreover, transactionIDs are used to identify unconfirmed transactions (transaction that are not included in the blockchain) within the peer-to-peer communication. Therefore, it is desirable to use a single transactionID for the same transaction. To mitigate the risk that the same transaction is broadcast with different sets of signatures in the network, and therefore different transactionIDs, we propose to reject a transaction that has more signatures than required. Otherwise, it could happen that some nodes modify the transaction object by reducing the signature set to a minimum and distributing the same transaction with a new transactionID in the network. Especially active delegates could be tempted to do so, since they have an incentive to reduce the number of signatures once a dynamic fee system is enabled (currently planned and proposed in [LIP 0013](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0013.md)). For this reason, we use the name `numberOfSignatures` instead of `min` in the proposed protocol.

### Combinations with 2nd Passphrase Registrations

In the current protocol, it is allowed to do a second public key registration (transaction type 1) and a multisignature registration for the same account, and there are some accounts for which both registrations were done. With the proposed changes, it will not be required anymore to do both registrations separately to achieve these specific account rules. Therefore, and for the sake of simplicity, we propose to not allow

*   to perform a second public key registration for a multisignature account, and
*   to perform multisignature registration for accounts with a registered 2nd public key.

#### Existing Combinations

The _second signature_ of a second signature account is the signature of a transaction object that includes the _first signature_. However, with this proposal, there exists no _first signature_ anymore for multisignature accounts. To avoid some extra logic for second signature accounts, we propose to convert existing accounts for which both registrations were done into a multisignature account with two mandatory keys (the original public key of the account and the second registered public key) and all keys from the keygroup as optional keys. Moreover, the `numberOfSignatures` value equals `min`+1. Such an account will not be considered anymore as a second signature account. Note that this conversion does not change the access rules of the account.

## Specification

### Multisignature Account Registration

A multisignature account is created by converting an existing account into a multisignature account. This is done via a transaction of type 4 (multisignature registration transaction). This transaction has to be sent from the account that is supposed to be converted. Besides all mandatory properties of a transaction (`type`, `senderPublicKey`, etc.), the registration transaction needs the following:

1. The `asset` property needs to contain the property `mandatoryKeys`. The value of this property is an array of pairwise distinct public keys. Once the account is registered as a multisignature account, every outgoing transaction requires for every public key in `mandatoryKeys` a signature. The array may be empty.
2. The `asset` property needs to contain the property `optionalKeys`. The value of this property is an array of pairwise distinct public keys. Once the account is registered as a multisignature account, every outgoing transaction requires some signatures for some public keys in `optionalKeys` (the number of needed signatures depends on the `numberOfSignatures` property and may also be zero). The array may be empty.
3. The sets of mandatory and optional keys, specified by `mandatoryKeys` and `optionalKeys,` must be disjoint and their union must have at least two elements. The total number of public keys is upper bounded by 64.
4. The `asset` property needs to contain the `numberOfSignatures` property. 
    - The value must be an integer between 1 and the total number of public keys of the account (sum of optional and mandatory keys).
    - The value must not be smaller than the length of the value of `mandatoryKeys`.
    - The value specifies how many signatures are needed for every outgoing transaction from the registered multisignature account, where signatures for mandatory and optional keys are counted.
5. The transaction object needs to contain the `signatures` property. The value of this property is an array where each entry is an object with the properties `index` and `signature`. The value of index must be an integer. Moreover:
    - For every entry `e`, the signature `e.signature` must be a valid signature of the registration transaction for the public key of the account with index `e.index` (see [below](#indexes-of-public-keys) for the specification of _index_).
    - For any two distinct entries `e1` and `e2`, the indexes `e1.index` and `e2.index` must be distinct. 
    - For every public key in `mandatoryKeys` or `optionalKeys,` there must be an entry with a valid signature and matching index.
    - If the sender public key is also contained in one of the two arrays, then there must be a index-signature entry for this public key as well.

    The `signatures` property of the current protocol that holds an array of signatures is replaced by this one.

The properties `lifetime` and `keysgroup` are not required anymore and will be ignored.

The address of the multisignature account is the same as the one before the multisignature registration (as in the current protocol). That means, this address has to be used as the `recipientID` for balance transfers to this multisignature account.

#### Indexes of Public Keys

Each public key of a multisignature account gets an index which is used for the outgoing transactions. For this, a relational operator is needed: For two public keys _pk<sub>1</sub>_ and _pk<sub>2</sub>_, we say that _pk<sub>1</sub>_ is larger than _pk<sub>2</sub>_, and write _pk<sub>1</sub> > pk<sub>2</sub>_, if and only if the 256-bit representation of _pk<sub>1</sub>_ interpreted as a big-endian encoded integer is larger than the one of _pk<sub>2</sub>_.

Let _s_ be the number of mandatory keys and _t_ be the number of optional keys of a multisignature account. Furthermore, let {_k<sub>1</sub>_, _k<sub>2</sub>_, …, _k<sub>s+t</sub>_} be the set of all public keys of the account, i.e. all mandatory and all optional public keys, such that the sequence **K**=(_k<sub>1</sub>_, _k<sub>2</sub>_, …, _k<sub>s+t</sub>_) fulfills the following:

*   _k<sub>1</sub>_, …, _k<sub>s</sub>_ are mandatory public keys and _k<sub>1</sub>_ > _k<sub>2</sub>_ > … > _k<sub>s-1</sub>_ > _k<sub>s</sub>_.
*   _k<sub>s+1</sub>_, …, _k<sub>t</sub>_ are optional public keys and _k<sub>s+1</sub>_ > _k<sub>s+2</sub>_ > … > _k<sub>t-1</sub>_ > _k<sub>t</sub>_.

The _index_ of a public key _k_ is then the position of _k_ in **K**, where the positions range from 1 to _s+t_, i.e., the index of _k<sub>i</sub>_ is _i_ for every _i=1_, ..., _s+t_.

### Transaction Creation and Verification

An outgoing transaction from a multisignature account needs to fulfill the following in order to be valid:

1. The `senderPublicKey` property of the transaction JSON contains the public key used for registering the multisignature account.
2. The transaction JSON has the property `signatures.` The value of this property contains an array where each entry is an object with the properties `index` and `signature`. The value of index must be an integer. Moreover, the array must fulfill the following: 
    - For every entry `e`, the signature `e.signature` must be a valid signature of the transaction for the public key of the account with index `e.index`.
    - For any two distinct entries `e1` and `e2`, the indexes `e1.index` and `e2.index` must be distinct. 
    - For every mandatory public key of the account, there must be an entry with a valid signature and matching index.
    - There must be an entry with a valid signature and matching index for exactly _m_ distinct public keys specified for the account (mandatory and optional keys), where _m_ is the `numberOfSignatures` value specified for the account during the registration (in other words, there must be an entry with a valid signature and matching index for exactly _m-p_ distinct public keys specified in `optionalKeys` if the account has _p_ mandatory keys).

    The `signatures` property of the current protocol which holds an array of signatures is replaced by this one.

Moreover, the `signature` property is ignored in the transaction verification.

### Transaction Broadcasting

When a node receives a transaction, it first has to verify the transaction before broadcasting. This includes the steps 1 and 2 from the [section above](#transaction-creation-and-verification) for transactions from multisignature accounts. In particular, a node is not allowed to broadcast a transaction that does not have the correct number of signatures (step 2).

### Transaction Serialization

#### Asset Property Serialization for Multisignature Registration Transactions

The asset property of a transaction of type 4 has to be serialized as by the function `serialize_asset_for_type_4` in the pseudocode below. This serialization is used to compute the byte array of a transaction for the signature computation, the transactionID computation and to include the transaction into the payload hash of a block.

```
serialize_asset_for_type_4(asset):
    let byteBuffer be an empty byte buffer
    let lm be the length of the array asset.mandatoryKeys
    append lm as an 8-bit unsigned integer to byteBuffer 
    for each key in asset.mandatoryKeys:
        append the big endian encoding of key to byteBuffer
    let lo be the length of the array asset.optionalKeys
    append lo as an 8-bit unsigned integer to byteBuffer
    for each key in asset.optionalKeys:
        append the big endian encoding of key to byteBuffer
    append asset.numberOfSignatures as an 8-bit unsigned integer to byteBuffer
    return byteBuffer
```

Note that both `for each` loops in `serialize_asset_for_type_4` have to process the array elements in the order given in the JSON arrays.

#### Signatures Serialization

Let `tx` be a transaction of type 4 or a transaction from a multisignature account and let `{e_1, ..., e_m}` be the set of entries in the `signatures` property such that `e_1.index < ... < e_m.index`. For i=1,...,m, let `BI_i` be the byte representing `e_i.index`, `BS_i` the big endian encoding of `e_i.signature` and `B_i = BI_i||BS_i` the concatenation of `BI_i` and  `BS_i`. Let `BA_SIGS = B_1||...||B_m` and let `BA` be the byte array of `tx` that is used for computing the transactionID of `tx` and for including `tx` into the payload hash of a block. Then, `BA_SIGS` has to be contained in `BA`:

*   If `tx` is a transaction of type 4, `BA_SIGS` follows the bytes of the `signature` property.
*   If `tx` is a transaction from a multisignature account, `BA_SIGS` follows the bytes of the `asset` property.

### Converting Existing Accounts

Existing multisignature accounts are converted in order to meet the specifications of multisignature accounts [proposed above](#multisignature-account-registration):

*   The `lifetime` property is removed and ignored.
*   The set of optional keys equals the set of keys previously listed in the `keysgroup` property.
*   If the account is NOT registered as a second signature account:
    *   The set of mandatory keys contains exactly one public key, namely the one that registered the multisignature account.
    *   The value of the `numberOfSignatures` property equals the value of the `min` property. The `min` property is removed and ignored. 
*   If the account is registered as a second signature account:
    *   The set of mandatory keys contains two public key: the one that registered the multisignature account and the second registered public key. Moreover, the converted account is not treated as a second signature account anymore.
    *   The value of the `numberOfSignatures` property equals the value of the `min` property plus 1. The `min` property is removed and ignored.

### Delegate Accounts

It is allowed that an account is registered as a delegate account and as a multisignature account. Blocks forged by such an account must have a signature for the public key that was used for the multisignature account registration (i.e., the original public key of the account), even if this key does neither belong to the set of mandatory nor to the set of optional keys.

### Second Signature Registrations

*   A transaction of type 4 (multisignature registration transaction) is invalid if a transaction of type 1 (second signature registration) was already performed for the same account. 
*   A transaction of type 1 (second signature registration) is invalid if a transaction of type 4 (multisignature registration transaction) was already performed for the same account.

## Backwards Compatibility

This proposal results in a hard fork because: 

*   Every outgoing transaction from a multisignature account according to the proposed change will be rejected by nodes following the current protocol, and vice versa.
*   Transactions of type 4 according to the proposed change will be rejected by nodes following the current protocol, and vice versa.
*   Accounts that are multisignature accounts and second signature accounts in the current protocol will not be second signature accounts in the proposed protocol. This introduces another incompatibility for transactions from such accounts.
