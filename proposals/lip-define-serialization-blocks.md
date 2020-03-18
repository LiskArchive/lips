```
LIP: <LIP number>
Title: Define schema and use generic serialization for blocks
Author: Alessandro Ricottone <alessandro.ricottone@lightcurve.io>
Discussions-To: https://research.lisk.io/t/define-schema-and-use-generic-serialization-for-blocks/209
Type: Informational
Created: 2020-02-18
Updated: 2020-03-18
Requires: 0027
```

## Abstract

This LIP defines how the generic serialization defined in [LIP 0027][generic-serialization] is applied to blocks by specifying the appropriate JSON schema. We restructure the block header and introduce the block asset property, storing properties specific to the corresponding chain. We further specify the block-asset schema for the Lisk mainchain.

## Copyright

This LIP is licensed under the [Creative Commons Zero 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).

## Motivation

Having a standard way of serializing blocks is beneficial in several parts of the Lisk protocol:

1. Blocks will be serialized and inserted in a Merkle tree to calculate the block root for the "[Introduce decentralized re-genesis](https://lisk.io/roadmap)" roadmap objective.
2. An optimized block serialization can improve storage efficiency.
3. The [Lisk P2P protocol](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0004.md) can use the generic serialization for transmission to reduce bandwidth requirements.
4. An expandable block-asset schema can be included in the SDK and used for sidechains to make the development of custom blockchains easier.

Given these premises, we aim for a minimal, yet flexible and expandable schema for block serialization. [LIP 0027 "A generic, deterministic and size efficient serialization method"][generic-serialization] defines the general serialization method and how JSON schemas are used to serialize data in the Lisk protocol. In this LIP we specify the JSON schemas to serialize a full block, a block header and a block asset in the Lisk mainchain.

## Rationale

We define the `block` schema for the full block serialization. This schema contains two properties, the header property, whose serialization is specified by the schema `blockHeader`, and the payload property. The separation of block header and payload is due to the fact that typically transactions in the payload are stored separately from the block header, so that it is easy to query and access both transactions and blocks separately. These transactions are serialized according to the method defined in [LIP 0028 "Use generic serialization for transactions"][transactions-serialization].

Among other properties, the `blockHeader` schema contains the `asset` property for the block asset. Similarly to the [serialization process for transactions](https://docs.google.com/document/d/1k2bdbQ2Tvevk3oxo_t5Hd1dZUnzbdaRTQ4YgMl1UX1o/edit#heading=h.5bg4mkqkqckm), the block asset is serialized separately from the rest of the block header, using the `blockAsset` schema specified by the `version` property in the block header. When the protocol version changes, the `version` property is updated, and some properties of the block asset may change as well. Using this method, we can upgrade the `blockAsset` schema without changing the whole block schema. In this LIP,  we specify the `blockAsset` schema valid for `version=2` on the Lisk mainchain. The same schema is used as default for sidechains developed using the Lisk SDK. Sidechain developers can also define their own custom schemas with additional properties, e.g., for custom transactions.

Some properties that are part of the [block header in the current protocol](#appendix-a-block-schema-in-the-current-protocol) will be removed:

1. `id`: The block ID. This value can be obtained from the SHA-256 hash of the serialized block header.
2. `numberOfTransactions`: The number of transactions in the payload. This value can be inferred from the payload.
3. `totalAmount`: The amount of tokens transferred with the transactions included in the block. This value can be inferred from the transactions included in the payload.
4. `totalFee`:  The sum of the fees associated with the transactions included in the block. This value can be inferred from the transactions included in the payload.
5. `payloadHash`: The SHA-256 hash of the block payload. After the implementation of [LIP 0032 "Replace payloadHash with Merkle tree root in block header"][replace-payloadhash], this value is replaced by the `transactionRoot`.
6. `payloadLength`: The length in bytes of the payload. This value can be inferred from the payload.

## Specification

### `block` Schema

![Block Schema](lip-define-schema-and-use-generic-serialization-for-blocks/block_schema.png)

_A schematic of the block-serialization structure. The block header is serialized according to the <code>blockHeader</code> schema. The <code>payload</code> is an array of transactions, serialized according to the method described in [LIP 0028][transactions-serialization]._

The `block` schema is used to serialize blocks, for example before transmitting them to peers in the P2P layer.

The `block` schema contains 2 properties:

1. `header`: The serialized block header. Its serialization is specified by the `blockHeader` schema.
2. `payload`: The block payload, containing all transactions included in the block, serialized according to [LIP 0028][transactions-serialization].

#### Serialization

Consider a data structure `blockData` to be serialized, representing a valid block according to the Lisk protocol. The serialization procedure is done in 3 steps:

1. Each transaction `trs` in the block payload `blockData.payload` is serialized according to the method described in [LIP 0028][transactions-serialization]. The resulting bytes replace the original `trs` in the payload.
2. The block header `blockData.header` is serialized using the [method described below](#serialization-1), and the resulting bytes replace the original value in `blockData`.
3. `blockData` is serialized according to the `block` schema.

#### Deserialization

Consider a binary message `blockMsg` to be deserialized. The deserialization procedure is done in 3 steps:

1. `blockMsg` is deserialized according to the `block` schema.
2. Each transaction in the block payload `block.payload` is deserialized using the method defined in [LIP 0028][transactions-serialization].
3. The block header `block.header` is deserialized using the the [method described below](#deserialization-1).

```json
block = {
  "type": "object",
  "properties": {
    "header": {
      "dataType": "bytes",
      "fieldNumber": 1
    },     
    "payload": {
      "type": "array",
      "items": {
        "dataType": "bytes"
      },
      "fieldNumber": 2
    }
  },
  "required": [
    "header",
    "payload"
  ]
}
```

### `blockHeader` Schema

The `blockHeader` schema is used to serialize the block header as part of the full block serialization and to calculate the block signature and ID. Furthermore, block headers can be serialized to be stored in a database separated from the block payload. All properties of the `blockHeader` schema are required, with the exception of the `signature`.

The `blockHeader` schema contains the following properties:

1. `version`: An integer indicating the protocol version used by the block. It specifies the JSON schema to be used to serialize and deserialize the `asset` property of the block. The value of this property at the time of adoption of this LIP is `version=2`.
2. `timestamp`: An integer indicating the epoch timestamp of the block creation starting from the genesis block.
3. `height`: An integer indicating the block height.
4. `previousBlockID`: The ID of the previous block in the chain. A valid block ID is 32 bytes long.
5. <code>[transactionRoot](https://github.com/LiskHQ/lips-staging/blob/replace-payloadhash-with-merkle-tree-root-in-block-header/proposals/lip-replace-payloadhash-with-merkle-tree-root-in-block-header.md)</code>: The Merkle root of the payload tree. This value is 32 bytes long.
6. <code>generatorPublicKey</code>: The public key of the block forger, used to sign the block header. A valid public key is 32 bytes long.
7. <code>reward</code>: An integer indicating the reward in Beddows for the block forger.
8. <code>asset</code>: The asset stores blockchain-specific properties.
9. `signature`: The signature of the block header. Notice that this property is not required (see [Block Signature](#block-signature-calculation) section below). A valid signature is 64 bytes long.

```json
blockHeader = {
  "type": "object",
  "properties": {
    "version": {
      "dataType": "uint32",
      "fieldNumber": 1
    },
    "timestamp": {
      "dataType": "uint32",
      "fieldNumber": 2
    },
    "height": {
      "dataType": "uint32",
      "fieldNumber": 3
    },
    "previousBlockID": {
      "dataType": "bytes",
      "fieldNumber": 4
    },
    "transactionRoot": {
      "dataType": "bytes",
      "fieldNumber": 5
    },
    "generatorPublicKey": {
      "dataType": "bytes",
      "fieldNumber": 6
    },
    "reward": {
      "dataType": "uint64",
      "fieldNumber": 7
    },
    "asset": {
      "dataType": "bytes",
      "fieldNumber": 8
    },
    "signature": {
      "dataType": "bytes",
      "fieldNumber": 9
    },
  },
  "required": [
    "version",
    "timestamp",
    "height",
    "previousBlockID",
    "transactionRoot",
    "generatorPublicKey",
    "reward",
    "asset"
  ]
}
```

#### Serialization

Consider a data structure `blockHeaderData` to be serialized, representing a valid block header according to the Lisk protocol. The serialization procedure is done in 3 steps:

1. The correct `blockAsset` schema is selected according to the value of the `blockHeaderData.version` property. The block asset `blockHeaderData.asset` is serialized according to the `blockAsset` schema.
2. The binary value from step 1 is inserted in the `blockHeaderData.asset` property replacing the original value.
3. The `blockHeaderData` from step 2 is serialized according to the `blockHeader` schema.

#### Deserialization

Consider a binary message `blockHeaderMsg` to be deserialized. The deserialization procedure is done in 3 steps:

1. `blockHeaderMsg` is deserialized according to the `blockHeader` schema to obtain `blockHeaderData`.
2. The serialized block asset `blockHeaderData.asset` is deserialized using the `blockAsset` schema, chosen according to the value of the `blockHeaderData.version` property.
3. The deserialized block asset from step 2 is inserted in the `blockHeaderData.asset` property.

### Block Signature Calculation

The `blockHeader` schema specifies how to serialize all the information necessary to sign a block header and generate the block ID. In the Lisk protocol, block headers are serialized and signed by the forging delegate.

Given a data structure `unsignedBlockHeaderData` representing a block header with no `signature` property, the block signature is calculated as follows:

1. `unsignedBlockHeaderData` is serialized using the [method explained above](#serialization-1). In particular, the serialized data does not contain the signature.
2. The block signature is calculated by signing the binary message from step 1.
3. `unsignedBlockHeaderData.signature` is set to the output of step 2.

### Block Signature Validation

Given a binary message `signedBlockHeaderMsg` representing a serialized block header with a valid `signature` property, the block signature is verified as follows:

1. `signedBlockHeaderMsg` is deserialized using the `blockHeader` schema into  `blockHeaderData`, a data structure representing a signed block header.  
2. The block signature is read from `blockHeaderData.signature` and the `signature` property is then removed from `blockHeaderData`.
3. `blockHeaderData` is re-serialized according to the [method described above](#serialization-1). In particular, the serialized message does not contain the signature.
4. The block signature is verified against the output of step 3.

### Block ID

Given a data structure `signedBlockHeaderData` representing a block header with a `signature` property, the block ID is calculated as follows:

1. `signedBlockHeaderData` is serialized using the [method explained above](#serialization-1).
2. The block ID is calculated as the SHA-256 hash of the binary message from step 1.

### `blockAsset` Schema

<img alt="Block Asset Schema" src="lip-define-schema-and-use-generic-serialization-for-blocks/block_asset_schema.png" width="500">

_The <code>blockAsset</code> schema for the Lisk mainchain contains properties related to the Lisk consensus algorithm. The block asset is serialized separately from the rest of the block, to be able to upgrade the <code>blockAsset</code> schema whenever the protocol version changes._

The `blockAsset` schema is used to serialize the block-header asset as part of the block header serialization. All properties of the `blockAsset` schema are required.

The `blockAsset` schema contains the following properties:

1. <code>[maxHeightPreviouslyForged](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0014.md#additional-block-header-properties)</code>: An integer indicating the largest height of any block previously forged by the delegate.
2. <code>[maxHeightPrevoted](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0014.md#additional-block-header-properties)</code>: An integer indicating the height of the last ancestor block with at least 68 prevotes. The fork-choice rule in the BFT consensus protocol specifies that delegates choose the longest chain that contains the highest <code>maxHeightPrevoted</code>.
3. <code>[seedReveal](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0022.md#block-header)</code>: A value revealed by each forging delegate for the Randao-based random number generation used to select stand-by delegates. This value is 16 bytes long.

```json
blockAsset = {
  "type": "object",
  "properties": {
    "maxHeightPreviouslyForged": {
      "dataType": "uint32",
      "fieldNumber": 1
    },
    "maxHeightPrevoted": {
      "dataType": "uint32",
      "fieldNumber": 2
    },
    "seedReveal": {
      "dataType": "bytes",
      "fieldNumber": 3
    }
  },
  "required": [
    "maxHeightPreviouslyForged",
    "maxHeightPrevoted",
    "seedReveal"
  ]
}
```

## Backwards Compatibility

This proposal introduces a hard fork in the network. After its implementation, block serialization will change, resulting in different block signatures and block IDs.

## Appendix A: Block Schema in the Current Protocol

In this section, we present the block schema `baseBlockSchema` used in the current protocol, as a reference for comparison with the new schema defined in this LIP.

```json
baseBlockSchema = {
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "id",
      "minLength": 1,
      "maxLength": 20,
    },
    "height": {
      "type": "integer"
    },
    "blockSignature": {
      "type": "string",
      "format": "signature"
    },
    "generatorPublicKey": {
      "type": "string",
      "format": "publicKey"
    },
    "numberOfTransactions": {
      "type": "integer"
    },
    "payloadHash": {
      "type": "string",
      "format": "hex"
    },
    "payloadLength": {
      "type": "integer"
    },
    "previousBlockId": {
      "type": "string",
      "format": "id",
      "minLength": 1,
      "maxLength": 20
    },
    "timestamp": {
      "type": "integer"
    },
    "totalAmount": {
      "type": "object",
      "format": "amount"
    },
    "totalFee": {
      "type": "object",
      "format": "amount"
    },
    "reward": {
      "type": "object",
      "format": "amount"
    },
    "transactions": {
      "type": "array",
      "uniqueItems": true
    },
    "version": {
      "type": "integer",
      "minimum": 0
    }
  },
  "required": [
    "blockSignature",
    "generatorPublicKey",
    "numberOfTransactions",
    "payloadHash",
    "payloadLength",
    "timestamp",
    "totalAmount",
    "totalFee",
    "reward",
    "transactions",
    "version"
  ]
}
```

## Appendix B: Serialization Example

```json
blockData = {
  "header": {
    "version": 3,
    "timestamp": 180,
    "height": 16,
    "previousBlockID": "e194ce4e908c148ea4d11719cd40a016d07f393d31031ea150d7a8b7904a22d5",
    "transactionRoot": ,
    "generatorPublicKey": "ed3b9fd50b188d35f5d2ea3fef05cb894363931c5ba50a5967c224ae5b16b339",
    "reward": 100000000,
    "asset": {
      "maxHeightPreviouslyForged": 3,
      "maxHeightPrevoted": 10,
      "seedReveal": "8038ec83c421fa4844c5c65995cb2a66"
    },
    "signature": "bfc186b17132180057c8604640c276b85169fcaba72255bdc24f9220e620aa3e9731e6308a131f87097979e5696a7c38a25212bcb4779b099fab7df576b50207"
  },
  "payload": []
}
```

```
blockMsg = {
  0aac01: {
    08: 03,
    10: b401,
    18: 10,
    2220: e194ce4e908c148ea4d11719cd40a016d07f393d31031ea150d7a8b7904a22d5,
    2a00: ,
    3220: ed3b9fd50b188d35f5d2ea3fef05cb894363931c5ba50a5967c224ae5b16b339,
    38: 80c2d72f,
    4216: {
      08: 03,
      10: 0a,
      1a10: 8038ec83c421fa4844c5c65995cb2a66
    },
    4a40: bfc186b17132180057c8604640c276b85169fcaba72255bdc24f9220e620aa3e9731e6308a131f87097979e5696a7c38a25212bcb4779b099fab7df576b50207
  }
}
```

```
binaryMsg [175 bytes] = 0aac01080310b40118102220e194ce4e908c148ea4d11719cd40a016d07f393d31031ea150d7a8b7904a22d52a003220ed3b9fd50b188d35f5d2ea3fef05cb894363931c5ba50a5967c224ae5b16b3393880c2d72f42160803100a1a108038ec83c421fa4844c5c65995cb2a664a40bfc186b17132180057c8604640c276b85169fcaba72255bdc24f9220e620aa3e9731e6308a131f87097979e5696a7c38a25212bcb4779b099fab7df576b50207
```

```
blockID = e4448ec3d3366680ef65f0fbc60d49979361f3c4767f562bad2bb2841fe4702d
```

```
privateKey = 13f10fde4d5aa4298fe248707e7ec7392b854cdc1a655c2d67864e4117c4db2eed3b9fd50b188d35f5d2ea3fef05cb894363931c5ba50a5967c224ae5b16b339
```

[generic-serialization]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0027.md
[replace-payloadhash]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0032.md
[transactions-serialization]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0028.md
