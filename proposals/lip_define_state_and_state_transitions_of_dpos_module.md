```
LIP: <LIP number>
Title: Define state and state transitions of DPoS module
Author: Maxime Gagnebin <maxime.gagnebin@lightcurve.io>
        Nazar Hussain <nazar@lightcurve.io>
        Mehmet Egemen Albayrak <mehmet.albayrak@lightcurve.io>
Discussions-To: https://research.lisk.com/t/define-state-and-state-transitions-of-dpos-module/320
Type: Standards Track
Created: <YYYY-MM-DD>
Updated: <YYYY-MM-DD>
Required: 0022, 0023, 0024, 0040, 0044, 
          Define state and state transitions of Random module, 
          Introduce BFT module,
          Introduce unlocking condition for incentivizing certificate generation
```


## Abstract

The DPoS (delegated proof-of-stake) module is responsible for handling delegate registration, votes, and computing the delegate weight. 
In this LIP, we specify the properties of the DPoS module, along with their serialization and initial values. 
Furthermore, we specify the state transitions logic defined within this module, 
i.e. the commands, the protocol logic injected during the block lifecycle, and the functions that can be called from other modules or off-chain services.


## Copyright

This LIP is licensed under the [Creative Commons Zero 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).


## Motivation

The DPoS module handles all aspects of the generator selection, this includes the registration of accounts as delegates, the voting process, and potential misbehavior reports.

In this LIP we specify the properties, serialization, initialization, and exposed functions of the DPoS module, 
as well as the protocol logic processed during a block life cycle and the module commands.


## Rationale

This new LIP does not introduce significant protocol changes to the generator selection mechanism proposed in [LIP 0022][LIP-0022] and [LIP 0023][LIP-0023]. 
It only defines how the commands and processes defined in those LIPs are integrated in the state model used in Lisk. 
Please see [LIP 0022][LIP-0022] and [LIP 0023][LIP-0023] for a thorough rationale regarding the choice of voting system and the inclusion of standby delegates.

[LIP 0022][LIP-0022] defines a selection mechanism for 2 standby delegates. 
In this LIP, we slightly extend the specifications to support 0 or 1 standby delegate, however, we do not specify how to extend the protocol to more than 2 delegates. 
Introducing more standby delegates might require a different source of randomness and it is not the aim of this LIP to describe this topic.


### DPoS Store


#### Voter Substore

This part of the state store is used to maintain the votes and recent unvotes of users. 
The entries are keyed by address and contain an array of the current votes as well as an array of objects representing the tokens waiting to be unlocked. 


#### Delegate Substore

This part of the state store is used to maintain all information regarding the registered delegates. 
It is keyed by address and contains values for the delegate name, last generated height, total votes received, 
proof-of-misbehaviour heights, and a flag asserting if the delegate is banned or not.


#### Name Substore

This part of the state store is used to maintain a list of all names already registered. 
It allows the protocol to efficiently process the delegate registration transaction. 
The entries are keyed by delegate name and the value contains the address of the corresponding delegate.


#### Snapshot Substore

This part of the state store is used to maintain the needed snapshots of validator weights. 
The entries are keyed by round number and contain the active delegates, the delegate weight of potential standby delegates. 
Entries for older rounds which are no longer necessary are removed.


#### Genesis Data Substore

This part of the state store is used to maintain information from the genesis block. 
This information is used to compute if a block is at the end of a round, 
and to generate the generator list during the bootstrap period.


#### Previous Timestamp Substore

This part of the state store is used to maintain the timestamp of the last block added to the chain.
This is used when calling the function computing missed blocks from the Validators module.


## Specification


### Notation and Constants

For the rest of this proposal we define the following constants:


| Name          | Type    | Value       | Description |
| ------------- |---------| ------------| ------------|
| **DPoS store constants** ||||
| `STORE_PREFIX_VOTER`               | bytes | 0x0000 | The store prefix of the voter substore.|
| `STORE_PREFIX_DELEGATE`            | bytes | 0x4000 | The store prefix of the delegate substore.|
| `STORE_PREFIX_NAME`                | bytes | 0x8000 | The store prefix of the name substore.|
| `STORE_PREFIX_SNAPSHOT`            | bytes | 0xd000 | The store prefix of the snapshot substore.|
| `STORE_PREFIX_GENESIS_DATA`        | bytes | 0xc000 | The store prefix of the genesis data substore.|
| `STORE_PREFIX_PREVIOUS_TIMESTAMP`  | bytes | 0xe000 | The store prefix of the previous timestamp substore.|
| **DPoS constants** ||||
| `MODULE_ID_DPOS`                   | uint32  | TBD | The module ID of the DPoS module.|
| `COMMAND_ID_DELEGATE_REGISTRATION` | uint32  | `0` | The command ID of the delegate registration transaction.|
| `COMMAND_ID_VOTE`                  | uint32  | `1` | The command ID of the vote transaction.|
| `COMMAND_ID_UNLOCK`                | uint32  | `2` | The command ID of the unlock transaction.|
| `COMMAND_ID_POM`                   | uint32  | `3` | The command ID of the proof-of-misbehavior transaction.|
| `COMMAND_ID_UPDATE_GENERATOR_KEY`  | uint32  | `4` | The command ID of the update generator key transaction.|
| **Configurable Constants** ||**Mainchain Value**||
| `FACTOR_SELF_VOTES`          | uint32 | `10` |The factor multiplying the self-votes of a delegate for the delegate weight computation.|
| `MAX_LENGTH_NAME`            | uint32 | `20` |The maximum allowed name length for delegates.|
| `MAX_NUMBER_SENT_VOTES`      | uint32 | `10` |The maximum size of the sentVotes array of a voter substore entry.|
| `MAX_NUMBER_PENDING_UNLOCKS` | uint32 | `20` |The maximum size of the pendingUnlocks array of a voter substore entry.|
| `FAIL_SAFE_MISSED_BLOCKS`    | uint32 | `50` |The number of consecutive missed blocks used in the fail safe banning mechanism.|
| `FAIL_SAFE_INACTIVE_WINDOW`  | uint32 | `260,000` |The length of the inactivity window used in the fail safe banning mechanism.|
| `PUNISHMENT_WINDOW`          | uint32 | `780,000` |The punishment time for punished delegates.|
| `ROUND_LENGTH`               | uint32 | `103` |The round length.|
| `BFT_THRESHOLD`              | uint32 | `68` |The precommit and certificate thresholds used by the BFT module.|
| `MIN_WEIGHT_STANDBY`         | uint32 | `1000*(10^8)` |The minimum delegate weight required to be eligible as a standby delegate.|
| `NUMBER_ACTIVE_DELEGATES`    | uint32 | `101` |The number of active delegates. |
| `NUMBER_STANDBY_DELEGATES`   | uint32 | `2` |The number of standby delegates. This LIP is specified for the number of standby delegates being 0, 1 or 2.|
| `TOKEN_ID_DPOS`              | object | `TOKEN_ID_LSK` = {<br /> `"chainID": 0`, <br /> `"localID": 0`<br />}  |The token ID of the token used to cast votes. |
| `DELEGATE_REGISTRATION_FEE`  | uint32 | `10*(10^8)` |The extra command fee of the delegate registration. |


#### uint32be

`uint32be(x)` returns the big endian uint32 serialization of an integer `x`, with `0 <= x < 2^32`. This serialization is always 4 bytes long.


#### Functions from Other Modules

Calling a function `fct` from another module (named `moduleName`) is represented by `moduleName.fct(required inputs)`.


### DPoS Module Store

The store keys and values of the DPoS store are set as follows:


#### Voter Substore


##### Store Prefix, Store Key, and Store Value

* The store prefix is set to `STORE_PREFIX_VOTER`.
* Each store key is a 20-byte `address`, representing a user address.
* Each store value is the serialization of an object following `voterStoreSchema`.
* Notation: For the rest of this proposal let `voterStore(address)` be the entry in the voter substore with store key `address`.


##### JSON Schema

```java
voterStoreSchema = {
    "type": "object",
    "required": ["sentVotes", "pendingUnlocks"],
    "properties": {
        "sentVotes": {
            "type": "array",
            "fieldNumber": 1,
            "items": {
                "type": "object",
                "required": ["delegateAddress", "amount"],
                "properties": {
                    "delegateAddress": {
                        "dataType": "bytes",
                        "fieldNumber": 1
                    },
                    "amount": {
                        "dataType": "uint64",
                        "fieldNumber": 2
                    }
                }
            }
        },
        "pendingUnlocks": {
            "type": "array",
            "fieldNumber": 2,
            "items": {
                "type": "object",
                "required": ["delegateAddress", "amount", "unvoteHeight"],
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
                }
            }
        }
    }
}
```


##### Properties and Default values

In this section, we describe the properties of the voter substore and specify their default values.

* `sentVotes`: stores an array of the current votes of a user. 
  Each vote is represented by the address of the voted delegate and the amount of tokens that have been used to vote for the delegate. 
  This array was called `votes` in LIP 0023. 
  This array is updated with a vote command.  
  The `sentVotes` array is always kept ordered in lexicographical order of `delegateAddress`.
  Its size is at most `MAX_NUMBER_SENT_VOTES`, any state transition that would increase it to above `MAX_NUMBER_SENT_VOTES` is invalid.
* `pendingUnlocks`: stores an array representing the tokens that have been unvoted, but not yet unlocked. 
  Each unvote generates an object in this array containing the address of the unvoted delegate, the amount of the unvote and the height at which the unvote was included in the chain. 
  Objects in this array get removed when the corresponding unlock command is executed. 
  This array was called `unlocking` in LIP 0023. 
  This array is updated with vote and unlock commands.  
  The `pendingUnlocks` array is always kept ordered by lexicographical order of `delegateAddress`, ties broken by increasing `amount`, ties broken by increasing `unvoteHeight`. 
  The size of the `pendingUnlocks` array is at most `MAX_NUMBER_PENDING_UNLOCKS`, any state transition that would increase it to above `MAX_NUMBER_PENDING_UNLOCKS` is invalid. 


#### Delegate Substore


##### Store Prefix, Store Key, and Store Value

* The store prefix is set to `STORE_PREFIX_DELEGATE`.
* Each store key is a 20-byte `address`, representing a delegate address.
* Each store value is the serialization of an object following `delegateStoreSchema`.
* Notation: For the rest of this proposal let `delegateStore(address)` be the entry in the delegate substore with store key `address`.


##### JSON Schema

```java
delegateStoreSchema = {
    "type": "object",
    "required": [
        "name", 
        "totalVotesReceived", 
        "selfVotes", 
        "lastGeneratedHeight", 
        "isBanned", 
        "pomHeights",
        "consecutiveMissedBlocks"
    ],
    "properties": {
        "name": {
            "dataType": "string", 
            "fieldNumber": 1
        },
        "totalVotesReceived": {
            "dataType": "uint64", 
            "fieldNumber": 2
        },
        "selfVotes": {
            "dataType": "uint64", 
            "fieldNumber": 3
        },
        "lastGeneratedHeight": {
            "dataType": "uint32", 
            "fieldNumber": 4
        },
        "isBanned": {
            "dataType": "boolean",
            "fieldNumber": 5
        },
        "pomHeights": { 
            "type": "array",
            "fieldNumber": 6,
            "items": {"dataType": "uint32"}
        },
        "consecutiveMissedBlocks": {
            "dataType": "uint32", 
            "fieldNumber": 7
        } 
    }
}
```



##### Properties and Default values

In this section, we describe the properties of the delegate substore and specify their default values. 
Entries in this substore can be created during the execution of the genesis block. 
When the chain is running, entries in this substore are created by a [delegate registration command](#delegate-registration) and its value is set during the command execution. 
It contains information about the delegate whose address is the store key.



* `name`: a string representing the delegate name, with a minimum length of `1` character and a maximum length of `MAX_LENGTH_NAME` 
* `totalVotesReceived`: the sum of all votes received by a delegate.
* `selfVotes` : the sum of all votes the delegate cast for its own account.
* `lastGeneratedHeight`: the height at which the delegate last generated a block.
* `isBanned`: a boolean value indicating if the delegate is banned or not. Banned delegates are never chosen to generate new blocks.
* `pomHeights`:  the heights at which a proof of misbehavior command was successfully executed with blocks generated by the delegate.
* `consecutiveMissedBlocks`: the number of consecutive missed blocks by the delegate. 
  This value resets to 0 whenever a block generated by the delegate is included in the blockchain.


#### Name Substore


##### Store Prefix, Store Key, and Store Value

* The store prefix is set to `STORE_PREFIX_NAME`.
* Each store key is a utf8-encoded string `name`, representing a delegate name.
* Each store value is the serialization of an object following `nameStoreSchema`.
* Notation: For the rest of this proposal let `nameStore(name)` be the entry in the name substore with store key `name`.


##### JSON Schema

```java
nameStoreSchema = {
    "type": "object",
    "required": ["delegateAddress"],
    "properties": {
        "delegateAddress": {
            "dataType": "bytes", 
            "fieldNumber": 1
        }
    }
}
```


##### Properties and Default values

The name substore maintains all registered names, using the name as store key and the address of the validator that registered that name as the corresponding store value. 
The name substore is initially empty, i.e. it does not contain any key-value pairs. 


#### Snapshot Substore


##### Store Prefix, Store Key, and Store Value

* The store prefix is set to `STORE_PREFIX_SNAPSHOT`.
* Each store key is `uint32be(roundNumber)`, where `roundNumber` is the number of the round at the end of 
  which the active delegates and weights are computed. 
  These values will be used to compute the validator set for round `roundNumber + 2`.
* Each store value is the serialization of an object following `snapshotStoreSchema`.
* Notation: For the rest of this proposal let `snapshotStore(roundNumber)` be the entry in the snapshot substore with store key `uint32be(roundNumber)`.


##### JSON Schema

```java
snapshotStoreSchema = {
    "type": "object",
    "required": ["activeDelegates", "delegateWeightSnapshot"],
    "properties": {
        "activeDelegates": {
            "type": "array",
            "fieldNumber": 1,
            "items": {"dataType": "bytes"}
        },
        "delegateWeightSnapshot": {
            "type": "array",
            "fieldNumber": 2,
            "items": {
                "type": "object",
                "required": ["delegateAddress", "delegateWeight"],
                "properties": {
                    "delegateAddress": {
                        "dataType": "bytes", 
                        "fieldNumber": 1
                    },
                    "delegateWeight": {
                        "dataType": "uint64",
                        "fieldNumber": 2
                    }
                }
            }
        }
    }
}
```


The `delegateWeightSnapshot` array is ordered lexicographically by `address`.


##### Properties and Default values

In this section, we describe the properties of the snapshot substore and specify their default values.

* `activeDelegates`: the addresses of the top `NUMBER_ACTIVE_DELEGATES` delegates by delegate weight at the end of round `roundNumber`.
* `delegateWeightSnapshot`: all delegate addresses and weights of delegates (not in the active delegates array) with more than `MIN_WEIGHT_STANDBY` delegate weight. 
  This array is completed with delegates with less weight in the case there are not enough delegates with weight above `MIN_WEIGHT_STANDBY`.

The snapshot substore is initially empty.


#### Genesis Data Substore


##### Store Prefix, Store Key, and Store Value

* The store prefix is set to `STORE_PREFIX_GENESIS_DATA`.
* The store key is the empty bytes.
* The store value is the serialization of an object following `genesisDataStoreSchema`.
* Notation: For the rest of this proposal let 
    * `genesisHeight` be the `height` property of the entry in the genesis data substore.
    * `initRounds` be the `initRounds` property of the entry in the genesis data substore.
    * `initDelegates` be the `initDelegates` property of the entry in the genesis data substore.


##### JSON Schema

```java
genesisDataStoreSchema = {
    "type": "object",
    "required": [
        "height", 
        "initRounds",
        "initDelegates"
    ],
    "properties": {
        "height": {
            "dataType": "uint64",
            "fieldNumber": 1
        },
        "initRounds": {
            "dataType": "uint32",
            "fieldNumber": 2
        },
        "initDelegates": {
            "type": "array",
            "fieldNumber": 3,
            "items": {"dataType": "bytes"}
        }
    }
}
```


##### Properties and Default values

The genesis data substore stores information from the genesis block. It is initialized when processing the genesis block.

* `height`: height of the genesis block.
* `initRounds`: the length of the [bootstrap period][LIP-0034-bootstrapPeriod], also called initial rounds. 
  This property must have a value greater than 3.
* `initDelegates`: the addresses of the validators to be used during the bootstrap period. This property must have a non-empty value.


#### Previous Timestamp Substore


##### Store Prefix, Store Key, and Store Value

* The store prefix is set to `STORE_PREFIX_PREVIOUS_TIMESTAMP`.
* The store key is the empty bytes.
* The store value is the serialization of an object following `previousTimestampStoreSchema`
* Notation: For the rest of this proposal, let `previousTimestamp` be the `timestamp` property of the entry in the previous timestamp substore.


##### JSON Schema

```java
previousTimestampStoreSchema = {
    "type": "object",
    "required": ["timestamp"],
    "properties": {
        "timestamp": {
            "dataType": "uint32",
            "fieldNumber": 1
        }
    }
}
```


##### Properties and Default values

`timestamp`: The timestamp of the last block added to the chain.


### Command


#### Delegate Registration

Transaction executing this command have:

* `moduleID = MODULE_ID_DPOS`,
* `commandID = COMMAND_ID_DELEGATE_REGISTRATION`.


##### Fee

This command has an extra command fee:

```python
extraCommandFee(MODULE_ID_DPOS, COMMAND_ID_DELEGATE_REGISTRATION) = DELEGATE_REGISTRATION_FEE
```


##### Parameters

```java
delegateRegistrationTransactionParams = {
    "type": "object",
    "required": [
        "name",
        "blsKey",
        "proofOfPossession",
        "generatorKey"
    ],
    "properties": {
        "name": {
            "dataType": "string",
            "fieldNumber": 1
        },
        "blsKey": {
            "dataType": "bytes",
            "fieldNumber": 2
        },
        "proofOfPossession": {
            "dataType": "bytes",
            "fieldNumber": 3
        },
        "generatorKey": {
            "dataType": "bytes",
            "fieldNumber": 4
        }
    }
}
```


##### Verification

The params property of a delegate registration command is valid if:

* there exists no entry in the name substore with store key `name`.
* `name` contains only characters from the set `abcdefghijklmnopqrstuvwxyz0123456789!@$&_.` 
  (lower case letters, numbers and symbols `!@$&_.`), is at least `1` character long and at most `MAX_LENGTH_NAME` characters long. 
* There exists no entry in the delegate substore with store key `delegateAddress`, 
  `delegateAddress` being derived from the transaction sender public key.
* `generatorKey` must have length 32.
* `blsKey` must have length 48.
* `proofOfPossession` must have length 96.


##### Execution

When a transaction `trs` executing a delegate registration command included in a block `b`, the logic below is followed:

```python
derive delegateAddress from trs.senderPublicKey

validators.registerValidatorKeys(delegateAddress,
                                 proofOfPossession,
                                 generatorKey,
                                 blsKey)

if the above function returns False, the execution fails

create an entry in the delegate substore with 
    storeKey = delegateAddress,
    storeValue = {
        "name": trs.params.name,
        "totalVotesReceived": 0,
        "lastGeneratedHeight": b.height,
        "isBanned": False,
        "pomHeights": [],
        "consecutiveMissedBlocks": 0
    } serialized using delegateStoreSchema

create an entry in the name substore with 
    storeKey = trs.params.name encoded as utf8,
    storeValue = {"delegateAddress": delegateAddress} serialized using nameStoreSchema
```


#### Update Generator Key

This command is used to update the generator key (from the [validators module][LIP-validators]) for a specific validator. 
Transaction executing this command have:

* `moduleID = MODULE_ID_DPOS`,
* `commandID = COMMAND_ID_UPDATE_GENERATOR_KEY`.


##### Parameters

```java
updateGeneratorKeyParams = {
    "type": "object",
    "required": ["generatorKey"],
    "properties": {
        "generatorKey": {
            "dataType": "bytes",
            "fieldNumber": 1
        }
    }
}
```


##### Verification

An update generator key transaction `trs` must fulfill the following to be valid:

* Let `address` be the 20-byte address derived from `trs.senderPublicKey`. 
  Then the delegate substore must have an entry for the store key `address`.
* `trs.params.generatorKey` must have length 32.


##### Execution

Executing an update generator key transaction `trs` is done by calling `validators.updateGeneratorKey(address, trs.params.generatorKey)` where 
`address` is the 20-byte address derived from trs.senderPublicKey.


#### Vote

Transactions executing this command have:

* `moduleID = MODULE_ID_DPOS`
* `commandID  = COMMAND_ID_VOTE`


##### Parameters

```java
voteTransactionParams = {
    "type": "object",
    "required": ["votes"],
    "properties": {
        "votes": {
            "type": "array",
            "fieldNumber": 1,
            "items": {
                "type": "object",
                "required": ["delegateAddress", "amount"],
                "properties": {
                    "delegateAddress" : {
                        "dataType": "bytes", 
                        "fieldNumber": 1
                    },
                    "amount": {
                        "dataType": "sint64",
                        "fieldNumber": 2
                    }
                }
            }
        }
    }
}
```

The verification and execution of this transaction is specified in [LIP 0023][LIP-0023-voteTrs]. 
This specification is followed to implement the vote command with the following additional point:

* when executing a self-vote (a vote with the `delegateAddress` equal to the address derived from the transaction public key), 
  modify the `delegateStore(delegateAddress).selfVotes` property and the `voterStore(delegateAddress).sentVotes` entry corresponding to `delegateAddress` identically.


#### Unlock

Transactions executing this command have:

* `moduleID = MODULE_ID_DPOS`
* `commandID = COMMAND_ID_UNLOCK`


##### Parameters

The `params` property of unlock transactions is empty.


#### Verification

Unlock transactions do not trigger specific verifications.


#### Execution

When executing an unlock transaction `trs`, the following is done:

```python
senderAddress = address corresponding to trs.senderPublicKey
height = height of the block including trs

for each unlockObject in voterStore(senderAddress).pendingUnlocks:
    if (hasWaited(unlockObject, senderAddress, height) 
        and not isPunished(unlockObject, senderAddress, height)
        and isCertificateGenerated(unlockObject)):
        delete unlockObject from voterStore(senderAddress).pendingUnlocks
        token.unlock(senderAddress, MODULE_ID_DPOS, TOKEN_ID_DPOS, unlockObject.amount)
```

The definition and rationale for the `isCertificateGenerated` function is part of [LIP "Introduce unlocking condition for incentivizing certificate generation"][LIP-incentivizeCertificateGeneration]. 
The `hasWaited` and `isPunished` functions are defined below and are rationalized in [LIP 0023][LIP-0023-unlockRationale] and [LIP 0024][LIP-0024-rationale] respectively.
```python
hasWaited(unlockObject, senderAddress, height):
    if unlockObject.delegateAddress == senderAddress:
        # this is a self-unvote
        delayedAvailability = 260,000
    else:
        delayedAvailability = 2000

    if height - unlockObject.unvoteHeight < delayedAvailability:
        return False
    else:
        return True
```

```python
isPunished(unlockObject, senderAddress, height):
    if delegateStore(unlockObject.delegateAddress).pomHeights is empty:
        return false
    else:
        let lastPomHeight be the last element of delegateStore(unlockObject.delegateAddress).pomHeights 
        # lastPomHeight is also its largest element of the pomHeights array
        
        if unlockObject.address == senderAddress:
            # this is a self-unvote
            if height – lastPomHeight < 780,000 and lastPomHeight < unlockObject.unvoteHeight + 260,000:
                return True
        else:
            if height – lastPomHeight < 260,000 and lastPomHeight < unlockObject.unvoteHeight + 2000:
                return  True

   return False
```


#### Proof of Misbehavior

Transactions executing this command have:

* `moduleID = MODULE_ID_DPOS`
* `commandID = COMMAND_ID_POM`


##### Parameters

```java
pomParams = {
    "type": "object",
    "required": ["header1", "header2"],
    "properties": {
        "header1": {
            "dataType": "bytes", 
            "fieldNumber": 1
        },
        "header2": {
            "dataType": "bytes", 
            "fieldNumber": 2
        }
    }
}
```


##### Verification

Both properties of the parameters must follow the block header schema as defined in [LIP "New block header and block asset schema"][LIP-newBlockHeader]. 
Validity of this transaction is then specified in [LIP 0024][LIP-0024-verifyPOM].


##### Execution

Execution of this transaction is specified in [LIP 0024][LIP-0024-applyingPOM].


### Internal Functions


#### Round Number and End of Rounds

All blocks (with the exception of the genesis block) are part of a round. 
The first block after the genesis block is the first block of the first round, and so on. 
The round length, i.e. the number of blocks in a round, is specified in a configuration file and is denoted `ROUND_LENGTH`. 
In the block lifecycle, it will be useful to compute the round number to which a block belongs and if the block is the last block of its round. 
For this, we will use the following functions:


##### roundNumber

This function returns the round number to which the input height belongs.

```python
roundNumber(h):
    return ceiling((h - genesisHeight) / ROUND_LENGTH)
```


##### isEndOfRound

This function returns a boolean indicating if the input height is at the end of a round or not.


```python
isEndOfRound(h):
    if (h - genesisHeight) % ROUND_LENGTH == 0:
        return True
    else:
        return False
```


#### delegateWeight

The delegate weight is always a function of the votes, the potential misbehaviors and the block height.


##### Parameters

The function has the following input parameters in the order given below:

* `address`: A 20-byte addresses of a delegate.
* `height`: The height for which the weight is computed.


##### Returns

This function returns the delegate weight.


##### Execution

```python
delegateWeight(address, height):

    if there exist h in delegateStore(address).pomHeights with 0 < height - h < PUNISHMENT_WINDOW:
        return 0
    else:
        return min(delegateStore(address).selfVotes * FACTOR_SELF_VOTES,
                   delegateStore(address).totalVotesReceived)
```



#### shuffleValidatorsList

A function to reorder the list of validators as specified in [LIP 0003][LIP-0003].


##### Parameters

The function has the following input parameters in the order given below:

* `validatorsAddresses`: An array of pairwise distinct 20-byte addresses.
* `randomSeed`: A 32-byte value representing a random seed.


##### Returns

This function returns an array of bytes with the re-ordered list of addresses.


##### Execution

```python
shuffleValidatorsList(validatorsAddresses, randomSeed):
    
    roundHash = {}
    for address in validatorsAddresses:
        roundHash[address] = hash(randomSeed || address)

    # Reorder the validator list
    shuffledValidatorAddresses = sort validatorsAddresses where address1 < adress2 if (roundHash(address1) < roundHash(address2))
                                 or ((roundHash(address1) == roundHash(address2)) and address1 < address2)         
    
    return shuffledValidatorAddresses
```


### Block Processing


#### After Genesis Block Execution

After the genesis block `b` is executed, the following logic is executed:

```python
create the entry in the genesis data substore with 
store value = {
    "height": b.header.height, 
    "initRounds": b.header.assets.initRounds, 
    "initDelegates": b.header.assets.initDelegates
} serialized using genesisDataStoreSchema

# set the inititial delegates in the BFT module
bftWeights = [
    {"address": address, "bftWeight": 1} 
    for address in initDelegates
    sorted by lexicographically by address
]

# compute the initial BFT threshold 
initBFTThreshold = floor(2/3 * length(initDelegates)) + 1

BFT.setBFTParameters(initBFTThreshold,
                     initBFTThreshold,
                     bftWeights)
                     
# set the inititial delegates in the validators module                 
validators.setGeneratorList(initDelegates)
```


#### After Block Execution

After a block `newBlock` is executed, the properties related to missed blocks are updated according to [Delegate Productivity][LIP-0023-delegateProductivity]. This logic is recapitulated below:

```python
newHeight = newBlock.header.height
# previousTimestamp is the value in the previous timestamp substore
missedBlocks = validators.getGeneratorsBetweenTimestamps(previousTimestamp, newBlock.header.timestamp)

# remove the start and end blocks, as those are not missed
missedBlocks[validators.getGeneratorAtTimestamp(previousTimestamp)] -= 1
missedBlocks[validators.getGeneratorAtTimestamp(newBlock.header.timestamp)] -= 1

for address in missedBlocks:
    delegateStore(address).consecutiveMissedBlocks += missedBlocks[address]

    # the rule below was introduced in LIP 0023
    if (delegateStore(address).consecutiveMissedBlocks > FAIL_SAFE_MISSED_BLOCKS
        and newHeight - delegateStore(address).lastGeneratedHeight > FAIL_SAFE_INACTIVE_WINDOW):
        delegateStore(address).isBanned = True

delegateStore(newBlock.header.generatorAddress).consecutiveMissedBlocks = 0
delegateStore(newBlock.header.generatorAddress).lastGeneratedHeight = newHeight

previousTimestamp = newBlock.header.timestamp
```

After an end-of-round block `b` is executed (`isEndOfRound(b.height) == True`), the following logic is executed (this must be done after the properties related to missed blocks are updated):

```python
roundNumber = roundNumber(b.height)
currentWeights = {}
for address being a storeKey in delegate substore and isBanned(address) == False:
    currentWeights[address] = delegateWeight(address, b.height)} 

activeDelegates = array of the top 101 address by decreasing delegateWeight from currentWeights, ties broken by lexicographical ordering of the address

# if currentWeights contains less than 101 entries
# there will be less than 101 activeDelegates
remove all entries from currentWeights with address in activeDelegates

sort currentWeights by decreasing delegateWeight, ties broken by lexicographical order of the delegateAddress

weightSnapshot = []
for each address being a key of currentWeights (keys taken in order):
    if currentWeights[address] >= MIN_WEIGHT_STANDBY:
        weightSnapshot.append({"delegateAddress": address,
                               "delegateWeight": currentWeights[address]})
    else: 
        # only triggered if there not enough addresses with weight MIN_WEIGHT_STANDBY as currentWeights is sorted
        if length(weightSnapshot) < 2:
            weightSnapshot.append({"delegateAddress": address,
                                   "delegateWeight": currentWeights[address]})

create an entry in the snapshot substore with 
    storeKey = uint32be(roundNumber),
    storeValue = {
        "activeDelegates": activeDelegates,
        "delegateWeightSnapshot": weightSnapshot
    } serialized using snapshotStoreSchema
delete any entries from the snapshot substore with storeKey <= uint32be(roundNumber-3)

# updates to Validators and BFT module are only done after the bootstrap period
if roundNumber > initRounds:
    validatorsTwoRoundsAgo = deserialized value of the snapshot substore entry with storeKey == uint32be(roundNumber-2)
    activeDelegates = validatorsTwoRoundsAgo.activeDelegates
    
    bftWeights = [
        {"address": address, "bftWeight": 1}
        for address in activeDelegates
        sorted by lexicographically by address
    ]
                  
    # get the last stored BFT parameters, and update them if needed
    currentBFTParameters = BFT.getBFTParameters(b.height)
    if (currentBFTParameters.validators != bftWeights
        or currentBFTParameters.precommitThreshold != BFT_THRESHOLD
        or currentBFTParameters.certificateThreshold != BFT_THRESHOLD):
        BFT.setBFTParameters(BFT_THRESHOLD,
                             BFT_THRESHOLD,
                             bftWeights)

    if NUMBER_STANDBY_DELEGATES == 2:
        randomSeed1 = random.getRandomBytes(b.height +1 - (ROUND_LENGTH*3)//2, 
                                     ROUND_LENGTH)
        randomSeed2 = random.getRandomBytes(b.height +1 - 2*ROUND_LENGTH,
                                     ROUND_LENGTH)
        delegate1, delegate2 = addresses of the standby delegates selected from validatorsTwoRoundsAgo.delegateWeightSnapshot 
                               as specified in LIP 0022, using the seeds randomSeed1 and randomSeed2
        # in the above, if validatorsTwoRoundsAgo.delegateWeightSnapshot is empty, then no standby delegates are selected
        validators = union of activeDelegates and {delegate1, delegate2}

    elif NUMBER_STANDBY_DELEGATES == 1:
        randomSeed1 = random.getRandomBytes(b.height +1 - (ROUND_LENGTH*3)//2,
                                 	 ROUND_LENGTH)
        delegate1 = address of the standby delegates selected from validatorsTwoRoundsAgo.delegateWeightSnapshot 
                    as specified in LIP 0022, using the seed randomSeed1
        validators = union of activeDelegates and {delegate1}
    else: # no standby delegates
        randomSeed1 = random.getRandomBytes(b.height +1 - (ROUND_LENGTH*3)//2,
                                 	 ROUND_LENGTH)
        validators = activeDelegates

    nextValidators = shuffleValidatorsList(validators, randomSeed1)
    validators.setGeneratorList(nextValidators)
```


### Protocol Logic for Other Modules

More functions might be made available during implementation.


#### isNameAvailable

Asserts the availability of a given name for delegate registration.


##### Parameters

* `name`: A string being asserted for availability.


##### Returns

A boolean asserting the availability of the given name for delegate registration.


##### Execution

```python
isNameAvailable(name):
    if (nameStore(name) exists
       or name includes symbols not in "abcdefghijklmnopqrstuvwxyz0123456789!@$&_."
       or length(name) > MAX_LENGTH_NAME
       or length(name) < 1):
        return False
    else:
        return True
```


#### getVoter

Returns the stored information relative to the given address.


##### Parameters

* `address`:  A 20-byte value identifying the voter.


##### Returns

This functions returns `voterStore(address)` deserialized using `voterStoreSchema`.


#### getDelegate

Returns the stored information relative to the given address.


##### Parameters

* `address`:  A 20-byte value identifying the delegate.


##### Returns

This functions returns `delegateStore(address)` deserialized using `delegateStoreSchema`.


### Endpoints for Off-Chain Services


#### getVoter(address)

Returns voter information for the given address.


##### Parameters

* `address`: A 20-byte value identifying the voter.


##### Returns

This function returns `voterStore(address)` deserialized using `voterStoreSchema`


#### getDelegate(address)

Returns delegate information for the given address.

##### Parameters

* `address`: A 20-byte value identifying the delegate.

##### Returns

This functions returns `delegateStore(address)` deserialized using `delegateStoreSchema`.


#### getAllDelegates()

Returns information of all delegates.


##### Parameters

This function has no input parameter.


##### Returns

This function returns all `delegateStore` items deserialized using `delegateStoreSchema`.


## Backwards Compatibility

This LIP defines a new store interface for the DPoS module, which in turn will become part of the state tree and will be authenticated by the state root. 
As such, it will induce a hardfork.


## Reference Implementation

TBA

[LIP-0022]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0022.md
[LIP-0023]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0023.md
[LIP-0023-unlockTrs]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0023.md#new-unlock-transaction
[LIP-0023-voteTrs]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0023.md#new-vote-transaction-1
[LIP-0023-delegateProductivity]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0023.md#delegate-productivity-1
[LIP-0023-unlockRationale]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0023.md#explicit-unlock-mechanism
[LIP-0003]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0003.md
[LIP-0024-applyingPOM]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0024.md#applying-a-pom-transaction
[LIP-0024-verifyPOM]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0024.md#validity-of-a-pom-transaction
[LIP-0024-rationale]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0024.md#rationale
[LIP-0034-bootstrapPeriod]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0034.md#bootstrap-period

[LIP-newBlockHeader]: https://research.lisk.com/t/new-block-header-and-block-asset-schema/293
[LIP-incentivizeCertificateGeneration]: https://research.lisk.com/t/introduce-unlocking-condition-for-incentivizing-certificate-generation/300
[LIP-validators]: https://research.lisk.com/t/introduce-validators-module/317
