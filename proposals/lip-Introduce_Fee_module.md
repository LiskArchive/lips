```
LIP: <LIP number>
Title: Introduce Fee module
Author: Maxime Gagnebin <maxime.gagnebin@lightcurve.io>
        Mitsuaki Uchimoto <mitsuaki.uchimoto@lightcurve.io>
Discussions-To: https://research.lisk.com/t/introduce-fee-module/318
Type: Standards Track
Created: <YYYY-MM-DD>
Updated: <YYYY-MM-DD>
Required: Introduce Token module
```


## Abstract

The Fee module is responsible for handling the fee of transactions. 
It allows chains to choose the token used to pay the fee and to define a minimum fee for transactions to be valid.


## Copyright

This LIP is licensed under the [Creative Commons Zero 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).


## Motivation

This LIP defines the fee system in a modular way, as currently [used in the Lisk ecosystem][state-model-LIP]. 
The fee handling is implemented in a separate module to allow sidechains to freely update or replace the fee handling module, 
possibly to implement a more complex fee structure, without needing to modify or update the Token module.


## Rationale


### Fee Token ID

Each chain can configure the token used to pay fees. 
On the Lisk mainchain, the token used for transaction fees is the LSK token.


### Minimum Fee per Transaction

As introduced in [LIP 0013][LIP-0013], all transactions must have a fee greater or equal to a minimum fee (which can be zero). 
The minimum fee is computed from a part based on the transaction size and a part specific to the command (called _extra fee_). 
Chains can configure their minimum fee per byte and the eventual extra fees.

For example, on the Lisk mainchain, the following extra fees are defined:

* `extraFee(MODULE_ID_DPOS, COMMAND_ID_DELEGATE_REGISTRATION) = 1000000000`,
* `extraFee(MODULE_ID_INTEROPERABILITY, COMMAND_ID_SIDECHAIN_REG) = 1000000000`.

The constants `MODULE_ID_DPOS` and `COMMAND_ID_DELEGATE_REGISTRATION` are defined in [LIP "Define state and state transitions of DPoS module"][DPoS-LIP]. 
The constants `MODULE_ID_INTEROPERABILITY` and `COMMAND_ID_SIDECHAIN_REG` are defined in [LIP "Introduce Interoperability module"][base-interoperability-LIP].


### Burning the Minimum Fee

The minimum part of the fee should be burned, this is to avoid that validators can send transactions in the blocks they generate without cost.
This is only possible if the chosen fee token is a native token (with chain ID equal 0).
If the chosen fee token is not a native token (for example the LSK token on sidechains), the minimum fee per byte and the extra fees should be set to zero.
This is the only choice that makes sense, as burning non-native tokens is not supported by the [Token module][token-LIP].


## Specification


### Notation and Constants

We define the following constants:

| Name          | Type    | Value       | Description       | 
| ------------- |---------| ------------|---------|
| **General Constants** ||||
| `MODULE_ID_FEE` | uint32 | 1 | Module ID of the Fee module. |
| **Configurable Constants** ||||
| `MIN_FEE_PER_BYTE`| uint64 | 1000 | Minimum amount of fee per byte required for transaction validity.|
| `TOKEN_ID_FEE`    | object | `TOKEN_ID_LSK` = {<br /> `"chainID": 0`, <br /> `"localID": 0`<br />} | Token ID of the token used to pay the transaction fees. |


### Extra Fee

The Fee module allows to specify extra fees for each command.
This is specified in the module configuration and is written as `extraFee(moduleID, commandID)` in this LIP. 
All `(moduleID, commandID)` pairs that do not have a specified extra fee are assumed to have `extraFee(moduleID, commandID) = 0`.


### Fee Module Store

The Fee module does not store information in the state.


### Commands

The Fee module does not contain any commands.


### Protocol Logic for Other Modules

The Fee module does not expose any functions.


### Block Processing


#### Verify Transaction

During `trs` verification, the following logic is applied:

```python
minFee = MIN_FEE_PER_BYTE * size(trs) 
         + extraFee(trs.moduleID, trs.commandID)
if trs.fee < minFee:
     trs is invalid
```


#### Before Transaction Execution

Before a transaction `trs` is executed, the following logic is applied:

```python
minFee = MIN_FEE_PER_BYTE * size(trs) 
         + extraFee(trs.moduleID, trs.commandID)
senderAddress is derived from trs.senderPublicKey
generatorAddress is the address of the generator of the block including trs

if TOKEN_ID_FEE.chainID == 0: # fee token is a native token 
    token.burn(senderAddress,
               TOKEN_ID_FEE,
               minFee)
    token.transfer(senderAddress, 
                   generatorAddress, 
                   TOKEN_ID_FEE, 
                   trs.fee - minFee) 
else:
    token.transfer(senderAddress,
                   generatorAddress,
                   TOKEN_ID_FEE,
                   trs.fee)

if any of those function fails, the transaction is invalid
```

The functions `token.burn` and `token.transfer` are defined in the [Token module][token-LIP]. Burning the fee was specified in [LIP 0013](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0013.md).


### Endpoints for Off-Chain Services

To be completed by the dev team.


## Backwards Compatibility

This LIP defines a new Fee module, which follows the same protocol as currently implemented. Changing the implementation to include the Fee module will be backwards compatible.


## Reference Implementation

TBA


[LIP-0013]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0013.md
[token-LIP]: https://research.lisk.com/t/introduce-an-interoperable-token-module/295
[DPoS-LIP]: https://research.lisk.com
[base-interoperability-LIP]:https://research.lisk.com/t/properties-serialization-and-initial-values-of-the-interoperability-module/290
[state-model-LIP]: https://github.com/LiskHQ/lips/blob/master/proposals/lip-0040.md
