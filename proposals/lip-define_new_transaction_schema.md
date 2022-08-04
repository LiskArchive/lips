```
LIP: <lip number>
Title: Define new transaction schema
Author: Maxime Gagnebin <maxime.gagnebin@lightcurve.io>
? Discussions-To: https://research.lisk.com/t/define-new-transaction-schema/348/15
Type: Standards Track
Created: <YYYY-MM-DD>
Updated: <YYYY-MM-DD>
```

## Abstract

This LIP defines a new schema to be used to serialize transactions. The main change is to replace module and command identifiers by the corresponding names, which are of type string. This LIP also updates the terminology used for transaction and transaction properties. 


## Copyright

This LIP is licensed under the [Creative Commons Zero 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).


## Motivation

The Lisk protocol handles identifiers for transactions, modules, commands, and many more. In many of those cases such as modules and commands there is also a name property, which is of type string and is set to some intuitive value (e.g., "token" module, "token transfer" command). In the current protocol,  such objects are referenced using their identifiers and their names have an auxiliary role. This is not so convenient for users and developers, since they have to memorize the (non-intuitive) identifier values. Merging those two properties and identifying modules and commands using their name provides a much better user/developer experience. 


## Rationale


### Simplifying identification

The type identifiers in the Lisk protocol are of type `uint32` or of type `bytes`. In both cases, they are set to a non-intuitive value which has to be memorized by users and developers. As the ecosystem grows and more functionalities are added, especially with the intoduction of interoperability, the number of values that have to be memorized gets quite large, making the identification system quite impractical (and potentially error-prone). On the other hand, for each component (modules, commands, events, etc.) there is a much more intuitive parameter: its name. Switching identifiers to those names (and removing the old identifiers) makes the whole user and developer experience easier and less error-prone. 

Therefore, for the cases where removing the old identifiers does not introduce any significant challenge in the ecosystem, it is plausible to proceed to this switch and use names as identifiers. This is the case for modules, commands and events.  


### New Property Names


All properties in the proposed transaction schema are equivalent to the ones defined in [LIP 0028][lip-0028]. The only changes are the replacement of identifiers by the corresponding names and the update of terminology according to the [LIP "Update Lisk SDK modular blockchain architecture"][lip-update-lisk-sdk-modular-architecture] (renaming a module asset to a command and a transaction `asset` property to `params`). Overall, `moduleID` is replaced by `module`, `assetID` is replaced by `command` and `asset` is renamed to `params`.


## Specification

The transaction schema defined in [LIP 0028][lip-0028] is superseded by the one defined [below](#json-schema). 

The `params` property must follow the schema corresponding to the (`module`, `command`) pair defined in the corresponding module; we call this schema `paramsSchema`.

As for the other transaction procedures:

- Serialization and deserialization follow the same specifications already defined in [LIP 0028][lip-0028]; for completeness we include the pseudocode [below](#serialization). The resulting serialization is however different when the proposed transaction schema is used, due to the change of types for identifiers for module and command. Moreover, the transaction ID is calculated in the same way as described in [LIP 0028][lip-0028] (the SHA-256 hash of the serialized transaction object).
- Signature calculation follows the same specifications as in [LIP 0028][lip-0028], updated to incorporate message tags introduced in [LIP 0037][lip-0037]. For completeness we provide the pseudocode [below](#transaction-signature-calculation).
- Signature validation is done using the `verifySignatures` function defined in [LIP 0041](https://github.com/LiskHQ/lips/blob/main/proposals/lip-0041.md#transaction-verification). 


### Constants


|Name                        |Type      |Value                              |Description                                                                  |
|----------------------------|----------|-----------------------------------|-----------------------------------------------------------------------------|
|**Global Constants**        |          |                                   |                                                                             |
| `ED25519_PUBLIC_KEY_LENGTH`|uint32    | 32                                | The length of public keys.                                                  |
| `ED25519_PRIVATE_KEY_LENGTH`|uint32   | 32                                | The length of private keys.                                                 |
| `ED25519_SIGNATURE_LENGTH` |uint32    | 64                                | The length of signatures.                                                   |
| `MESSAGE_TAG_TRANSACTION`  | bytes    | "LSK_TX_" as ASCII-encoded literal| Message tag for transaction signatures (see [LIP 0037](lip-0037)).          |
| **Configurable Constants** |          |**Mainchain Value**                |                                                                             |
| `MAX_PARAMS_SIZE`          |uint32    | 14 KiB (14*1024 bytes)    |   The maximum allowed length of the transaction parameters.                         |


### Type Definition

| Name                | Type   | Validation                                       | Description                                                          |
|---------------------|--------|--------------------------------------------------|----------------------------------------------------------------------|
| `SignatureEd25519` | bytes   | Must be of length `ED25519_SIGNATURE_LENGTH`.  | Used for Ed25519 signatures.  |
| `PrivateKeyEd25519` | bytes   | Must be of length `ED25519_PRIVATE_KEY_LENGTH`. | Used for Ed25519 private keys. |
| `Transaction` | object | Must follow the `transactionSchema` schema with the only difference that `params` property is not serialized and contains the values of parameters of `paramsSchema` for the corresponding transaction. | An object representing a non-serialized transaction.                                        |

### JSON Schema

Transactions are serialized using `transactionSchema` given below.


```java
transactionSchema = {
    "type": "object",
    "required": [
        "module",
        "command",
        "nonce",
        "fee",
        "senderPublicKey",
        "params",
        "signatures"
    ],
    "properties": {
        "module": {
            "dataType": "string",
            "fieldNumber": 1
        },
        "command": {
            "dataType": "string",
            "fieldNumber": 2
        },
        "nonce": {
            "dataType": "uint64",
            "fieldNumber": 3
        },
        "fee": {
            "dataType": "uint64",
            "fieldNumber": 4
        },
        "senderPublicKey": {
            "dataType": "bytes",
            "length": ED25519_PUBLIC_KEY_LENGTH,
            "fieldNumber": 5
        },
        "params": {
            "dataType": "bytes",
            "fieldNumber": 6
        },
        "signatures": {
            "dataType": "array",
            "items": {
                "dataType": "bytes",
                "length": ED25519_SIGNATURE_LENGTH 
            },
            "fieldNumber": 7
        }
    }
}
```


#### Validation

For a transaction `trs` to be valid, it must satisfy the following:

* `trs` must follow the `transactionSchema`. 
* `trs.params` is of length less than or equal to `MAX_PARAMS_SIZE` .

The validity of each transaction is verified in the [static validation stage][lip-0055#block-processing] of the block processing. 


### Serialization

The serialization of an object of type `Transaction` is described in the following pseudocode.

```python
def encode(transactionSchema: LiskJSONSchema, trs: Transaction) -> bytes:
    trs.params = encode(paramsSchema,trs.params)
    return encode(transactionSchema,trs)
```

### Deserialization

Consider a binary message `trsMsg`, corresponding to a serialized transaction. The deserialization procedure is as follows:

```python
def decode(transactionSchema: LiskJSONSchema, trsMsg: bytes) -> Transaction: 
    trsData = decode(transactionSchema,trsMsg)
    trsData.params = decode(paramsSchema,trsData.params)
    return trsData
```

### Transaction signature calculation
Consider a data structure `unsignedTrsData` representing a valid `Transaction` object in which the signatures array is initialized to the default value (an empty array). The following function calculates a signature of the object on a certain chain with secret key `sk`. 

```python
def signTransaction(sk: PrivateKeyEd25519, unsignedTrsData: Transaction) -> SignatureEd25519:
    serializedTrs = encode(transactionSchema, unsignedTrsData)
    return signMessage(sk, MESSAGE_TAG_TRANSACTION, networkIdentifier, serializedTrs)
```

Here `networkIdentifier` is the correct [network identifier](https://github.com/LiskHQ/lips/blob/main/proposals/lip-0037.md#network-identifiers) for the chain and the function `signMessage` is defined in [LIP 0037](https://github.com/LiskHQ/lips/blob/main/proposals/lip-0037.md#signing-and-verifying-with-ed25519).


## Backwards Compatibility

This LIP results in a hard fork as nodes following the proposed protocol will reject transactions following the previous schema, and nodes following the previous protocol will reject transactions following the proposed schema.


## Reference Implementation

TBD


## Appendix

In this section, we present a serialization example for a transfer transaction. To calculate the signature, we use the network identifier: `networkID = 9ee11e9df416b18bf69dbd1a920442e08c6ca319e69926bc843a561782ca17ee` and the tag: `tag = "LSK_TX_".encode()`.

#### **Transaction object to serialize:**

```java
myTrs = {
  "moduleID": '00000002',
  "commandID": '0000',
  "nonce": 5n,
  "fee": 1216299416n,
  "senderPublicKey": '6689d38d0d89e072b5339d24b4bff1bd6ef99eb26d8e02697819aecc8851fd55',
  "params": {
    "amount": 123986407700n,
    "recipientID": '2ca4b4e9924547c48c04300b320be84e8cd81e4a',
    "data": 'Odi et amo. Quare id faciam, fortasse requiris.'
  },
  "signatures": [
    '9953f164f9664e05526c1e3a10c4631715cdcb9fd4f376bf7db5334ded3bbc8470bce023d67c7aca16cf3389ea01f3e3c011820c317f1f5a63f98bb6d6b34b07',
    'a95fc611f7207ddaaaf7929f8f19b7c1cb2473ead20e9be99b8c0abc148b4ea35713ed296acbd6612f124698e96d57e6fde0eddbb998b86203d04ff3c3976700'
  ]
}
```

#### **Binary message without signatures (132 bytes):**

```
0a0400000002120200001805209883fdc3042a206689d38d0d89e072b5339d24b4bff1bd6ef99eb26d8e02697819aecc8851fd55324e0894e2a9f1cd0312142ca4b4e9924547c48c04300b320be84e8cd81e4a1a2f4f646920657420616d6f2e2051756172652069642066616369616d2c20666f7274617373652072657175697269732e
```

#### **Transaction ID:**

```
48d354de94872d87556d6be51d2b6418dcadcec9
```

#### **First key pair:**

```
private key = 42d93fa53d631181540ad630b9ad913835db79e7d2510be915513836bc175edc
public key = 6689d38d0d89e072b5339d24b4bff1bd6ef99eb26d8e02697819aecc8851fd55
```

#### **Second key pair:**

```
private key = 3751d0dee5ee214809118514303fa50a1daaf7151ec8d30c98b12e0caa4bb7de
public key = aa3f553d66b58d6167d14fe9e91b1bd04d7cf5eef27fed0bec8aaac6c73c90b3
```


[lip-0028]: https://github.com/LiskHQ/lips/blob/main/proposals/lip-0028.md
[lip-0037]: https://github.com/LiskHQ/lips/blob/main/proposals/lip-0037.md
[lip-0055#block-processing]: https://github.com/LiskHQ/lips/blob/main/proposals/lip-0055.md#block-processing-stages
[lip-update-lisk-sdk-modular-architecture]: https://research.lisk.com/t/update-lisk-sdk-modular-blockchain-architecture/343
