```
LIP: <lip number>
Title: Define new transaction schema
Author: Maxime Gagnebin <maxime.gagnebin@lightcurve.io>
? Discussions-To: <Link to discussion in Lisk Research>
Type: Standards Track
Created: <YYYY-MM-DD>
Updated: <YYYY-MM-DD>
```

## Abstract

This LIP defines a new schema to be used to serialize transactions. The main change is to make module and command identifiers to be of type bytes. This LIP also updates the terminology used for transaction and transaction properties. 


## Copyright

This LIP is licensed under the [Creative Commons Zero 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).


## Motivation

The Lisk protocol handles identifiers for transactions, modules, commands, and many more. The type of those identifiers is however not fully consistent, as some are of type `uint32` (like module ID and chain ID) and others of type `bytes` (like transaction ID and block ID). Moreover, all identifiers used in the new state model to compute the store keys must be first converted to type `bytes`. Unifying all identifier types to be of type `bytes` simplifies their handling and avoids unnecessary type conversion.


## Rationale


### Unifying Identifier Type

The type identifiers in the Lisk protocol are not fully consistent, as some are of type `uint32` and others of type `bytes`. This means that special care is required to use the proper type whenever the identifier is used. Further, identifiers are often used to compute the store keys in the state tree and for this purpose must always be of type bytes. Hence, identifiers of `uint32` type need to be converted to fulfill this purpose. This implies that the implementation very often converts those identifiers from their integer form (as schema entries) to the corresponding bytes (as store key). The new transaction schema introduced in this LIP sets the module ID and command ID to type bytes. 

Defining identifiers as type `bytes` also requires fixing the length of the identifier. This was not possible when using identifiers of type `uint32`, as the full 4 bytes of the maximal range always had to be assumed when using the identifier in the state tree.  


### New Property Names

All properties in the proposed transaction schema are equivalent to the ones defined in LIP 0028. The only changes are the renaming of `assetID` to `commandID` and of `asset` to `params`. As was described in LIP "Update Lisk SDK modular blockchain architecture".


## Specification

The transaction schema defined in [LIP 0028](https://github.com/LiskHQ/lips/blob/main/proposals/lip-0028.md) is superseded by the one defined below. 

The `params` property must follow the schema corresponding to the `moduleID`, `commandID` pair defined in the corresponding module.

All transaction procedures - serialization, deserialization, signature calculation, signature validation and transaction ID - follow the same specifications already defined in [LIP 0028](https://github.com/LiskHQ/lips/blob/main/proposals/lip-0028.md#serialization). The resulting serialization or signatures are however different when the proposed transaction schema is used.


### Constants


| Global Constants                |         |                                                                                                            |
|:-------------------------------:|:-------:|------------------------------------------------------------------------------------------------------------|
| **Name**                        |**Value**|**Description**                                                                                             |
| `MODULE_ID_LENGTH_BYTES `       | 4       | The length of module IDs.                                                                                  |
| `COMMAND_ID_LENGTH_BYTES`       | 2       | The length of command IDs.                                                                                 |
| `PUBLIC_KEY_LENGTH_BYTES `      | 32      | The length of public keys.                                                                                 |
| `SIGNATURE_LENGTH_BYTES`        | 64      | The length of signatures.                                                                                  |
| **Configurable Constants**      |         |                                                                                                            |
| **Name**                        |**Mainchain Value**        |**Description**                                                                           |
| `MAX_PARAMS_SIZE_BYTES`         | 14 KiB (14*1024 bytes)    |   The maximum allowed length of the transaction parameters.                             |


### JSON Schema

Transactions are serialized using `transactionSchema` given below.


```java
transactionSchema = {
    "type": "object",
    "required": [
        "moduleID",
        "commandID",
        "nonce",
        "fee",
        "senderPublicKey",
        "params",
        "signatures"
    ],
    "properties": {
        "moduleID": {
            "dataType": "bytes",
            "length": MODULE_ID_LENGTH_BYTES,
            "fieldNumber": 1
        },
        "commandID": {
            "dataType": "bytes",
            "length": COMMAND_ID_LENGTH_BYTES,
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
            "length": PUBLIC_KEY_LENGTH_BYTES,
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
                "length": SIGNATURE_LENGTH_BYTES 
            },
            "fieldNumber": 7
        }
    }
}
```


### Validation

For a transaction `trs` to be valid, it must satisfy the following:


* `trs.params` is of length less than or equal to `MAX_PARAMS_SIZE_BYTES` .


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
