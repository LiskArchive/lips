```
LIP: <LIP number>
Title:  Define state transitions of Reward module
Authors: Iker Alustiza <iker@lightcurve.io>
         Mehmet Egemen Albayrak <mehmet.albayrak@lightcurve.io>
Discussions-To: https://research.lisk.com/t/define-state-transitions-of-reward-module
Type: Standards Track
Created: <YYYY-MM-DD>
Updated: <YYYY-MM-DD>
Requires: Random Module LIP, BFT module LIP, and Token Module LIP.
```

## Abstract

The Reward module provides the base reward system for a blockchain developed with the Lisk SDK. 
In this LIP, we specify the protocol logic that this module injects during the block lifecycle as well as the functions that can be called from off-chain services.

## Copyright

This LIP is licensed under the [Creative Commons Zero 1.0 Universal][creative].

## Motivation

The goal of this LIP is to modularize the rewards assignment logic when a new block is generated.
For this purpose, we specify the Reward module, which will make it easier to customize this logic and replace it if necessary. 

## Rationale

The Reward module induces specific logic after the application of a block:

* After applying the block, a certain quantity of the native token of the blockchain is minted and assigned to the block generator. The exact amount assigned to the block generator, i.e., the reward, is calculated depending on the rules of the [random module][randomLIP] and the [BFT module][BFTLIP].

## Specification

In this section, we specify the protocol logic in the lifecycle of a block injected by the Reward module as well as the functions that can be called from off-chain services.
It depends on the token, BFT, and random modules.

### Constants

| **Name**                 | **Type** | **Value** |
|--------------------------|----------|-----------|
| `MODULE_ID_REWARD `      | uint32   | TBD |
| `TOKEN_ID_REWARD`         | object   | specified as part of module configuration |
| `TOKEN_ID_LSK_MAINCHAIN`        | object     | `{"chainID": 0, "localID": 0}` |
| `REWARD_REDUCTION_FACTOR_BFT`    | uint32   | 4 |

### Token for rewards

The Reward module triggers the minting of rewards in the fungible token identified by the value of `TOKEN_ID_REWARD`, which denotes a token ID. 
The value of `TOKEN_ID_REWARD` is set according to the initial configuration of the Reward module. 

### Reward Brackets

As part of the Reward module configuration, the module has to define certain reward brackets, i.e., the values of the default block reward depending on the height of the block. 
For this LIP, we assume the reward brackets are given by the function `getDefaultRewardAtHeight(height)`, which returns a 64-bit unsigned integer value, the default block reward, given the block height `height` as input.

### Lisk Mainchain Configuration

#### Mainchain Rewards Token

The token for rewards on the Lisk mainchain is the LSK token, with token ID equals to `TOKEN_ID_LSK_MAINCHAIN`. 

#### Mainchain Reward Brackets

The reward brackets for the Lisk Mainchain are as follows: 

| **Heights**                 | **Default Reward** |
|--------------------------|----------|
| From 1,451,520 to 4,451,519 | 5 × 10<sup>8</sup>
| From 4,451,520 to 7,451,519 | 4 × 10<sup>8</sup>
| From 7,451,520 to 10,451,519 | 3 × 10<sup>8</sup>
| From 10,451,520 to 13,451,519 | 2 × 10<sup>8</sup>
| From 13,451,520 onwards | 1 × 10<sup>8</sup>

This corresponds to default rewards of 5 LSK, 4 LSK, 3 LSK, 2 LSK, and 1 LSK respectively.

### State Store

This module does not define any state store.

### Commands

This module does not define any command.

### Internal Functions

The Reward module has the following internal function.

#### getBlockReward

This function is used to retrieve the reward of a block at a given height.

##### Parameters

`blockHeader`: A block header.

##### Returns

The reward for the block as a 64-bit unsigned integer.

##### Execution

```python
getBlockReward(blockHeader):
    if isValidSeedReveal(blockHeader.generatorAddress, blockHeader.seedReveal) == false:
        return 0

    defaultReward = getDefaultRewardAtHeight(blockHeader.height)
    if impliesMaximalPrevotes(blockHeader) == false: 
        return defaultReward / REWARD_REDUCTION_FACTOR_BFT

    return defaultReward
```
Here, `/` represents integer division, `isValidSeedReveal` is the function exposed by the [random module][randomLIP] and `impliesMaximalPrevotes` is the function exposed by the [BFT module][BFTAPI].

### Protocol Logic for Other Modules

This module does not define any specific logic for other modules.

### Endpoints for Off-Chain Services

The Reward module exposes the following functions for off-chain services.

#### getDefaultRewardAtHeight

This function is used to retrieve the expected default reward at a given height.

##### Parameters

The height of a block as a 32-bit unsigned integer.

##### Returns

The default reward of the block as a 64-bit unsigned integer.

### Block Processing

#### After Block Execution

After a block `b` is executed, the `mint` function exposed by the [token module][tokenLIP] to assign the reward to the block generator as:

```python
blockReward = getBlockReward(b.header)
mint(b.header.generatorAddress, TOKEN_ID_REWARD, blockReward)
```

where `TOKEN_ID_REWARD` is the token ID of the token used for the reward system of the blockchain. 
In the case of the Lisk mainchain, `TOKEN_ID_REWARD = TOKEN_ID_LSK_MAINCHAIN`.

## Backwards Compatibility

This LIP defines the interface for the Reward module but does not introduce any change to the protocol, hence it is a backward compatible change.

## Reference Implementation

TBA

[creative]: https://creativecommons.org/publicdomain/zero/1.0/
[randomLIP]: https://research.lisk.com/t/define-state-and-state-transitions-of-random-module/311
[BFTLIP]: https://research.lisk.com
[BFTAPI]: https://research.lisk.com
[tokenLIP]: https://research.lisk.com/t/introduce-an-interoperable-token-module/295#mint-64
