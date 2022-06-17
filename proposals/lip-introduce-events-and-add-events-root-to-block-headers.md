```
LIP: <LIP number>
Title: Introduce events and add events root to block headers
Author:	Mehmet Egemen Albayrak <mehmet.albayrak@lightcurve.io>
        Alessandro Ricottone <alessandro.ricottone@lightcurve.io>
Discussions-To: https://research.lisk.com/t/introduce-events-and-add-events-root-to-block-headers/342
Type: Standards Track
Created: <YYYY-MM-DD>
Updated: <YYYY-MM-DD>
Requires: 0039, 0055
```

## Abstract

In this LIP, we introduce a mechanism to emit events from the application domain during the block processing. These events are included in a sparse Merkle tree, whose root, the event root, is added as a new property to block headers. Using the event root, it is possible to provide inclusion or or non-inclusion proofs for events, proving whether an event was emitted during the block processing.

## Copyright

This LIP is licensed under the [Creative Commons Zero 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).

## Motivation

Currently in the Lisk protocol, once a transaction has been included in a block, its effect is completely determined by the data inside of it. However, there are several cases in which this may not be the case anymore:

* The result of advanced transactions might depend on the state at the moment of execution, e.g. the conversion rate at which a swap in a DEX is executed, and cannot be read only from the transaction data.
* In the Lisk interoperability solution the effect of a [cross-chain message][lip-0049] that is part of a [cross-chain update][lip-0053] included in a block, does not necessarily depend only on its data: In some cases, the cross-chain message can be returned or its execution can fail.
* After the implementation of [LIP 0055][lip-0055#failing], transactions can fail, i.e. their execution can trigger an error but the transaction is still included in the block.

Furthermore, some state transitions, like assigning the [block reward][lip-0042] to the block generator, are not induced by transactions but [by the block header itself][lip-0055#separation]. In all these scenarios, the extra information about the execution of state transitions can be included in _events_, on-chain data emitted during the processing of a block. Front-end products can query the blockchain for the existence of a certain event and use the information contained to enrich the user experience.

Events do not need to be explicitly included in the block (like, e.g., transactions), but can be rather authenticated collectively in the block header. This authentication mechanism can be used to ensure that a specific event has been emitted during the block processing, e.g. it can prove a cross-chain payment has been processed successfully.

## Rationale

### Event Data Structure

Events follow a generic structure, storing the module ID and an event type identifier along with a nested data property. Every module defines its events and the schemas used to serialize and deserialize the data property. The only restriction, which is globally imposed, is a maximum size of serialized events. This is to ensure that events can always be exchanged easily over the network.

Events have the following properties:

* `moduleID`: A byte value set to the ID of the module that emits the event.
* `typeID`: A byte value indicating the type of the event.
* `data`: A byte value. This property contains extra information regarding the event. Each module defines the schemas used for serialization and deserialization.
* `topics`: An array of byte values. The event is inserted in the sparse Merkle tree once for each entry in this array.
* `index`: An integer counter (unique within a block) indicating how many events were emitted before the current one.

### Event Tree

Events are emitted during [application domain stages of the block processing][lip-0055#block-processing-stages] and are inserted in a [sparse Merkle tree][lip-0039] as new leaf nodes. The leaf values are set to the serialized events. Leaf keys are given by the concatenation of a generic byte value and an index that identifies the position in which the event was emitted during the block processing. In particular, each event specifies an array of topics (similar to the 'indexed' keyword used in [Solidity](https://docs.soliditylang.org/en/v0.8.11/cheatsheet.html#modifiers)). The same event is inserted multiple times in the sparse Merkle tree, once for each entry in this array. By default, the indexed topics array contains the ID of the transaction that emitted the event or a constant placeholder for events emitted during the processing of the block header.

This pattern allows efficient (non-)inclusion proofs for a variety of use cases, while at the same time leaving developers of custom modules the freedom to decide how to index custom events.

### Event root

In this LIP we propose to add the root of the event sparse Merkle tree to the block header to allow checking inclusion and non-inclusion of events. The root of the sparse Merkle tree is 32-bytes, therefore resulting in a limited increase of the block-header size.

### Standard Events

We specify one standard event which is emitted at the end of the transaction processing. This event is emitted within the application domain and has module ID set to the ID of the module to which the transaction belongs and a constant event type. The event data is a Boolean indicating the success of the transaction execution.

### Error Handling and Events

If an error is encountered during the processing of a transaction, the transaction fails and the state is reverted to the state snapshot taken before the command execution as defined in [LIP 0055][lip-0055#block-processing-stages]. Similarly, all events that were emitted during the command execution should be reverted. Sometimes, however, it is useful to still persist some events even in this case. When emitting an event each module specifies if it should be reverted in case of an error.

### Discarded Alternatives

We analyzed three options for authenticating events:

* Regular Merkle trees
* Sparse Merkle trees
* Bloom filters

#### Regular Merkle Trees

Regular Merkle trees are used to authenticate lists, and the order of the elements in the list matters in calculating the Merkle root. In the Lisk protocol, they are already used to authenticate transactions in the block header via the [`transactionRoot`][lip-0032].

We discarded regular Merkle trees because they do not provide the same flexibility of sparse Merkle trees in terms of non-inclusion proofs.

#### Bloom Filters

[Bloom filters](https://en.wikipedia.org/wiki/Bloom_filter) are a probabilistic data structure that can efficiently check for the existence of a certain element in a set. Here efficiently means that no proof is necessary, as it is in the Merkle trees case, and a Verifier can check inclusion directly just by holding the filter value.

Bloom filters have no false negatives, meaning that if an element is not part of the set, it is indicated with certainty in the Bloom filter value. However, they do have a non-zero probability of false positives, where it is possible that the filter value mistakenly indicates inclusion of an element that is not part of the set. This false positive rate increases with the set size.

Another disadvantage is that Bloom filters are in general larger than Merkle roots (for instance, in Ethereum [the event Bloom filter has a size of 256 bytes](https://ethereum.github.io/yellowpaper/paper.pdf)).

To summarize, we chose sparse Merkle trees because:

* They offer non-inclusion proofs.
* The root is small in size.
* An inclusion proof indicates the existence of an event with certainty.

## Specification

### Constants

| Name                                 | Type    | Value                                                 | Description                                                                          |
|--------------------------------------|---------|-------------------------------------------------------|--------------------------------------------------------------------------------------|
| `MAX_EVENT_SIZE_BYTES`               | integer | `1024`                                                | Maximum size in bytes of a serialized event.                                         |
| `EMPTY_HASH`                         | bytes   | `SHA-256("")`                                         | Hash of empty bytes.                                                                 |
| `EVENT_TOPIC_INIT_GENESIS_STATE`     | bytes   | `0x00`                                                | Default topic for events emitted during genesis state initialization.                |
| `EVENT_TOPIC_FINALIZE_GENESIS_STATE` | bytes   | `0x01`                                                | Default topic for events emitted during genesis state finalization.                  |                                               |
| `EVENT_TOPIC_BEFORE_TRANSACTIONS`    | bytes   | `0x02`                                                | Default topic for events emitted _before_ transactions execution.                    |
| `EVENT_TOPIC_AFTER_TRANSACTIONS`     | bytes   | `0x03`                                                | Default topic for events emitted _after_ transactions execution.                     |
| `EVENT_TYPE_ID_STANDARD`             | bytes   | `0x0000`                                              | Type ID of standard event emitted at the end of transaction execution.               |
| `EVENT_INDEX_LENGTH_BITS`            | integer | TBD                                                   | Length in bits of the index used to calculate events tree leaf keys.                 |
| `MAX_EVENTS_PER_BLOCK`               | integer | `2^EVENT_INDEX_LENGTH_BITS`                           | Max number of events emitted per block.                                              |
| `TOPIC_HASH_LENGTH_BYTES`            | integer | TBD                                                   | Output length in bytes of the hash function used to calculate events tree leaf keys. |
| `TOPIC_INDEX_LENGTH_BITS`            | integer | `2`                                                   | Length in bits of the topic index used to calculate events tree leaf keys.           |
| `MAX_TOPICS_PER_EVENT`               | integer | `2^TOPIC_INDEX_LENGTH_BITS`                           | Max number of topics per event.                                                      |
| `TOTAL_INDEX_LENGTH_BYTES`           | integer | `(EVENT_INDEX_LENGTH_BITS+TOPIC_INDEX_LENGTH_BITS)/8` | Length in bytes of the concatenation of the event index and the topic index.         |
| `EVENT_ID_LENGTH_BYTES`              | integer | `4+TOTAL_INDEX_LENGTH_BYTES`                          | Length in bytes of the event ID.                                                     |

### Event ID

Events can be globally identified in the blockchain by the height of the block including the event and the index of the event in the block. In particular, we define the event ID as a byte value given by the concatenation of the height of the block (serialized as big-endian 4 bytes value) and the event index converted to a binary string of length `EVENT_INDEX_LENGTH_BITS` concatenated `TOPIC_INDEX_LENGTH_BITS` bits set to 0 (for a total of `TOTAL_INDEX_LENGTH_BYTES` bytes). The event ID has length `EVENT_ID_LENGTH_BYTES`.

### Event Data Structure

Events are serialized and deserialized using the following JSON schema.

```java
eventSchema = {
    "type": "object",
    "required": ["moduleID", "typeID", "data", "topics", "index"],
    "properties": {
        "moduleID": {
            "dataType": "bytes",
            "fieldNumber": 1
        },
        "typeID": {
            "dataType": "bytes",
            "fieldNumber": 2
        },
        "data": {
            "dataType": "bytes",
            "fieldNumber": 3
        },
        "topics": {
            "type": "array",
            "fieldNumber": 4,
            "items": {
                "dataType": "bytes"
            }
        },
        "index": {
            "dataType": "uint32",
            "fieldNumber": 5
        }
    }
}
```

The maximum size of a serialized event is `MAX_EVENT_SIZE_BYTES`.

#### `moduleID`, `typeID`, and `data`

The `moduleID` of an event is the ID of the module to which the event belongs to. Each module defines the `typeID` and JSON schema used to serialize and deserialize the `data` property for the events they can emit. The `typeID` is a byte value of length 2. The value `EVENT_TYPE_ID_STANDARD` is reserved for the standard event and cannot be assigned.

#### `topics`

The event `topics` is an array of unique byte values whose length ranges between `1` and `MAX_TOPICS_PER_EVENT`. By default, it contains one entry for the transaction ID (in the case of events emitted during the transaction processing stages), the constant `EVENT_TOPIC_INIT_GENESIS_STATE` (for events emitted during the 'genesis state initialization' stage), `EVENT_TOPIC_FINALIZE_GENESIS_STATE` (for events emitted during the 'genesis state finalization' stage), `EVENT_TOPIC_BEFORE_TRANSACTIONS` (for events emitted during the 'before transactions execution' stage), or the constant `EVENT_TOPIC_AFTER_TRANSACTIONS` (for events emitted during the 'after transactions execution' stage). An event emitted during transaction processing cannot have any of these reserved constant in the `topics` array.

#### `index`

The event `index` is an integer between `0` and `MAX_EVENTS_PER_BLOCK - 1`, set to the number of events that were previously emitted in the same block. As a consequence, during a single block, at most `MAX_EVENTS_PER_BLOCK` events can be emitted.

### Error Handling and Events

For events emitted during the command execution, modules specify whether the event is reverted or not in case of error (i.e., whether it is included in the events tree or not). In all other application domain stages errors cannot occur in a valid block (thus, also state changes are never reverted) so that it is not necessary to specify if the event is revertible.

### Events Tree

Events are inserted into the events tree once for each entry in the event `topics` array. The leaf key is the concatenation of the hash of the element in the topics array, the event `index` converted to a binary string of length `EVENT_INDEX_LENGTH_BITS` and concatenated with the topic index of `TOPIC_INDEX_LENGTH_BITS` bits (corresponding to the entry in the `topics` array), for a total of `TOTAL_INDEX_LENGTH_BYTES` bytes. The leaf value is the serialization of the event properties using the `eventSchema` given above.

In summary, for each event one key-value pair is added to the events tree for each entry `topic` in the associated `topics` array, where:

* `key = SHA-256(topic)[:TOPIC_HASH_LENGTH_BYTES] + ((event index << TOPIC_INDEX_LENGTH_BITS) + topic index).to_bytes(TOTAL_INDEX_LENGTH_BYTES, byteorder="big")`
* `value` = serialization of event according to `eventSchema`.

### Event Root

In this LIP we introduce a new block header property, `eventRoot`. The events root at a certain height `h`, `eventRoot(h)`, is the root of the sparse Merkle tree computed from all key-value pairs of all events emitted from the block at height `h` (the events tree). A block header without any events has only one empty node in the events tree therefore the event root equals the `EMPTY_HASH`.

### Standard Events

Each module defines a standard event indicating the result of a transaction processing, with the following properties:

* `moduleID`: The module ID of the transaction.
* `typeID`: The constant `EVENT_TYPE_ID_STANDARD`.
* `topics`: An array containing the transaction ID.
* `data`: A Boolean value set to `true` if the transaction was processed successfully, `false` otherwise. The event `data` JSON schema is given below.

```java
standardEventDataSchema = {
    "type": "object",
    "required": ["success"],
    "properties": {
        "success": {
            "dataType": "bool",
            "fieldNumber": 1
        }
    }
}
```

### Emitting Events

We define the following notation to emit events during the block processing.

- `emitEvent(moduleID: bytes, typeID: bytes, data: dict, topics: list[bytes])`: emit an event and add it to the events tree as explained [above](#events-tree). The event index and the relevant default topic are added automatically. The `data` property is serialized according to the schema corresponding to the given `typeID`.
- `emitPersistentEvent(moduleID: bytes, typeID: bytes, data: dict, topics: list[bytes])`: emit an event and add it to the events tree as explained [above](#events-tree). The event index and the relevant default topic are added automatically. The `data` property is serialized according to the schema corresponding to the given `typeID`. If the event is emitted during the command execution stage, it is not removed from the events tree if the command execution fails. Otherwise, it works exactly as `emitEvent`.

## Backwards Compatibility

This LIP, and in general the new block header proposed in [LIP 0055][lip-0055], results in a hard fork as nodes following the proposed protocol will reject blocks according to the previous protocol, and nodes following the previous protocol will reject blocks according to the proposed protocol.

[lip-0032]: https://github.com/LiskHQ/lips/blob/main/proposals/lip-0032.md
[lip-0039]: https://github.com/LiskHQ/lips/blob/main/proposals/lip-0039.md
[lip-0042]: https://github.com/LiskHQ/lips/blob/main/proposals/lip-0042.md
[lip-0049]: https://github.com/LiskHQ/lips/blob/main/proposals/lip-0049.md
[lip-0053]: https://github.com/LiskHQ/lips/blob/main/proposals/lip-0053.md
[lip-0055]: https://github.com/LiskHQ/lips/blob/main/proposals/lip-0055.md
[lip-0055#block-processing-stages]: https://github.com/LiskHQ/lips/blob/main/proposals/lip-0055.md#block-processing-stages
[lip-0055#failing]: https://github.com/LiskHQ/lips/blob/main/proposals/lip-0055.md#failing-and-invalid-transactions
[lip-0055#separation]: https://github.com/LiskHQ/lips/blob/main/proposals/lip-0055.md#separation-between-block-header-and-block-assets
