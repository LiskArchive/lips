```
LIP: lip-maxime-vote_by_locking
Title: Introduce vote locking periods and new vote weight definition
Author: Maxime Gagnebin <maxime.gagnebin@lightcurve.io> 
Discussions-To: https://research.lisk.io/t/introduce-vote-locking-periods-and-new-vote-weight-definition/191
Type: Standards Track
Created: -
Updated: -
```

## Abstract

This LIP proposes a change of the voting system used to choose block forgers in Lisk. 
We suggest to move closer to a proof of stake system by having voters lock their tokens when casting a vote. 
Consequently, accounts can still vote for multiple delegates, but a given LSK can only be used in a single vote. 
The goal is to increase the decentralization of the network by creating a healthy competition for active delegate slots.

We also modify the computation of the delegate weights to account for the amount of self-votes cast by the delegates. 
The proposed system will encourage delegates to maintain a secure and efficient setup as well as have an open communication about their node setup.

This LIP addresses the same issues as the withdrawn [LIP 0021 "Change to one vote per account"](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0021.md). 
That LIP and the corresponding forum thread contain valuable information used to create this proposal. 
We encourage community members to read that LIP in order to understand the similarities and differences between these proposals. 



## Copyright

This LIP is licensed under the [Creative Commons Zero 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).


## Motivation

In the current voting system, every account holder can vote for up to 101 delegates. The vote weight of each vote is the balance of the voting account. The current voting system suffers from several shortcomings. 



*   **Incentive to form coalitions:** As the vote weight is independent of the number of votes, there is a high incentive for delegates to form a coalition or pool by voting for each other. The Lisk blockchain aims to be a trustless system, relying on decentralisation for its security. As such, the voting system should give no economic incentive to form groups.
*   **High entry barrier:** There is currently a very high barrier for anybody to become an active delegate. For example, a delegate with support of roughly 5% of the total amount of LSK might not able to become an active delegate. This contradicts a core principle of PoS asserting that the probability of an account getting (or, as in the case of DPoS, delegating) a forging slot is according to the amount of coins it holds.
*   **Low dictatorial bar:** Currently, it is possible to change all 101 active delegates by owning 41 % of the total supply of Lisk tokens. This would allow to stop the chain, censor transactions or execute double spending attacks, for instance. 
*   **No incentive to choose stable delegates:** Currently, it is very difficult to make voters responsible for their votes. Voting does not come with a commitment to the delegate and choosing a bad delegate is without consequences.

This LIP proposes to modify the voting design: voters choose the weight of each vote separately by locking their LSK to the delegate. By definition, each LSK can only be locked to one delegate. This proposal solves the above shortcomings:

*   **Incentive to form coalitions:** Delegates have no more incentive to form coalitions. Indeed, trading votes should essentially disappear as it gives no mathematical advantage.
*   **High entry barrier:** The threshold to become an active delegate is significantly lower as approximately 1 % of the total amount of voting Lisk tokens is sufficient to become an active delegate. 
*   **Low dictatorial bar:** Even huge stakeholders will only be represented among the active delegates according to their proportion of the voting supply of Lisk tokens. Therefore it is virtually impossible for an individual or an organisation to control all the delegates.
*   **No incentive to choose stable delegates:** The proposed system allows the protocol to include some form of responsibility. By locking its LSK to the delegate, the account makes a statement that it believes this delegate to be reliable and properly maintained.


## Rationale

It is important to acknowledge that one perfect voting system for Delegated Proof of Stake does not exist. Nevertheless, we believe that the proposed change of the voting system is a significant improvement over the current state and an important step in evolving the Lisk Delegated Proof of Stake system.


### Technical Glossary



*   Delegate weight: the weight of the delegate in the process of choosing the block forgers. The way this weight is calculated is described in the 
[specification section](#specification). This proposal does not modify the way we use the delegate weights to select forging delegates.
*   Voting: the way LSK holders use to show support for a delegate. Users can vote for delegates and those votes impact the delegate weight.
*   Unvoting: the action of removing one’s votes.
*   Self-voting: delegates can vote for themselves, this action is called self-voting.
*   Locked tokens: tokens that cannot be used. Such tokens have to be unlocked (and potentially wait a given number of blocks) before being available again. They do not leave the account of the holder, but their use is invalid.
*   Unlocking: process of getting locked LSK tokens available again.
*   Balance: amount of available LSK in an account. Notice that the total owned by an account is therefore “balance + locked tokens”.


### Desired Properties

At first, we want to list the main desired properties of a voting system for Lisk. The following properties are not listed in order of importance.



*   **Decentralization:** In order to have a truly decentralized network, the delegates should act as independent entities and the voting system should give no incentive for delegates to form coalitions. Instead, it should foster competition for the active delegate ranks. The future implementation of the [BFT consensus protocol](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0014.md) will provide block finality to the Lisk protocol. However, it assumes that there are at least 68 delegates honestly following the protocol. That is a further reason to encourage influence groups or coalitions to remain small and independent.
*   **Flexibility:** The voting system should allow users to vote for different delegates and to tune their votes to suitably reflect their voting preferences. In turn, this encourages the participation of stakeholders in the voting system.
*   **Security:** The voting system should incentivize voters to elect delegates who maintain a secure and effective network.
*   **Efficiency:** The voting system should allow to efficiently compute the rank of the delegates. Moreover, vote transactions should be kept small.

Another property that may be intuitively named is “fairness”. This property is very subjective and is hard to precisely define, but we try to address it in the next subsection. 


### One Voting Lisk – 
Power

We believe that a first step to a more “fair” system is the “1 LSK = 1 vote power” principle. This principle gives accounts with similar amounts of tokens a similar impact on the selection mechanism, regardless of the fact that those accounts take part of a voting group or not. The proposed system includes this mechanism as one LSK can only be locked to one delegate. This contrasts with the current voting system where accounts can vote for many delegates with their total balance as vote weight. 

Some propositions try to limit the power of very large stakeholders. In a trustless, decentralized system it is, however, impossible to map accounts to people. In particular, it is impossible to distinguish if many small accounts are controlled by many people or by one big stakeholder. Therefore, any voting system that gives many small accounts more cumulative voting power than one large account can be easily circumvented by a large stakeholder by creating multiple accounts.


### Voting by Locking Tokens

This proposal introduces a mechanism locking tokens used for voting. The voting procedure hence becomes more consequential. The current system gives very little incentive to vote for delegates showing an interest in the network and advertising a secure and reliable setup. With this proposal, voting will require an account to give up the use of its token until the vote in undone. For this reason, voters will be watchful of their delegates’ doing. It will become important for delegates to show an active participation in the network to attract voters. Further, voters now have an incentive to unvote bad delegates.

The proposed mechanism works as follows: 



*   Any amounts of LSK used for voting cannot be used for any other transactions. This includes but is not limited to balance transfers, further voting or fees. 
*   To use those LSK, the account has to submit a vote transaction with a negative amount (also called “unvote”). This will start the unlocking procedure and the LSK will be ready for unlock 2000 blocks later (roughly 5 hours and 30 minutes).


#### Explicit Unlock Mechanism

To recover the locked tokens, the account has to submit two transactions. 



*   First, the tokens have to be unvoted. This is done with the new vote transaction, the transaction just needs to contain a negative amount. 
    *   The tokens are now in an “unlocking” state. They have been unvoted but are not usable yet.
*   After a 2000 block period, the tokens can be unlocked. This is done with a new unlock transaction. This transaction specifies which tokens have to be unlocked and added back to the balance. 

This mechanism is necessary to allow blocks to be reverted. Future improvements of the Lisk blockchain (particularly on the database level) could render this unlock transaction unnecessary.


#### Making the Unlock Easier

An unlock transaction can contain multiple unlock objects. This allows an account to submit multiple vote transactions and recover those tokens with a single unlock transaction. Of course, all tokens must have been in the unlocking state for at least 2000 blocks for the unlock to be valid. 


### New Vote Transaction

This new voting system needs a new vote transaction. The way voting is done is drastically changed as one now needs to specify how much Lisk is voted or unvoted with each vote. 

To cast a vote or unvote, we propose to use the Lisk address of the delegate, as opposed to the public key in the current implementation. This will make the transaction smaller and hence cheaper assuming [LIP 0013](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0013.md) is implemented.

The amount of each vote has to be specified. This amount can be positive (for a vote) or negative (for an unvote).  We also impose that voting is done in multiples of 10 LSK. This will prevent the number of transactions from becoming too high, and hence avoid over encumbering the network. This does not affect the user experience much and has a big positive impact on the network.

 

These changes will make the voting process more **flexible**. [LIP 0013](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0013.md) will also make voting much cheaper on average. We believe that the increased flexibility and the decreased fee will improve the participation of Lisk users in the voting procedure.


#### New Delegate Weight

Alongside with the new vote transaction, we propose a novel way to compute the delegate weight. Primarily, the weight of a delegate is the sum of all votes for this delegate. However, this way of computing the delegate weight does allow a delegate to rely entirely on exterior votes, i.e. votes received from other accounts. Delegates are responsible for maintaining a secure and effective setup and we believe that this should be backed up by locking part of their own tokens. For this reason, we bound the delegate weight to 10 times the self-votes.

This factor 10 is chosen with two arguments in mind:

*   This factor should be low enough to allow popular delegates to gather support from the community and not have their weight limited by a lack of personal funds.
*   This factor should be high enough to force delegates to lock a sizable portion of their own tokens as a deposit for their forging spot.

We believe that this bound of 10 times the self-votes is a good trade off between the two above arguments.


#### Impact on Security

The proposed voting system will greatly lower the entry barrier to forge blocks. This has the major advantage of making the Lisk network more open. But this also makes it easier for a malicious entity to secure an active delegate slot. This potential issue is mitigated by the locking mechanism and by the 10% minimum self-votes. Indeed, any attack on the network could affect the value of the Lisk token and therefore also the value of the tokens the malicious entity had to lock to obtain a forging slot.

Additionally, a delegate committing a protocol violation can be held accountable and can be punished. The extent and severity of the punishment is discussed in a separate LIP.


### Delegate Productivity

It could happen that a delegate loses its private key, or that it does not maintain its forging node anymore. For this reason, we include a “fail safe” mechanism banning unproductive delegates.

The “fail safe” mechanism is triggered when a delegate misses more than 50 blocks in a row over a period longer than 30 days (260,000 blocks). In such a case, the delegate is banned and cannot be selected to forge again.

The two conditions are chosen to avoid banning delegates for unwanted reasons. A delegate with few forging opportunities could miss its first few block slots because its setup is not yet functional or offline. This is why we propose to wait for 50 missed blocks to ban a delegate. For an active delegate going offline, those 50 blocks could however be quickly reached. This motivates the 30 days waiting period. 

This proposal does not include the use of a normal productivity in the selection mechanism. We believe that delegates with mediocre productivity will not attract many voters, will not be regularly selected to forge blocks and hence will not have a large impact on the network.


### Other Considerations

Numerous voting systems exist and present interesting properties. The main alternatives have been reviewed in the [LIP 0021 "Change to one vote per account"](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0021.md). We refer to that document for arguments and information about those various voting systems. We just compare the differences between our proposal and that LIP.


#### One Vote per Account

LIP 0021 proposes to let each account vote for at most one delegate. That voting system has the “One Voting Lisk - One Vote Power” property mentioned above. Moreover, computing the rank of a delegate is very easy and demands little computational effort. In this regard, the LIP 0021 addresses the main shortcoming of the current voting system. The arguments for the “One Voting Lisk - One Vote Power” property present in that LIP are excellent and we encourage interested readers to become familiar with them.

In terms of user experience, users wanting to vote for several delegates would however need to manage multiple accounts and vote with each of them. This would worsen their experience and probably refrain them from casting multiple votes. We believe this argument is important and has been taken into account in this proposal. Further, the LIP 0021 does not give the Lisk network additional tools to enforce voter or forger accountability.

For those reasons, we believe the current proposal should be preferred to the “Change to one vote per account” LIP. 


## Specification

  


### Delegate Weight

This proposal introduces a new way to calculate the delegate weight: 

delegate weight = minimum { 10 * delegate self-vote , sum of all votes for the delegate },

where delegate self-vote is the amount the delegate voted for its own account. Note that the sum of all votes for the delegate includes the self-votes. 
[The Appendix](#appendix) contains examples of computations of the delegate weight. 


#### Delegate Productivity

The “fail safe” mechanism described in the 
[rationale](#delegate-productivity) is specified by calling a function implementing the logic
below at the end of each block:

```
function updateDelegateForgingInfo:

   let D0 be the delegate who forged the last block (at height h)
   let D1 be the delegate who forged the block at height h-1 
   for every delegate D between D1 and D0 in the selected delegate list (note that “between” is to be taken respectively to the forging order)
	      increment D.consecutiveMissedBlocks
	      if D.consecutiveMissedBlocks > 50 and h-D.lastForgedHeight > 260,000
           D.isBanned = true

    D0.lastForgedHeight = h
    D0.consecutiveMissedBlocks = 0
```

This pseudo code requires delegate accounts to have three new properties:

*   `consecutiveMissedBlocks`, a 32 bit unsigned integer, initialised to 0 when the delegate is registered.
*   `lastForgedHeight`, a 32 bit unsigned integer, initialised when the delegate is registered to the height of the block including the registration. 
*   `isBanned`, a boolean property initialised to false when the delegate is registered.

Delegate missed blocks are currently calculated with the function <code>[getOutsiders](https://github.com/LiskHQ/lisk-sdk/blob/7c31c9d4b12a72f18a35ead79198b2ba6d4bd091/framework/src/modules/chain/submodules/rounds.js#L411)</code>. This function does not record missed blocks in the same way as the above pseudo code. Therefore, <code>[getOutsiders](https://github.com/LiskHQ/lisk-sdk/blob/7c31c9d4b12a72f18a35ead79198b2ba6d4bd091/framework/src/modules/chain/submodules/rounds.js#L411)</code> is not used for this proposal.


#### Banned Delegates

When the list of forging delegates for round `r` is generated (at the beginning of a round `r`) banned delegates are removed from the delegate list and are not considered in the selection mechanism.

This means that a delegate banned during a particular round cannot forge in any subsequent rounds.


### Locking on the Lisk Blockchain

This proposal introduces a locking mechanism for Lisk. Locked tokens cannot be used for any other transactions. The balance property of the account now denotes the non-locked tokens, or the  “available balance”. This means that:


        Total tokens owned = balance + sum of locked amounts.


#### Locked Tokens in the Account State

Every account state now has two new properties. Both properties contain objects used to record locked tokens.



1. `account.votes`: this property is an array of vote objects, it records the current votes by the account. A vote object is an object of size 2 with keys `delegateAddress` and `amount`.
    1. `delegateAddress` is the Lisk address of the delegate the vote is for.
    2. `amount` is a 64 bit signed integer. It represents the number of Beddows voted for the delegate. This number is non-negative. This number is updated with vote transactions.

  `account.votes` is ordered by lexicographical order of `delegateAddress`.
  The size of this array is at most 10.



2. `account.unlocking`: this property is an array of unlocking objects. Unvoted but not yet unlocked tokens are recorded in this property. An unlock object is an object of size 3 with keys `delegateAddress`, `amount` and `unvoteHeight`.
    1.  `delegateAddress` is the Lisk address of the delegate being unvoted.
    2.  `amount` is a 64 bit signed integer. It represents the number of Beddows unvoted, this number is non-negative.
    3.  `unvoteHeight` is the block height at which the unvote was included in the blockchain.

 `account.unlocking` is ordered by lexicographical order of `delegateAddress`.
 The size of this array is at most 20.


### New Vote Transaction

We introduce a new vote transaction. Beside the mandatory properties (`type`, `senderPublicKey`, etc.), the transaction has the following property:



*   `asset.votes`: an array of votes. Each vote is an object of size 2 with keys `delegateAddress` and `amount`.
    *   `delegateAddress` is the Lisk address of the delegate the vote is for.
    *   `amount` is a 64 bit signed integer. It represents the number of Beddows voted for the delegate. If the number is negative, it represents the number of Beddows unvoted from the delegate.


#### Validity of the Vote Transaction

Let `account` be the account of the sender of the vote transaction. To assert the validity of the asset property of a vote transaction, we check the following rules:

*   Every vote included in `asset.votes` is valid. A vote is valid if:
    *   `delegateAddress` value corresponds to the address of a registered delegate.
    *   If the `amount` value is negative, there exists a vote object `U` in `account.votes` such that 
        *   `U.delegateAddress` == `vote.delegateAddress` and 
        *   `U.amount` ≥ |`vote.amount`|
    *   `amount` value is a multiple of 10^9, this corresponds to multiples of 10 LSK.
*   The sum of all positive amounts and fees is smaller or equal to `account.balance`.
*   `asset.votes` has at most 20 elements.
*   A given `delegateAddress` is included in at most one vote from the list of votes (regardless of the associated amounts).
*   If the transaction would bring the sender `votes` property to contain more than 10 objects with non-zero amount, the transaction is invalid.
*   If the transaction would bring the the sender `unlocking` property to contain more than 20 entries, the transaction is invalid.

When multiple vote transactions from a given sender are included in a block, the following checks have to be done to assert block validity.

*   The sum of all positive `amount` values is treated as an outgoing amount for the purpose of validity check. In particular, it is added to the outgoing amount from balance transfers.
*   The sum of all negative `amount` values unvoting a given delegate is smaller in magnitude (or equal) to the amount voted by the sender for that delegate. 

Those last two specifications will be removed when we establish block validity by ordering transactions.


#### Applying a Vote Transaction

When a vote transaction is included in a block at height `h`, all its votes are applied. All votes with negative amounts have to be executed first (in any order) with the following state changes:

*   All negative amounts are removed from the respective vote objects in `account.votes`.
    *   If the amount of a vote object becomes zero, the object is removed. 
*   The delegate weight of the delegate is updated.
*   An unvote object is created in `account.unlocking`. The object has the values

```
{delegateAddress : the address of the unvoted delegate,
 amount : the amount of LSK being unvoted in absolute value,
 unvoteHeight : the height of inclusion of the vote }
```

Then all votes with positive amounts are applied in the following manner:

*   The amount it is subtracted from the account balance.
*   `account.votes` is updated:
    *   All the positive amounts are added to the respective vote object. 
        *   If a required object does not exist, it is created.
*   The delegate weight of the delegate is updated.


#### Vote Transaction Serialization

The asset property of a vote transaction has to be serialized as in the function `getAssetBytes` below:


```
getAssetBytes(asset):
    let buffer be an empty byte buffer 
    for entry in asset.votes
        append the encoding of the entry.delegateAddress to buffer
        append the encoding of entry.amount to buffer
    return buffer
```


#### Undoing a Vote Transaction

When undoing a block containing a vote transaction, the following is done for each vote in `asset.votes`:


*   If the vote has a positive amount, this amount is added to the account balance.
*   Update the corresponding entry in `account.votes`.
*   Update the corresponding delegate weight.
*   If the vote has a negative amount, the corresponding object is removed from `account.unlocking`.


### New Unlock Transaction

We introduce an unlock transaction. Beside the mandatory properties of a transaction (`type`, `senderPublicKey`, etc.), the transaction needs the following property:

*   `asset.unlockObjects`: an array of unlock objects. Each unlock is an object of size 3 with keys `delegateAddress`, `amount` and `height.`
    *   `delegateAddress` is the Lisk address of the delegate which was unvoted.
    *   `amount` is a 64 bit signed integer. It represents the number of Beddows unvoted, this number is non-negative.
    *   `unvoteHeight` is the block height at which the unvote was included in the blockchain.

An unlock object has the same format as the ones present in the `account.unlocking` property.


#### Validity of the Unlock Transaction

To assert the validity of the asset property of an unlock transaction, we check the following rules:



*   Every unlock object in `asset.unlockObjects` is valid. Let `account` be the account of the sender of the unlock transaction, an unlock object `U` is valid if:
    *   There exists an element `U'` in `account.unlocking` that is equal to `U`.
    *   The object has waited its locking period. This is verified according to the following logic.

        ```
        function hasWaited(U)
            let account be the account sending the transaction
            if U.delegateAddress == account.address  //this is a self-unvote
                delayedAvailability = 260,000
            else
                delayedAvailability = 2000
                
            let h be the block height at which the transaction is included
            if h - U.unvoteHeight < delayedAvailability
                return false
    	else
                return true
        ```


*   If an object `U` appears k times in `asset.unlockObjects`, then it must appear at least k times in `account.unlocking`.
*   `asset.unlockObjects` has at most 20 elements. This is implied by the previous bullet point, but this check can be done without access to the database.

When multiple unlock transactions from a given sender are included in a block, we must make sure that they are unlocking different objects from `account.unlocking`.


#### Applying a Unlock Transaction

Applying a valid unlock consists of removing the corresponding unlock object from `account.unlocking` and adding the unlocked amount to the balance.


#### Unlock Transaction Serialization

The asset property of an unlock transaction has to be serialized as in the function `getUnlockAssetBytes` below:

```
getUnlockAssetBytes(asset):
    let buffer be an empty byte buffer
    for entry in asset.unlockObjects
        append the encoding of the entry.delegateAddress to buffer
        append the encoding of entry.amount to buffer
        append the encoding of entry.unvoteHeight to buffer
    return buffer
```


#### Undoing an Unlock Transaction

Undoing an unlock transaction consists of adding all the unlock objects to the `unlocking` property of the corresponding accounts and removing the sum of the amounts from the balance.


### Migration

For migrating from the old voting system to the new voting system, we propose to perform the migration in two steps. 



*   First, starting from round r1 we activate the new transactions, 
the new account properties, the locking mechanism and the new balance definition. 
The new properties of delegate accounts are initialized with `consecutiveMissedBlocks` = 0, 
`lastForgedHeight` = starting height of r1 and
`isBanned` = false. The banning mechanism will be activated starting from round r1,  
i.e., the function “updateDelegateForgingInfo” is called from the beginning of r1. \
The old vote transaction remains active and the vote weight is calculated as the sum of the balance and the locked tokens. 
This first step will last for a suitable amount of time so that account holders can cast votes with the new vote transaction. 
*   Second, starting from round r2 the delegate weight is computed with the new system. The old vote transaction is deactivated. 
Notice that the forging delegates are selected using the delegate weights snapshot from two rounds ago, 
this means that forging delegates will be selected with the new system in round r2+2 for the first time.


## Backwards Compatibility

The changes will introduce a hard fork as the forging delegates are selected based on a different voting system and the vote transaction is modified. 


## Reference Implementation

TBD


## Appendix


### Example of Delegate Weight



1. Delegate has 100 LSK self-votes and 100 LSK other votes:

        delegates weight = 200 LSK = min {1000 LSK, 200 LSK}.

2. Delegate has 200 LSK self-votes and 1500 LSK other votes: 

        delegate weight = 1700 LSK= min {2000 LSK, 1700 LSK}.
      
3. Delegate has 200 LSK self-votes and 3000 LSK other votes: 

	     delegate weight = 2000 LSK = min {2000 LSK, 3200 LSK}.
  
4. Delegate has 250 LSK self-votes and 3000 LSK other votes: 

        delegate weight = 2500 LSK = min {2500 LSK, 3250 LSK}.


### Example of Vote Asset Property

With the current address system, 
the asset property of a vote transaction could for example be:


```
"asset": { "votes": [ {"delegateAddress": 16010222168256538112L, "amount": 50 0000 0000},
                      {"delegateAddress": 11546389013412359332L, "amount": -70 0000 0000}
                    ]
         }
```

If [LIP 0018](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0018.md) "Use base32 encoding of long hash of public key plus checksum for address"
is implemented for the address system, 
the asset property of a vote transaction could for example be:

```
"asset": { "votes": [ {"delegateAddress": lsk24cd35u4jdq8szo3pnsqe5dsxwrnazyqqqg5eu, "amount": 50 0000 0000},
                      {"delegateAddress": lskxwnb4ubt93gz49w3of855yy9uzntddyndahm6s, "amount": -70 0000 0000}
                    ]
         }
```
