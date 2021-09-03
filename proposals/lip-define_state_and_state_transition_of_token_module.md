```
LIP:
Title: Define state and state transitions of Token module
Author: Maxime Gagnebin <maxime.gagnebin@lightcurve.io>
Type: Standards Track
Created: <YYYY-MM-DD>
Updated: <YYYY-MM-DD>
```


## Abstract

This LIP introduces a Token module to be used in the Lisk ecosystem for minting, burning, and transferring tokens. 
This module allows any chain in the ecosystem to handle and transfer tokens in a coherent, secure, and controlled manner. 
In this LIP, the tokens handled are fungible.


## Copyright

This LIP is licensed under the [Creative Commons Zero 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).


## Motivation

The Token module is composed of a state store definition used to store tokens in the state. 
To modify this store, we propose two commands: a token transfer command and a cross-chain token transfer command; 
as well as multiple functions to be used by other modules.

Interactions between custom modules and the Token module should only happen following the specified functions. 
Interacting with the token store via those functions allows sidechain developers to create custom modules and custom behavior 
without needing to ensure and test that all rules of the Token module are followed.

With the proposed interoperability solution for the Lisk ecosystem, we anticipate that multiple chains will create and distribute custom tokens. 
Those tokens can be used for a wide variety of reasons which are the choice of the sidechain developer. 


## Rationale


### Technical Glossary


*   **Native chain:** With regards to a token, this is the chain where the token was minted.
*   **Native tokens:** With regards to a chain, all tokens minted on this chain.
*   **Foreign chain:** With regards to a token, all chains other than the native chain.


### Token Identification and Interoperability

To identify tokens in the Lisk ecosystem, we introduce token identifiers in this proposal. 
An identifier will be unique among all tokens in the ecosystem. 
It is built from the [chain ID][registration-lip] of the chain minting the token 
and a local identifier, an integer chosen when the token is minted. 
The local identifier allows chains to define multiple custom tokens, 
each identified by their respective local ID. 
For example, a decentralized exchange could have a governance token (distributed in the genesis block) 
and a liquidity token (distributed to liquidity providers).

In particular, the LSK token is native to the Lisk mainchain which has `chainID = 1`, 
it is also the first (and only) token of this chain and has `localID = 0`. 
This entails that the LSK token ID is `(1,0)`.
Token identifiers in this LIP are written as a dictionary `{"chainID": 1, "localID": 0}` (for example for the LSK token).
Other document could also choose to represent them as a tuple, the LSK ID could then be written as `(1,0)`.


#### Supported Tokens

All chains are allowed to select which tokens their protocol supports. 
Supporting a token only implies that users of the chain can hold those tokens and handle them as specified in this LIP. 
It does not mean that the chain implements custom logic associated with those tokens. 

The choice of supported tokens must abide by two rules: all chains must support their native tokens and all chains must support the LSK token. 
The supported tokens can be specified as part of the initial configuration of the Token module at the chain creation. 
For example:


*   A decentralized exchange could support all tokens.
*   A chain with a specific use case and no native token could only support the LSK token.
*   A chain with a specific use case and with a native token might only support the LSK token and their native token.
*   A gambling chain might support their native token, the LSK token and tokens from a selected group of oracle chains.

When receiving unsupported tokens from a cross-chain transfer, chains should return those tokens to the sending chain if the message fee was sufficient. 
The threshold on the message fee to return unsupported tokens is chosen to be the same as the interoperability threshold for [returning CCMs][CCM-LIP] for other errors. 
This threshold is set to be equal to the Lisk mainchain minimum fee.

Lastly, note that modifying the list of supported tokens would result in a fork of the chain. 
For this reason, the default behavior for Lisk sidechains would be to support all tokens.


### Cross-chain Token Transfer

To allow cross-chain transfers of tokens, we define a specific command which makes use of the [Interoperability module][base-interoperability-LIP]
and creates a [cross-chain message][CCM-LIP] with the relevant information. 
When sending cross-chain tokens, it is crucial that every chain can correctly maintain escrow amounts of its native tokens across the ecosystem. 
In this way, the total supply of a token can never be increased by a foreign chain as the native chain only accepts as many tokens from a foreign chain as have been sent to it before. 


#### Transfer To and From the Native Chain

These specifications only allow tokens to be transferred to and from their native chain. 
In particular, this means that a token minted on chain A cannot be transferred directly from chain B to chain C. 
This is required to allow the native chain to maintain correct escrowed amounts. 
The alternative would be to allow such transfer and require an additional message to be sent to the native chain to acknowledge the transfer. 
However the correctness of the escrowed amounts would rely on the processing of this additional information. 
Network delays could mean that this is only processed much later and that in the meantime users have been tricked into accepting tokens not backed by escrow.


### Protocol Logic for Other Modules

The functions below are the exposed methods of the Token module. 
For the Token module those functions are designed to allow a wide range of use cases while avoiding unexpected behaviors such as unwanted minting or unlocking of tokens.


#### mint

This function allows a chain to mint a specified amount of native tokens. 
This function will increase the balance by the specified amount in the specified user substore and at the same time, increase the corresponding total token supply.


#### burn

This function allows a chain to destroy a specified amount of native tokens. 
When burning tokens, this function will remove the specified amount of tokens from the user substore and at the same time decrease the total supply corresponding to the token. 


#### transfer

This function allows a chain to transfer tokens. 
When transferring tokens, this function will remove the tokens from the sender and add them to the recipient.


#### transferCrossChain

This function is used if a custom module needs to send tokens to another chain. 
It ensures that all amounts are correctly validated and that tokens are escrowed if necessary.


#### escrow

This function allows to transfer tokens from a user substore entry to an escrow substore entry. 
This should be done when native tokens are sent to another chain.


#### unescrow

This function allows to transfer tokens from an escrow substore entry to a user substore entry. 
This should be done when native tokens are returned from another chain.


#### transferEscrow

This function allows to transfer tokens from an escrow substore entry to another escrow substore entry. 
This is done when native tokens returning from another chain are directly sent to a third chain.


#### lock

This function is used to lock tokens held by a user. Locking tokens is done "module wise", i.e., when locking tokens a `moduleID` has to be specified. 
This allows locked tokens to be managed more securely. For example, if a token is locked in a DPoS module, 
then there is no risk that a bug in a custom HTLC module would unlock those tokens. 


#### unlock

This function is used to unlock tokens previously locked. 
As for locking, the corresponding module ID needs to be specified in order to unlock the correct tokens. 
Notice that there is no protocol rule restricting different modules from unlocking tokens locked with a given `moduleID`, it is a protection allowing well written code to be more secure.


#### beforeSendCCM 

This function is called by the Interoperability module before sending cross-chain messages. 
It handles deducting the message fee from the account of the message sender. 
It should not be called by any other module.


#### beforeExecuteCCM 

This function is called by the Interoperability module before executing cross-chain messages. 
It handles crediting the message fee to the account of the cross-chain update sender.
It should not be called by any other module.


#### recover

This function is called by the interoperability module whenever [state recovery transaction][recovery-LIP] for the Token module is executed.  
The amount of native tokens stored in the terminated chain can therefore be credited again to the user on the native chain.
It should not be called by any other module.


#### Use of Protocol Logics by Other Modules

As of writing this proposal, other modules exist in the Lisk protocol that make use of tokens.
Those uses should be updated to call functions implemented by the Token module as defined in this proposal. 
This guarantees that those modules will not trigger potentially improper state changes. For example:

*   The voting process should use the `lock` and `unlock` function to lock and unlock voted tokens.
*   Block rewards should be assigned using the `mint` function.
*   The fee handling should use the `transfer` function to transfer the fee from the transaction sender to the block forger and, on the Lisk mainchain, the `burn` function to burn the minimum part of the fee. 


## Specification


### Constants and Notations

The following constants are used throughout the document


| Name          | Type    | Value       |
| ------------- |---------| ------------|
| **Interoperability Constants** |||
| `MAINCHAIN_ID`               | uint32 | 1 |
| `MIN_RETURN_FEE`             | uint64 | 1000 |
| **Token Module Constants** |||
| `MODULE_ID_TOKEN`                     | uint32 | TBD |
| `COMMAND_ID_TRANSFER`                 | uint32 | 0 |
| `COMMAND_ID_CROSS_CHAIN_TRANSFER`     | uint32 | 1 |
| `CROSS_CHAIN_COMMAND_ID_TRANSFER`     | uint32 | 0 |
| `CROSS_CHAIN_COMMAND_ID_FORWARD`      | uint32 | 1 |
| `CCM_STATUS_OK`                       | uint32 | 0 |
| `CCM_STATUS_TOKEN_NOT_SUPPORTED`      | uint32 | 64 |
| `CCM_STATUS_PROTOCOL_VIOLATION`       | uint32 | 65 |
| `CCM_STATUS_MIN_BALANCE_NOT_REACHED`  | uint32 | 66 |
| `MIN_BALANCE`                         | uint64 | 50000000 |
| `CHAIN_ID_ALIAS_NATIVE`               | uint32 | 0 |
| `LOCAL_ID_LSK`                        | uint32 | 0 |
| `TOKEN_ID_LSK`                        | object | {"chainID": 1, "localID": 0} |
| `TOKEN_ID_LSK_MAINCHAIN`              | object | {"chainID": 0, "localID": 0} |
| **Token Store Constants** |||
| `STORE_PREFIX_USER`               | bytes | 0x 00 00 |
| `STORE_PREFIX_SUPPLY`             | bytes | 0x 80 00 |
| `STORE_PREFIX_ESCROW`             | bytes | 0x c0 00 |
| `STORE_PREFIX_AVAILABLE_LOCAL_ID` | bytes | 0x d0 00 |
| `STORE_PREFIX_TERMINATED_ESCROW`  | bytes | 0x e0 00 |
| **General Constants** |||
| `ADDRESS_LENGTH`                 | uint32 | 20 |
| `MAX_DATA_LENGTH`                | uint32 | 64 |

#### uint32be

`uint32be(x)` returns the big endian uint32 serialization of an integer `x`, with `0 <= x < 2^32`. 
This serialization is always 4 bytes long.


#### Logic from Other Modules

Calling a function `fct` implemented in the [Interoperability module][base-interoperability-LIP] is represented by `interoperability.fct(required inputs)`.


### Token Identification

All tokens in the ecosystem are identified by a pair of non-negative integers `(chainID, localID)`, both strictly less than 2^32 . 
The first element of the pair, `chainID`, is the chain ID of the chain that minted the token (an integer, as specified in the ["Chain Registration" LIP][registration-lip]) and 
the second element, `localID`, is an integer specified when the token is minted. 

In this LIP, the token identifier is written as a dictionary of 2 elements `{"chainID": chainID, "localID": localID}`. 
This is for example used in all input formats for the module's exposed functions.
This choice follows a potential way the module could be implemented in JavaScript, the same behavior could be implemented with a named tuple in Python.
This allows the exposed function interfaces to be simple and uniform.


#### Token ID and Native Tokens

Tokens on their native chain are identified by the pair `{"chainID": CHAIN_ID_ALIAS_NATIVE, "localID": localID}`. 
The same tokens in other chains would be identified by the pair `{"chainID": nativeChainID, "localID": localID}`. 

In all sidechains, the LSK token is identified by the pair `{"chainID": 1, "localID": 0}`, i.e., `chainID = MAINCHAIN_ID = 1` and `localID = 0`. 
This is in contrast with the LSK ID on mainchain which is `{"chainID": 0, "localID": 0}`.


#### Supported Tokens

The Token module contains a function used when receiving cross-chain messages to assert the support for non-native tokens. 
It should return a boolean, depending on the configuration of the Token module.
For the rest of this LIP, this function is written `tokenSupported(tokenID)`.
It must satisfy the condition below:

*   `tokenSupported({"chainID": MAINCHAIN_ID, "localID":  LOCAL_ID_LSK}) = True`. This corresponds to the token ID of the LSK token.

Further, on the Lisk mainchain, the LSK token is the only supported token (no tokens with different chain ID are supported).


### Token Module Store

The Token module store is separated in four parts, the supply substore, the escrow substore, the terminated escrow substore and the user substore. 


#### Supply Substore

The Token module store contains an entry dedicated to storing information about the total supply of native tokens. 
The substore contains entries with:


*   The store prefix is set to `STORE_PREFIX_SUPPLY`.
*   Each store key is a serialized local ID: `uint32be(localID)`.
*   Each store value is the serialization of an object following `supplyStoreSchema`.

```java
supplyStoreSchema = {
    "type": "object",
    "properties": {
        "totalSupply": { 
            "dataType": "uint64",
            "fieldNumber": 1
        },
    },
    "required": ["totalSupply"]
}
```
The default value for this substore is `{"totalSupply": 0}` serialized using `supplyStoreSchema`. 


#### Available Local ID Substore

The Token module store contains an entry dedicated to storing information about the available local IDs:


*   The store prefix is set to `STORE_PREFIX_AVAILABLE_LOCAL_ID`.
*   Each store key is the empty bytes.
*   Each store value is the serialization of an object following `availableLocalIDStoreSchema`.

```java
availableLocalIDStoreSchema = {
    "type": "object",
    "properties": {
        "nextAvailableLocalID": { 
            "dataType": "uint32",
            "fieldNumber": 1
        },
    },
    "required": ["nextAvailableLocalID"]
}
```
The default value for this substore is `{"nextAvailableLocalID": 0}` serialized using `availableLocalIDStoreSchema`. 


#### Escrow Substore

The Token module store contains an entry dedicated to storing information about native tokens which have been sent to another chain. 
The state contains an entry with:


*   The store prefix is set to `STORE_PREFIX_ESCROW`.
*   Each store key is the identifier of the chain to which the tokens are escrowed, 
    and the local ID of the escrowed token: `uint32be(escrowedChainID)||uint32be(tokenLocalID)`.
*   Each store value is the serialization of an object following `escrowStoreSchema`.

```java
escrowStoreSchema = {
    "type": "object",
    "properties": {
        "amount" : {
            "dataType": "uint64",
            "fieldNumber": 1
        },
    },
   "required": ["amount"]
}
```
If any state transition would reduce the `amount` property of an entry to zero, 
this entry is removed from the escrow substore.

If any state transition would increase the `amount` property of a non-existent substore entry, this entry is created. 


##### Terminated Escrow Substore

The Token module store contains an entry dedicated to storing information about chains which have violated the protocol described in this LIP.
The state contains an entry with:


*   The store prefix is set to `STORE_PREFIX_TERMINATED_ESCROW`.
*   Each store key is the identifier of a chain: `uint32be(chainID)`.
*   Each store value is the serialization of an object following `terminatedEscrowSchema`.

```java
terminatedEscrowSchema = {
    "type": "object",
    "properties": {
        "escrowTerminated" : {
            "dataType": "boolean",
            "fieldNumber": 1
        },
    },
   "required": ["escrowTerminated"]
}
```


#### User Substore

The Token module store contains entries dedicated to storing the balances of users for a given `address` and `tokenID`. 
The substore contains entries with:


*   The store prefix is set to `STORE_PREFIX_USER`
*   Each store key is a 20-byte address, 
    and a token ID: `address || uint32be(tokenID.chainID) || uint32be(tokenID.localID) `
*   Each store value is the serialization of an object following `userStoreSchema`.

```java
userStoreSchema = {
    "type": "object",
    "properties": {
        "availableBalance": {
            "dataType": "uint64",
            "fieldNumber": 1
        },
        "lockedBalances":{ 
            "type": "array",
            "fieldNumber": 2, 
            "items": {
                "type": "object",
                "properties":{
                    "moduleID":{"dataType":"uint32", "fieldNumber": 1},
                    "amount"  :{"dataType": "uint64","fieldNumber": 2},
                },
                "required":[ "moduleID", "amount" ]
            }
        }
    }
    "required":["availableBalance", "lockedBalances"]
}
```
In the above object, `lockedBalances` is always kept ordered by ascending order of `moduleID`. 
This guarantees that serialization is done consistently across nodes maintaining the chain.

The `lockedBalances` array contains only elements with non-zero amounts. 
If any state transition would reduce the `amount` property of an element to zero, 
this element is removed from the array.

When, after any state transition, all amounts in a user substore entry (available and locked) are zero the state entry is removed.

If any state transition would increase the `availableBalance` property of a non-existent store entry, 
this entry is created with default value and the available balance is set accordingly. 
The default value for this substore is `{"availableBalance": 0, "lockedBalances": []}` serialized using `userStoreSchema`. 


#### Store Notation

For the rest of this proposal:

*   Let `userStore(address, tokenID)` be the user substore entry with store key `address || uint32be(tokenID.chainID) || uint32be(tokenID.localID)`.
    *   Let `availableBalance(address, tokenID)` be the `availableBalance` property of `userStore(address, tokenID)`.
        If the corresponding store entry does not exist, we assume that the available balance is 0.
    *   Let `lockedAmount(address, moduleID, tokenID)` be the amount corresponding to the given `moduleID` in the `lockedBalances` array of `userStore(address, tokenID)`.
        If the corresponding store entry does not exist, we assume that the amount is 0.
*   Let `escrowStore(chainID)` be the escrow substore entry with store key `uint32be(chainID)`.
    *   Let `escrowAmount(chainID, localID)` be the amount corresponding to the given `localID` in the `escrowedTokens` array of `escrowStore(chainID)`. 
        If the corresponding store entry does not exist, we assume that the amount is 0.
*   Let `escrowTerminated(chainID)` be the `escrowTerminated` property of the escrow terminated substore entry with store key `uint32be(chainID)`. If the store entry does not exist, we assume this notation to return `False`.
*   Let `supplyStore(localID)` be the supply substore entry with store key `uint32be(localID)`.
    *   Let `totalSupply(localID)` be the `totalSupply` property stored in `supplyStore(localID)`.-
*   Let `nextAvailableLocalID` be the `nextAvailableLocalID` property of the entry of the available local ID substore.


##### Store Function

In this proposal, the following function is used:

```python
terminateEscrow(chainID):
    create an store entry with
        storePrefix = STORE_PREFIX_TERMINATED_ESCROW
        storeKey = uint32be(chainID) 
        storeValue = {"escrowTerminated": True} serialized using terminatedEscrowSchema
```
In the above function, if the store entry already exists, the function has no effect.


### Commands

The module provides the following commands to modify token entries.


#### Token Transfer

Transactions executing this command have: 

*   `moduleID = MODULE_ID_TOKEN`
*   `commandID  = COMMAND_ID_TRANSFER`


##### Parameters Schema

The `params` property of token transfer transactions follows the schema `transferParams`.

```java
transferParams = {
    "type": "object",
    "properties":  {
        "tokenID": {
            "type": "object",
            "fieldNumber": 1,
            "properties": {
                "chainID": {
                    "dataType": "uint32",
                    "fieldNumber": 1
                },
                "localID": {
                    "dataType": "uint32",
                    "fieldNumber": 2
                },
            },
            "required": ["chainID", "localID"]
        },
        "amount": {
            "dataType": "uint64",
            "fieldNumber": 2 
        },
        "recipientAddress": {
            "dataType": "bytes",
            "fieldNumber": 3 
        },
        "data": {
            "dataType": "string",
            "fieldNumber": 4 
        },
    },
    "required": [ 
        "tokenID", 
        "amount" , 
        "recipientAddress", 
        "data" 
    ]
}
```


##### Parameters Validity

The `params` property of a token transfer transaction is valid if:

*   `recipientAddress` is a byte array of length `ADDRESS_LENGTH`.
*   `data` has length less than or equal to `MAX_DATA_LENGTH`.


##### Execution

When executing a token transfer transaction `trs`, the logic below is followed:

```python
derive senderAddress from trs.senderPublicKey
let tokenID, recipientAddress, amount given by trs.params

if availableBalance(senderAddress, tokenID) < amount:
    transaction execution fails 

availableBalance(senderAddress, tokenID) -= amount 
availableBalance(recipientAddress, tokenID) += amount
```


#### Cross-chain Token Transfer 

Transactions executing this command have:

*   `moduleID = MODULE_ID_TOKEN`
*   `commandID  = COMMAND_ID_CROSS_CHAIN_TRANSFER` 


##### Parameters Schema

The `params` property of cross-chain token transfer transactions follows the schema `crossChainTransferParams`.

```java
crossChainTransferParams = {
    "type": "object",
    "properties": {
        "tokenID": {
            "type": "object",
            "fieldNumber": 1,
            "properties": {
                "chainID": {
                    "dataType": "uint32",
                    "fieldNumber": 1
                },
                "localID": {
                    "dataType": "uint32",
                    "fieldNumber": 2
                },
            },
            "required": ["chainID", "localID"]
        },
        "amount": {
            "dataType": "uint64",
            "fieldNumber": 2 
        },
        "receivingChainID": {
            "dataType": "uint32",
            "fieldNumber": 3
        },
        "recipientAddress": {
            "dataType": "bytes",
            "fieldNumber": 4
        },
        "data": {
            "dataType": "string",
            "fieldNumber": 5
        },
        "messageFee": {
            "dataType": "uint64",
            "fieldNumber": 6
        }
    },
    "required": [ 
        "tokenID", 
        "amount", 
        "receivingChainID", 
        "recipientAddress", 
        "data", 
        "messageFee" 
    ]
}
```


##### Parameters Validity

The `params` property of a cross-chain token transfer transaction is valid if 

*   `recipientAddress` is a byte array of length `ADDRESS_LENGTH`.
*   `data` has length less than or equal to `MAX_DATA_LENGTH`.
*   `tokenID.chainID` is either `CHAIN_ID_ALIAS_NATIVE`, `MAINCHAIN_ID` or `receivingChainID`.


##### Execution

When executing a cross-chain token transfer transaction `trs`, the following is done: 

*   Derive `senderAddress` from `trs.senderPublicKey`.
*   Execute the logic defined by:
    ```python
    timestamp = timestamp of the block including the execution of this command
    transferCrossChain(timestamp,
                       senderAddress, 
                       trs.params.receivingChainID, 
                       trs.params.recipientAddress, 
                       trs.params.tokenID, 
                       trs.params.amount, 
                       trs.params.messageFee,
                       trs.params.data).

    ```


### Cross-chain Commands


#### Cross-chain Token Transfer Messages

Cross-chain messages executing this cross-chain command have:

*   `moduleID = MODULE_ID_TOKEN`
*   `crossChainCommandID  = CROSS_CHAIN_COMMAND_ID_TRANSFER`


##### CCM Parameters

The `params` property of cross-chain token transfer messages follows the schema `crossChainTransferMessageParams`.

```java
crossChainTransferMessageParams = {
    "type": "object",
    "properties":{
        "tokenID": {
            "type": "object",
            "fieldNumber": 1,
            "properties": {
                "chainID": {
                    "dataType": "uint32",
                    "fieldNumber": 1
                },
                "localID": {
                    "dataType": "uint32",
                    "fieldNumber": 2
                },
            },
            "required": ["chainID", "localID"]
        },
        "amount": {
            "dataType": "uint64",
            "fieldNumber": 2
        },
        "senderAddress": {
            "dataType": "bytes",
            "fieldNumber": 3 
        },
        "recipientAddress": {
            "dataType": "bytes",
            "fieldNumber": 4 
        },
        "data": {
            "dataType": "string",
            "fieldNumber": 5 
        }
    },
    "required": [
        "tokenID", 
        "amount" ,   
        "senderAddress", 
        "recipientAddress", 
        "data" 
    ]
}
```


##### Execution

When executing a cross-chain token transfer message `CCM`, the logic below is followed.

```python
tokenID = CCM.params.tokenID
tokenChainID = tokenID.ChainID
tokenLocalID = tokenID.LocalID 
amount = CCM.params.amount
recipientAddress = CCM.params.recipientAddress
senderAddress = CCM.params.senderAddress
sendingChainID = CCM.sendingChainID
ownChainID = interoperability.getOwnChainAccount().ID

# token should only be sent to and from their native chains 
if (tokenChainID not in [ownChainID, sendingChainID]
    or length(senderAddress) != ADDRESS_LENGTH
    or length(recipientAddress) != ADDRESS_LENGTH
    or length(CCM.params.data) > MAX_DATA_LENGTH
    or (tokenChainID == ownChainID
        and escrowAmount(sendingChainID, tokenLocalID) < amount)):
    if (CCM.status == CCM_STATUS_OK
        and CCM.fee >= MIN_RETURN_FEE * length(CCM)):
        interoperability.error(CCM, CCM_STATUS_PROTOCOL_VIOLATION)
    terminateEscrow(sendingChainID)
    stop CCM execution
    
if tokenChainID == ownChainID:
    escrowAmount(sendingChainID, tokenLocalID) -= amount
    localTokenID = {"chainID": CHAIN_ID_ALIAS_NATIVE, "localID": tokenLocalID}
    if CCM.status == 0:
        availableBalance(recipientAddress, localTokenID) += amount
    else:
        availableBalance(senderAddress, localTokenID) += amount

else: # tokenChainID != ownChainID:
    # return any non-supported tokens with enough fee
    if tokenSupported(tokenID) == False:
        if (CCM.fee >= MIN_RETURN_FEE*length(CCM) 
            and CCM.status == CCM_STATUS_OK):
            interoperability.error(CCM, CCM_STATUS_TOKEN_NOT_SUPPORTED)
        stop CCM execution
    if CCM.status == CCM_STATUS_OK:
        availableBalance(recipientAddress, tokenID) += amount
    else:
        availableBalance(senderAddress, tokenID) += amount        
```


#### Cross-chain Token Forward Messages

Cross-chain messages executing this cross-chain command have:

*   `moduleID = MODULE_ID_TOKEN`
*   `crossChainCommandID  = CROSS_CHAIN_COMMAND_ID_FORWARD`


##### CCM Parameters

The `params` property of cross-chain token forward messages follows the schema `crossChainForwardMessageParams`.

```java
crossChainForwardMessageParams = {
    "type": "object",
    "properties":{
        "tokenID": {
            "type": "object",
            "fieldNumber": 1,
            "properties": {
                "chainID": {
                    "dataType": "uint32",
                    "fieldNumber": 1
                },
                "localID": {
                    "dataType": "uint32",
                    "fieldNumber": 2
                },
            },
            "required": ["chainID", "localID"]
        },
        "amount": {
            "dataType": "uint64",
            "fieldNumber": 2
        },
        "senderAddress": {
            "dataType": "bytes",
            "fieldNumber": 3 
        },
        "forwardToChainID": {
            "dataType": "bytes",
            "fieldNumber": 4 
        },      
        "recipientAddress": {
            "dataType": "bytes",
            "fieldNumber": 5 
        },
        "data": {
            "dataType": "string",
            "fieldNumber": 6 
        },
        "forwardedMessageFee": {
            "dataType": "uint64",
            "fieldNumber": 7 
        }
    },
    "required": [
        "tokenID",  
        "amount" ,   
        "senderAddress", 
        "forwardToChainID",
        "recipientAddress", 
        "data",
        "forwardedMessageFee"
    ]
}
```

##### Execution

When executing a cross-chain token forward message, the logic below is followed.

```python
sendingChainID = CCM.sendingChainID
tokenID = CCM.params.tokenID
amount = CCM.params.amount
forwardToChainID = CCM.params.forwardToChainID
recipientAddress = CCM.params.recipientAddress
senderAddress = CCM.params.senderAddress
data = CCM.params.data
forwardedMessageFee = CCM.params.forwardedMessageFee
ownChainID = interoperability.getOwnChainAccount().ID


if (length(senderAddress) != ADDRESS_LENGTH
    or length(recipientAddress) != ADDRESS_LENGTH
    or length(CCM.params.data) > MAX_DATA_LENGTH):
    if CCM.status == CCM_STATUS_OK:
        interoperability.error(CCM, CCM_STATUS_PROTOCOL_VIOLATION)
    terminateEscrow(sendingChainID)
    stop CCM execution

if CCM.status != CCM_STATUS_OK:
    if sendingChainID == tokenID.chainID:
        # credit the sender with the returned tokens
        availableBalance(senderAddress, tokenID) += amount + forwardedMessageFee
    else:
        # this should not happen, the sending chain modified the Token module
        # the message is malicious and no tokens should be credited
        terminateEscrow(sendingChainID)
    stop CCM execution

if (tokenID.chainID != ownChainID
    or escrowAmount(sendingChainID, tokenID.localID) < amount + forwardedMessageFee):
    if CCM.status == CCM_STATUS_OK:
        interoperability.error(CCM, CCM_STATUS_PROTOCOL_VIOLATION)
    terminateEscrow(sendingChainID)
    stop CCM execution

    
escrowAmount(sendingChainID, tokenID.localID) -= amount + forwardedMessageFee
localTokenID = {"chainID": CHAIN_ID_ALIAS_NATIVE, "localID": tokenID.localID}
availableBalance(senderAddress, localTokenID) += amount + forwardedMessageFee

messageParams: {  
    "tokenID": tokenID,
    "amount": amount,
    "senderAddress": senderAddress,
    "recipientAddress": recipientAddress,
    "data": data
}
                           
serializedParams = serialization of messageParams
                  following crossChainTransferMessageParams

timestamp = timestamp of the block including the execution of this cross-chain command
                  
interoperability.send(timestamp,
                      MODULE_ID_TOKEN,
                      CROSS_CHAIN_COMMAND_ID_TRANSFER,
                      forwardToChainID,
                      forwardedMessageFee,
                      senderAddress,
                      serializedParams)

if the above send function does not fail:
    availableBalance(senderAddress, localTokenID) -= amount
    # notice that the forwardedMessageFee was deducted by the send function
```


### Tokens and Genesis Blocks

The genesis block of a chain can have a non-empty token store. 
The distribution of tokens at genesis is left to sidechain developers and must follow the conditions below: 


*   No entries with prefix key `STORE_PREFIX_ESCROW` should exist in the genesis block.
*   Only tokens with `chainID = CHAIN_ID_ALIAS_NATIVE` must exist in the genesis block. They can be part of the available balance or part of the locked balances.
*   For all `localID`, the sum of all corresponding amounts (available or locked) over all existing user store entries must equal `totalSupply(localID)`.
*   `nextAvailableLocalID > localID` for all `localID` such that `supply(localID)` exists.


### Mainchain Minimum Balance Specifications

As specified in [LIP 0025](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0025.md), mainchain user substore entries cannot hold less than `MIN_BALANCE` of LSK token. To follow this rule: 


*   Executing transactions that would result in an address `address` with `availableBalance(address, TOKEN_ID_LSK_MAINCHAIN) < MIN_BALANCE` is invalid. This is checked as part of the "after transaction execution" logic of the block lifecycle.
*   Cross-chain messages that would result in an address `address` with `availableBalance(address, TOKEN_ID_LSK_MAINCHAIN) < MIN_BALANCE` after their execution must be rejected. 
    This is done by calling `interoperability.error(CCM, CCM_STATUS_MIN_BALANCE_NOT_REACHED)` on the rejected CCM.


### Protocol Logic for Other Modules

The Token module provides the following methods to modify the token state. Any other modules should use those to modify the token state. 
The token state should never be modified from outside the module without using one of the proposed functions as this could result in unexpected behavior and could cause an improper state transition.

In the following, we use the function
```python
canonicalTokenID(tokenID):
    if tokenID.chainID == interoperability.getOwnChainAccount().ID
        return {"chainID": CHAIN_ID_ALIAS_NATIVE, "localID": tokenID.localID}
    else:
        return tokenID
````
This allows the functions below to be called with the chain ID of native tokens being either `CHAIN_ID_ALIAS_NATIVE` or the registered chain ID.

#### getAvailableBalance

```python
getAvailableBalance(address, tokenID):
    tokenID = canonicalTokenID(tokenID)
    return availableBalance(address, tokenID)
```


#### getLockedAmount

```python
getLockedAmount(address, moduleID, tokenID):
    tokenID = canonicalTokenID(tokenID)
    return lockedAmount(address, moduleID, tokenID)
```


#### getEscrowedAmount

```python
getEscrowedAmount(escrowChainID, tokenID):
    tokenID = canonicalTokenID(tokenID)
    if tokenID.chainID != CHAIN_ID_ALIAS_NATIVE:
        getEscrowedAmount fails
    return escrowAmount(escrowChainID, tokenID.localID)
```


#### getEscrowStatus

```python
getEscrowStatus(chainID):
    return escrowTerminated(chainID)
```


#### getNextAvailableLocalID

```python
getNextAvailableLocalID():
    return nextAvailableLocalID
```


#### initializeToken

```python
initializeToken(localID):
    if supplyStore(localID) exists:
        initializeToken fails
    else:
        create a supply substore entry with
            storeKey = uint32be(localID)
            storeValue = {"totalsupply": 0} serialized using escrowStoreSchema 
        
    if localID >= nextAvailableLocalID:
        nextAvailableLocalID = localID + 1
    return localID
```


#### mint 

```python
mint(address, tokenID, amount): 
    tokenID = canonicalTokenID(tokenID)
    # this function is only used to mint native tokens
    if (tokenID.chainID != CHAIN_ID_ALIAS_NATIVE
        or amount < 0
        or supplyStore(tokenID.localID) does not exist
        or availableBalance(address, tokenID) + amount >= 2^64):
        mint fails

    availableBalance(address, tokenID) += amount
    totalSupply(tokenID.localID) += amount
```


#### burn

```python
burn(address, tokenID, amount):
    tokenID = canonicalTokenID(tokenID)
    if (tokenID.chainID != CHAIN_ID_ALIAS_NATIVE
        or amount < 0
        or availableBalance(address, tokenID) < amount):
        burn fails

    availableBalance(address, tokenID) -= amount
    totalSupply(tokenID.localID) -= amount
```


#### transfer

```python
transfer(senderAddress, recipientAddress, tokenID, amount):
    tokenID = canonicalTokenID(tokenID)
    if (amount < 0:
        or availableBalance(senderAddress, tokenID) < amount):
        transfer fails

    availableBalance(senderAddress, tokenID) -= amount 
    availableBalance(recipientAddress, tokenID) += amount 
```


#### transferCrossChain

```python
transferCrossChain(timestamp,
                   senderAddress, 
                   receivingChainID, 
                   recipientAddress, 
                   tokenID, 
                   amount, 
                   messageFee, 
                   data): 

    tokenID = canonicalTokenID(tokenID)
    chainID = tokenID.chainID
    localID = tokenID.localID
    if (amount < 0
        or chainID not in [CHAIN_ID_ALIAS_NATIVE, MAINCHAIN_ID, receivingChainID]
        or (escrowTerminated(receivingChainID) == True
            and (chainID == CHAIN_ID_ALIAS_NATIVE or chainID == MAINCHAIN_ID))
        or length(data) > MAX_DATA_LENGTH
        or length(senderAddress) != ADDRESS_LENGTH
        or length(recipientAddress) != ADDRESS_LENGTH
        or availableBalance(senderAddress, tokenID) < amount):
        transferCrossChain fails

    if chainID == CHAIN_ID_ALIAS_NATIVE:  
        escrowAmount(receivingChainID, localID) += amount
        newTokenID = {"chainID": interoperability.getOwnChainAccount().ID,
                      "localID": localID}
    else:
        newTokenID = tokenID

    if chainID in [CHAIN_ID_ALIAS_NATIVE, receivingChainID]
        availableBalance(senderAddress, tokenID) -= amount
        messageParams: {  
            "tokenID": newTokenID,
            "amount": amount,
            "senderAddress": senderAddress,
            "recipientAddress": recipientAddress,
            "data": data
        }       
        serializedParams = serialization of messageParams 
                          following crossChainTransferMessageParams    
        interoperability.send(timestamp,
                              MODULE_ID_TOKEN,
                              CROSS_CHAIN_COMMAND_ID_TRANSFER,
                              receivingChainID,
                              messageFee,
                              senderAddress,
                              serializedParams)
                                   
    else: # ie: chainID == MAINCHAIN_ID and receivingChainID != MAINCHAIN_ID
        availableBalance(senderAddress, tokenID) -= amount + messageFee
        messageParams: {  
            "tokenID": newTokenID,
            "amount": amount,
            "senderAddress": senderAddress,
            "forwardToChainID": receivingChainID,
            "recipientAddress": recipientAddress,
            "data": data,
            "forwardedMessageFee": messageFee
        }        
        serializedParams = serialization of messageParams
                          following crossChainForwardMessageParams
        interoperability.send(timestamp,
                              MODULE_ID_TOKEN,
                              CROSS_CHAIN_COMMAND_ID_FORWARD,
                              MAINCHAIN_ID,
                              0,
                              senderAddress,
                              serializedParams)
```


#### escrow

```python
escrow(escrowChainID, address, tokenID, amount):
    tokenID = canonicalTokenID(tokenID)
    if (tokenID.chainID != CHAIN_ID_ALIAS_NATIVE
        or amount < 0
        or availableBalance(address, tokenID) < amount
        or escrowTerminated(escrowChainID) == True):
        escrow fails

    availableBalance(address, tokenID) -= amount 
    escrowAmount(escrowChainID, tokenID.localID) += amount 
```


#### unescrow

```python
unescrow(escrowChainID, address, tokenID, amount):
    tokenID = canonicalTokenID(tokenID)
    if (tokenID.chainID != CHAIN_ID_ALIAS_NATIVE
        or amount < 0
        or escrowAmount(escrowChainID, localID) < amount):
        unescrow fails

    availableBalance(address, tokenID) += amount
    escrowAmount(escrowChainID, tokenID.localID) -= amount 
```


#### transferEscrow

```python
transferEscrow(fromChainID, toChainID, tokenID, amount):
    tokenID = canonicalTokenID(tokenID)
    if (tokenID.chainID != CHAIN_ID_ALIAS_NATIVE
        or amount < 0
        or escrowAmount(fromChainID, tokenID.localID) < amount
        or escrowTerminated(toChainID) == True):
        transferEscrow fails

    escrowAmount(fromChainID, tokenID.localID) -= amount
    escrowAmount(toChainID, tokenID.localID) += amount
```



#### lock

```python
lock(address, moduleID, tokenID, amount):
    tokenID = canonicalTokenID(tokenID)
    if (amount < 0
        or availableBalance(address, tokenID) < amount):
        lock fails
        
    availableBalance(address, tokenID) -= amount
    lockedAmount(address, moduleID, tokenID) += amount 
```



#### unlock

```python
unlock(address, moduleID, tokenID, amount):
    tokenID = canonicalTokenID(tokenID)
    if (amount < 0
        or lockedAmount(address, moduleID, tokenID) < amount):
        unlock fails
        
    availableBalance(address, tokenID) += amount
    lockedAmount(address, moduleID, tokenID) -= amount
```



#### beforeExecuteCCM

```python
beforeExecuteCCM(relayerAddress, CCM):
    fee = CCM.fee
    if fee < 0:
        beforeExecuteCCM fails
    
    if interoperability.getOwnChainAccount().ID == MAINCHAIN_ID:
        # if this chain is the mainchain, unescrow the fee
        if escrowAmount(CCM.sendingChainID, LOCAL_ID_LSK) < fee:
            beforeExecuteCCM fails
        availableBalance(relayerAddress, TOKEN_ID_LSK_MAINCHAIN) += fee 
        escrowAmount(CCM.sendingChainID, LOCAL_ID_LSK) -= fee
    else:
        availableBalance(relayerAddress, TOKEN_ID_LSK) += fee    
```


#### beforeSendCCM

```python
beforeSendCCM(payFromAddress, CCM):
    fee = CCM.fee
    if fee < 0:
        beforeSendCCM fails
        
    if interoperability.getOwnChainAccount().ID == MAINCHAIN_ID:
        # if this chain is the mainchain, escrow the fee
        if availableBalance(payFromAddress, TOKEN_ID_LSK_MAINCHAIN) < fee:
            beforeSendCCM fails
        availableBalance(payFromAddress, TOKEN_ID_LSK_MAINCHAIN) -= fee 
        escrowAmount(CCM.receivingChainID, LOCAL_ID_LSK) += fee
    else:
        if availableBalance(payFromAddress, TOKEN_ID_LSK) < fee:
            beforeSendCCM fails
        availableBalance(payFromAddress, TOKEN_ID_LSK) -= fee
```


#### recover

```python
recover(terminatedChainID, moduleID, storePrefix, storeKey, storeValue):
    if (storePrefix != STORE_PREFIX_USER
        or len(storeKey) != 28
        or storeValue cannot be deserialized using userStoreSchema):
        recover fails
        
    address = first ADDRESS_LENGTH bytes of storeKey
    chainID = bytes 21 to 24 of storeKey
    localID = last 4 bytes of storeKey
    account = storeValue deserialized using userStoreSchema
    totalAmount = sum of availableBalance and all locked amounts of account
    
    if (chainID != interoperability.getOwnChainAccount().ID
        or escrowAmount(terminatedChainID, localID) < totalAmount):
        recover fails
        
    escrowAmount(terminatedChainID, localID) -= totalAmount
    availableBalance(address, {"chainID":CHAIN_ID_ALIAS_NATIVE, "localID": localID}) += totalAmount
```


## Backwards Compatibility

This introduces a different token handling mechanism for the whole Lisk ecosystem which requires a hard fork.

[base-interoperability-LIP]: https://research.lisk.com/t/properties-serialization-and-initial-values-of-the-interoperability-module/290
[registration-LIP]: https://research.lisk.com/t/chain-registration/291
[recovery-LIP]: https://research.lisk.com/t/sidechain-recovery-transactions/292
[CCU-LIP]: https://research.lisk.com/t/introduce-cross-chain-update-transactions/298
[CCM-LIP]: https://research.lisk.com/t/cross-chain-messages/299
