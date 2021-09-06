```
LIP: <LIP number>
Title: Introduce Legacy module
Author: Andreas Kendziorra <andreas.kendziorra@lightcurve.io>
        Maxime Gagnebin <maxime.gagnebin@lightcurve.io>
        Rishi Mittal <rishi.mittal@lightcurve.io>
Type: Standards Track
Created: <YYYY-MM-DD>
Updated: <YYYY-MM-DD>
Discussions-To: https://research.lisk.com/t/introduce-legacy-module/319
Requires: LIP 0018
```


## Abstract

The Legacy module maintains all accounts on the Lisk mainchain that received balance transfers to their address in the old 8-byte format and for which no public key is associated. 
The Legacy module also implements a command allowing delegates without a BLS key to register one.

In this LIP, we specify the properties of the Legacy module, along with their serialization and default values. 
Furthermore, we specify the commands and the functions that can be called from off-chain services.

This module is only needed for the Lisk mainchain.


## Copyright

This LIP is licensed under the [Creative Commons Zero 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).


## Motivation

Once [LIP 0018][LIP18] is active on the Lisk mainchain, 
all nodes for the Lisk mainchain must maintain the accounts that received some funds before the implementation of LIP 18, 
but do not have an associated public key. 
The balance of these accounts is maintained in the legacy accounts substore and can be recovered with a reclaim transaction.

Furthermore, delegates registered before the implementation of the [Validators module][validator-LIP] do not have a registered BLS key. 
This module implements a command to allow those delegates to register a BLS key and hence participate in the certification generation process.

Implementing the Legacy module avoids the need for other modules (specifically the Token module and the Validators module) to handle legacy behaviors present only on the Lisk mainchain. 
This module is only part of the Lisk mainchain, and should not be implemented in any sidechain. 


## Specification


### Module ID

The Legacy module has the module ID `MODULE_ID_LEGACY` (defined in the table below).


### Notation and Constants

We define the following constants:


| Name          | Type    | Value | Description          |
| ------------- |---------| ------|  --------------------|
| `MODULE_ID_LEGACY `             | uint32 | TBD  | Module ID of the Legacy module. |
| `COMMAND_ID_RECLAIM `           | uint32 | 1000 | Command ID of the reclaim command. |
| `COMMAND_ID_REGISTER_BLS_KEY `  | uint32 | 1    | Command ID of the register BLS key command.|
| `STORE_PREFIX_LEGACY_ACCOUNTS ` | bytes  | 0x0000 | Store prefix of the legacy accounts substore. This contains the addresses and balances of legacy accounts.|


#### Functions from Other Modules

Calling a function `fct` from another module (named `moduleName`) is represented by `moduleName.fct(required inputs)`.


### Legacy Module Store


#### Legacy Accounts Substore

This substore contains an array with the addresses and the balances of all legacy accounts for which no [reclaim transaction][LIP18-ReclaimTransaction] was included.


##### Store Prefix, Store Key, and Store Value

* The store prefix is set to `STORE_PREFIX_LEGACY_ACCOUNTS`.
* The store key is an 8-byte value representing the legacy address.
* The store value is set to the serialization using `legacyAccountsSchema` of the balance of the legacy account.


##### JSON Schema

```java
legacyAccountsSchema = {
    "type": "object",
    "required": ["balance"],
    "properties": {
        "balance": {
            "dataType": "uint64",
            "fieldNumber": 1
        }
    }
}
```


##### Properties and Default values

This substore contains an entry for each legacy address for which no [reclaim transaction][LIP18-ReclaimTransaction] was included. 
See also the [“Accounts without Public Key” section][LIP18-AccountsWithoutPKey] in LIP 0018. 

The module store will be initialized with these legacy addresses and their respective balances during the execution of the genesis block.


#### Internal Functions


#### Legacy Addresses

Obtaining the legacy 8-byte address from a public key.


##### Parameters

A 32-byte value representing a public key.


##### Returns

The 8-byte legacy address corresponding to the given input.


##### Execution

```python
getLegacyAddress(publicKey):
    hashedKey = SHA-256(publicKey)
    firstEightBytes = first 8 bytes of hashedKey
    reversedEightBytes = firstEightBytes reversed
    return reversedEightBytes
```


### Commands


#### Reclaim

This command allows users to reclaim tokens from a legacy account as defined in [LIP 0018][LIP18-ReclaimTransaction]. Here, we clarify the verification and execution logic with respect to the module store.

Transactions executing this command have:

* `moduleID = MODULE_ID_LEGACY`,
* `commandID = COMMAND_ID_RECLAIM`.


##### Parameters

The `params` property of a reclaim transaction must obey the following schema:

```java
reclaimParamsSchema = {
    "type": "object",
    "required": ["amount"],
    "properties": {
        "amount": {
            "dataType": "uint64",
            "fieldNumber": 1
        }
    }
}
```


##### Verification

For a reclaim transaction `trs` to be valid, the legacy accounts substore must contain an entry with store key equal to `getLegacyAddress(trs.senderPublicKey)` and store value `{"balance": trs.params.amount}`, serialized using `legacyAccountsSchema`.


##### Execution

When a reclaim transaction `trs` is executed, the following is done:

* Delete the entry from the legacy accounts substore with store key `getLegacyAddress(trs.senderPublicKey)`.
* Call the function `mint(newAddress, 0, trs.params.amount)`, where `newAddress` is the [20-byte address][LIP18-addressComputation] derived from `trs.senderPublicKey`. 
  The function `mint` is defined in the [Token module][token-LIP-mint].


#### Register BLS Key

This command allows migrated legacy validators without a BLS key to register one. 
This command cannot be used to modify an existing BLS key, as this is forbidden by the Validators module. Transaction executing this command have:

* `moduleID = MODULE_ID_LEGACY`,
* `commandID = COMMAND_ID_REGISTER_BLS_KEY`.


##### Parameters

The `params` property of a register BLS key transaction must obey the following schema:

```java
registerBLSKeyParamsSchema = {
    "type": "object",
    "required": ["blsKey", "proofOfPossession"],
    "properties": {
        "blsKey": {
            "dataType": "bytes",
            "fieldNumber": 1
        },
        "proofOfPossession": {
            "dataType": "bytes",
            "fieldNumber": 2
        }
    }
}
```


##### Execution

Executing a transaction `trs` triggering an register BLS key command is done by calling the function `setValidatorBLSKey(validatorAddress, trs.params.proofOfPossession, trs.params.blsKey)` 
where `validatorAddress` is the 20-byte address derived from `trs.senderPublicKey` 
and `setValidatorBLSKey` is defined in the [Validators module][validator-LIP-setValidatoBLSKey]. 
If this function returns false, the transaction is invalid.


### Protocol Logic for Other Modules

This module does not expose any functions.


### Endpoints for Off-Chain Services


#### getLegacyAccount

This function provides the legacy address and balance of the corresponding legacy accounts.


##### Parameters

* inputParameter1: `publicKey`, an Ed25519 public key


##### Returns

Either an object with the properties `legacyAddress` and `balance`, where `legacyAddress` is the legacy address for `publicKey` and `balance` is the balance of the corresponding legacy account, or `undefined`.


##### Execution

```python
getLegacyAccount(publicKey)
    let legacyAddress be the legacy address of publicKey
    if there exists no entry in the legacy accounts substore with store key equal to legacyAddress:
        return undefined
    else:
        let balance be the value of the balance property of the legacy accounts substore entry with store key legacyAddress
        return {"legacyAddress": legacyAddress,
                "balance": balance}
```



## Backwards Compatibility

This LIP defines a new module and specifies its store, which in turn will become part of the state tree and will be authenticated by the state root. 
As such, it will induce a hardfork.


## Reference Implementation

TBA

[validator-LIP]: https://research.lisk.com/t/introduce-the-validators-module/317
[validator-LIP-setValidatoBLSKey]: https://research.lisk.com/t/introduce-the-validators-module/317#setvalidatorblskey-38
[token-LIP-mint]: https://research.lisk.com/t/define-state-and-state-transitions-of-token-module/295#mint-64
[LIP18]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0018.md
[LIP18-addressComputation]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0018.md#address-computation
[LIP18-ReclaimTransaction]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0018.md#reclaim-transaction
[LIP18-AccountsWithoutPKey]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0018.md#accounts-without-public-key
