```
LIP: <LIP number>
Title: Introduce cross-chain messages
Author: Maxime Gagnebin <maxime.gagnebin@lightcurve.io>
Discussions-To: https://research.lisk.com/t/introduce-cross-chain-messages/299
Type: Standards Track
Created: <YYYY-MM-DD>
Updated: <YYYY-MM-DD>
Requires: Introduce cross-chain update mechanism
```


## Abstract

This proposal introduces the cross-chain message schema, the generic message processing and the base error handling. 
Defining a base cross-chain message allows all chains in the ecosystem to read and understand the base properties of messages.

The proposal also introduces four messages used by the Interoperability module, the cross-chain update receipt, the channel terminated receipt, the sidechain terminated message and the registration message.


## Copyright

This LIP is licensed under the [Creative Commons Zero 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).


## Motivation

To achieve interoperability, chains need to exchange information by sending messages to each other. 
To this end, we introduce a new message format, which we call a _cross-chain message_ and define in this proposal the base schema of cross-chain messages. 
Specifying a unified base message schema allows all chains in the Lisk ecosystem to deserialize and read cross-chain messages. 

To achieve some of its basic functionalities, the Interoperability module uses four messages. 
The first one, the _cross-chain update receipt_, is sent back to the partner chain (the chain with which the current chain is exchanging messages) whenever a cross-chain update transaction from this chain gets included. 
The cross-chain update receipt serves to update a few properties of the interoperability store, and in general to acknowledge the inclusion of cross-chain update transactions. 
The second one, the _channel terminated message_, is sent to chains which have been terminated. 
This message also updates a few properties of the interoperability store to keep them synchronized between chains. 
The third one, the _registration message_, is used when registering a chain on the Lisk mainchain. 
The message serves as a guarantee that the correct chain ID and network ID are used when the registration transaction is sent on the sidechain.
The last one, the _sidechain terminated message_ is created on the Lisk mainchain when a message should be routed to a terminated or inactive chain.
This message allows other sidechains to automatically trigger the creation of the terminated sidechain account.

Further motivation and rationale behind the Lisk interoperability architecture is given in the general interoperability document ["Introduce Interoperability module"][base-interoperability-LIP].


## Rationale

Messages in the Lisk ecosystem will be included in multiple chains. 
It is therefore important that all chains can deserialize and process the base part of cross-chain messages in the same way. 
The properties of the message contain all the information necessary for this purpose while trying to keep a minimal size.


### Cross-chain Message Properties

In the following, we list all the properties of a cross-chain message.


#### Sending Chain ID and Receiving Chain ID

Used to identify the chains exchanging the cross-chain message. 
On the mainchain, the receiving chain ID is read to route the message to the corresponding chain outbox, as specified in [LIP "Introduce cross-chain update mechanism"][CCU-LIP]. 
The sending chain ID is used, for example, if the message triggers an error and has to be sent back.


#### Index

When a cross-chain message is created and added to the partner chain outbox, the size of the outbox at that point is added to the message in the `index` property. 
This allows all messages to be uniquely identified by the `(sendingChain, receivingChain, index)` tuple. 
This property is important to identify messages and to track them throughout the ecosystem.


#### Module ID and Cross-chain Command ID

Once the message has reached the recipient chain, the two properties `moduleID` and `crossChainCommandID` specify which logic should be used to validate and execute the message. 
The Interoperability module handles the message in case the required logic is not available on the chain. 
This brings the benefit that sending chains do not need to monitor all other chains in the ecosystem and the modules they support. 
We are following an optimistic approach in which all messages will be delivered and error handling will kick in when it is needed. 
In that regard, users should be aware that valid messages will usually not trigger a response. 
A quick API call will guarantee that the message has been properly received and executed.
 
For a given module, the set of command IDs and cross-chain command IDs are allowed to overlap.


#### Fee

For all cross-chain messages, a fee paid in LSK is used to account for the transaction processing in the recipient chain.
This fee must be transferred from the sending chain account to the recipient chain account in order to maintain the correct LSK balances on all chains in the ecosystem. 
The [token ID][token-LIP-tokenID] for this fee is always the token ID of the LSK token and as such is not repeated in the message. 
The LSK token is the main utility token of the Lisk ecosystem and as such is the only good candidate for paying cross-chain fees.


#### Status

The basic error handling for routing messages to other chains is done by the mainchain. 
For example, in the case the recipient chain does not exist, is not active or has been terminated, the mainchain will return the message to the sending chain. 
The sending chain can then revert the message and potentially refund users. 
This design choice allows sidechains to send messages to other chains without needing to monitor the status (or even existence) of every other chain. 
Information about the reason why the message failed and the initial message identifier are stored in the `status` property.

The constant table lists the different status codes defined by the Interoperability module. 
To allow for future updates or improvements of the Interoperability module, we restrict other modules from using status codes up to 63 (included). 
Other modules may use other status codes larger or equal to 64.


#### Parameters

The `params` property of the messages is defined by each module and can follow any schema, similar to the `params` property of a transaction. 
The `params` property is not deserialized or validated by the Interoperability module.

In the Lisk ecosystem, all cross-chain messages are routed through the mainchain. 
This means that messages should always have a sufficiently small size in order to be easily included in mainchain blocks. 
As the mainchain payload size limit is 15 KiB, and [other properties][CCU-LIP] in the cross-chain updates will not be larger than 4 KiB, we limit the message size to 10 KiB. 
To guarantee that all messages can be included and handled, sidechains in the Lisk ecosystem should have a payload size limit equal to or greater than 15 KiB (15 x 1024 bytes).


### Message ID

As all messages emitted in the Lisk ecoystem are distinct (thanks to the unicity of the `(sendingChain, receivingChain, index)` trio), we can assign a unique ID to them.
The message ID is obtained in the same way as other IDs in the protocol, namely by hashing the serialized object.
This assigns to each message a 32-byte value that can be used whenever the message needs to be referenced.


### Message Tracking

Tracking messages throughout the ecosystem could be a challenge, particularly if the messages are errored (and hence spawn new messages from the erroring chain).
However, this can easily be done using the logs emitted by the CCM processing. 
Indeed, messages which are errored and which send a response message to their sending chain, will log the ID of the return message,
allowing off-chain services to display the current status of CCMs (or the status of the returned message if needed).
More generally, the logged records will allow users to know whether a CCM is forwarded, successfully executed, or triggers an error mechanism.


### Sending Cross-chain Messages

Whenever a message is created, it must be added to the outbox of the corresponding partner chain. 
On sidechains, this logic always appends to the mainchain outbox, while on the mainchain, this logic can append to any registered sidechain outbox.

The Interoperability module exposes the <code>[send][base-interoperability-LIP-sendReducer]</code> reducer which is used to check the liveness of the receiving chain, set the messages index property and append messages to the outbox of the partner chain.


### Cross-chain Update Receipt

The main role of the cross-chain update receipt is to inform chains that a cross-chain update transaction has been posted on the partner chain, by whom, the fee that was paid, and the inbox size of the partner chain. 
This is then used on the mainchain to allow for message recovery, see [LIP "Introduce sidechain recovery mechanism"][recovery-LIP]. 
This can also be used in the sidechain to compensate the cross-chain update transaction poster, also called the _relayer_. 
The precise choice of the compensation mechanism is left to sidechain developers. 
For example, all cross-chain transaction fees could be split between the block forger and a compensation pool. 
Whenever a cross-chain update transaction is posted on the mainchain, the poster gets compensation from the pool.


### Channel Terminated Message

The role of the channel terminated message is to inform chains that their channel has been terminated on the mainchain. 
The chain receiving this message can then also close the channel to the mainchain. 
This is helpful in preventing users from sending transactions to a chain whilst the cross-chain update transaction will be invalid. 
Note that the Interoperability module is designed in such a way that no channel should be terminated while the sidechain is respecting the Lisk interoperability protocol. 
Sending and receiving this message should therefore be a rare occurrence.

The termination message contains the last inbox size of the sidechain. 
This allows the sidechain to know exactly which messages were executed on the mainchain and which are still pending at the time of termination.


### Registration Message

The role of the registration message is to guarantee that a channel was opened on the sidechain with the correct chain ID and network ID. 
When a sidechain is registered on the mainchain, an ecosystem wide chain ID is attributed to this chain. 
This chain ID and the corresponding network ID are included in a cross-chain message that is appended to the sidechain outbox. 
When the first cross-chain update is sent to the sidechain, the equality between the properties in the cross-chain message and the ones in the interoperability store is verified.


### Sidechain Terminated Message

The role of the sidechain terminated message is to inform sidechains that another sidechain has been terminated on the mainchain and is unable to receive messages. 
The message contains the ID of the terminated chain as well as the last certified state root of the terminated sidechain (as certified on the mainchain).
This value is used for the creation of the terminated chain account (on the sidechain receiving the CCM), allowing state recoveries.

This message allows to inform sidechains about other terminated sidechains efficiently.
Indeed, this message will automatically trigger the creation of the terminated sidechain account as soon as the first message is unable to be delivered.
This also prevents further messages to be sent to already terminated sidechains.

## Specification

Cross-chain messages (CCM) are used by modules to execute actions on other chains in the ecosystem. 
They are part of the Interoperability module.


### Notation and Constants

The following constants are used throughout the document, multiple of those constants are shared with the other LIPs defining the Interoperability module and all of the needed constants for the Interoperability module are defined in [LIP "Introduce Interoperability module"][base-interoperability-LIP]. 
That LIP should be considered correct if a value stated here would be different.

| Name          | Type    | Value       |
| ------------- |---------| ------------|
| **Interoperability Constants** |||
| `MODULE_ID_INTEROPERABILITY` | uint32 | 64 |
| `MAINCHAIN_ID`               | uint32 | 1  |
| `MIN_RETURN_FEE`             | uint64 | 1000 |
| `MAX_CCM_SIZE`               | uint64 | 10240 |
| **Interoperability Store** |||
| `STORE_PREFIX_CHAIN_DATA`       | bytes  | 0x8000 |
| `STORE_PREFIX_TERMINATED_CHAIN` | bytes  | 0xc000 |
| **Interoperability Cross-chain Command IDs** |||
| `CROSS_CHAIN_COMMAND_ID_REGISTRATION`         | uint32 | 0 |
| `CROSS_CHAIN_COMMAND_ID_CCU_RECEIPT`          | uint32 | 1 |
| `CROSS_CHAIN_COMMAND_ID_CHANNEL_TERMINATED`   | uint32 | 2 |
| `CROSS_CHAIN_COMMAND_ID_SIDECHAIN_TERMINATED` | uint32 | 3 |
| **Message Status and Errors** |||
| `CCM_STATUS_OK`                   | uint32 | 0 |
| `CCM_STATUS_MODULE_NOT_SUPPORTED` | uint32 | 1 |
| `CCM_STATUS_CROSS_CHAIN_COMMAND_NOT_SUPPORTED`  | uint32 | 2 |
| `CCM_STATUS_CHANNEL_UNAVAILABLE`  | uint32 | 3 |
| `CCM_STATUS_RECOVERED`            | uint32 | 4 |
| **Chain Status** |||
| `CHAIN_REGISTERED` | uint32 | 0 |
| `CHAIN_ACTIVE`     | uint32 | 1 |
| `CHAIN_TERMINATED` | uint32 | 2 |


#### uint32be

`uint32be(x)` returns the big endian uint32 serialization of an integer `x`, with `0 <= x < 2^32`. 
This serialization is always 4 bytes long.


#### Chain Account

Let `account(chainID)` be the entry in the interoperability store with store prefix `STORE_PREFIX_CHAIN_DATA` and store key `uint32be(chainID)`.


### Use of Cross-chain Command ID

The logic associated with a cross-chain message is identified by the pair `(moduleID, crossChainCommandID)`. 

A pair `(moduleID, crossChainCommandID)` must uniquely correspond to 

*   one cross-chain message parameters schema,
*   one cross-chain message verification logic, and
*   one cross-chain message execution logic

in one blockchain, with uniqueness being among all cross-chain commands. 
This means that for any change with respect to the three aspects above, a different pair `(moduleID, crossChainCommandID)` must be used for the new message. 
Typically, new messages are still contained in the same module, i.e., the value of `moduleID` stays the same, and a new unique value of `crossChainCommandID` is used.


### CCM Status and Interoperability Restricted Range

The CCM statuses from `0` to `63` (included) are reserved for the Interoperability module.
They should not be used by other modules to signify a module specific status.


### Cross-chain Message Schema

All cross-chain messages in the Lisk ecosystem use the following schema.

```java
crossChainMessageSchema = {
    "type": "object",
    "required": [
        "index",  
        "moduleID", 
        "crossChainCommandID", 
        "sendingChainID", 
        "receivingChainID", 
        "fee", 
        "status", 
        "params"
    ],
    "properties": {
        "index": {
            "dataType": "uint64",
            "fieldNumber": 1 
        },
        "moduleID": {
            "dataType": "uint32",
            "fieldNumber": 2 
        },
        "crossChainCommandID": {
            "dataType": "uint32",
            "fieldNumber": 3 
        },
        "sendingChainID": {
            "dataType": "uint32",
            "fieldNumber": 4 
        },
        "receivingChainID": {
            "dataType": "uint32",
            "fieldNumber": 5 
        },
        "fee": {
            "dataType": "uint64",
            "fieldNumber": 6
        },
        "status": {
            "dataType": "uint32",
            "fieldNumber": 7 
        },
        "params": {
            "dataType": "bytes",
            "fieldNumber": 8 
        }
    }
}
```


### Cross-chain Message ID

The ID of a message `CCM` is computed as `SHA-256(serializedCCM)` where serializedCCM is the serialization of `CCM` using `crossChainMessageSchema`.


### Internal Functions


#### createCrossChainMessage

The following logic should be used to create new cross chain messages:

```python
createCrossChainMessage(moduleID, crossChainCommandID, receivingChainID, fee, params):

    return message = {
               "index": 0,
               "moduleID": moduleID,
               "crossChainCommandID": crossChainCommandID,
               "sendingChainID": chainID of the current chain,
               "receivingChainID": receivingChainID,
               "fee": fee,
               "status": CCM_STATUS_OK,
               "params": params
           }
```


#### validateFormat 

All cross-chain messages `CCM` must have the correct format, which is checked by the following logic:

```python
validateFormat(CCM):
   if size(CCM) > MAX_CCM_SIZE bytes: 
      return False
   if CCM does not follow crossChainMessageSchema: 
      return False
   return True
```


#### process

When processing a cross-chain message, with a valid format, `CCM`, follow the logic below:

```python
process(CCM):
   let ownChainID be the chainID of the current chain 

   if CCM.receivingChainID == ownChainID:
      tryToExecute(CCM)
   else:
      tryToForward(CCM)
```

```python
tryToExecute(CCM):
   if (CCM.mouleID, CCM.crossChainCommandID) is supported:
      call the logic associated with (CCM.moduleID, CCM.crossChainCommandID) on CCM
   else:
      if CCM.status != CCM_STATUS_OK or CCM.fee < MIN_RETURN_FEE*size(CCM):
         CCM is discarded and has no further effect
      elif moduleID is not supported:
         newCCM = CCM
         newCCM.fee = 0
         newCCM.status = CCM_STATUS_MODULE_NOT_SUPPORTED
         swap newCCM.receivingChainID and newCCM.sendingChainID
         process(newCCM) 
      elif crossChainCommandID is not supported:
         newCCM = CCM
         newCCM.fee = 0
         newCCM.status = CCM_STATUS_CROSS_CHAIN_COMMAND_NOT_SUPPORTED 
         swap newCCM.receivingChainID and newCCM.sendingChainID
         process(newCCM) 
```

```python
tryToForward(CCM):
   let partnerChainID = getPartnerChainID(CCM.receivingChainID)

   if account(partnerChainID).status == CHAIN_ACTIVE and isLive(partnerChainID):
      addToOutbox(partnerChainID, CCM)
   elif CCM.status == CCM_STATUS_OK:
      newCCM = CCM
      newCCM.fee = 0
      newCCM.status = CCM_STATUS_CHANNEL_UNAVAILABLE  
      swap newCCM.receivingChainID and newCCM.sendingChainID
      process(newCCM)
      
      STMParams = {chainID: CCM.receivingChainID,
                  stateRoot: account(CCM.receivingChainID).lastCertifiedStateRoot}
                  serialized using sidechainTerminatedCCMParamsSchema
      STM = createCrossChainMessage(MODULE_ID_INTEROPERABILITY, 
                                    CROSS_CHAIN_COMMAND_ID_SIDECHAIN_TERMINATED,
                                    CCM.sendingChainID,
                                    0,
                                    STMParams)
      addToOutbox(STM)
   else:
      CCM is discarded and has no further effect
```
The `addToOutbox`, `getPartnerChainID` and `isLive` functions are defined in [LIP "Introduce Interoperability module"][base-interoperability-LIP].


### Cross-chain Commands


#### Cross-chain Update Receipt

The cross-chain update receipt (CCU receipt) is a CCM with 

*   `moduleID = MODULE_ID_INTEROPERABILITY`,
*   `crossChainCommandID  = CROSS_CHAIN_COMMAND_ID_CCU_RECEIPT`.

The main role of the cross-chain update receipt is to inform chains that a cross-chain update transaction has been posted on the partner chain.

##### Parameters

The `params` schema for CCU receipts is:

```java
ccuReceiptParamsSchema = {
    "type": "object",
    "required": [
        "paidFee", 
        "relayerPublicKey", 
        "partnerChainInboxSize"
    ],
    "properties": {
        "paidFee": {
            "dataType": "uint64",
            "fieldNumber": 1 
        },
        "relayerAddress": {
            "dataType": "bytes",
            "fieldNumber": 2 
        },
        "partnerChainInboxSize": {
            "dataType": "uint64",
            "fieldNumber": 3
        }
    }
}
```
*   `paidFee`: fee paid by the relayer for the cross-chain update transaction.
*   `relayerAddress`: address of the relayer posting the cross-chain update transaction. This property must be 20 bytes long.
*   `partnerChainInboxSize`: size of the partner chain inbox.


##### Creating Cross-chain Update Receipts

A CCU receipt is created by the Interoperability module upon acting on a cross-chain update transaction as specified in [LIP "Introduce cross-chain update mechanism"][CCU-LIP].


##### Executing Cross-chain Update Receipts

When a CCU receipt `ccuReceipt` is received, the following is done:

```python
if ccuReceipt.status != CCM_STATUS_OK 
or account(sendingChainID).partnerChainInboxSize > ccuReceipt.params.partnerChainInboxSize:
    terminateChain(ccuReceipt.sendingChainID)
    stop the ccuReceipt execution

account(sendingChainID).partnerChainInboxSize = ccuReceipt.params.partnerChainInboxSize
```
The `terminateChain` function is defined in [LIP "Introduce Interoperability module"][base-interoperability-LIP].


#### Channel Terminated Message 

The channel terminated message is a CCM with 

*   `moduleID = MODULE_ID_INTEROPERABILITY`,
*   `crossChainCommandID  = CROSS_CHAIN_COMMAND_ID_CHANNEL_TERMINATED`.

The role of the channel terminated message is to inform chains that their channel has been terminated on the mainchain.


##### Parameters

The `params` schema for channel terminated is:

```java
channelTerminatedCCMParamsSchema = {
    "type": "object",
    "required" : ["partnerChainInboxSize"],
    "properties": {
        "partnerChainInboxSize": {
            "dataType": "uint64",
            "fieldNumber": 1
        }
    }
}
```
*  `partnerChainInboxSize`: size of the partner chain inbox.


##### Creating Channel Terminated Messages

A channel terminated message is created by the Interoperability module when [terminating a chain account][base-interoperability-LIP-terminationFunction], for example when encountering a malicious cross-chain update transaction or malicious cross-chain message.


##### Executing Channel Terminated Messages

When a channel terminated message `CTM` is received, the following is done: 

```python
account(CTM.sendingChainID).status = CHAIN_TERMINATED

if account(CTM.sendingChainID).partnerChainInboxSize < CTM.params.partnerChainInboxSize 
    set account(CTM.sendingChainID).partnerChainInboxSize = CTM.params.partnerChainInboxSize
```


#### Registration Message 

The registration message is a CCM with 

*   `moduleID = MODULE_ID_INTEROPERABILITY`,
*   `crossChainCommandID  = CROSS_CHAIN_COMMAND_ID_REGISTRATION`.

The role of the registration message is to guarantee that a channel was opened on the sidechain with the correct chain ID and network ID.


##### Parameters

The `params` schema for the registration CCM is:

```java
registrationCCMParamsSchema = {
    "type": "object",
    "required" : ["networkID", "name"],
    "properties": {
        "networkID": {
            "dataType": "bytes",
            "fieldNumber": 1 
        },
        "name": {
            "dataType": "string",
            "fieldNumber": 2 
        }
    }
}
```
*  `networkID`: network ID registered on the mainchain,
*  `name`: name registered on the mainchain.

##### Creating Registration Message 

A registration message is created by the Interoperability module when registering a sidechain on the mainchain, as specified in [LIP "Introduce chain registration mechanism"][registration-LIP]. 


##### Executing Registration Message

When a registration message `RM` is executed, the following is done: 

```python
let ownName and ownChainID be the name and ID properties (respectively) of the deserialized value of account(0) 

if CCM.index != 0 
or ownChainID != CCM.receivingChainID
or ownName != CCM.params.name
or CCM.params.networkID does not equal the chain's networkID:
    terminateChain(RM.sendingChainID)
```
The `terminateChain` function is defined in [LIP "Introduce Interoperability module"][base-interoperability-LIP].


#### Sidechain Terminated Message 

The sidechain terminated message is a CCM with 

*   `moduleID = MODULE_ID_INTEROPERABILITY`.
*   `crossChainCommandID  = CROSS_CHAIN_COMMAND_ID_SIDECHAIN_TERMINATED`.

The role of the sidechain terminated message is to inform sidechains that another sidechain is unable to receive messages. 
This then triggers the creation of the terminated chain account, allowing state recoveries.


##### Parameters

The `params` schema for the sidechain terminated CCM is:

```java
sidechainTerminatedCCMParamsSchema = {
    "type": "object",
    "required" : ["chainID", "stateRoot"],
    "properties": {
        "chainID": {
            "dataType": "uint32",
            "fieldNumber": 1 
        },
        "stateRoot": {
            "dataType": "bytes",
            "fieldNumber": 2 
        }
    }
}
```
*  `chainID`: chain ID of the terminated chain,
*  `stateRoot`: last state root of the terminated sidechain, as certified on the mainchain.


##### Creating Sidechain Terminated Message 

A sidechain terminated message is created by the Interoperability module when a message should be routed to a terminated or inactive chain. 


##### Executing Sidechain Terminated Message

When a sidechain terminated message `STM` is executed, the following is done: 

```python
if (there exist an entry in the interoperability store with
    storePrefix = STORE_PREFIX_TERMINATED_CHAIN
    storeKey = uint32be(STM.params.chainID)):
    stop CCM execution

create an entry in the interoperability store with
    storePrefix = STORE_PREFIX_TERMINATED_CHAIN
    storeKey = uint32be(STM.params.chainID)
    storeValue = {"stateRoot": STM.params.stateRoot} serialized using the terminatedChain schema.
```
The `terminatedChain` schema is defined in [LIP "Introduce Interoperability module"][base-interoperability-LIP].


## Backwards Compatibility

This proposal, together with [LIP "Introduce chain registration mechanism"][registration-LIP], [LIP "Introduce Interoperability module"][base-interoperability-LIP], 
[LIP "Introduce cross-chain update mechanism"][CCU-LIP], and [LIP "Introduce sidechain recovery mechanism"][recovery-LIP], is part of the Interoperability module. 
This new module defines and specifies its store, which in turn will become part of the state tree and will be authenticated by the state root. As such, it will induce a hardfork.


## Reference Implementation

TBA


[base-interoperability-LIP]:https://research.lisk.com/t/properties-serialization-and-initial-values-of-the-interoperability-module/290
[registration-LIP]: https://research.lisk.com/t/chain-registration/291
[recovery-LIP]: https://research.lisk.com/t/sidechain-recovery-transactions/292
[CCU-LIP]: https://research.lisk.com/t/introduce-cross-chain-update-transactions/298
[token-LIP-tokenID]: https://research.lisk.com/t/introduce-an-interoperable-token-module/295#token-identification-27
[base-interoperability-LIP-sendReducer]: https://research.lisk.com/t/properties-serialization-and-initial-values-of-the-interoperability-module/290#send-49
[base-interoperability-LIP-terminationFunction]: https://research.lisk.com/t/properties-serialization-and-initial-values-of-the-interoperability-module/290#terminatechain-47
