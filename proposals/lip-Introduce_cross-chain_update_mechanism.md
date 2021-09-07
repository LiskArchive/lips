```
LIP:
Title: Introduce cross-chain update mechanism
Author: Maxime Gagnebin <maxime.gagnebin@lightcurve.io>
Type: Standards Track
Created: <YYYY-MM-DD>
Updated: <YYYY-MM-DD>
Discussions-To: https://research.lisk.com/t/introduce-cross-chain-update-mechanism/298
Requires: Introduce cross-chain messages, Introduce Interoperability module
```


## Abstract

This LIP introduces _cross-chain update transactions_ which are used to post certified information and cross-chain messages in Lisk ecosystem chains. 

Cross-chain update transactions are the carriers of the information transmitted between chains. 
By posting a cross-chain update, the receiving chain gets the information required about the advancement of the sending chain. 
The transaction can also include cross-chain messages and thus serves as an envelope for messages from one chain to another.


## Copyright

This LIP is licensed under the [Creative Commons Zero 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).


## Motivation

Motivation for the Lisk Interoperability module and the cross-chain update transaction can be found in [LIP "Introduce Interoperability module"][base-interoperability-LIP].


## Rationale


### Cross-chain Update Transaction Properties


#### sendingChainId

Identifies the chain sending the cross-chain update. 
Only cross-chain update transactions coming from [registered][registration-LIP] chains are valid, registered chains are the ones with an entry in the interoperability store corresponding to their `chainID`.


#### certificate

Used to update the cross-chain account. It must be a certificate with an adequate [BLS signature][BLS-LIP]. 
The signature is always validated against the public key set stored in the sending chain account.

It is important to note here that the validation of this signature is done with respect to the network identifier of the sending chain. 
This network identifier is included in the sending chain account in the interoperability store.


#### validatorsUpdate

The chain account will store the public keys required to validate the certificate signature. 
Those public keys have to be updated if the validator set changes in the chain sending the certificate. 
The difference between the old public key set and the new one is included in this property.

This update also contains the `newCertificateThreshold` property. 
This value is the new certificate threshold used on the sending chain to attest the validity of signed certificates.


#### inboxUpdate

The `inboxUpdate` contains the information relative to the messages to be included in the sending chain inbox. 
As specified in [LIP "Introduce Interoperability module"][base-interoperability-LIP], cross-chain messages are stored in the chain outbox on the sending chain and in the corresponding inbox on the receiving chain. 
This property contains three elements: the cross-chain messages themselves, an inclusion witness into the outbox root, and an inclusion witness of this outbox root into the state root.


##### crossChainMessages

An array of cross-chain messages. 
See [LIP "Introduce cross-chain messages"][CCM-LIP] for the general properties and processing of cross-chain messages. 
The `crossChainMessages` property must contain consecutive messages from the outbox.


##### messageWitness

In the sending chain, all cross-chain messages are added to a regular Merkle tree attested by the outbox root. 
The `messageWitness` contains two values relative to that Merkle tree: 
the `partnerChainOutboxSize`, giving the total messages sent by the partner chain, 
and the `siblingHashes`, which is part of a regular Merkle proof.

This Merkle proof is required if not all messages necessary to recompute the outbox root were given in `crossChainMessages`. 
If all messages required to compute the outbox root are included in `crossChainMessages` then `siblingHashes` can be left empty.


##### outboxRootWitness

The outbox root of the sending chain is part of a sparse Merkle tree attested by the state root (provided in the certificate). 
The `outboxRootWitness` property is an inclusion proof into the state root of the outbox root computed from the receiving chain inbox, `crossChainMessages` and `messageWitness`. 
If the cross-chain update transaction contains an empty certificate, this property can also be left empty, as the required root was already attested in a previous cross-chain update.


### Posting Cross-chain Updates on Mainchain and on Sidechains

As the roles of both mainchain and sidechain are quite different, so are the transactions used to post cross-chain updates. 
The most notable differences are:

*   On the mainchain, all CCMs included in the `inboxUpdate` must have their `sendingChainID` equal to the chainID sending the cross-chain update.
*   On sidechains, all CCMs included in the `inboxUpdate` must have their `receivingChainID` equal to the chainID of the sidechain receiving the cross-chain update.
*   As the mainchain accepts CCMs with `receivingChainID` corresponding to another sidechain, the cross-chain update processing on the mainchain is responsible for the inclusion of those CCMs in the corresponding outbox.

These points guarantee that the CCMs are always forwarded to the correct chains and that the receiving chain can be confident that the chain specified in `CCM.sendingChainID` was truly the chain issuing the CCM.


### Creating and Posting Cross-chain Update Transactions

The Lisk consensus mechanism is designed to create and publish certificates regularly, at least once per round. 
In that regard, obtaining the information required to post a cross-chain update transaction is easy and straightforward. 
The following is an example workflow that a relayer for a given sidechain could follow.

Setup to gather the required mainchain information:

*   Run a mainchain node. 
*   Maintain a list of all CCMs included in the sidechain outbox. 
    For each height where a CCM was included in the outbox, also save the inclusion witness of the outbox into the state root. 
    All CCMs and witnesses for heights that have been certified on the sidechain can be discarded.
*   Maintain a history of all validator changes on the mainchain for rounds that have not yet been certified on the sidechain.

Create a cross-chain update transaction for a given height `h1`:

*   Find a [signed certificate][certificate-generation-LIP] in the mainchain block headers for a height (say `h2`) higher or equal to `h1`. 
    This will be used as the `certificate` property of the transaction.
*   The property `inboxUpdate.crossChainMessages` lists all CCMs that have been included in the sidechain outbox up to `h2` (and which have not been included on the sidechain yet). 
    In this case, the `messageWitness` will be empty.
*   Compute the inclusion proof for the outbox root of the sidechain account into the mainchain state root. 
    This proof is then used to compute `inboxUpdate.outboxRootWitness`.
*   If the `validatorsHash` property of the certificate is different from the `validatorsHash` derived from the `validators` property of the mainchain account on the sidechain, compute the required update between both sets and include it in `validatorsUpdate`. 
    How to obtain this update is detailed in the [Appendix](#appendix).
*   Post the cross-chain update transaction on the sidechain. 

Relayers should post cross-chain update transactions on the sidechain when the need for it arises. 
This can be either because some CCMs have been included in the outbox and need to be relayed, 
or when the mainchain validators changes require the channel to be updated on the sidechain. 

The role of relayer is totally symmetric for relaying information from a sidechain to the mainchain.


#### Posting Partial Cross-chain Updates

The Lisk protocol allows relayers to post cross-chain update transactions which do not contain all CCMs, as opposed to the mechanism explained in the previous section. 
This can be useful for example when the list of CCMs is too large to be included in a single block.

The cross-chain update transaction can contain an `inboxUpdate` which does not contain all CCMs required to recompute the outbox root corresponding to the given state root. 
In that case, the relayer has to make sure that an appropriate `messageWitness` is provided. 
This witness is constructed as a right witness as defined in [LIP 0031](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0031.md).

If a cross-chain update was submitted without all the CCMs (as explained in the previous paragraph), then it is possible to provide those missing CCMs without the need to provide another `certificate` or `outboxRootWitness` (technically an empty `certificate` and `outboxRootWitness` are provided). 
The cross-chain update transaction contains only the missing CCMs and the potential `messageWitness`.

Those options for partial cross-chain update transactions are not expected to be used regularly. 
It is however a good option in corner case events where the sidechain outbox suddenly becomes very large.


#### Malicious Cross-chain Update Transactions

A cross-chain update transaction may have been created with validly signed information according to the [validity rules](#parameters-validity) and hence be included in the blockchain. 
However, the transaction could include invalid CCMs. 
Those will be detected when trying to process the `inboxUpdate`. 
If a CCM is invalid (as specified in the ["Execute Cross-chain Updates" section](#execute-cross-chain-updates)), then the sending chain is [terminated][base-interoperability-LIP-termination].


#### First Cross-chain Update from a Sidechain

The first cross-chain update from a given sidechain posted on mainchain has a special function. 
It will change the chain status from `CHAIN_REGISTERED` to `CHAIN_ACTIVE`.
This change means that the sidechain is now available to receive cross-chain messages and can interact with the mainchain.
Additionally, the sidechain must now follow the liveness condition and regularly post cross-chain updates (at least once a month).
If the sidechains fails to follow the liveness condition, it is terminated on the mainchain.

When a sidechain is started and registered, the sidechain developers might decide to not activate the sidechain straight away (maybe to do further testing).
It could happen then (intentionally or not) that an old block header (almost 30 days old) is submitted to the mainchain to activate the sidechain.
This could result in the sidechain being punished for liveness failure very soon after the activation (maybe only a few minutes later). 
To prevent this issue (and without any significant drawbacks) the first cross-chain update to be submitted on mainchain must contain a certificate less that 15 days old.
The sidechain has therefore at least 15 days to submit the next cross-chain update to the mainchain and start the regular posting of cross-chain updates.


## Specification

The Interoperability module supports two commands used to certify the state of another chain. 
Those commands have `moduleID = MODULE_ID_INTEROPERABILITY`. 
One of them, meant to be posted on the mainchain, has `commandID = COMMAND_ID_MAINCHAIN_CCU`, 
while the other, meant to be posted on sidechains, has `commandID = COMMAND_ID_SIDECHAIN_CCU`.


### Constants and Notations

The following constants are used throughout the document:

| Name          | Type    | Value       |
| ------------- |---------| ------------|
| **Interoperability Constants** |||
| `MODULE_ID_INTEROPERABILITY` | uint32 | 64     |
| `STORE_PREFIX_CHAIN_DATA`    | bytes  | 0x8000 |
| **Interoperability Command and Cross-chain Command IDs** |||
| `COMMAND_ID_SIDECHAIN_CCU`             | uint32 | 2 |
| `COMMAND_ID_MAINCHAIN_CCU`             | uint32 | 3 |
| `CROSS_CHAIN_COMMAND_ID_CCU_RECEIPT`   | uint32 | 1 |
| **Chain Status** |||
| `CHAIN_REGISTERED` | uint32 | 0 |
| `CHAIN_ACTIVE`     | uint32 | 1 |
| `CHAIN_TERMINATED` | uint32 | 2 |
| **Message Tags** |||
| `MESSAGE_TAG_CERTIFICATE ` | bytes | "LSK_CE_" ASCII-encoded |

Several of those constants are shared with the other LIPs defining the Interoperability module and all of the needed constants for the Interoperability module are defined in [LIP "Introduce Interoperability module"][base-interoperability-LIP]. 
That LIP should be considered correct if a value stated here differs.


#### uint32be

`uint32be(x)` returns the big endian uint32 serialization of an integer `x`, with `0 <= x < 2^32`. 
This serialization is always 4 bytes long.


### Parameters Schema

Both commands will use the following `params` schema:

```java
crossChainUpdateTransactionParams = {
    "type": "object",
    "required": [
        "sendingChainID", 
        "certificate", 
        "validatorsUpdate",
        "inboxUpdate"
    ],
    "properties": {
        "sendingChainID": {
            "dataType": "uint32",
            "fieldNumber": 1
        },
        "certificate": {
            "dataType": "bytes",
            "fieldNumber": 2
        },
        "validatorsUpdate": {
            "type": object, 
            "fieldNumber": 3,
            "required":[
                "keysUpdate",
                "weightsUpdate",
                "newCertificateThreshold"
            ],
            "properties":{
                "keysUpdate": {
                    "type": "array",
                    "fieldNumber": 1,
                    "items": {"dataType": "bytes"}
                },
                "weightsUpdate": {
                    "type": "array",
                    "fieldNumber": 2,
                    "items": {"dataType": "uint64"}
                },
                "newCertificateThreshold": {
                    "dataType": "uint64",
                    "fieldNumber": 3
                }
            }
        },
        "inboxUpdate": {
            "type": "object",
            "fieldNumber": 4,    
            "required": [
                "crossChainMessages", 
                "messageWitness", 
                "outboxRootWitness"
            ],
            "properties": {
                "crossChainMessages": {
                    "type": "array",
                    "fieldNumber": 1,
                    "items": {"dataType": "bytes"}
                },
                "messageWitness": {
                    "type": "object",
                    "fieldNumber": 2,
		    "required": ["partnerChainOutboxSize", "siblingHashes"],
                    "properties": { 
                        "partnerChainOutboxSize":{
                            "dataType": "uint64",
                            "fieldNumber": 1
                        },
                        "siblingHashes":{
                            "type": "array",
                            "fieldNumber": 2,
                            "items": {"dataType": "bytes"}
                        }
                    }
                },
                "outboxRootWitness": {
                    "type": "object",
                    "fieldNumber": 3,
                    "required": ["bitmap", "siblingHashes"],
                    "properties": {
                        "bitmap":{
                            "dataType": "bytes",
                            "fieldNumber": 1
                        },
                        "siblingHashes":{
                            "type": "array",
                            "fieldNumber": 2,
                            "items": {"dataType": "bytes"}
			}
                    }
                }
            }
        }
    }
}
```


### Parameters Validity

In the following, let `sendingAccount` be the entry in the interoperability store with store prefix `STORE_PREFIX_CHAIN_DATA` and store key `uint32be(sendingChainID)`.


#### Liveness of Sending Chain

A CCU transaction is only valid if the sending chain is not terminated and follows the [liveness rule][base-interoperability-LIP-livenessCondition]. 
This is done by asserting the two points below:  

*  `sendingChain.status != CHAIN_TERMINATED`,
*  if `sendingChain.status == CHAIN_ACTIVE` then also validate  `isLive(sendingChainID,timestamp) == True`. 
   The `isLive` function is specified in [LIP "Introduce Interoperability module"][base-interoperability-LIP], and `timestamp` is the timestamp of the block including the CCU.


##### Liveness Requirement for the First CCU

If `sendingChain.status == CHAIN_REGISTERED`, the proposed CCU must contain a non-empty `certificate` which must follow the schema defined in  [LIP "Introduce a certificate generation mechanism"][certificate-generation-LIP]. 
In the following, let `certificate` be the deserialized certificate.

Furthermore, the certificate is only valid if it allows the sidechain account to remain live for a reasonable amount of time.
This is done by checking that
```java
timestamp - CCU.params.certificate.timestamp < 15*24*3600
```
where `timestamp` is the timestamp of the block including the CCU.


#### Certificate and Validators Update Validity

If `params` contains a non-empty `certificate`, it is valid if:

*  `params.certificate` follows the schema defined in [LIP "Introduce a certificate generation mechanism"][certificate-generation-LIP]. 
   Again, we write `certificate` for the deserialized certificate.
*  `certificate.height` is greater than `sendingAccount.lastCertifiedHeight`.
*  `certificate.timestamp < timestamp`, where timestamp is the timestamp of the block including the CCU.
*  `certificate.signature` is a valid aggregate signature for the `sendingAccount.validators` property of the cross-chain account. This is done by verifying that the function below defined in the [LIP 0038][BLS-LIP-verifyWeightedAggSig] returns `VALID`. 	
	```java
	verifyWeightedAggSig( 
	    keysList          = sendingAccount.validators.keys,  
	    aggregationBits.  = certificate.aggregationBits,  
	    signature         = certificate.signature,  
	    tag               = MESSAGE_TAG_CERTIFICATE, 
	    networkIdentifier = sendingAccount.networkID,  
	    weights           = sendingAccount.validators.weights,  
	    threshold         = sendingAccount.validators.threshold, 
	    message           = params.certificate 
	)
	```

If `params` contains a non-empty `validatorsUpdate` property (with deserialized value not equal to `{keysUpdate:[], weightsUpdate:[], newCertificateThreshold: 0}`), 
it is valid if:

*   `params` contains a non-empty `certificate`.
*   `validatorsUpdate` has the correct format:
    *   `keysUpdate` is an array of unique BLS public keys, hence all elements are 48 bytes long.
    *   `weightsUpdate` is of the same length as `keysUpdate`.
*   `certificate.validatorsHash` is obtained as the SHA-256 digest of the updated `sendingAccount.validators`, see ["Update Validators" section](#update-validators) below, serialized according to `chainAccountSchema.validators` defined in the [LIP "Introduce Interoperability module"][base-interoperability-LIP] (and copied below).
    ```java
    validators = {
        "type": "object",
        "required" : [
            "activeValidators",
            "certificateThreshold"
        ],
        "properties": {
            "activeValidators": {
                "type": "array",
                "fieldNumber": 1,
                "items": {
                    "type": "object",
                    "required": [
                        "blsKey",
                        "bftWeight"
                    ],
                    "properties": {
                        "blsKey": {
                            "dataType": "bytes",
                            "fieldNumber": 1
                        },
                        "bftWeight": {
                            "dataType": "uint64",
                            "fieldNumber": 2
                        }
                    }
                }
            },
            "certificateThreshold": {
                "dataType": "uint64",
                "fieldNumber": 2
            }
        }
    }
    ```


#### InboxUpdate Validity

If `params` contains a non-empty `certificate` and an `inboxUpdate`, the validity of the latter is checked by:

*   Let `newInboxRoot`, `newInboxAppendPath` and `newInboxSize` be the resulting new root, append path and size of the Merkle tree that would be obtained if all messages from `crossChainMessages` would be appended to the `sendingAccount` inbox. 
    Note that `sendingAccount.inbox` is not updated here.
*   If `inboxUpdate` contains a non-empty `messageWitness`, then update `newInboxRoot` to the output of `calculateRootFromRightWitness(newInboxSize, newInboxAppendPath, inboxUpdate.messageWitness.siblingHashes)` as specified in [LIP 0031](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0031.md).
*   Then validate the newly updated root against the certificate state root using the provided `outboxRootWitness`. 
    Using notation from [LIP 0039][SMT-LIP], this is done via the function `verify(queryKeys, proof, certificate.stateRoot)` with 
    ```java
    queryKeys = [outboxKey],
    
    proof = {siblingHashes: outboxRootWitness.siblingHashes, 
             queries: [{ key: outboxKey, 
                         value: newInboxRoot, 
                         bitmap: outboxRootWitness.bitmap }],
            }
            
    outboxKey = MODULE_ID_INTEROPERABILITY 
                || STORE_PREFIX_OUTBOX 
                || SHA-256(uint32be(sendingChainID)).
    ``` 

If `params` contains an empty `certificate` and a non-empty `inboxUpdate`, the validity of the latter is checked as follows:

*   Let `newInboxRoot`, `newInboxAppendPath` and `newInboxSize` be the resulting new root, append path and size of the Merkle tree that would be obtained if all messages from `crossChainMessages` would be appended to the `sendingAccount` inbox. Note that `sendingAccount.inbox` is not updated here.
*   If `inboxUpdate` contains a `messageWitness`, then update `newInboxRoot` to the output of `calculateRootFromRightWitness(newInboxSize, newInboxAppendPath, inboxUpdate.messageWitness.siblingHashes)` as specified in [LIP 0031](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0031.md).
*   Then validate that `newInboxRoot == sendingAccount.partnerChainOutboxRoot`.


### Execute Cross-chain Updates

Cross-chain updates posted on the mainchain or sidechains follow a different execution logic, which we describe in the following two subsections, and a common one, described in the ["Common Processing" section](#common-processing). 

In the following, let `CCU` be the cross-chain update transaction. Let `partnerChainID = CCU.sendingChainID` and `partnerChain` the entry in the interoperability store with store prefix `STORE_PREFIX_ACCOUNT` and store key `uint32be(partnerChainID)`.


#### Cross-chain Updates Posted on Mainchain

Cross-chain update transactions posted on mainchain are transactions with 

*   `moduleID = MODULE_ID_INTEROPERABILITY`,
*   `commandID  = COMMAND_ID_MAINCHAIN_CCU`. 

Then, the following is done in the given order:

*   If `partnerChain.status == CHAIN_REGISTERED`, set `partnerChain.status = CHAIN_ACTIVE`
*   For every `CCM` in `inboxUpdate.crossChainMessages`:
    *   Validate that `params.sendingChainID == CCM.sendingChainID`.
    *   Validate the format of `CCM` according to the function provided in [LIP "Introduce cross-chain messages"][CCM-LIP]. 
*   Validate that the first CCM in `inboxUpdate.crossChainMessages` has `CCM.index == partnerChain.inbox.size`.
*   Validate that all CCMs in `inboxUpdate.crossChainMessages` have increasing and sequential index property.
*   Validate that the sum of all `CCM.fee` and all amounts for LSK cross-chain transfers is smaller or equal than the escrowed amount for the sending chain. The escrowed amount is obtained with the [token function][token-LIP] `getEscrowAmount(params.sendingChainID,0)`.
*   If one of those validation points fails:
    *   `terminateChain(partnerChainID)` as specified in [LIP "Introduce Interoperability module"][base-interoperability-LIP].
    *   Exit the transaction processing, the CCU has no further effect. 
*  For every `CCM` in `inboxUpdate.crossChainMessages` where `CCM.receivingChainID` corresponds to an active and live sidechain account:  
    *  transfer `CCM.fee` from the sending sidechain escrowed balance to the receiving sidechain escrowed balance. 
       This is done with the [token function][token-LIP] `transferEscrow(CCM.sendingChainID, CCM.receivingChainID, 0, CCM.fee)`.
*   Continue the processing by executing all steps in the ["Common Processing" section](#common-processing).


#### Cross-chain Updates Posted on Sidechains

Cross-chain update transaction posted on sidechains are transactions with

*   `moduleID = MODULE_ID_INTEROPERABILITY`,
*   `commandID  = COMMAND_ID_SIDECHAIN_CCU`. 

To execute cross-chain updates, the following is done:

*   If `partnerChain.status == CHAIN_REGISTERED`, set `partnerChain.status = CHAIN_ACTIVE`.
*   For every `CCM` in `inboxUpdate.crossChainMessages`:
    *   Validate that `ownChainID == CCM.receivingChainID`.
    *   Validate the format of `CCM` according to the function provided in [LIP "Introduce cross-chain messages"][CCM-LIP]. 
*   Validate that the first CCM in `inboxUpdate.crossChainMessages` has `CCM.index == partnerChain.inbox.size`.
*   Validate that all CCMs in `inboxUpdate.crossChainMessages` have increasing and sequential index property.
*   If one of those validation points fails:
    *   `terminateChain(partnerChainID)` as specified in [LIP "Introduce Interoperability module"][base-interoperability-LIP].
    *   Exit the transaction processing, the CCU has no further effect.
*   Continue the processing by executing all steps in the ["Common Processing" section](#common-processing).


#### Common Processing

For CCU transactions posted on the mainchain or on sidechains, once the specific execution steps described above have been completed, the following is done in the given order:

*   For every `CCM` in `inboxUpdate.crossChainMessages` with  `CCM.receivingChainID == ownChainID`:
    *   Assign `CCM.fee` to the relayer, here `relayerAddress` is the address corresponding to the sender public key of the CCU. This is done with the [token function][token-LIP] `beforeExecuteCCM(relayerAddress, CCM)`.
*   For every `CCM` in `inboxUpdate.crossChainMessages` (respecting the order of the array):
    *   Call <code>[appendToInboxTree][base-interoperability-LIP-appendToInboxTree](partnerChainID, SHA-256(serializedMessage))</code> where `serializedMessage` is the serialized CCM according to the schema given in [LIP "Introduce cross-chain messages"][CCM-LIP].
    *   Process `CCM` as detailed in [LIP "Introduce cross-chain messages"][CCM-LIP-process].
*  Update `partnerChain.validators` according to `validatorsUpdate`, see ["Update Validators" section](#update-validators).
*  Set `partnerChain.lastCertifiedStateRoot` to `certificate.stateRoot`.
*  Set `partnerChain.lastCertifiedTimestamp` to `certificate.timestamp`.
*  Set `partnerChain.lastCertifiedHeight` to `certificate.height`.
*  Set `partnerChain.partnerChainOutboxSize` to
    *   `inboxUpdate.messageWitness.partnerChainOutboxSize` if `params` contains a non-empty `inboxUpdate.messageWitness`.
    *   `partnerChain.inbox.size` otherwise.
*   Set `partnerChain.partnerChainOutboxRoot` to
    *   `calculateRootRightWitness(inbox.size, inbox.appendPath, inboxUpdate.messageWitness.siblingHashes)` if `params` contains a non-empty `inboxUpdate.messageWitness`.
    *   `partnerChain.inbox.root` otherwise.
*   Append a cross-chain update receipt to the partner chain outbox by calling `addToOutobx(partnerChain, CCUR)` with
	```java
	CCUR = createCrossChainMessage(
	           moduleID = MODULE_ID_INTEROPERABILITY, 
	           crossChainCommandID = CROSS_CHAIN_COMMAND_ID_CCU_RECEIPT, 
	           receivingChainID = CCU.params.sendingChainID, 
	           fee = 0,
	           params = {
	               paidFee = CCU.fee,
	               relayerPublicKey = CCU.senderPublicKey,
	               partnerChainInboxSize = partnerChain.inbox.size    
	           }
	       )
	```


### Update Validators

Updating `sendingAccount.validators` with respect to a given `validatorsUpdate` is done following the points below:

*   Update the weight of all public keys present in `keysUpdate` with the corresponding weight specified in `weightsUpdate` (elements in `keysUpdate` array correspond to weights with the same index in `weightsUpdate`). If the key was not present in `sendingAccount.validators` before the update, it is added to it. Keys are always maintained in lexicographical order.
*   Remove all keys which have now weight `0` from `sendingAccount.validators.keys`, and remove the corresponding `0` in `sendingAccount.validators.weights`.
*   Set `sendingAccount.validators.threshold` = `validatorsUpdate.newCertificateThreshold`. 


## Backwards Compatibility

This proposal, together with [LIP "Introduce chain registration mechanism"][registration-LIP], [LIP "Introduce cross-chain messages"][CCM-LIP], and [LIP "Introduce sidechain recovery mechanism"][recovery-LIP], is part of the Interoperability module. 
Chains adding this module will need to do so with a hard fork.


## Reference Implementation

TBA


## Appendix


### Computing the Validators Update

When posting a CCU transaction, the validators hash given in the certificate certifies the new set of validators of the sending chain. The CCU must therefore include the difference between the validators currently stored in the chain account and the validator set authenticated by the certificate.

```java
getValidatorsDiff((keys, weights, threshold),
	          (newKeys, newWeights, newCertificateThreshold)): 

    keysDiff = []
    weightDiff = []
    for i from 0 to length(newKeys)-1:
        if there exist j in [0,length(keys)] such that 
        (newKeys[i],newWeights[i]) == (keys[j],weights[j]):
            continue
        else:
            append newKeys[i] to keysDiff
            append newWeights[i] to weightDiff

    for i from 0 to length(keys)-1:	
        if there exist j in [0,length(newKeys)] such that newKeys[j] == keys[i]:
            continue
        else:
            append keys[i] to keysDiff
            append 0 to weightDiff

return (keysDiff, weightsDiff, newCertificateThreshold)
```

[base-interoperability-LIP]: https://research.lisk.com/t/properties-serialization-and-initial-values-of-the-interoperability-module/290
[base-interoperability-LIP-termination]: https://research.lisk.com/t/properties-serialization-and-initial-values-of-the-interoperability-module/290#terminatechain-47
[base-interoperability-LIP-appendToInboxTree]: https://research.lisk.com/t/properties-serialization-and-initial-values-of-the-interoperability-module/290#appendtoinboxtree-39
[base-interoperability-LIP-livenessCondition]: https://research.lisk.com/t/properties-serialization-and-initial-values-of-the-interoperability-module/290#islive-42
[registration-LIP]: https://research.lisk.com/t/chain-registration/291
[recovery-LIP]: https://research.lisk.com/t/sidechain-recovery-transactions/292
[CCM-LIP]: https://research.lisk.com/t/cross-chain-messages/299
[CCM-LIP-process]: https://research.lisk.com/t/cross-chain-messages/299#process-25
[token-LIP]: https://research.lisk.com/t/introduce-an-interoperable-token-module/295
[certificate-generation-LIP]: https://research.lisk.com/t/introduce-a-certificate-generation-mechanism/296
[new-block-header-LIP]: https://research.lisk.com/t/new-block-header-and-block-asset-schema/293 
[SMT-LIP]: https://research.lisk.com/t/introduce-sparse-merkle-trees/283
[BLS-LIP]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0038.md
[BLS-LIP-verifyWeightedAggSig]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0038.md#aggregate-signatures-and-their-verification
