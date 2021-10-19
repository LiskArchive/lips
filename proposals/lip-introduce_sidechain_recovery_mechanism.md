```
LIP:
Title: Introduce sidechain recovery mechanism
Author: Iker Alustiza <iker@lightcurve.io>
Type: Standards Track
Created: <YYYY-MM-DD>
Updated: <YYYY-MM-DD>
Requires: Define state and state transitions of Token module LIP, LIP 40
          Introduce Interoperability module LIP, Introduce cross-chain messages LIP
```

## Abstract

This LIP introduces three new commands to the Lisk ecosystem: the message recovery command, the state recovery command, and the recovery initialization command. The message recovery command allows users to recover cross-chain messages that are pending in the outbox of an inactive or terminated sidechain. The state recovery command is used to recover entries from the module store of a terminated sidechain, whereas the recovery initialization command is used to initialize this state recovery process on sidechains.

## Copyright

This LIP is licensed under the [Creative Commons Zero 1.0 Universal][creative].

## Motivation

In the Lisk ecosystem, the ability of a sidechain to interoperate with other chains can be revoked, i.e., terminated, permanently. Specifically, this occurs when the sidechain has been inactive for too long, i.e., not posting a transaction with a [cross-chain update (CCU)][CCU] command for more than 30 days, or if it posted one with a malicious CCU command on the mainchain. Once a sidechain is terminated in the ecosystem, the users of said chain cannot have any cross-chain interaction with it. This means they will no longer be able to send or receive any (fungible or non-fungible) token, message or custom information from or to the sidechain. Therefore, it is useful to provide a trustless on-chain mechanism to recover tokens, messages and information from terminated sidechains. This mechanism will noticeably improve the user experience of the Lisk ecosystem without affecting the security guarantees of the general interoperability solution.

## Rationale

This LIP introduces new commands to the Lisk ecosystem to provide a recovery mechanism for sidechain users in the scenario stated in the previous section. These commands are part of the Lisk [Interoperability module][interop], thus they make use of the information provided in the interoperability store of the terminated sidechain. The main use cases provided by this recovery mechanism are:

* On the Lisk mainchain:
  * The users can recover a [pending cross-chain message (CCM)][CCM] from the sidechain account outbox by submitting a transaction with a **message recovery command** on the Lisk mainchain.
  * The users can recover the balance of LSK they had on a terminated sidechain by submitting a transaction with a **state recovery command**.

* On sidechains:
  * The users can recover the balance of any custom token they had on a terminated sidechain by submitting a transaction with a **state recovery command**.
  * The users can recover any NFT they had on a terminated sidechain by submitting a transaction with a **state recovery command**.
  * The stored data of certain custom modules can be recovered from a terminated sidechain by submitting a transaction with a **state recovery command**.

In the next subsections, these mechanisms are explained together with their conditions, sidechain data availability requirements, effects, and their potential usage by certain network participants.

### Message Recovery from the Sidechain Account Outbox

This mechanism allows to recover any CCM pending in the sidechain outbox. That is, those CCMs that have not been included in the receiving sidechain yet.
Specifically, this includes all the CCMs whose indices (the position of these CCMs in the sidechain outbox tree) are larger than the index of the last message that the receiving sidechain reported to have included in its inbox on the mainchain. This recovery mechanism requires these conditions to work:

* The pending CCMs to be recovered have to be available to the sender of the recovery command.
* The indices of the pending CCMs to be recovered have to be larger than the value of the `partnerChainInboxSize` property of the interoperability account of the sidechain. This implies that these CCMs are still pending or that their processing has not been certified to the mainchain.
* The proof of inclusion for the pending CCMs into the current `outbox.root` has to be available. When a message recovery command is processed, the `outbox.root` property of the interoperability account of the corresponding sidechain is updated to account for the recovered CCMs (see Figure 1). This implies that the future potential message recovery commands have to include a proof of inclusion into the updated Merkle tree against the new `outbox.root`.

![CCM_recovery](lip-introduce_sidechain_recovery_mechanism/CCMrecovery.png)

_Figure 1: (top) The message recovery command recovers CCM<sub>32</sub> and CCM<sub>34</sub> by providing their indices and the sibling hashes to compute the outbox root (the proof of inclusion for these CCMs in the tree). The data provided by the command is highlighted in red in the tree. (bottom) The outbox root is then updated by recomputing the Merkle tree root with the recovered CCMs. In the second Merkle tree the updated nodes are highlighted in green. A new recovery command will need to provide a proof of inclusion for this updated Merkle tree._

Assuming these conditions are fulfilled, any user can submit a message recovery command to recover several CCMs at the same time. When the command is processed, the corresponding CCMs are recovered differently depending on their sending chain:

* If the sending chain of the pending CCM is the Lisk mainchain, it must be a cross-chain LSK token transfer CCM. The amount of LSK transferred in the CCM will be added back to the sender of the original transaction.
* If the sending chain of the pending CCM is any other sidechain, the CCM will be sent back to this chain. The sending sidechain will act on the CCM as usual, i,e., with respect to the specific logic associated with the cross-chain command.

Bear in mind that users are not guaranteed to recover their CCMs in every situation. Certain state information of the terminated sidechain might have been modified before termination and this would make the recovered CCM application fail. For example, the escrowed LSK in the sidechain account on the mainchain could have been subtracted by prior malicious behavior in the terminated sidechain.

### State Recovery from the Sidechain State Root

This mechanism allows to recover a specific entry from a substore (i.e. the collection of key-value pairs with a common store prefix) of a module store of a terminated sidechain. Here "recover" means triggering a specific state transition defined as part of the relevant module protocol logic. In particular, it is based on the sidechain state root, `stateRoot`, set in the last certificate before sidechain termination. In the context of the mainchain, a valid state recovery command can recover the LSK token balance that users had in the terminated sidechain. In the context of a sidechain, it can recover an entry in a recoverable module store from a terminated sidechain. A recoverable module is any module that exposes a recover function. This includes the [token module][tokenLIP] (for any custom token) and the [NFT module][NFTLIP].

This recovery mechanism requires these conditions to be valid:

* The state of the sidechain has to be consistent with respect to the value of the `stateRoot` property in the interoperability account of the sidechain in the mainchain.
* The specific entry of the substore of the recoverable module store to be recovered has to be available.
* The proof of inclusion for the specific entry to be recovered into the current `stateRoot` has to be available.
* When one of these commands is processed, the `stateRoot` property of the terminated sidechain is updated to account for the recovered tokens.
* This implies that the future potential state recovery commands on a specific chain have to include a proof of inclusion into the updated sparse Merkle tree against the new `stateRoot`.

There is an extra requirement in the case of recoveries in the sidechain context: The sidechain in which the recovery will happen needs to be aware of the `stateRoot` of the terminated sidechain. In general, this information is only available on mainchain (in the interoperability account of the terminated sidechain). A way to make sidechains aware of this specific information for state recoveries is needed. This recovery initialization process on sidechains can happen in two ways:
* **Recovery initialization command**: This command is used to prove on a sidechain the value that the `stateRoot` of the terminated sidechain has on mainchain.
Any user on the corresponding sidechain can send a transaction with this command and initiate the state recoveries with respect to the terminated sidechain.
* **Sidechain terminated message**: As specified in the [cross-chain message LIP][CCMterminatedMessage], when a CCM reaches a receiving chain that has been terminated, a sidechain terminated message is created and sent back to the sending chain carrying the `stateRoot` of the terminated sidechain. The application of this CCM on the sidechain will effectively initiate the recovery process.

Assuming these conditions are fulfilled, the entries of substores of any recoverable module in a terminated sidechain can be recovered back to the chain in which the transaction with this command was submitted. In particular, users can recover their LSK tokens back to their user account on mainchain. What is more, sidechain developers may implement any custom logic for the `recover` function in their custom modules, so that recoveries may have different functionalities depending on the module and the sidechain where the process happens.

Similar to the case for message recovery commands, it is not guaranteed to recover from the expected state in every situation. Certain state information of the terminated sidechain might have been modified and certified to the mainchain before termination.

In summary, the functionality provided by these recovery commands applies for sidechains that were terminated for inactivity or [other violations of the interoperability protocol][CCUviolations]. If the validators of the terminated sidechain were byzantine in the past, i.e., the security guarantees of the sidechain were broken, it is likely that these recovery mechanisms would not work.

### Recovery Commands as an Off-chain Service

As explained in the previous subsections, these recovery commands require specific information from the terminated sidechain to be available. In particular, for the message recovery mechanism, all the pending CCMs, their position in the sidechain outbox root, and the state of the sidechain outbox (root, size, and append path) up to the last non-pending CCM have to be available. For the state recovery mechanism, the sidechain state up to the last valid cross-chain update has to be available. Moreover, this information has to be updated for future recovery commands every time a recovery command is successfully processed.

In particular, message recovery commands are better suited to be submitted by accounts with access to a Lisk mainchain full node. The complete Merkle tree with root equal to the last value of the `outbox.root` property of the sidechain account can be computed from the history of the Lisk mainchain. In the case of submitting transactions with a state recovery command, a full node of the sidechain should also keep a snapshot of the sidechain state tree corresponding to the last certified `stateRoot` on mainchain. As explained above, these commands require the state of the sidechain to be consistent with the last value of `stateRoot`. However, the state of the sidechain may have evolved since the last CCU. That is why if a sidechain node intends to be ready to eventually submit these commands, they need to store this extra state information.

Since these technical requirements are not straightforward, the recovery commands are better suited to be offered as an off-chain service to sidechain users. When a sidechain is terminated, these recovery-service providers can recover the CCMs, tokens, NFTs or in general, any cross-chain information for the interested users.

## Specification

### Constants

| Name                                 | Type   | Value        |
|--------------------------------------|--------|--------------|
| **Module**                           |        |              |
| `MODULE_ID_INTEROPERABILITY`         | uint32 | 64           |
| `MODULE_ID_TOKEN`                    | uint32 | TBD          |
| **Store Prefix**                     |        |              |
| `STORE_PREFIX_CHAIN_DATA`            | bytes  | 0x8000       |
| `STORE_PREFIX_TERMINATED_CHAIN`      | bytes  | 0xc000       |
| **Status**                           |        |              |
| `CHAIN_TERMINATED`                   | uint32 | 2            |
| `CCM_STATUS_OK`                      | uint32 | 0            |
| `CCM_STATUS_RECOVERED`               | uint32 | 4            |
| **Command ID**                       |        |              |
| `COMMAND_ID_MESSAGE_RECOVERY`        | uint32 | 4            |
| `COMMAND_ID_STATE_RECOVERY`          | uint32 | 5            |
| `COMMAND_ID_RECOVERY_INITIALIZATION` | uint32 | 6            |
| `CROSS_CHAIN_COMMAND_ID_TRANSFER`    | uint32 | 0            |
| **Other**                            |        |              |
| `MAINCHAIN_ID`                       | uint32 | 1            |
| `LIVENESS_LIMIT`                     | uint32 | `30*24*3600` |

This LIP specifies three commands for Lisk mainchain. These commands are part of the [Interoperability module][interop], with `moduleID = MODULE_ID_INTEROPERABILITY`.

### General Notation

In the rest of the section:

* Let `account(chainID)` be the object of the interoperability account store with `storePrefix = STORE_PREFIX_CHAIN_DATA` and `storeKey = chainID`.
* Let `terminatedAccount(chainID)` be the object of the terminated account store with `storePrefix = STORE_PREFIX_TERMINATED_CHAIN` and `storeKey = chainID`.
* Let `isLive` and `terminateChain` be the interoperability module internal functions defined in the [Introduce Interoperability module LIP][interop].
* Let `uint32be` be the function for the big endian uint32 serialization of integers defined in the [Introduce Interoperability module LIP][interop].
* Let `process` be the internal function with the same name defined in [Introduce cross-chain messages LIP][CCM].
* Let `unescrow` be the function with the same name defined in [Define state and state transitions of Token module LIP][tokenCCM].
* Let `RMTVerify` be the `verifyDataBlock` function specified in [the appendix C of LIP 0031][LIP31appendixC].
* Let `RMTCalculateRoot` be the `calculateRootFromUpdateData` function specified in [the appendix E of LIP 0031][LIP31appendixE].
* Let `SMTVerify` be the `verify` function specified in the [LIP 0039][SMTLIP].
* Let `SMTCalculateRoot` be the `calculateRoot` function specified in the [LIP 0039][SMTLIP].

### Message Recovery Command

The command ID is `COMMAND_ID_MESSAGE_RECOVERY`.

* `params` property:
  * `chainID`: An integer representing the chain ID of the terminated sidechain.
  * `crossChainMessages`: An array of serialized CCMs, according to the schema specified in [Cross-chain messages LIP][CCMschema], to be recovered.
  * `idxs`: An array of indices corresponding to the position in the outbox Merkle tree of the sidechain for the elements in `crossChainMessages` as specified in [LIP 0031][LIP31inclusions].
  * `siblingHashes`: Array of bytes with the paths in the Merkle tree for the proofs of inclusion of `crossChainMessages` in the outbox root of the sidechain as specified in [LIP 0031][LIP31inclusions].

#### Message Recovery Command Schema

```java
messageRecoveryParams = {
    "type": "object",
    "required": ["chainID", "crossChainMessages", "idxs", "siblingHashes"],
    "properties": {
        "chainID": {
            "dataType": "uint32",
            "fieldNumber": 1
        },
        "crossChainMessages": {
            "type": "array",
            "items": {
                "dataType": "bytes"
            },
            "fieldNumber": 2
        },
        "idxs": {
            "type": "array",
            "items": {
                "dataType": "uint64"
            },
            "fieldNumber": 3
        },
        "siblingHashes": {
            "type": "array",
            "items": {
                "dataType": "bytes"
            },
            "fieldNumber": 4
        }
    }
}
```

#### Message Recovery Command Verification

Let `trs` be a transaction with module ID `MODULE_ID_INTEROPERABILITY` and command ID `COMMAND_ID_MESSAGE_RECOVERY` to be verified. Also, let `deserializedCCMs` be an array with the deserialization of every element in `trs.params.crossChainMessages` according to the schema specified in [Cross-chain messages LIP][CCMschema]. Then the set of validity rules to validate `trs.params` are:

```python
if trs.params.chainID does not correspond to a registered sidechain:
    return false
sidechainAccount = account(trs.params.chainID)

# Chain has to be either terminated or inactive
timestamp = timestamp of the block including trs
if sidechainAccount.status != CHAIN_TERMINATED and isLive(trs.params.chainID, timestamp):
    return false

# Check that the CCMs are still pending
for index in trs.params.idxs:
    if index < sidechainAccount.partnerChainInboxSize:
        return false

# Check the validity of the CCMs to be recovered
for CCM in deserializedCCMs:
    if CCM.status != CCM_STATUS_OK:
        return false
    if CCM.sendingChainID == MAINCHAIN_ID:
        if CCM.moduleID != MODULE_ID_TOKEN:
            return false
        if CCM.crossChainCommandID != CROSS_CHAIN_COMMAND_ID_TRANSFER:
            return false

# Check the inclusion proof against the sidechain outbox root
proof = { size: sidechainAccount.outbox.size,
	  idxs: trs.params.idxs,
	  siblingHashes: trs.params.siblingHashes}

return RMTVerify( [SHA-256(CCMData) for CCMData in trs.params.crossChainMessages],
                  proof,
		  sidechainAccount.outbox.root)
```

#### Message Recovery Command Execution

Processing a transaction `trs` with module ID `MODULE_ID_INTEROPERABILITY` and command ID `COMMAND_ID_MESSAGE_RECOVERY` implies the following logic:

```python
let trsSenderAddress be the address of the trs.senderPublicKey
sidechainAccount = account(trs.params.chainID)

# Terminate chain if necessary
if sidechainAccount.status != CHAIN_TERMINATED:
    terminateChain(trs.params.chainID)

# Set CCM status to recovered and assign fee to trs sender
updatedCCMs = []
for CCM in deserializedCCMs:
    unescrow(trs.params.chainID, trsSenderAddress, 0, CCM.fee)
    CCM.fee = 0
    CCM.status = CCM_STATUS_RECOVERED
    push serialized(CCM) to updatedCCMs # CCM is serialized again

# Update sidechain outbox root
proof = { size: sidechainAccount.outbox.size,
	  idxs: trs.params.idxs,
	  siblingHashes: trs.params.siblingHashes}

sidechainAccount.outbox.root = RMTCalculateRoot([SHA-256(CCMData) for CCMData in updatedCCMs], proof)

# Process recovery
for CCM in deserializedCCMs:
    if CCM.sendingChainID == MAINCHAIN_ID:
        # This is a LSK transfer CCM
        unescrow(trs.params.chainID, CCM.params.senderAddress, 0, CCM.params.amount)
    else:
       swap CCM.sendingChainID and CCM.receivingChainID
       process(CCM)
```

### State Recovery Command

The command ID is `COMMAND_ID_STATE_RECOVERY`.

* `params` property:
  * `chainID:` An integer representing the chain ID of the terminated sidechain.
  * `moduleID`: An integer representing the ID of the recoverable module.
  * `storeEntries`: An array of objects containing:
    * `storePrefix`: An integer representing the store prefix to be recovered.
  * `storeKey`: Array of bytes with the store key to be recovered.
    * `storeValue`: Array of bytes with the store value to be recovered.
    * `bitmap`: The bitmap corresponding to `storeValue` in the sparse Merkle tree as specified in [LIP 0039][SMTproof].
  * `siblingHashes`: Array of bytes with the sibling hashes in the sparse Merkle tree for the inclusion proofs of `storeEntries` in the state of the sidechain as specified in [LIP 0039][SMTproof].

#### State Recovery Command Schema

```java
stateRecoveryParams = {
    "type": "object",
    "required": ["chainID", "moduleID", "storeEntries", "siblingHashes"],
    "properties": {
        "chainID": {
            "dataType": "uint32",
            "fieldNumber": 1
        },
        "moduleID": {
            "dataType": "uint32",
            "fieldNumber": 2
        },
        "storeEntries": {
            "type": "array",
            "fieldNumber": 3,
            "items": {
                "type": "object",
                "properties": {
                    "storePrefix": {
                        "dataType": "uint32",
                        "fieldNumber": 1
                    },
                    "storeKey": {
                        "dataType": "bytes",
                        "fieldNumber": 2
                    },
                    "storeValue": {
                        "dataType": "bytes",
                        "fieldNumber": 3
                    },
                    "bitmap": {
                        "dataType": "bytes",
                        "fieldNumber": 4
                    }
                },
                "required": ["storePrefix", "storeKey", "storeValue", "bitmap"]
            }
        },
        "siblingHashes": {
            "type": "array",
            "items": {
                "dataType": "bytes"
            },
            "fieldNumber": 4
        }
    }
}
```

#### State Recovery Command Verification

Let `trs` be a transaction with module ID `MODULE_ID_INTEROPERABILITY` and command ID `COMMAND_ID_STATE_RECOVERY` to be verified. Then `trs` is valid if the following logic returns `true`:

```python
sidechainAccount = terminatedAccount(trs.params.chainID)
# The terminated account has to exist for this sidechain
if sidechainAccount is empty:
    return false

let queryKeys and storeQueries be empty arrays

for each entry in trs.params.storeEntries:
    # The recover function corresponding to the module ID has to pass
    route processing logic to the module given by trs.params.moduleID
    if recover(trs.params.chainID, trs.params.moduleID, entry.storePrefix, entry.storekey, entry.storeValue) fails:
        return false

push entry.storeKey to queryKeys

query = { key: entry.storeKey,
          value: SHA-256(entry.storeValue),
          bitmap: entry.bitmap}
push query to storeQueries

proofOfInclusionStores = { siblingHashes: trs.params.siblingHashes, queries : storeQueries}

return SMTVerify(queryKeys, proofOfInclusionStores, sidechainAccount.stateRoot)
```

#### State Recovery Command Execution

Processing a transaction `trs` with module ID `MODULE_ID_INTEROPERABILITY` and command ID `COMMAND_ID_STATE_RECOVERY` implies the following logic:

```python
sidechainAccount = terminatedAccount(trs.params.chainID)

let storeQueries be an empty array

for each entry in trs.params.storeEntries:
    # The recover function corresponding to the module ID applies the recovery logic
    route processing logic to the module given by trs.params.moduleID
    recover(trs.params.chainID, trs.params.moduleID, entry.storePrefix, entry.storeKey, entry.storeValue)

    emptyStore = empty bytes # Define an empty store entry
    query = { key: entry.storekey,
              value: SHA-256(emptyStore),
              bitmap: entry.bitmap}
    push query to storeQueries

sidechainAccount.stateRoot = SMTCalculateRoot(trs.params.siblingHashes, storeQueries)
```
#### Recover Function

For the verification and application of this command it is assumed that the module given by `trs.params.moduleID` exposes a `recover` function, with the following interface:

```
recover(terminatedChainID, moduleID, storePrefix, storeKey, storeValue),
```

where:

* `terminatedChainID`: The ID of the terminated chain.
* `moduleID`: The ID of the recoverable module.
* `storePrefix`: The store prefix of the store entry in the recoverable module state.
* `storeKey`: The store key of the store entry in the recoverable module state.
* `storeValue`: The store value of the store entry in the recoverable module state.

The recover function is specified for the [Token module][tokenReducer] and in the [NFT module][NFTReducer].

### Recovery Initialization Command

The command ID is `COMMAND_ID_RECOVERY_INITIALIZATION`.

* `params` property:
  * `chainID:` An integer representing the chain ID of the terminated sidechain.
  * `sidechainInteropAccount`: A byte array containing the serialization of the interoperability account of the terminated sidechain according to the `interoperabilityAccount` schema specified in [the Interoperability LIP][interopAccount].
  * `bitmap`: The bitmap corresponding to `stateRoot` in the sparse Merkle tree as specified in [LIP 0039][SMTproof].
  * `siblingHashes`: Array of bytes with the sibling hashes in the sparse Merkle tree for the inclusion proofs of `stateRoot` in the state of the mainchain as specified in [LIP 0039][SMTproof].

#### Recovery Initialization Command Schema

```java
recoveryInitializationParams = {
    "type": "object",
    "required": [
        "chainID",
        "sidechainInteropAccount",
        "bitmap",
        "siblingHashes"
    ],
    "properties": {
        "chainID": {
            "dataType": "uint32",
            "fieldNumber": 1
        },
        "sidechainInteropAccount": {
            "dataType": "bytes",
            "fieldNumber": 2
        },
        "bitmap": {
            "dataType": "bytes",
            "fieldNumber": 3
        },
        "siblingHashes": {
            "type": "array",
            "items": {
                "dataType": "bytes"
            },
            "fieldNumber": 4
        }
    }
}
```

#### Recovery Initialization Command Validation

Let `trs` be a transaction with module ID `MODULE_ID_INTEROPERABILITY` and command ID `COMMAND_ID_RECOVERY_INITIALIZATION` to be verified.

```python
if trs.params.chainID == 1 or trs.params.chainID == ownChainID:
    return false

mainchainAccount = account(MAINCHAIN_ID)
sidechainAccount = terminatedAccount(trs.params.chainID)
let deserializedInteropAccount be the deserialization of trs.params.sidechainInteropAccount

# The commands fails if the sidechain is already terminated on this chain
if sidechainAccount exists:
    return false

if (deserializedInteropAccount.status != CHAIN_TERMINATED
    and mainchainAccount.lastCertifiedTimestamp - deserializedInteropAccount.lastCertifiedTimestamp <= LIVENESS_LIMIT):
    return false

interopAccKey = uint32be(MODULE_ID_INTEROPERABILITY) || STORE_PREFIX_CHAIN_DATA || uint32be(trs.params.chainID)

query = { key: interopAccKey,
          value: SHA-256(trs.params.sidechainInteropAccount),
          bitmap: trs.params.bitmap }

proofOfInclusionInteropAccount = { siblingHashes: trs.params.siblingHashes, queries : [query]}

return SMTVerify(queryKeys, proofOfInclusionInteropAccount, mainchainAccount.stateRoot)
```

#### Recovery Initialization Command Execution

Processing a transaction `trs` with module ID `MODULE_ID_INTEROPERABILITY` and command ID `COMMAND_ID_RECOVERY_INITIALIZATION` implies the following logic:

```python
let deserializedInteropAccount be the deserialization of trs.params.sidechainInteropAccount

create a terminatedAccount entry in the terminatedChain substore with
    storePrefix = STORE_PREFIX_TERMINATED_CHAIN
    storeKey = uint32be(trs.params.chainID)
    storeValue = object serialized according to terminatedChain schema

let sidechainAccount = terminatedAccount(trs.params.chainID)

sidechainAccount.stateRoot = deserializedInteropAccount.lastCertifiedStateRoot
```

## Backwards Compatibility

This LIP introduces new commands with new effects to the Lisk mainchain state, thus it will imply a hardfork. It also implies that sidechains implement the Interoperability module, recoverable modules and follow the standard state model structure.

## Reference Implementation

TBA

[creative]: https://creativecommons.org/publicdomain/zero/1.0/
[CCU]: https://research.lisk.com/t/introduce-cross-chain-update-transactions/298
[interop]: https://research.lisk.com/t/properties-serialization-and-initial-values-of-the-interoperability-module/290
[CCM]: https://research.lisk.com/t/cross-chain-messages/299
[tokenLIP]: https://research.lisk.com/t/introduce-an-interoperable-token-module/295
[NFTLIP]: https://research.lisk.com/t/introduce-a-non-fungible-token-module/297
[tokenCCM]: https://research.lisk.com/t/introduce-an-interoperable-token-module/295
[NFTCCM]: https://research.lisk.com/t/introduce-a-non-fungible-token-module/297
[CCMterminatedMessage]: https://research.lisk.com/t/cross-chain-messages/299#sidechain-terminated-message-42
[CCUviolations]: https://research.lisk.com/t/introduce-cross-chain-update-transactions/298#cross-chain-updates-posted-on-mainchain-26
[LIP31appendixC]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0031.md#appendix-c-proof-of-inclusion-protocol-for-leaf-nodes
[LIP31appendixE]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0031.md#appendix-e-update-of-leaf-nodes
[SMTLIP]: https://research.lisk.com/t/introduce-sparse-merkle-trees/283#proof-verification-12
[CCMschema]: https://research.lisk.com/t/cross-chain-messages/299#cross-chain-message-schema-21
[LIP31inclusions]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0031.md#proof-of-inclusion
[tokenReducer]: https://research.lisk.com/t/introduce-an-interoperable-token-module/295#recover-75
[NFTReducer]: https://research.lisk.com/t/introduce-a-non-fungible-token-module/297/2#recover-75
[interopAccount]: https://research.lisk.com/t/properties-serialization-and-initial-values-of-the-interoperability-module/290#json-schemas-68
[SMTproof]: https://github.com/LiskHQ/lips-staging/blob/Add-LIP-Introduce-sparse-Merkle-trees/proposals/lip-Introduce-sparse-Merkle-trees.md#proof-construction
