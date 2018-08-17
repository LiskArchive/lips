```
LIP: LIP-ikeralus-blocksize
Title: Change to byte based block size limit
Authors: Iker Alustiza, iker@lightcurve.io
         Nazar Hussain, nazar@lightcurve.io
Status: Draft
Type: Standards Track       
Module: Block, Transaction Pool
Created: -
Updated: -
```

## Abstract

This LIP proposes to remove the 25 transactions (txs from now on) limit per block and set a byte based block size where a maximum block size of 15Kb is implemented.

## Copyright

This LIP is licensed under the [GNU General Public License, version 3](http://www.gnu.org/licenses/gpl-3.0.html "GNU General Public License, version 3").

## Motivation

With the incoming Lisk network and protocol improvements (fee system, voting system, P2P network improvement, etc) a clear increase in usage and activity in the network is expected. For the Lisk network, this basically implies more balance txs and more voting activity. Currently, there is a maximum number of txs per block of 25 txs, which we believe is not going to be enough in the future. Therefore in this LIP we propose a byte based block size limit.

## Rationale

We propose to set a maximum of 15Kb block size. This size will keep the blockchain growth below 50Gb per year even assuming 100% full blocks always and delegates missing no blocks. The summary of the numerical implications is as follows:

* Maximum block size: 15Kb
* Blockchain size will grow a **maximum** of 47.3Gb per year.
* According to the tx sizes given in [the documentation](https://lisk.io/documentation/lisk-protocol/transactions), each tx type will use the following space in the block:

| Transaction Type                | Block usage (%) |
| ------------------------------- | --------------- |
| 0 - Transfer (basic)            | 0.78%           |
| 0 - Transfer (2nd pass)         | 1.2%            |
| 0 - Transfer (2nd + data field) | 1.63%           |
| 1 - Second Secret               | 1%              |
| 2 - Delegate                    | 0.91%           |
| 3 - Vote (33 votes tx)          | 15.08%          |
| 4 - Multisignature (16 signs)   | 8.15%           |
| 5 - Dapp                        | 1.66%           |
| 6 - InTransfer                  | 1.33%           |
| 7 - OutTransfer                 | 1.33%           |

* Given the previous numbers, each block will be able to fit:

       - 6 votes and [ 8tx(a)  or 5tx(b)  or 4tx(c) ]
       - 4 votes and [ 48tx(a) or 31tx(b) or 23tx(c) ]
       - 2 votes and [ 88tx(a) or 57tx(b) or 42tx(c) ]
       - 128tx(a) or 82tx(b) or 61tx(c)

  Where _tx(a)_ is a basic Type 0 tx, _tx(b)_ is a 2nd passphrase Type 0 tx and _tx(c)_ is 2nd pass Type 0 + 64B data field tx. A 2nd passphrase Type 0 tx and a basic Type 0 tx + 64B data field tx are almost the same size, so only one is considered. Here _votes_ is assumed to be a full vote tx with 33 votes inside.

* 1000 users will require at least 27 minutes (166 blocks) to change a third of their votes (33 votes per vote tx). They will need around 90 minutes to change all their votes.

To get this data, the size of the block header (112 bytes) is ignored which can imply an extra 300Mb of growth per year. We have excluded other tx types of the last table because they are either one-time per wallet txs (Delegate txs, 2nd passphrase reg, etc), or seldom used txs (Dapp reg txs, In/out transfer txs). In the latter case, depending on the future development these types of txs can be more common but the size is going to be similar to a Type 0 tx.

Moreover, we can compare the maximum txs throughput per day for current and proposed implementations:

### Throughput comparison (assuming full blocks)

| Transaction Type                | Tx per day (current) | Tx per day (after) | Change |
| ------------------------------- | -------------------- | ------------------ | ------ |
| 0 - Transfer (basic)            | 216,000              | 1,080,000          | +500%  |
| 0 - Transfer (2nd + data field) | 216,000              | 589,090            | +272%  |
| 1 - Second Secret               | 216,000              | 869,798            | +402%  |
| 2 - Delegate                    | 216,000              | 644,776            | +298%  |
| 3 - Vote                        | 216,000              | 55,717             | -387%  |
| 4 - Multisignature              | 216,000              | 105,968            | +49%   |

### Tx Ratio Per Block comparison

To support the previous table, it is interesting to have a look at Lisk mainnet historical data:

| Transaction Type   | Tx Count (Current Avg) | Ratio   | Proposed Capacity |
| ------------------ | ---------------------- | ------- | ----------------- |
| 0 - Transfer       | 2.04184768             | 95.422% | 65                |
| 1 - Second Secret  | 0.00438445             | 0.205%  | 0.21              |
| 2 - Delegate       | 0.00200557             | 0.094%  | 0.07              |
| 3 - Vote           | 0.09154353             | 4.278%  | 0.28              |
| 4 - Multisignature | 0.00001629             | 0.001%  | 0.00012264        |
| 5 - Dapp           | 0.00000376             | 0%      | 0.0               |
| 6 - InTransfer     | 0.00000000             | 0%      | 0.0               |
| 7 - OutTransfer    | 0.00000251             | 0%      | 0.0               |

Where we can see that Type 0 txs account for more than 95% of all the tx in the blockchain currently.

We believe that given these numbers, 15Kb is the most adequate choice in terms of **network requirements** (bandwidth of the nodes, blockchain growth, etc) vs **network capabilities** (txs/s, votes per hour, etc). Moreover, it could be _easily_ extended in the future if the network usage requires it.

## Specification

### General implementation logic

* A full block (block payload) must not weigh more than 15kB. If a delegate generates a bigger block, it will be invalid.

* During the filling of a new block from the pool with unconfirmed txs, the node should optimize the available _space vs txs_. For example, when there is less than 2kB free for the next block (a vote tx is 2.3kB), the delegate should fill the remaining gap with smaller txs, even though the next txs in the queue in terms of fee (when new fee system is implemented) or age (currently) would be a vote tx. In this LIP, we propose a basic algorithm to do this (refer to 3 of Implementation Details Section). However, it is up to each delegate in the last instance to implement a different algorithm for their node if they believe it will optimize the profit.
* When a delegate generates a block, it should fetch the unconfirmed txs from pool and verify the size again.

### Implementation Details

1. Add `getListByteSize` in `logic.transactionPool`

   - The proposed implementation is to maintain a static counter for size and update those on every call of the following methods `add<Queue>Transaction`, `remove<Queue>Transaction`. For example, `addUnconfirmedTransaction` and `removeUnconfirmedTransaction` methods.
   
   - Other possibility can be to check in realtime `getBytes` on all txs in the queue.

2. Add `getListItem(index = 0)` in `logic.transactionPool` which will return a tx in the list at given index. By default, it should return the tx at the top of the list.

3. Reimplementing the method `fillPool` in `logic.transactionPool` with the [algorithm](#algorithm-for-logictransactionpoolfillpool).

4. Update `modules.blocks.process.generateBlock`:

   * Call `modules.transactions.getUnconfirmedTransactionList` without limit to get all the unconfirmed transactions. As those will be always equal to 15kb approximately.

5. Update `constants.maxPayloadLength` to 15kb

6. Remove `constants.maxTxsPerBlock` from 'constants.js'.

7. Remove `numberOfTransactions` check from blocks verification for the historical data since it is redundant as it is included in block's signature.

8. Remove `payloadLength` check from blocks verification for historical data (up to 1048576kb) since it is redundant as it is included in block's signature.

9. Set `maxPayloadLength` checks up to 15 kb for recent blocks.

#### Algorithm for logic.transactionPool#fillPool

```
algorithm fillPool
	input: No
	output: No

	Set unconfirmedSize to logic.transactionPool.getListByteSize('Unconfirmed')
	Set newTransactions to empty array

	While unconfirmedSize < 15kb do
		Call pickTransactionFromList('Multisignature', 15kb - unconfirmedSize)
		Push transaction to newTransactions Array
		Set unconfirmedSize = unconfirmedSize + transaction.getBytes()

	While unconfirmedSize < 15kb do
		Call pickTransactionFromList('Queued', 15kb - unconfirmedSize)
		Push transaction to newTransactions Array
		Set unconfirmedSize = unconfirmedSize + transaction.getBytes()

	Call applyUnconfirmedList(newTransactions)

	return

procedure pickTransactionFromList
	input: listName - Name of the list from which to pick transaction
	input: maxAllowedByteSize - Maximum byte size of transaction to pick
	input: skipIndex - Skip the top N transactions default to 0
	output: selectedTransaction

	Set count to logic.transactionPool.count<listName>()

	If count <= skipIndex
		return null

	Set selectedTransaction to getListItem(listName, skipIndex)

	If selectedTransaction.getBytes() < maxAllowedByteSize
	    Call logic.transactionPool.remove<listName>Transaction(selectedTransaction.id)
		return selectedTransaction
	Else
		Call pickTransactionForPool(listName, maxAllowedByteSize, skipIndex + 1)
```

### Related Implementation

For completeness, we add here a related implementation to these proposal which consists of refactoring the `transactionPool` for multisignature txs:

1. Only pending multisignature txs should stay in the `multisignature` list.
2. As soon as the multisignature tx is ready it should be pushed to `queued` list.
3. In the previous step, we only look into the `queued` list to fill the pool while generating blocks.

## Backwards Compatibility

* This proposal will cause a hard fork in the network.
* Once implemented, blocks with more than 25 txs will be valid and blocks with more than 7 voting txs will be invalid .
* The proposed changes will not imply any change in the blocks schema. It will contain the same fields of the current implementation.
* There is no need to add any exception validation logic, as `numberOfTransaction` property is already part of the block signature. So validating previous blocks will work fine.

## Reference Implementation

TBD
