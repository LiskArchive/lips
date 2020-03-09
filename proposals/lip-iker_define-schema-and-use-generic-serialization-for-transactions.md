```
LIP: <LIP number>
Title:  Define schema and use generic serialization for transactions
Author: Iker Alustiza <iker@lightcurve.io>
Type: Standards Track
Created: <YYYY-MM-DD>
Updated: <YYYY-MM-DD>
Requires: 0027
```

## Abstract

This LIP defines a generic serialization for transactions by specifying the appropriate JSON schema. The proposed serialization method is applied in two steps, first to the asset property, where type-specific properties are defined, and then to the base transaction object. It will be used for signing but also for storing and transmitting transactions in the Lisk protocol. Further, this shall be the default serialization method for custom transactions created via the Lisk SDK.

## Copyright

This LIP is licensed under the [Creative Commons Zero 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).

## Motivation

A standard way of serializing transactions is beneficial in several parts of the Lisk protocol:

1. A generic and standard transaction serialization facilitates the task of managing and upgrading critical points of the protocol as signature and transaction ID generation or payload-hash computation. 
2. An optimized transaction serialization can improve storage efficiency.
3. This serialization can also improve efficiency both for blocks and transactions propagation in the [Lisk P2P protocol](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0004.md).

When a transaction object is serialized, also the asset property has to be serialized. In the current protocol, there exists a customized way to serialize the asset property for each transaction type. If a new transaction type is added, either to the Lisk mainchain or to a sidechain, then a new serialization method for the transaction specific to the new asset property has to be defined and implemented. This increases the barrier for creating sidechains with custom transactions. To simplify the development process, it is desirable to have a generic way to serialize the asset property which makes the mentioned specification and implementation unnecessary. This generic method may then be the default for custom transactions created with the Lisk SDK.

## Rationale

This proposal follows the specifications in the [LIP 0027](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0027.md) to define a generic and deterministic way of serializing transactions in the Lisk protocol. This implies that JSON schemas have to be defined in order to perform the serialization-deserialization process.

As it is shown in the diagram below, every transaction object in the Lisk protocol, regardless of the type, has a common set of 6 properties. The data related to the specific transaction type is given in the `asset` property. This architecture is also expected to be used for custom transactions created with the Lisk SDK. For simplicity and consistency, custom transactions should have these 6 properties, while all the new logic and data is defined with respect to the custom `asset` property.



![alt_text](lip-define-schema-and-use-generic-serialization-for-transactions/Define-schema0.png "image_tooltip")

For this reason, this LIP proposes to divide the serialization-deserialization process. First it defines a serialization-deserialization process for the whole transaction object with the `baseTransaction` JSON schema where the `asset` property is assumed to be of type `bytes`. Secondly, it defines the serialization-deserialization process for the `asset` property with the corresponding `asset` property JSON schema depending on the type of the transaction (specified in the `type` property). There are 7 different `asset` property schemas, one for each of the transaction types in the Lisk protocol. In order to simplify the creation of custom transactions with the SDK and to make the validation process less error prone, every property defined inside a given `asset` schema is required.  

## Specification

Assuming that the JSON schemas for the `baseTransaction` and for the `asset` properties are provided according to the specifications in the [LIP 0027](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0027.md), the serialization and deserialization of a transaction object are done as follows.

### Serialization

Consider a data structure `trsData` representing a valid (signed or unsigned) transaction object to be serialized. The serialization procedure is done in 3 steps:

1.  The `trsData.asset` property is serialized to bytes according to the corresponding  `asset` property schema specified by the `trsData.type` property (see [below](#baseTransaction-schema)).
2. The resulting bytes are inserted into the `trsData.asset` property replacing the original value. 
3. The transaction object from step 2 is serialized according to the `baseTransaction` schema.

### Deserialization

Consider a binary message `trsMsg` to be deserialized. The deserialization procedure is done in 3 steps:

1. The serialized bytes of `trsMsg` are deserialized according to the `baseTransaction` schema to obtain `trsData`.
2. The bytes value of the `trsData.asset` property is deserialized according to the corresponding `asset` property schema specified by the `trsData.type` property.
3. The deserialized transaction object is the object from step 1, `trsData`, where the value of `trsData.asset` is the output of the step 2.

### Transaction signature calculation

Consider a data structure `unsignedTrsData` representing a valid transaction object in which the `signatures` array is initialized to the default value (an empty array). The signature of the object is calculated as follows:

1. `unsignedTrsData` is serialized using the method explained above. In particular, the empty `signatures` array is not part of the serialized data (see [below](#baseTransaction-schema)).
2. The transaction signature is calculated by signing the binary message from step 1. 
3. The signature bytes from step 2 are inserted into the corresponding element of the `unsignedTrsData.signatures` array.

### Transaction signature validation

Consider a binary message `trsMsg` representing a serialized transaction object. The signature of the object is validated as follows:

1. `trsMsg` is deserialized to an object, `trsData`, as explained above in [Deserialization](#deserialization). 
2. The signatures in `trsData.signatures` are removed from `trsData`, but kept for signature verification purposes. The array `trsData.signatures` is set to its default value.  
3. The transaction object, `trsData`, from step 2 is serialized using the method explained above.
4. The signatures saved in step 2 are verified against the binary message from step 3 and the associated public keys.  

### Transaction ID

Given a data structure, `signedTrsData`, representing a transaction object with the corresponding signatures present in the `signatures` property, the transaction ID is calculated as follows:

1. `signedTrsData` is serialized as [explained above](#serialization).
2. The transaction ID is calculated as the SHA-256 hash of the binary message from step 1. 

### `baseTransaction` schema

The schema `baseTransaction` contains 6 properties: 

1. `type`: An integer identifying the type of the transaction. It specifies the JSON schema to be used to serialize-deserialize the `asset` property of the transaction.
2. <code>[nonce](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0015.md)</code>: An integer which is unique for each transaction from the account corresponding to the <code>senderPublicKey.</code>
3. <code>fee</code>: An integer that specifies the fee in Beddows to be spent by the transaction.
4. <code>senderPublicKey</code>: The public key of the account issuing the transaction. A valid public key is 32 bytes long.
5. <code>asset</code>: The serialized asset.
6. <code>signatures</code>: An array with the signatures of the transaction. Note that this property is an array which implies that in case of <code>signatures</code> being initialized to its default value, it does not appear in the binary message. The elements of this array are bytes, either of length 64, or of length 0.

```yaml
baseTransaction = {
    "type": "object",
    "properties": {
        "type": {
            "dataType": "uint32",
            "fieldNumber": 1 
        },     
        "nonce": { 
            "dataType": "uint64",
            "fieldNumber": 2
        },
        "fee": {
            "dataType": "uint64",
            "fieldNumber": 3 
        }, 
        "senderPublicKey": {
            "dataType": "bytes",
            "fieldNumber": 4 
        },
        "asset": {
            "dataType": "bytes",
            "fieldNumber": 5 
        },
        "signatures": {
            "type": "array",
            "items": {
                "dataType": "bytes",
            },
            "fieldNumber": 6
        },      
    },
    "required": [
        "type",
        "nonce",
        "fee",
        "senderPublicKey",
        "asset"	
    ]
}
```

### `asset` property schema

There is a unique `asset` property schema per transaction type, implied by the value of the `type` property. All the properties defined in any `asset` schema are required. 

#### Balance transfer

The schema `balanceTransferAsset` contains 3 properties: 

1. `amount`: The amount in Beddows to be transferred to the account specified in `recipientAddress`.
2. `recipientAddress`: The address of the recipient of `amount`. This property is 20 bytes long.
3. `data`: A string with a maximum length of 64 bytes.

```yaml
balanceTransferAsset = {
    "type": "object",
    "properties": {
        "amount": {
            "dataType": "uint64",
            "fieldNumber": 1
        },
        "recipientAddress": {
            "dataType": "bytes",
            "fieldNumber": 2
        },
        "data": {
            "dataType": "string",
            "fieldNumber": 3
        },  
    },
    "required": [
        "amount",
        "recipientAddress",
        "data"
   ]
}
```

#### Vote

The `voteAsset` schema contains an array of objects. Each of these objects contains the following properties:

1. `delegateAddress`: The address of the voted delegate. An address is 20 bytes long.
2. `amount`: The amount, in Beddows, voted for the delegate.

```yaml
voteAsset = {
   "type": "object",
   "properties": {
       "votes": {
          "type": "array",
          "items": {
             "type": "object",
             "properties": {
                 "delegateAddress": {
            		    "dataType": "bytes",
            		    "fieldNumber": 1
                 },
                 "amount": {
            		    "dataType": "sint64",
            		    "fieldNumber": 2 
                 }
             },
             "required": [
               "delegateAddress",
               "amount" 
             ]
          },
          "fieldNumber": 1 
       } 
   },
   "required": [
      "votes" 
   ]
}
```

#### Delegate registration

The schema `delegateRegAsset` contains the `username` property. This property specifies the name of the registered delegate and is a string with a minimum length of 1 character and a maximum length of 20 characters.

```yaml
delegateRegAsset = {
    "type": "object",
    "properties": {
        "username": {
            "dataType": "string",
            "fieldNumber": 1                                                                                                                                                                                                                                     
        },  
    },
    "required": [
        "username"
    ]
}
```

#### Multisignature registration

The schema `multisigRegAsset` contains 3 properties: 

1. `numberOfSignatures`: The number of private keys that must sign a transaction. 
2. `mandatoryKeys`: An array of public keys. The corresponding private keys necessarily have to sign the transaction. A valid public key is 32 bytes long.
3. `optionalKeys`: An array of public keys. A valid public key is 32 bytes long.

```yaml
multisigRegAsset = {
    "type": "object",
    "properties": {
        "numberOfSignatures": {
            "dataType": "uint32",
            "fieldNumber": 1
        },
        "mandatoryKeys": {
            "type": "array",
            "items": {
                "dataType" : "bytes",
            },
            "fieldNumber": 2
        },
        "optionalKeys": {
            "type": "array",
            "items": {
                "dataType": "bytes",
            },
            "fieldNumber": 3
        },  
    },
    "required": [
        "numberOfSignatures",
        "mandatoryKeys",
        "optionalKeys"
    ]
}
```

#### Unlock vote

The `unlockVoteAsset` schema contains an array of objects. Each of these objects contains the following properties:

1. `delegateAddress`: The address of the unvoted delegate. An address is 20 bytes long.
2. `amount`: The amount, in Beddows, unvoted in a previous vote transaction.
3. `unvoteHeight`: The height at which the transaction to unvote the delegate has been included in the blockchain.

```yaml
unlockVoteAsset = {
    "type": "object",
    "properties": {
        "unlockObjects": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "delegateAddress": {
                       "dataType": "bytes",
                       "fieldNumber": 1
                    },
                    "amount": {
                       "dataType": "uint64",
                       "fieldNumber": 2 
                    },
                    "unvoteHeight": {
                       "dataType": "uint32",
                       "fieldNumber": 3 
                    }
                },
                "required": [
                   "delegateAddress",
                   "amount",
                   "unvoteHeight"
               ]
           }
       },
       "fieldNumber": 1 
   },
   "required": [
       "unlockObjects",
   ]
}
```  

#### PoM

The `pomAsset` schema contains two properties: `header1` and `header2`. Each of the properties contain the serialized version of a signed block header of the Lisk blockchain. The specification to generate the serialized block headers is explained in the [LIP 0029](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0029.md).

```yaml
pomAsset = {
    "type": "object",
    "properties:" {
         "header1": {
            "dataType": "bytes",
            "fieldNumber": 1
        },
         "header2": {
            "dataType": "bytes",
            "fieldNumber": 2
        },  
    },
    "required": [
        "header1",
        "header2",
    ]
}
```

#### Reclaim

The schema `reclaimAsset` contains the `amount` property. This property accounts for the balance in Beddows to be reclaimed.

```yaml
reclaimAsset = {
    "type": "object",
    "properties": {
        "amount": {
            "dataType": "uint64",
            "fieldNumber": 1
        },
    },
    "required": [
        "amount",
    ]
}
```

## Backwards Compatibility

This proposal introduces a hard fork in the network. Since the transaction serialization is computed in a different way, this proposal impacts the way in which transactions are signed, stored and transmitted in the Lisk protocol. This also affects how transaction IDs are computed.

## Appendix: Serialization Example of Balance Transfer Transaction

#### **Transaction object to serialize:**

```yaml
myTrs = {
   "type": 21,
   "nonce": 15701796739323706378n,
   "fee": 3156364651n,
   "senderPublicKey":
   0x8f057d088a585d938c20d63e430a068d4cea384e588aa0b758c68fca21644dbc,
   "asset": { 
      "amount": 9375038900n,
      "recipientAddress": 0xf214d75bbc4b2ea89e433f3a45af803725416ec3,
      "data": 'Odi et amo. Quare id faciam, fortasse requiris.' 
   },
   "signatures": [ 0x204514eb1152355799ece36d17037e5feb4871472c60763bdafe67eb6a38bec632a8e2e62f84a32cf764342a4708a65fbad194e37feec03940f0ff84d3df2a05,
0x0b6730e5898ca56fe0dc1c73de9363f6fc8b335592ef10725a8463bff101a4943e60311f0b1a439a2c9e02cca1379b80a822f4ec48cf212bff1f1c757e92ec02 ] 
 }
```

#### **Binary message (264 bytes):** 
`0x0815108af89ab6959efff3d90118eb9a89e10b22208f057d088a585d938c20d63e430a068d4cea384e588aa0b758c68fca21644dbc2a4d08b4fbaef6221214f214d75bbc4b2ea89e433f3a45af803725416ec31a2f4f646920657420616d6f2e2051756172652069642066616369616d2c20666f7274617373652072657175697269732e3240204514eb1152355799ece36d17037e5feb4871472c60763bdafe67eb6a38bec632a8e2e62f84a32cf764342a4708a65fbad194e37feec03940f0ff84d3df2a0532400b6730e5898ca56fe0dc1c73de9363f6fc8b335592ef10725a8463bff101a4943e60311f0b1a439a2c9e02cca1379b80a822f4ec48cf212bff1f1c757e92ec02`

**Transaction ID**: `0x4bef5fa471e8828b2fc8785a59abb222b9e1a9249dad07e5c5010f89aefb43cd`

#### **Private keys:**

```
0x2b2d2ac6f698a9cef440003c780bbcb5fe0e0a640d4633e43723b95c59d38d69d220071195b2307db7c722b6ec32888eaae92ab8206594aad13a0ec6e65d80eb

0x5e747e595407e689fa2cf5e5b720b85b88fb5c701d789332f4fef198070180ad94bedc715354abe8f8bf6966782726fff1dbb275aa89f81cf5305a0a2a63cf26
