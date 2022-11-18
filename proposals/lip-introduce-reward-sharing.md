```
LIP: <LIP number>
Title: Introduce reward sharing mechanism
Author: Grigorios Koumoutsos <grigorios.koumoutsos@lightcurve.io>
Type: Standards Track
Created: <YYYY-MM-DD>
Updated: <YYYY-MM-DD>
Required: 0022, 0023, 0057
```



## Abstract

We define an on-chain reward sharing mechanism for the Lisk ecosystem. This mechanism is defined as an additional part of the [DPoS module][lip-0057]. In this LIP, we specify the state transitions logic defined within the DPoS module due to reward sharing, i.e. the commands, the protocol logic injected during the block lifecycle, and the functions that can be called from other modules or off-chain services.


## Copyright

This LIP is licensed under the [Creative Commons Zero 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).


## Motivation

In Lisk protocol, delegates receive rewards for generating blocks. The set of delegates that generate blocks is chosen based on the total voted amount (self-votes and votes from voters), according to the selection mechanism specified in [LIP 0022][lip-0022] and [LIP 0023][lip-0023]. In contrast to delegates, voters do not receive any rewards by the protocol for locking their tokens to the voted delegates; in other words, there are no economic incentives for users to participate in voting. 

In practice, off-chain tools have been developed (see, e.g., [here](https://liskrewards.com/)) where delegates promise to share a certain part of their rewards to their voters. However this communication is outside the protocol and perhaps unknown to many users. Moreover, there is no guarantee that the delegates will indeed share the promised rewards. Furthermore, delegates who want to share the rewards with their voters need to manually submit the transfer transactions to all voters, which increases their workload and also costs transaction fees. 

This LIP introduces an on-chain reward sharing mechanism in the Lisk protocol. Rewards are shared between delegates and voters as follows: a certain part of the rewards is awarded to the delegate as a commission (the precise percentage of the commission is chosen by each delegate); then, the remaining rewards are shared by the delegate and the voters proportionally to their votes. 

Providing an on-chain reward sharing mechanism has several advantages. For voters, it incentives them to participate in voting, since it provides a guarantee on the receipt of the rewards. Moreover, it provides an easy-to-access interface to decide on the delegates to vote based on their commission. For these reasons, it is expected that this will increase the participation in voting, leading to an increase in the total amount locked for voting and therefore the security of the network. For delegates, it will simplify their tasks since they will not need to perform external communication and submit themselves the transactions for sharing the rewards.  

## Specification

The reward sharing mechanism is part of the DPoS module. This LIP extends the DPoS module to support reward sharing.

The values of all constants related to commissions are between 0 and 10000, corresponding to percentages with two decimal places, which can be obtained by dividing the value by 100. For example, a commission value of 1000, corresponds to a 10% commission. 

**High-level description.**  2 new commands are introduced: One for claiming rewards and one for changing the commission value. Initially, after registration the commission of a delegate is initialized with 100 %. Afterwards, it can be decreased by submitting a commission change transaction. For Lisk Mainnet, as part of the migration process, we also initialize the commission of all already registered delegates with 100 %, see [LIP 0063][lip-0063] for details. To support reward sharing, the vote command execution specified in [LIP 0057][lip-0057#vote] is modified to send the rewards related to delegates that are unvoted or re-voted. The voter and user substores of the DPoS module are modified appropriately to contain all necessary new parameters.  


### Constants

Here we define the constants related to reward sharing. All other DPoS module constants are defined in [LIP 0057][lip-0057#type-definition]. 

| Name                          | Type       | Value      | Description                             |
|-------------------------------|------------|------------|-------------------------------------------------------------------------------------------------|
| `COMMAND_NAME_CLAIM_REWARDS`  | string     | "claimRewards"    |  The command name for the claim rewards transaction                                             |
| `COMMAND_NAME_COMMISSION_CHANGE`| string     | "changeCommission"   |  The command name of the commission change transaction.                             |
| `COMMISSION_INCREASE_PERIOD`  | uint32     | 260000     |  Determines how frequently (after how many blocks) a delegate can increase their commission.      |
| `MAX_COMMISSION_INCREASE_RATE`| uint32     | 500        | Determines the maximum allowed increase on the commission per transaction.                      |
| `MAX_NUM_BYTES_Q96`           | uint32     | 24         | The maximal number of bytes of a serialized fractional number in Q96 format.                    |


### Types

Here we define the newly introduced types. All other types used in this LIP are defined in [LIP 0057][lip-0057#type-definition].

| Name   | Type     | Validation          | Description    |
|--------|----------|---------------------|----------------|
| `Q96`    | integer  | Must be non-negative| Internal representation of a Q96 number. |
| `Vote`   | object   | Contains 3 elements (address, amount, votesharingCoefficients) of types Address, uint64 and array respectively (same as the items in the sentVotes array of the [voterStoreSchema](#json-schema)).| Object containing information regarding a vote.|


#### Q96 Type Conversion

For the sharing coefficient, we use the Q96 unsigned numbers with 96 bits for integer and 96 bits for fractional parts. The arithmetic is defined formally in the [Appendix](#appendix).
The Q96 numbers are stored as byte arrays of maximal length `MAX_NUM_BYTES_Q96`, however whenever they are used in the DPoS module they are treated as objects of type `Q96` defined as in the table above. We define two functions to serialize and deserialize `Q96` numbers to type bytes, `bytesToQ96` and `q96ToBytes`. The functions check that the length of byte representation does not exceed `MAX_NUM_BYTES_Q96`.


```python
def bytesToQ96(numberBytes: bytes) -> Q96:
    if length(numberBytes) > MAX_NUM_BYTES_Q96:
        raise Exception()
    if numberBytes is empty:
        return Q96(0)
    return big-endian decoding of numberBytes

def q96ToBytes(numberQ96: Q96) -> bytes:
    result = big-endian encoding of numberQ96 as integer
    if length(result) > MAX_NUM_BYTES_Q96:
        raise Exception("Overflow when serializing a Q96 number")
    return result
```

Note that a Q96 representation of number 0 is serialized to empty bytes, and empty bytes are deserialized to a Q96 representation of 0.

#### Functions from Other Modules

Calling a function `fct` from another module (named `module`) is represented by `module.fct(required inputs)`.

### DPoS Module Store

The DPoS module store is defined in [LIP 0057][lip-0057].

### Commands

We define the two new commands added to the DPoS module in order to support reward sharing. All other DPoS module commands are defined in [LIP 0057][lip-0057]. 

#### Change Commission

Transactions executing this command have:

* `module = MODULE_NAME_DPOS`
* `command = COMMAND_NAME_COMMISSION_CHANGE`

##### Parameters

```java
changeCommissionParams = {
    "type": "object",
    "required": ["newCommission"],
    "properties": {
        "newCommission": {
            "dataType": "uint32",
            "fieldNumber": 1
        }
    }
}
```

##### Verification

```python
def verify(trs: Transaction) -> None:
    senderAddress = SHA256(trs.senderPublicKey)[:ADDRESS_LENGTH]     # derive address from trs.senderPublicKey
    b = block including trs
    h = b.header.height
    
    if there does not exist an entry delegateStore(senderAddress) in the delegate substore:
        raise Exception('Transaction sender has not registered as a delegate.')
     
    # check valid commission value
    if trs.params.newCommission > 10000: 
        raise Exception('Invalid commission value, not within range 0 to 10000.')
    
    # in case of increase in commission, check validity of new value
    oldCommission = delegateStore(senderAddress).commission

    if trs.params.newCommission > oldCommission and 
       h - delegateStore(senderAddress).lastCommissionIncreaseHeight < COMMISSION_INCREASE_PERIOD:
        raise Exception('Can only increase the commission again COMMISSION_INCREASE_PERIOD blocks after the last commission increase.')  
     
    if (trs.params.newCommission - oldCommission) > MAX_COMMISSION_INCREASE_RATE:
        raise Exception('Invalid argument: Commission increase larger than MAX_COMMISSION_INCREASE_RATE.')
```

##### Execution

```python
def execute(trs: Transaction) -> None:    
    senderAddress = SHA256(trs.senderPublicKey)[:ADDRESS_LENGTH]         # derive address from trs.senderPublicKey

    oldCommission = delegateStore(senderAddress).commission

    delegateStore(senderAddress).commission = trs.params.newCommission
    emitEvent(
        module = MODULE_NAME_DPOS,
        name = EVENT_NAME_COMMISSION_CHANGE,
        data={
            "delegateAddress": senderAddress,
            "oldCommission": oldCommission,
            "newCommission": trs.params.newCommission
        },
        topics = [delegateAddress]
    )
 
    if trs.params.newCommission >= oldCommission:
        b = block including trs
        delegateStore(senderAddress).lastCommissionIncreaseHeight = b.header.height 
```

#### Claim Rewards

Transactions executing this command have:

* `module = MODULE_NAME_DPOS`
* `command = COMMAND_NAME_CLAIM_REWARDS`

##### Parameters

The `params` property of claim transactions is empty.

##### Verification

No additional verification is performed for transactions executing this command.

#### Execution

```python
def execute(trs: Transaction) -> None:
    senderAddress = SHA256(trs.senderPublicKey)[:ADDRESS_LENGTH]         # derive address from trs.senderPublicKey

    for i in range(len(voterStore(senderAddress).sentVotes)):
        assignVoteRewards(senderAddress, i)
```

The internal function [assignVoteRewards](#assignvoterewards) assigns the rewards of a specified vote to the voter. 

### Events

We define the events of DPoS Module related to reward sharing. Those events are added to the DPoS module.

#### commissionChange

This event has `name = EVENT_NAME_COMMISSION_CHANGE`. This event is emitted whenever a delegate changes their commission.

##### Topics

* `delegateAddress`: The address of the delegate changing the commission.

##### Data

```java
commissionChangeEventParams = {
  "type": "object",
  "required": ["delegateAddress", "oldCommission", "newCommission"]
  "properties": {
        "delegateAddress": {
            "dataType": "bytes",
            "length": ADDRESS_LENGTH,
            "fieldNumber": 1
        },
        "oldCommission": {
            "dataType": "uint32",
            "fieldNumber": 2
        },
        "newCommission": {
            "dataType": "uint32",
            "fieldNumber": 3
        }
    }
}
```

#### rewardsAssigned

This event has `name = EVENT_NAME_REWARDS_ASSIGNED`. This event is emitted whenever rewards are assigned to a voter.

##### Topics

* `voterAddress` : The address of the voter receiving the rewards.

##### Data

```java
rewardsAssignedEventParams = {
  "type": "object",
  "required": ["voterAddress", "delegateAddress", "tokenID", "amount"]
  "properties": {
        "voterAddress": {
            "dataType": "bytes",
            "length": ADDRESS_LENGTH,
            "fieldNumber": 1
        },
        "delegateAddress": {
            "dataType": "bytes",
            "length": ADDRESS_LENGTH,
            "fieldNumber": 2
        },
        "tokenID": {
            "dataType": "bytes",
            "length": TOKEN_ID_LENGTH,
            "fieldNumber": 3
        },
        "amount": {
            "dataType": "uint64",
            "fieldNumber": 4
        }
    }
}
```


### Internal Functions

We define the internal functions added in the DPoS module to support reward sharing. All other internal functions of the DPoS module are defined in [LIP 0057][lip-0057#internal-functions]. 

#### calculateVoteRewards

This function calculates the current reward of a particular vote. The input is a `voteObject`, i.e., an object similar to the ones stored in the sentVotes array of the voter substore, containing `delegateAddress`, `amount` and `voteSharingCoefficients`.


```python
def calculateVoteRewards(vote: Vote,tokenID: TokenID):
    i = index of item in delegateStore(vote.delegateAddress).sharingCoefficients with item.tokenID == tokenID

    # transform variables to Q96    
    delegateSharingCoefficient = bytesToQ96(delegateStore(vote.delegateAddress).sharingCoefficients[i].coefficient)
    amount = Q96(vote.amount)
    voteSharingCoefficient = bytesToQ96(vote.voteSharingCoefficients[i].coefficient)

    # calculate reward
    reward = mul_96(amount, sub_96(delegateSharingCoefficient, voteSharingCoefficient))

    return Q_96_ToInt(reward)
```

Note that here `i` specifies the index of entries for token with id `tokenID` in the sharing coefficients array in both for the delegate and the voter substore. The fact that both arrays have the same `tokenID` in the same position is guaranteed from the fact that both arrays are sorted in lexicographic order. For the delegate substore array this is done in the [`updateSharedRewards`](#updatesharedrewards) function and for the voter substore in the [assignVoteRewards](#assignvoterewards) function.

#### assignVoteRewards

This function assigns the rewards to the specified voter for a specific vote, the `i`th vote stored in the `sentVotes` array of `voterStore(address)`.

```python
def assignVoteRewards(voterAddress: Address, i: uint32) -> None:
    vote = voterStore(voterAddress).sentVotes[i]
    # self-votes are excluded from reward sharing
    if vote.delegateAddress == voterAddress:
        return

    # assign rewards for each token separately
    for elem in delegateStore(vote.delegateAddress).sharingCoefficients:
        if there does not exist an item in vote.voteSharingCoefficients with item.tokenID == elem.tokenID:
            vote.voteSharingCoefficients.append({"tokenID": item.tokenID, "coefficient": q96ToBytes(Q96(0))})  
            keep the vote.voteSharingCoefficients array ordered in lexicographic order of tokenID 
            # this makes sure that the order is the same as in delegate substore

        tokenID = elem.tokenID
        reward = calculateVoteRewards(vote, tokenID)

        if reward > 0:
            # unlock and send tokens to voter
            Token.unlock(vote.delegateAddress,
                     	   MODULE_NAME_DPOS,
                    	   tokenID,
                    	   reward
                    	)    
            Token.transfer(vote.delegateAddress, 
                          voterAddress,
                          tokenID,
                          reward)

            emitEvent(
                module = MODULE_NAME_DPOS,
                name = EVENT_NAME_REWARDS_ASSIGNED,
                data={
                    "voterAddress": voterAddress,
                    "delegateAddress": vote.delegateAddress,
                    "tokenID": tokenID,
                    "amount": reward
                },
                topics = [voterAddress]
            )

    # update sharing coefficients
    vote.voteSharingCoefficients = delegateStore(vote.delegateAddress).sharingCoefficients
```

### Protocol Logic for Other Modules

#### updateSharedRewards

This function is called after a reward is assigned to a delegate. It locks the amount of the reward which will be shared to voters and updates the delegate's sharing coefficient.

```python
def updateSharedRewards(generatorAddress: Address, tokenID: TokenID, reward: uint64) -> None	
    if delegateStore(generatorAddress).totalVotesReceived == 0: # If sharing coefficient can not be defined, we return.
        return
        
    # use Q96 numbers
    reward = Q96(reward)
    rewardFraction = sub_96(Q96(1), div_96(Q96(delegateStore(generatorAddress).commission), Q96(10000)))
    selfVotes = Q96(delegateStore(generatorAddress).selfVotes)
    totalVotes = Q96(delegateStore(generatorAddress).totalVotesReceived)
    
    if there does not exist an item in delegateStore(generatorAddress).sharingCoefficients with item.tokenID == tokenID:
        delegateStore(generatorAddress).sharingCoefficients.append({"tokenID":tokenID,
                                                                    "sharingCoefficient": q96ToBytes(Q96(0))}) 
                                                                    # Initialize sharing coefficient for the specified token.
        keep the delegateStore(generatorAddress).sharingCoefficients array ordered
        in lexicographic order of tokenID     # Sharing coefficients are sorted in lexicographic order of tokenID.

    i = index of item in delegateStore(generatorAddress).sharingCoefficients with item.tokenID == tokenID
    oldSharingCoefficient = bytesToQ96(delegateStore(generatorAddress).sharingCoefficients[i].coefficient)
    
    # Calculate the increase in sharing coefficient.
    sharingCoefficientIncrease = muldiv_96(reward, rewardFraction, totalVotes)
    # Lock the amount that needs to be shared.
    sharedRewards = mul_96(sharingCoefficientIncrease, sub_96(totalVotes, selfVotes))
    sharedRewards = Q_96_ToInt(sharedRewards)
    Token.lock(generatorAddress, MODULE_NAME_DPOS, tokenID, sharedRewards)
    
    # Update sharing coefficient.
    newSharingCoefficient = add_96(oldSharingCoefficient, sharingCoefficientIncrease)
    delegateStore(generatorAddress).sharingCoefficients[i].coefficient = q96ToBytes(newSharingCoefficient)
```

### Endpoints for Off-Chain Services

#### getLockedRewards

This function returns the amount of rewards in the specified delegate's account that is locked in order to be shared to the voters.

```python
def getLockedRewards(delegateAddress: Address, tokenID: TokenID) -> uint64:
    if tokenID == TOKEN_ID_DPOS:
        return Token.getLockedAmount(delegateAddress, MODULE_NAME_DPOS, tokenID) - getLockedVotedAmount(delegateAddress) 
    return Token.getLockedAmount(delegateAddress, MODULE_NAME_DPOS, tokenID)
```

#### getClaimableRewards

This function returns the rewards that a user can claim. 

```python
def getClaimableRewards(voterAddress: Address) -> dict[TokenID, uint64]:
    rewards: dict[TokenID, uint64] = {}
    for i in range(len(voterStore(voterAddress).sentVotes)):
        vote = voterStore(voterAddress).sentVotes[i]
        delegateAddress = vote.delegateAddress
        # Self-votes are excluded.
        if delegateAddress != voterAddress:
            for elem in delegateStore(delegateAddress).sharingCoefficients:
                if there does not exist an item in vote.voteSharingCoefficients
                with item.tokenID == elem.tokenID:

                    vote.voteSharingCoefficients.append({"tokenID": item.tokenID, 
                                                         "coefficient": q96ToBytes(Q96(0))})
                    keep the vote.voteSharingCoefficients array ordered in lexicographic order of tokenID
                    # this makes sure that the order is the same as in delegate substore

                if elem.tokenID in rewards:
                    rewards[elem.tokenID]+= calculateVoteRewards(vote, elem.tokenID)
                else:
                    rewards[elem.tokenID] = calculateVoteRewards(vote, elem.tokenID)

    return rewards
```

## Rationale

### Commission

The commission defines the part of the rewards that are assigned to the delegate. We allow delegates to set their own commission. The reason is to provide flexibility to delegates. For example, it makes it easier for new delegates to enter in the ecosystem and attract voters: by setting the commission to a relatively small value compared to other delegates, it becomes more attractive for voters to vote for this delegate. Moreover, it allows delegates to choose if they want to share rewards or not: by setting a commission 100% a delegate can essentially disable reward sharing for the voters. Furthermore, it allows delegates to adapt their commission based on external factors (e.g., change in maintenance cost, change in value of the token). 

### Constraints on Commission Increase 

Delegates can change their commission using a change commission transaction. This might cause reward losses and bad user experience for voters in case of abrupt commission increases. For example, consider the scenario where a user votes a delegate with small commission (e.g., 5%), expecting a certain amount of rewards; shortly afterwards, the delegate increases highly the commission (e.g.,from 5% to 50%). Then, even if the voter realizes this change quickly, then switching to some other delegate(s) requires unvoting and choose again which delegates to vote; this situation could lead to bad user experience if it occurs repeatedly. Even worse, in case the voter does not realize the change in commission fast enough, the rewards obtained due to this vote are significantly decreased.

To avoid such cases and provide guarantees to voters on their expected rewards, we introduce two constraints on the increase of the delegate commission: 

* The increase of the commission rate should be at most `MAX_COMMISSION_INCREASE_RATE`. For the mainchain this is set to 5%. 
* After increasing the commission, a delegate can not increase it again for the next  `COMMISSION_INCREASE_PERIOD` blocks. For the mainchain, this is set to 260000 blocks (roughly 30 days).

Those two constraints provide the guarantee to the voters that if they check the changes in delegates' commissions reasonably often (e.g., once a month for the mainchain), then the potential loses in expected rewards of the voters are quite limited.  

### Distribution of Rewards

Whenever rewards are attributed to a delegate, the part of rewards corresponding to the commission are sent to this delegate; the rest part of the rewards belongs to delegates and voters according to their vote amount. Therefore, if a delegate receives a reward $r$ and has commission percentage $c$, the overall reward assigned to the delegate is

$$ r \cdot \frac{c}{100} +  r \cdot (1- \frac{c}{100}) \cdot \frac{selfVotes}{totalVotes}   $$

and the reward for a voter who has voted amount $myVotes$ is 

$$  r \cdot   (1- \frac{c}{100}) \cdot \frac{myVotes}{totalVotes}.  $$

At first glance it might seem unclear why two types of rewards are attributed to delegates, one for commission and one for self-votes. It might look simpler if the delegates just get the commission and the rest is attributed to voters. The reason for choosing the current formulation is twofold: 

* First, it makes it easier for voters to calculate and compare their expected rewards for voting delegates. In particular, to calculate the rewards for voting an amount `myVotes` for a delegate, only two values are needed, the commission and total votes of this delegate. Otherwise, the self-votes of the delegate would be also needed to calculate the rewards. 
* Second, the current formulation allows delegates to increase their rewards by increasing their self-votes by any amount they wish; this can not be done by increasing the commission due to the constaints on commission increase.  

### Efficient Calculation of Rewards 

Each delegate might have too many voters. Therefore it would be extremely inefficient to calculate the rewards for all voters at the time of generating a block. To avoid un-necessary calculations, we define a special transaction for claiming pending rewards. Voters can claim their rewards by submitting such a transaction. Rewards are calculated only at times when it is needed in order to credit the rewards to the voter. Assume a voter votes an amount $myVotes$ for a delegate at height $h_{vote}$ and submits a claim rewards transaction at height $h_{claim}$. The rewards attributed for this vote equal:

$$ \sum_{i = h_{vote}}^{h_{claim}-1} r_i \cdot (1 -  \frac{c_i}{100}) \cdot \frac{myVotes}{totalVotes(i)} = myVotes \cdot \sum_{i = h_{vote}}^{h_{claim}-1}  \frac{r_i \cdot (1 -  \frac{c_i}{100})}{totalVotes(i)} $$ 

where $r_i$ is the reward, $c_i$ the commission and $totalVotes(i)$ the total votes for the delegate at height $i$. In order to be able to calculate this quantity efficiently, we define 

$$F(h) = \sum_{i = 0}^{h - 1}  \frac{r_i \cdot (1 -  \frac{c_i}{100})}{totalVotes(i)},$$ 

which we call *sharing coefficient* of a delegate at height $h$. The reward is then equal to

$$ myVotes \cdot ( F(h_{claim}) - F(h_{vote}))  $$

This way, to calculate the reward we just need to have access to the values $F(h_{claim})$ and $F(h_{vote})$. To achieve this, we store the current value of the sharing coefficient in the delegate's account in the delegate substore and update it any time the delegate receives rewards. The value of the sharing coefficient at the time of voting, $F(h_{vote})$ is stored in the voter's account in the voter substore. When rewards are claimed,  $F(h_{claim})$ is recovered from the delegates substore and $F(h_{vote})$ from the voters substore. After a claim rewards transaction is submitted and the rewards are assigned to the voter, then the sharing coefficient of the vote $F(h_{vote})$ is updated to the current value of the delegate sharing coefficient. Note the robustness of the sharing coefficient quantity: it is able to incorporate dynamic change of rewards per block, commission of the delegate and total votes for the delegate.

**Assigning unclaimed rewards**. The reward calculation above assumes that the voted amount `myVotes` of voter to the delegate is fixed. This might not be the case in general, since the voted amount could change if a voter decreases/increases the vote. In order to be able to support efficient calculation of rewards using the sharing coefficient, before the modifying the voted amount, all unclaimed rewards of this vote are credited to the voter. Then, the newly voted amount (sum of previous amount plus vote/unvote) is treated as a new vote from the reward sharing point of view and the sharing coefficient $F(h_{vote})$ is updated with the current value for the specified delegate. 

**Number representation**. Note that the sharing coefficient is a fractional number, since we need to divide by the total votes of the delegate. The fractional number representation has to be completely deterministic and transparent for implementation. This guarantees that all the correct implementations of the reward sharing mechanism update the state in exactly the same way for the same inputs. Thus we rely on fixed point arithmetic, which is specified in the [Appendix](#fixed-point-arithmetic).

In practice, we work with `Q96` unsigned numbers with 96 bits for integer and 96 bits for fractional parts (also see [the Wikipedia page about Q number format][Q_wiki]). Note that the intermediate results of arithmetic computations with `Q96` numbers may need more memory space, e.g. the implementation of `div_n(a, b) = (a << n) // b` needs to store the result of `a << n`.


### Supporting Rewards in Various Tokens

In the Lisk ecosystem, there are different reasons for which delegates receive rewards and perhaps those rewards might even be in different tokens. For example, in a sidechain both block rewards and transaction fees awarded to delegates might be shared with voters; in general, the tokens used for those rewards might be different (e.g., block rewards in its native token and transaction fees in LSK). More generally, depending on the application many other kinds of rewards might be applicable. For example, a DeFi sidechain where block rewards are assigned in a native token, can incentivize validator participation to increase the security of the chain by providing occasionally additional rewards using more valuable tokens (e.g., LSK token). 

Our reward sharing mechanism allows an arbitrary number of different rewards and different tokens. To achieve this, instead of storing one sharing coefficient for each delegate, we store an array containing multiple sharing coefficients, one for each token used for rewards (i.e., the value $F(h)$ for each token). Similarly, in the voter substore, we store an array for sharing coefficients where each entry contains $F(h_{vote})$ for the corresponding token used for rewards.   

## Backwards Compatibility

This LIP adds extra functionality (commands, events, protocol logic) to the DPoS module and therefore implies a hard fork.

## Reference Implementation

TBA

## Appendix


### Fixed Point Arithmetic


#### Definition

We represent a positive real number `r` as a `Qn` by the positive integer `Qn(r) = floor(r*2^n)` (inspired by the [Q number format](https://en.wikipedia.org/wiki/Q_(number_format)) for signed numbers). In this representation, we have `n` bits of fractional precision. We do not limit the size of `r` as modern libraries can handle integers of arbitrary size; note that all the `Qn` conversions assume no loss of significant digits.


#### Operations on Integers

For an integer `a` in the `Qn` format, we define:

* Rounding down: `roundDown_n(a) = a >> n`


#### Qn Arithmetic Operations

In the following definition, `*` is the integer multiplication, `//` is the integer division (rounded down). Division by zero is not permitted and should raise an error in any implementation.

For two numbers `a`,`b` and `c` in `Qn` format, we define the following arithmetic operations which all return a `Qn`:

* Addition: `add_n(a, b) = a + b`

* Subtraction: `sub_n(a,b) = a - b`, only defined if `a >= b`

* Multiplication: `mul_n(a, b) = (a * b) >> n`

* Division: `div_n(a, b) = (a << n) // b`

* Multiplication and then division: `muldiv_n(a, b, c) = roundDown_n(((a * b) << n) // c)`

* Multiplication and then division, rounding up: `muldiv_n_RoundUp(a, b, c) = roundUp_n(((a * b) << n) // c)`

* Convert to integer rounding down: `Q_n_ToInt(a) = roundDown_n(a)`

* Convert to integer rounding up: `Q_n_ToIntRoundUp(a) = roundUp_n(a)`

* Inversion in the decimal precision space: `inv_n(a) = div_n(1 << n, a)`


[lip-0022]: https://github.com/LiskHQ/lips/blob/main/proposals/lip-0022.md
[lip-0023]: https://github.com/LiskHQ/lips/blob/main/proposals/lip-0023.md
[lip-0057]: https://github.com/LiskHQ/lips/blob/main/proposals/lip-0057.md
[lip-0057#type-definition]: https://github.com/LiskHQ/lips/blob/main/proposals/lip-0057.md#type-definition
[lip-0057#delegate-registration]: https://github.com/LiskHQ/lips/blob/main/proposals/lip-0057.md#delegate-registration
[lip-0057#vote]: https://github.com/LiskHQ/lips/blob/main/proposals/lip-0057.md#vote
[lip-0057#internal-functions]: https://github.com/LiskHQ/lips/blob/main/proposals/lip-0057.md#internal-functions
[lip-0063]: https://github.com/LiskHQ/lips/blob/main/proposals/lip-0063.md
[Q_wiki]: https://en.wikipedia.org/wiki/Q_(number_format)
