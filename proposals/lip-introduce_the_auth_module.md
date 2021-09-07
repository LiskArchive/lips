```
LIP: <LIP number>
Title: Introduce Auth module
Author: Alessandro Ricottone <alessandro.ricottone@lightcurve.io>
        Ishan Tiwari <ishan.tiwari@lightcurve.io>
Discussions-To: https://research.lisk.com/t/introduce-auth-module
Status: Draft
Type: Standards Track
Created: 2021-07-27
Updated: 2021-09-07
Requires: 0040
```

## Abstract

The Auth module is responsible for handling and verifying nonces and for transaction signature validation, including transactions from multisignature accounts. In this LIP, we specify the properties of the Auth module, along with their serialization and default values. Furthermore, we specify the state transitions logic defined within this module, i.e. the commands, the protocol logic injected during the block lifecycle, and the functions that can be called from other modules or off-chain services.

## Copyright

This LIP is licensed under the [Creative Commons Zero 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).

## Motivation

In the Lisk protocol, some verification steps are common to all transactions. In particular, to validate a transaction it is necessary to validate the [signatures](https://lisk.com/documentation/lisk-sdk/protocol/accounts.html#keys) and the [nonce](https://lisk.com/documentation/lisk-sdk/protocol/accounts.html#nonce). These validation steps are handled by the authentication (auth) module.

In this LIP we specify the properties, serialization, and default values of the Auth module, as well as the protocol logic processed during a block lifecycle, the commands, and the functions exposed to other modules and to off-chain services.

## Rationale

Validating a transaction requires reading the state to get the nonce and possibly the multisignature keys from the user account. Since both these checks are necessarily done together, it makes sense to store these values together, to reduce the number of database accesses.

## Specification

In this section, we specify the substores that are part of the Auth module store, the commands, and the protocol logic called during the block lifecycle. The Auth module has module ID `MODULE_ID_AUTH` (see the [table below](#constants)).

### Constants

We define the following constants:

| Name               | Type    | Value       | Description                             |
| ------------------ |---------| ------------| ----------------------------------------|
|`MODULE_ID_AUTH`    | uint32  | TBD         | ID of the Auth module.                  |
|`STORE_PREFIX_AUTH` | bytes   | 0x0000      | Store prefix of the auth data substore. |

### Auth Module Store

The key-value pairs in the module store are organized in the following substore.

#### Auth Data Substore

##### Store Prefix, Store Key, and Store Value

* The store prefix is set to `STORE_PREFIX_AUTH`.
* Store keys are set to 20 bytes addresses, representing a user address.
* Store values are set to _auth account_ data structures, holding the properties indicated [below](#properties-and-default-values), serialized using the JSON schema `authAccountSchema`, presented [below](#json-schema).
* Notation: For the rest of this proposal let `authAccount(address)` be an entry in the auth data substore identified by the store key `address`.

##### JSON Schema

```java
authAccountSchema = {
  type: "object",
  properties: {
    nonce: {
      dataType: "uint64",
      fieldNumber: 1
    },
    numberOfSignatures: {
      dataType: "uint32",
      fieldNumber: 2
    },
    mandatoryKeys: {
      type: "array",
      items: {
        dataType: "bytes"
      },
      fieldNumber: 3
    },
    optionalKeys: {
      type: "array",
      items: {
        dataType: "bytes"
      },
      fieldNumber: 4
    }
  },
  required = ["nonce",
              "numberOfSignatures",
              "mandatoryKeys",
              "optionalKeys"]
}
```

##### Properties and Default values

In this section, we describe the properties of an auth account and specify their default values.

* <code>[nonce](https://lisk.com/documentation/lisk-sdk/protocol/accounts.html#nonce)</code>: The nonce represents the total number of transactions sent from the account. Each time a new transaction is sent, the nonce is incremented by one. The default value of this property is 0.
* <code>[numberOfSignatures](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0017.md)</code>: The number of private keys that must sign a transaction. This value is greater than 0 if and only if a register multisignature group transaction for this account was included. The default value of this property is 0.
* <code>[mandatoryKeys](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0017.md)</code>: An array of public keys in lexicographical order. The corresponding private keys have to necessarily sign the transaction. A valid public key is 32 bytes long. The default value of this property is an empty array.
* <code>[optionalKeys](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0017.md)</code>: An array of public keys in lexicographical order. The corresponding private keys can optionally sign the transaction. The number of corresponding private keys that have to sign the transaction equals <code>numberOfSignatures</code> minus the length of <code>mandatoryKeys</code>. A valid public key is 32 bytes long. The default value of this property is an empty array.

### Commands

#### registerMultisignatureGroup

This command is specified in [LIP 0017](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0017.md#multisignature-account-registration). It allows users to register a multisignature group for the sender account.

##### Parameters

The properties and schema for this command are defined in [LIP 0028](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0028.md#multisignature-registration).

##### Verification

The verification of this command is defined in [LIP 0017](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0017.md#multisignature-account-registration).

##### Execution

This command updates the entries in the sender `authAccount` to the values specified in the command parameters.

### Protocol Logic for Other Modules

#### getAuthAccount

This function is used to retrieve information about an auth account.

##### Parameters

* `address`: A 20 bytes value identifying the auth account.

##### Returns

This function returns `authAccount(address)`. If there is no entry corresponding to `address`, it returns an empty object.

### Endpoints for Off-Chain Services

#### getAuthAccount

This function is used to retrieve information about an auth account.

##### Parameters

* `address`: A 20 bytes value identifying the auth account.

##### Returns

This function returns `authAccount(address)`. If there is no auth account corresponding to `address`, it returns an empty object.

#### verifySignatures

This function verifies the signatures of a given transaction `trs`, including transactions from  multisignature accounts.

##### Parameters

* `trs`: A transaction object.

##### Returns

This function returns `true` if the transaction object contains a valid signature, `false` otherwise, as specified in [LIP 0017](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0017.md#transaction-creation-and-verification).

#### verifyNonce

This function verifies the nonce of a given transaction `trs` and returns a boolean value.

##### Parameters

* `trs`: A transaction object.

##### Returns

This function returns `true` if the transaction object contains a valid nonce, `false` otherwise. This is done using the `isValidNonce` function defined [below](#transaction-verification).

### Block Processing

#### Transaction Verification

As part of the verification of a transaction `trs`, the following checks are applied. If the checks fail the transaction is invalid and the whole block is discarded.

* Check that the transaction nonce is equal to the account nonce by returning `isValidNonce(trs)`.

```python
isValidNonce(trs):
  let senderAddress be the address corresponding to trs.senderPublicKey
  if there is no entry in the in the auth data substore with storeKey == senderAddress:
    return trs.nonce == 0
  return trs.nonce == authAccount(senderAddress).nonce
```

Notice that a transaction in the transaction pool with a nonce greater than the account nonce is considered "pending" rather than invalid, since it could become valid in the future.

* Check the signatures property of the transaction [as explained in LIP 0017](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0017.md#signatures-replaces-signature) using `authAccount(address)`, where `address` is the address corresponding to `trs.senderPublicKey`.

#### Before Transaction Execution

Before a transaction `trs` is executed, the following logic is applied.

* Create an auth account if no account exists for the sender address:

```python
let senderAddress be the address corresponding to trs.senderPublicKey
if there is no entry in the in the auth data substore with storeKey == senderAddress:
  create an entry in the auth data substore with storeKey = senderAddress, initialized to default values
```

#### After Transaction Execution

After a transaction `trs` is executed, the following logic is applied.

* Increment account nonce:

```python
let senderAddress be the address corresponding to trs.senderPublicKey
authAccount(senderAddress).nonce += 1
```

## Backwards Compatibility

This LIP defines a new storage interface for the Auth module, which in turn will become part of the state tree and will be authenticated by the state root. An existing chain including the Auth module will need to perform a hardfork.
