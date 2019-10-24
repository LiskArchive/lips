```
LIP: lip-maxime-punish_BFT_violations
Title: Punish BFT violations
Author: Maxime Gagnebin <maxime.gagnebin@lightcurve.io> 
Discussions-To: https://research.lisk.io/t/punish-bft-violations/192
Type: Standards Track
Created: -
Updated: -
Requires: 0014, "Introduce vote locking periods and new vote weight definition"
```

## Abstract

This LIP introduces consequences for breaching the BFT protocol. Adding finality and BFT guarantees to Lisk has been discussed in [LIP 0014](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0014.md). That LIP introduces the rules for detecting protocol violations, however, it does not define how to record and punish these violations. This LIP introduces a new transaction type called “Proof of Misbehavior”. This transaction allows users to reveal to the network any BFT protocol violation. 

This proposal also specifies the consequences of such a breach of protocol. This is done by modifying the delegate weight calculation and the validity of unlock transactions.


## Copyright

This LIP is licensed under the [Creative Commons Zero 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).


## Motivation

One of the most discussed security issues of PoS based consensus mechanism is the “nothing at stake” problem. This problem arises when block producers can produce blocks on several branches of a chain without much cost. On a protocol level, the Lisk rules for solving this problem are given in [LIP 0014](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0014.md) (which we will call BFT LIP here). However, the BFT LIP does not define an economic incentive for delegates to follow the BFT rules.

In the current Lisk implementation, delegates only have popularity incentives to respect the protocol. A delegate with devoted voters, or very high funds, can disregard the BFT rules without consequences. This proposal solves this by introducing a transaction to demonstrate the misbehaving of a delegate as well as rules about the consequences of said misbehavior.  In the following, the delegate having breached the BFT protocol will be called “misbehaving delegate”.


### Voter accountability

Voting is an important component of a healthy Lisk network. Voters should choose their delegates wisely and try to promote delegates who will maintain an effective setup and keep a secure network. The current proposal introduces a consequence for voters whose delegate misbehaves. This consequence is milder than the one inflicted upon the misbehaving delegate.


## Specification


This proposal adds a new property `pomHeights` to delegate accounts. This property is an array of heights and is initialized empty when the delegate is registered. This array has length at most 5.

**Definition:** We say that the delegate `D` is punished at height `h` if there exists an entry `h0` in `D.pomHeights` such that `0 < h – h0 < 780,000`. 


### Proof of Misbehavior – PoM

We introduce a new transaction type: proof of misbehavior (abbreviated PoM in this document). 

This transaction contains the information necessary to prove that a delegate has breached the BFT protocol. Beside the mandatory properties of a transaction (`type`, `senderPublicKey`, etc.), the PoM needs the following properties:

*   ``asset.header1``: the header of a block.
*   ``asset.header2``: the header of a second block. 


#### Validity of a PoM Transaction

To include a PoM transaction in a block at height `h`, we verify the validity of the asset property by checking the conditions below:

*   `|header1.height - h| < 260,000`.
*   `|header2.height - h| < 260,000`.
*   The account signing `header1` is a registered delegate `D` such that:
    *   `D` is not punished at height `h.` 
    *   `D.isBanned = false`. 
*   `header1` and `header2` contain all block header properties and they are validly signed. Notice that we do not check whether the delegate had the right to forge at this height, if the reward is correct for the given height nor do we include the transactions of the payload.
*   `header1` and `header2` are contradicting as defined by the BFT rules. The function ``checkHeadersContradicting`` from the [BFT LIP](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0014.md#detecting-contradicting-block-headers) performs this check. This function checks:
    *   The two headers are by the same delegate.
    *   The two headerIDs are different.
    *   The delegate transgressed either the fork-choice rule or the disjointness condition.

A block cannot contain two PoMs with the same forging delegate in `header1`. In practice, this means that a delegate cannot be punished twice in one block (this specification will be removed when we establish block validity by ordering transactions).


#### Applying a PoM Transaction

When a PoM is accepted in a block at height `h`, this height `h` is appended to the end of the `pomHeights` property of the misbehaving delegate. 

If `pomHeights` has length 5 we also set the `isBanned` property of the misbehaving delegate to `true`.


#### Undoing a PoM Transaction

When undoing a block containing a PoM transaction, the height of the block is removed from the end of the delegate’s `pomHeights` property.

If `pomHeights` then has length 4, the `isBanned` property of the misbehaving delegate is set to `false`.


#### Reward of PoM

A reward is added to the account sending the PoM. This amount is subtracted from the account balance of the misbehaving delegate. We set the reward to be equal to the regular block reward at the height of inclusion (3 LSK when writing this LIP). In the unlikely event that the misbehaving account has balance less than the regular block reward, then the reward is reduced to equal that balance. To be precise: 

```
let A be the account of the misbehaving delegate

reward = min { A.balance , regular block reward }

reward is added to the balance of the sender of the PoM
reward is subtracted from A.balance
```


#### PoM Transaction Serialization

The asset property of a PoM transaction has to be serialized as in the function `getPoMAssetBytes` below:

```
getPoMAssetBytes(asset):
   let buffer be an empty byte buffer
   append the serialization of asset.header1 to buffer
   append the serialization of asset.header2 to buffer
   return buffer
```


### Update to Delegate Selection

This proposal modifies the use of the delegate weight for the selection of forging delegates`.` Suppose that round `r` starts at height `h`. If the delegate `D` is punished at height `h` then `D.weight` is replaced by 0 for the purpose of selecting the forging delegates for round `r`. 

The BFT LIP specifies that the delegate weights used for selecting the forging delegates have to be delayed by two rounds. The above paragraph implies that the following is done at the beginning of round `r`: 

*   Let `W(D)` be the weight of delegate `D` from the beginning of round `r-2`.
*   If `D` is punished at the beginning of round `r`, set `W(D)=0`.
*   Use `W` for the purpose of selecting the forging delegates of round `r`.

Recall that a delegate `D` is punished at height `h` if there exists an entry `h0` in `D.pomHeights` such that `0 < h – h0 < 780,000`.


### Update to Validity of Unlock Transaction

This proposal modifies the validity of unlock transactions. Additionally to the conditions defined in the LIP “Introduce vote locking periods and new vote weight definition”, an unlock transaction containing the unlock object `U` is valid if the logic from the following function returns false:

```
function isPunished( U )

   let D be the delegate with address U.delegateAddress
   if D.pomHeights is empty 
      return false
   else 
      let lastPomHeight be the last element of D.pomHeights //it is also its largest element
      let h be the block height at which the unlocking transaction is included
      let account be the account sending the unlocking transaction
      
      if D.address == account.address //this is a self-unvote
         if h – lastPomHeight < 780,000 and lastPomHeight < U.unvoteHeight + 260,000
            return true
      else
         if h – lastPomHeight < 260,000 and lastPomHeight < `U.unvoteHeight` + 2000
            return true

   return false
```


### Update to the Block Header Signing Procedure

The signing procedure for block headers will now follow the same schema as the one proposed in [LIP 0009](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0009.md) for signing transactions. The LIP 0009 introduces a network identifier and its use for generating transaction signatures.

The same network identifier has to be included at the beginning of the byte array used as the input of the block header signing process.


## Rationale

Delegates should not breach the BFT protocol. They are encouraged to keep an effective setup by receiving a block reward when a block is forged. If they produce an invalid block, the block is refused by the network and no block reward is received for this block. Invalid blocks are easy to detect – for example blocks containing invalid transactions or blocks by an invalid forger. On the other hand, contradicting blocks (not following the BFT protocol) are difficult to detect. Those rules are hard to enforce because they need information that is not present on the blockchain – such as: did this delegate forge on another branch. 

In order to enforce the latter, we introduce a proof of misbehavior. The PoM is a suitable way to display the necessary information to prove the violation to other nodes running the blockchain.

If a PoM is accepted in block `B` at height `h=B.height`, then the tokens used for voting for this delegate are locked for a given time period. This extended locking period also applies to tokens recently unvoted and still in the mandatory locking period (see the “voting LIP”).

Self-voted tokens (or self-unvoted tokens in the unlocking state) from the misbehaving account cannot be redeemed before height `h+780,000`. Tokens from other accounts voted (or unlocking) for the misbehaving account cannot be redeemed before height `h+260,000`.

We believe that those extended locking periods will be long enough to deter any delegate to misbehave. They will also give voters a strong economic incentive to choose their delegates carefully.

We believe that the first few misbehaviors could happen accidentally and do not necessitate a permanent ban. However, if delegates keeps violating the BFT rules, we ban them definitely. This happens at the fifth misbehavior. 


### Misbehavior Punished by the Present Proposal

The rules to validate a PoM are given in the [BFT LIP](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0014.md#detecting-contradicting-block-headers). The function ``checkHeadersContradicting`` returns true in two scenarios:



1. The delegate did not respect the disjointness condition. This condition states that the `heightPrevious` property of a block must refer to the last height at which the delegate has proposed a block. This condition is triggered when a delegate lies about having proposed a block on another branch.
2. The delegate did not respect the fork choice rule. This rule states on which branch a delegate is supposed to forge. This condition is triggered when a delegate decides to forge on the wrong branch or to double forge.

The rules checked in the ``checkHeadersContradicting`` function rely on information present in the block headers. The PoM contains two different block headers in its asset field.

This way, the block headers’ signature can be verified to ensure that this block was proposed by the misbehaving delegate.

Notice that delegates can forge blocks on multiple networks without those blocks being used in a PoM as the signature for the block header is network dependent, as specified in section “[Update to the Block Header Signing Procedure](#update-to-the-block-header-signing-procedure)”.


### Reward

The sender of the PoM will have to pay the transaction fee for the PoM. To encourage nodes to reveal a misbehavior they have found, we introduce a reward for submitting a valid PoM. The reward is equal to the expected block reward at the inclusion height of the PoM. The reward is subtracted from the account of the misbehaving delegate and added to the account sending the valid PoM. The reward is set to this amount because the contradicting block is violating the protocol, so the forger should not have received a reward for forging it.

The PoM will be about 500 bytes in size. According to [LIP 0013](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0013.md), the minimum fee for this transaction will be ~0.005 LSK. This means that the block reward (at least 1 LSK) is sufficient to compensate the transaction fee and incentivize nodes to submit the PoM.

By issuing a PoM, delegates also increase their chances of being selected to forge. Indeed, if the misbehaving delegate would have been selected to forge in the next round, then removing it allows another delegate to forge in its slot. 


#### Low Balance Misbehaving Delegate

The PoM reward has to be removed from the balance of the misbehaving delegate and added to the account sending the PoM. It could happen that the misbehaving delegate has very low balance. In this case, we set the reward to equal the account balance. We believe that this is not a major issue as the aim of this LIP is to deter delegates from BFT violations, not to introduce a new way to receive rewards.


### Issuing a PoM

Given the proposed approach, it may be that only the delegate forging the current block will issue the PoM. Indeed, delegates are likely to include their own PoM in their block and not the ones submitted by other accounts. Circumventing this issue would require a much more elaborate setup. To keep the procedure simple and efficient we accept this limitation. As stated in the last paragraph, the aim of this LIP is to deter delegates from BFT violations, not to introduce a new reward channel.


### Invalid Signing

Delegates have to be aware of all the block headers they sign to avoid being punished. Indeed, a delegate signing an invalid block (for some reason) is still considered to have signed a block header. So even if the block is rejected by the blockchain protocol, it has to be accounted for when forging next.


### Considerations Rejected by this Proposal


#### Hard Slashing

Forgers and voters who misbehave lose part of their stake, this is used for example in Cosmos (see for example their [FAQ](https://cosmos.network/docs/cosmos-hub/validators/validator-faq.html#what-are-the-slashing-conditions)). 

We believe that our proposal is adequate to deter attackers from trying attacks on the Lisk network and that it is unnecessary to further add sanctions to potential mistakes by node managers.


## Backwards Compatibility

This proposal introduces a new transaction type. Adding new functionalities result in a hard-fork of the network.


### Migration

If the implementation of this proposal is done at height `h` then we additionally check that every PoM has `asset.header1.height` and `asset.header2.height` greater than `h`, i.e. you cannot be punished for misbehaviors done before the implementation of this proposal. Notice that this last check on the headers’ height becomes optional after height `h+260,000`. 


## Reference Implementation

TBD
