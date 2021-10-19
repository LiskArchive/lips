```
LIP: <LIP number>
Title: Update block schema and block processing
Author: Andreas Kendziorra <andreas.kendziorra@lightcurve.io>
        Alessandro Ricottone <alessandro.ricottone@lightcurve.io>
        Rishi Mittal <rishi.mittal@lightcurve.io >
Discussions-To: https://research.lisk.com/t/update-block-schema-and-block-processing/293
Type: Standards Track
Created: <YYYY-MM-DD>
Updated: <YYYY-MM-DD>
Requires: 0040,
          Introduce a certificate generation mechanism
```

## Abstract

This LIP changes the structure of a block, introducing the assets property alongside the block header and payload.
The block header schema is updated to add new properties introduced by several other LIPs.
We clarify the mechanism by which modules can include data in the block assets and specify the validation of each block header property.

## Copyright

This LIP is licensed under the [Creative Commons Zero 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).

## Motivation

The first change proposed by this LIP is to introduce a new block property, the assets, and to update the block schema accordingly. 
This property is an array of objects containing data injected by the modules registered in the chain during the block creation. 
This change clarifies the general procedure by which modules insert extra data in a block.


The second change is to update the block header schema.
In general, it is desirable to have one fixed block header schema that:

- does not need to be changed when modules are added or removed to a running blockchain,
- is used by every blockchain in the Lisk ecosystem regardless of the modules implemented in the individual chains.

Furthermore, we update the block header schema to include new properties introduced by the ["Define state model and state root"][lip-state-model-and-state-root] LIP, the ["Introduce BFT module"][lip-bft-module] LIP, and the ["Introduce a certificate generation mechanism"][lip-certificate-generation] LIP.

Finally, this LIP specifies the validation of all block header properties in one place.

## Rationale

### New Block Header Properties

This LIP introduces the following new block header properties:

- `stateRoot`: The root of the sparse Merkle tree that is computed from the state of the blockchain.
  See the [Define state model and state root][lip-state-model-and-state-root] LIP to see why it needs to be included in a block header.
- `assetsRoot`: The root of the Merkle tree computed from the block assets array.
See [below](#separation-between-block-header-and-block-assets) for more details.
- `generatorAddress`: The address of the block generator.
  It replaces the `generatorPublicKey` property.
  See [below](#change-generator-public-key-to-generator-address) for more details.
- `aggregateCommit`: This property contains the aggregate signature for a certificate for a certain block height.
  Based on this, any node can create a certificate for the corresponding height.
  See the [Introduce a certificate generation mechanism][lip-certificate-generation] LIP for more details.
- `maxHeightPrevoted`: This property is related to the [Lisk BFT protocol][lip-weighted-BFT] and is used for the fork choice rule.
- `maxHeightGenerated`: This property is related to the [Lisk BFT protocol][lip-weighted-BFT] and is used to check for contradicting block headers.
- `validatorsHash`: This property authenticates the set of validators active from the next block onward. It is used to [generate certificates][lip-certificate-generation] from the block header.

### Change Generator Public Key to Generator Address

Before this proposal, the `generatorPublicKey` property of a block header was fulfilling two purposes: 1) The validator account was deduced by deriving the address from it, and 2) the block signature could be validated without any on-chain data. 

Both the generator address or a public key yielding this address fulfill the first purpose. 
On the other hand, the second point is not possible anymore without on-chain data, as the generator key is now part of the Validators module store and can be updated. 
Hence, there is no further drawback in replacing the generatorPublicKey property by the generatorAddress property, while it has the advantages of reducing the size of the block header by a few bytes and skipping the address derivation step during block validation.

### Separation Between Block Header and Block Assets

The separation between properties in the bock header and properties in the block assets is done according to the following rules:

- Properties created by the framework layer of the Lisk SDK are added to the block header.
- Properties created by individual modules are added to the block assets.
- It should be possible to follow the fork choice consensus rule just with the block header. This implies that the `maxHeightPrevoted` property is part of the block header.
- Similarly, it should be possible to generate a certificate just with the block header. This implies that the `validatorsHash` property is part of the block header.
Moreover, the `validatorsHash` property can only be obtained after the state transitions by the modules have been processed. 
The reason is that the DPoS or PoA modules only set the validators for the next round after the asset of the last block of a round is processed. 
Therefore, this property needs to be added to the block by the framework layer after the state transitions by the modules are processed.

As an example, blockchains created with the Lisk SDK that implement the [Random module][lip-random-module], will insert the seed reveal property in the block assets, not in the block header.

The schema for the block assets allows each module to include its serialized data individually, which makes the inclusion of module data very flexible.
Each module can insert a single entry in the assets.
This entry is an object containing a `moduleID` property, indicating the ID of the module handling it, and a generic `data` property that can contain arbitrary serialized data.

Each entry of the block assets is then inserted in a Merkle tree, whose root is included in the block header as the `assetsRoot` property.
Inserting the assets root rather than the full assets allows to bound the size of the block header while still authenticating the content of the block assets.


## Specification

### Notation and Constants

For the rest of this proposal we define the following constants.

| Name          | Type    | Value       | Description |
| ------------- |---------| ------------| ------------|
| `MAX_PAYLOAD_SIZE_BYTES` | integer | TBD | The max size of a block payload in bytes.|
| `MAX_ASSET_DATA_SIZE_BYTES` | integer | TBD | The max size of an assets entry in bytes.|
| `SIGNATURE_LENGTH_BYTES`| integer | 64 | The length of a Ed25519 signature.|


Furthermore, in the following we indicate with `block` be the block under consideration and with `previousBlock` the previous block of the chain.
Calling a function `fct` from another module `module` is represented by `module.fct`.

### Processing Stages of Block, Block Assets, and Block Header

<img src="lip-Update_block_schema_and_block_processing/stages.png" width="80%">

In this section, we specify the order of the various processing stages of a block.
Note that a genesis block follows different rules specified in the ["Update genesis block schema and processing" LIP][research:genesis-block].

- **Static validation**: When a new block is received, some initial static checks are done to ensure that the serialized object follows the general structure of a block. 
  These checks are performed immediately because they do not require access to the state store and can therefore be done very quickly.
- **Block verification**: Properties that require access to the state store *before* the block has been executed are verified in this stage.
In particular, these checks are performed *before* the state transitions implied by the modules are processed.
- **State-machine processing**: In this stage, the block is processed in the state machine where module-level logic is applied (see [following section][#state-machine-processing-stages]).
- **Result verification**: In this stage we verify the properties that require access to the state store *after* the block has been executed, i.e. they can be verified only after the state transitions implied by the block execution have been performed.
In particular, these checks are performed *after* the state transitions implied by the modules are processed.

The static validation, block verification, and result verification are processed in the framework layer, while the state-machine processing is performed in the state-machine layer. 

#### State-machine Processing Stages

In the following, we list the block processing stages performed as part of the state-machine layer. 

- **Block verification**: In this stage, the entry in the block assets relevant to the module is checked. If the checks fail, the block is discarded and has no further effect.
- **Before block execution**: In this stage, modules can process protocol logic *before* the transactions contained in the block payload are executed. 
- **Transaction verification**: The transaction is verified, possibly by accessing the state store. If the verification fails, the transaction is invalid and the whole block is discarded.
- **Before transaction execution**: In this stage, modules can process protocol logic *before* a transaction contained is executed. 
- **Transaction execution**: Commands belonging to the module (i.e. with `moduleID` property matching the module ID) are executed.
- **After transaction execution**: In this stage, modules can process protocol logic *after* a transaction contained is executed. 
- **After block execution**: In this stage, modules can process protocol logic *after* the transactions contained in the block payload are executed.

These steps are performed for each module registered in the blockchain. The transaction verification, before transaction execution, transaction execution, and after transaction execution steps are performed for each transaction in the block payload.

### Block

#### JSON Schema

Blocks are serialized and deserialized accordingly to the following JSON schema.

```java
blockSchema = {
  "type": "object",
  "required": ["header", "payload", "assets"],
  "properties": {
    "header": {
      "dataType": "bytes",
      "fieldNumber": 1
    },
    "payload": {
      "type": "array",
      "fieldNumber": 2,
      "items": {
        "dataType": "bytes"
      }
    },
    "assets": {
      "type": "array",
      "fieldNumber": 3,
      "items": {
        "dataType": "bytes"
      }
    }
  }
}
```

#### Validation

The block is validated in the [static validation stage](#validation-stages-of-block-block-assets-and-block-header) as follows:

- **Static validation**:
  - Check that the total size of the serialized transactions contained in the block payload is at most `MAX_PAYLOAD_SIZE_BYTES`.

#### Block ID

The block ID is calculated using the `blockID` function.
This function returns a 32 bytes value or an error if the block header has an invalid signature format.

```python
blockID():
  # Check that the signature length is 64 bytes to ensure
  # that we do not compute the block ID of an unsigned block
  if length(block.header.signature) != SIGNATURE_LENGTH_BYTES:
    return error

  let serializedBlockHeader be the serialization of block.header following the blockHeaderSchema
  return SHA-256(serializedBlockHeader)
```

### Block Assets

This LIP introduces a new block property, the block assets, which in addition with the header and the payload forms the complete block. 


#### JSON Schema

The block assets contains data created by individual modules.
It is an array of bytes, where each value corresponds to an object serialized according to the following schema.


```java
assetSchema = {
  "type": "object",
  "required": ["moduleID", "data"],
  "properties": {
    "moduleID": {
      "dataType": "uint32",
      "fieldNumber": 1
    },
    "data": {
      "dataType": "bytes",
      "fieldNumber": 2
    }
  }
}
```

#### Validation

The block assets is validated in the [static validation stage](#validation-stages-of-block-block-assets-and-block-header) as follows:

- **Static validation**:
  - Check that each entry in the assets array has `moduleID` set to the ID of a module registered in the chain, while the `data` property has size at most equal to `MAX_ASSET_DATA_SIZE_BYTES`.
  - Each module can insert at most one entry in the block assets.
Hence, check that each entry must has a distinct `moduleID` property.
  - Check that the entries are sorted by increasing values of `moduleID`.

These validations are performed before the block is processed and without accessing the state. 


### Block Header

Block headers are serialized and deserialized accordingly to the following JSON schema.

#### JSON Schema

```java
blockHeaderSchema = {
  "type": "object",
  "required": [
    "version",
    "timestamp",
    "height",
    "previousBlockID",
    "generatorAddress",
    "transactionRoot",
    "assetsRoot",
    "stateRoot",
    "maxHeightPrevoted",
    "maxHeightGenerated",
    "validatorsHash",
    "aggregateCommit"
  ],
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
    "generatorAddress": {
      "dataType": "bytes",
      "fieldNumber": 5
    },
    "transactionRoot": {
      "dataType": "bytes",
      "fieldNumber": 6
    },
    "assetsRoot": {
      "dataType": "bytes",
      "fieldNumber": 7
    },
    "stateRoot": {
      "dataType": "bytes",
      "fieldNumber": 8
    },
    "maxHeightPrevoted": {
      "dataType": "uint32",
      "fieldNumber": 9
    },
    "maxHeightGenerated": {
      "dataType": "uint32",
      "fieldNumber": 10
    },
    "validatorsHash": {
      "dataType": "bytes",
      "fieldNumber": 11
    },
    "aggregateCommit": {
      "type": "object",
      "fieldNumber": 12,
      "required": [
        "height",
        "aggregationBits",
        "certificateSignature"
      ],
      "properties": {
        "height": {
          "dataType": "uint32",
          "fieldNumber": 1
        },
        "aggregationBits": {
          "dataType": "bytes",
          "fieldNumber": 2
        },
        "certificateSignature": {
          "dataType": "bytes",
          "fieldNumber": 3
        }
      }
    },
    "signature": {
      "dataType": "bytes",
      "fieldNumber": 13
    }
  }
}
```

#### Validation

In this section, we specify the validation for each property of the block header.

The block header is validated in all three [stages of the block validation](#validation-stages-of-block-block-assets-and-block-header).

- **Static validation**:
  - Check that the block header follows the block header schema.
  - Validate the `version`, `transactionRoot`, and `assetsRoot` properties. 
- **Block verification**:
  - Verify the `timestamp`, `height`, `previousBlockID`, `generatorAddress`, `maxHeightPrevoted`, `maxHeightGenerated`, `aggregateCommit`, and `signature` properties.
- **Result verification**:
  - Verify the `stateRoot` and `validatorsHash` properties.


##### Version

With this LIP, the version value is incremented.
That means that `block.header.version` must be equal the value of a block of the previous protocol plus one.

##### Timestamp

The timestamp is verified by calling the `verifyTimestamp`.
This function returns a boolean, indicating the success of the check.

```python
verifyTimestamp():
  blockSlotNumber = validators.getSlotNumber(block.header.timestamp)

  # Check that block is not from the future
  let currentTimestamp be the current system time
  if blockSlotNumber > validators.getSlotNumber(currentTimestamp):
    return False

  # Check that block slot is strictly larger than the block slot of previousBlock
  previousBlockSlotNumber = validators.getSlotNumber(previousBlock.header.timestamp)
  if blockSlotNumber <= previousBlockSlotNumber:
      return False

  return True
```

##### Height

The height is verified by calling the `verifyHeight` function.
This function returns a boolean, indicating the success of the check.

```python
verifyHeight():
  return block.header.height == previousBlock.header.height + 1
```

##### Previous Block ID

The height is verified by calling the `verifyPreviousBlockID` function.
This function returns a boolean, indicating the success of the check.

```python
verifyPreviousBlockID():
  return block.header.previousBlockID == blockID(previousBlock)
```

Here, the function `blockID` calculates the ID of an input block as specified in [LIP 20][block-ID].

##### Generator Address

The generator address is verified by calling the `verifyGeneratorAddress` function.
This function returns a boolean, indicating the success of the check.

```python
verifyGeneratorAddress():

  # Check that the generatorAddress has the correct length of 20 bytes
  if length(block.header.generatorAddress) != 20:
    return False

  # Check that the block generator is eligible to generate in this block slot.
  return block.header.generatorAddress == validators.getGeneratorAtTimestamp(block.header.timestamp)
```

##### Transaction Root

The [transaction root][lip-32] is the root of the Merkle tree built from the ID of the transactions contained in the block payload.
It is validated by calling the `validateTransactionRoot` function.
This function returns a boolean, indicating the success of the check.

```python
validateTransactionRoot():
  transactionIDs = [transactionID(trs) for trs in block.payload]
  return block.header.transactionRoot == merkleRoot(transactionIDs)
```

Here, the function `transactionID` calculates the ID of an input transaction as specified in [LIP 19][transaction-ID] and the function `merkleRoot` calculates the Merkle root starting from an input array of bytes values as defined in [LIP 31][merkle-root].

##### Assets Root

The assets root is the root of the Merkle tree built from the block assets array.
It is validated by calling the `validateAssetsRoot` function.
This function returns a boolean, indicating the success of the check.

```python
validateAssetsRoot():
  assetHashes = [SHA-256(asset) for asset in block.assets]
  return block.header.assetsRoot == merkleRoot(assetHashes)
```

##### State Root

The state root is the root of the sparse Merkle tree built from the state of the chain after the block has been processed.
It is verified by calling the `verifyStateRoot` function.
This function returns a boolean, indicating the success of the check.

```python
verifyStateRoot():
  return block.header.stateRoot == stateRoot(block.header.height)
```

Here, the function `stateRoot` calculates the state root of the chain at the input height as specified in [LIP 40][state-root].


##### Max Height Prevoted and Max Height Generated

The properties `maxHeightPrevoted` and `maxHeightGenerated` are related to the [Lisk-BFT protocol][lip-bft].
They are verified by calling the `verifyBFTProperties` function.
This function returns a boolean, indicating the success of the check.

```python
verifyBFTProperties():
  if block.header.maxHeightPrevoted != bft.getBFTHeights().maxHeightPrevoted:
    return False

  return not bft.isHeaderContradictingChain(block.header)
```

##### Validators Hash

The validators hash authenticates the set of validators participating to Lisk-BFT from height `block.header.height + 1` onward.
They are verified by calling the `verifyValidatorsHash` function.
The function returns a boolean, indicating the success of the check.

```python
verifyValidatorsHash():
  return block.header.validatorsHash == bft.getBFTParameters(block.header.height + 1).validatorsHash
```

##### Aggregate Commit

The aggregate commit contains an aggregate BLS signature of a certificate corresponding to the block at the given height. 
It attests that all signing validators consider the corresponding block final.
It is verified by calling the `verifyAggregateCommit` function, defined in LIP ["Introduce a certificate generation mechanism"][verifyAggregateCommit].
This function takes the aggregate commit `block.header.aggregateCommit` as input and returns a boolean, indicating the success of the check.


##### Signature

The signature is verified by calling the `verifyBlockSignature` function.
This function returns a boolean, indicating the success of the check.

```python
verifyBlockSignature():
  generatorKey = validators.getValidatorAccount(block.header.generatorAddress).generatorKey
  signature = block.header.signature 

  # Remove the signature from the block header
  delete block.header.signature
  # Serialize the block header without signature
  let serializedUnsignedBlockHeader be the serialization of block.header following the blockHeaderSchema

  let networkIdentifier be the network identifier of the chain

  return verifyMessageSig(generatorKey, "LSK_BH_", networkIdentifier, serializedUnsignedBlockHeader, signature)
```

Here, the function `verifyMessageSig` verifies the validity of a signature as specified in [LIP 37][lip-signature].



## Backwards Compatibility

This LIP results in a hard fork as nodes following the proposed protocol will reject blocks according to the previous protocol, and nodes following the previous protocol will reject blocks according to the proposed protocol.


[lip-certificate-generation]: https://research.lisk.com/t/introduce-a-certificate-generation-mechanism/

[lip-certificate-generation-aggregate-commits]: https://research.lisk.com/t/introduce-a-certificate-generation-mechanism/

[lip-certificate-generation-certificate-threshold]: https://research.lisk.com/t/introduce-a-certificate-generation-mechanism/

[lip-certificate-generation-chain-of-trust]: https://research.lisk.com/t/introduce-a-certificate-generation-mechanism/

[lip-certificate-generation-validate-aggregate-commit]: https://research.lisk.com/t/introduce-a-certificate-generation-mechanism/

[lip-random-module]: https://research.lisk.com/t/define-state-and-state-transitions-of-random-module/311

[lip-state-model-and-state-root]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0040.md

[lip-weighted-BFT]: https://research.lisk.com/t/add-weights-to-lisk-bft-consensus-protocol/289 

[block-ID]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0020.md#specification

[transaction-ID]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0019.md#specification

[merkle-root]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0031.md#merkle-root

[state-root]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0040.md#specification

[lip-bft]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0014.md#additional-block-header-properties

[lip-bft-module]: https://research.lisk.com/t/introduce-bft-module/321

[lip-signature]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0037.md#signing-and-verifying-with-ed25519

[verifyAggregateCommit]: https://research.lisk.com/t/introduce-a-certificate-generation-mechanism/
[lip-32]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0032.md

[research:genesis-block]: https://research.lisk.com/t/update-genesis-block-schema-and-processing/325