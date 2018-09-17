```
LIP: LIP-usman-improvements_in_handling_transactions_in_memory
Title: Improvements in handling transactions in memory
Author: Usman Khan, usman@lightcurve.io
Type: Process
Module: Transaction Pool
Created: <2018-09-07>
Updated: -
```

## Abstract
This LIP addresses the performance impact of applying transactions on the unconfirmed state of the accounts in the database prior to block application and proposes a performance efficient solution where transactions only update accounts state while node is processing a new block.

This LIP addresses the performance impact of applying transactions on the state of the accounts in the database prior to block application and proposes a performance efficient solution where transactions only update accounts state while node is processing a new block. 

## Motivation
Application maintains the unconfirmed state for transactions in the transaction pool by using unconfirmed columns in the `mem_accounts` table. For every transaction added to the unconfirmed queue in the transaction pool, application performs database writes. Since transaction moves from queued to unconfirmed queue back and forth multiple times before (possibly) becoming part of a block, application takes a huge performance hit because of it.

These unnecessary database updates are done in two places:

1. fillpool
2. applyBlock

From [fillpool](https://github.com/LiskHQ/lisk/blob/development/logic/transaction_pool.js#L749) in transaction pool, application applies the effects of transactions to the unconfirmed columns of the relevant accounts in the `mem_accounts` table before transaction becomes part of the blockchain. The purpose of fillPool is to check the validity of transactions against the confirmed state as well as with other unconfirmed transactions in the database.

From [applyBlock](https://github.com/LiskHQ/lisk/blob/development/modules/blocks/chain.js#L502), we perform [undoUnconfirmedListStep](https://github.com/LiskHQ/lisk/blob/development/modules/blocks/chain.js#L316), [applyUnconfirmedStep](https://github.com/LiskHQ/lisk/blob/development/modules/blocks/chain.js#L336) where node updates relevant accounts rows in the database.

These database update calls are unnecessary because block application is done atomically now as opposed to earlier when application didn’t have the ability of atomic database writes.

## Assumption
A block is the smallest atomic step in a blockchain, this means that when transactions are put in a block, they should behave as if they are all applied at the same time. This assumption will imply that all transactions in the current block of the blockchain should on their own be valid against the state of the blockchain present as of the last block. This assumption also implies that it’s not possible to have a transaction which is invalid based on the state of the blockchain as of the last block of the blockchain but is only valid because of some transaction which came before it in the same block.

This assumption ensures that the order of transactions in a block do not matter. Which ensures that application will behave in a consistent way in many edge cases like:

* An account A sends 10 LSK to another account B where B does not have any LSK then B cannot spend that money in the same block irrespective of order of the transactions in the block.
* An account A sends a transfer transaction and a second signature registeration transaction and both of these transactions go in the same block, then transfer transaction will not require a second signature irrespective of order of the transactions in the block.

## Rationale
Removing the maintenance of unconfirmed state from the database means that application has to ensure same level of consistency through application logic. Therefore, it is the responsibility of transaction pool to do the following things:
* Transaction pool should be able to handle conflicting transactions.
* Transaction pool should revalidate transactions when the state of blockchain has changed.

Conflicting transactions are the transactions which depend on each other in a way that they are valid separately, but when processed together, can lead to the invalidation of one or more transaction. There are various types of conflicting transactions, and in order to derive a thorough solution, we need to first understand the different kinds of conflicting transactions. One example of a conflicting transactions is that say one user has 10 LSK in his account if he makes two transactions sending 10 LSK and sends it to a node then only one of these transactions can become part of the blockchain.

And since transaction pool will maintain transactions in memory, it should be able removes the transactions which become invalid due to a change in the state of the blockchain after they’ve been initially verified.

Both of these points are explained in detail in the following sections.

### Handling conflicting transactions:
Transactions can be conflicting based on how they affect the sender or recipient account and also the state of the blockchain. In Lisk, there are 6 different transaction types (currently active), and here we list the effects of each transaction type on the blockchain, and how it can possibly become conflicting.
#### For transfer transaction:
If there are two or more transfer transactions from the same account, then it means that when both of the transactions are processed together, the balance of the account may become less than zero leading to a conflicting state.
#### For second signature transaction:
If there are two or more second signature registration transactions from the same account, then it means that those transactions are definitely conflicting. And all transactions that come after second signature registration transaction has become part of the blockchain are affected by second signature transaction for that account. (Note: An account can have a second signature registration transaction and transfer transaction in the same block but the transfer transaction will not require second signature.)
#### For delegate registration transaction:
Delegate usernames are unique, so all the delegate registration transactions are possibly conflicting transactions with each other. Also, there can be only one delegate registration transaction from an account.
#### For vote transaction:
All vote transactions from the same account are possibly conflicting because it’s possible that account tried to vote same delegate in two different transactions and also in the case that multiple vote transactions together make the total votes greater than 101 (which is not allowed).
#### For multi transaction:
All multisignature registration transactions from the same account are conflicting. And all transactions that come after multi registration transaction has become part of the blockchain are affected by multi registration transaction for that account. (Note: An account can have a multisignature registration transaction and transfer transaction in the same block but the transfer transaction will not require multisignatures.)
#### For dapp registration transaction:
All dapp registration transactions are possibly conflicting with other dapp registration transactions.

### Handling events which change the state of the blockchain:
The state of the blockchain is updated when a block is forged or deleted and when a round finishes or gets reverted. These changes affect accounts state, which can lead to a transaction in transaction pool becoming invalid and vice versa. So, whenever any of these events happen, application should reverify all transactions in the pool which are related to accounts which were involved in the block/round change.

### Summary of scenarios:
So, to summarise, there are 7 scenarios which transaction pool should handle consistently:
1. Transactions from the same account are conflicting with each other.
2. Transaction type effects the state of the account for all transactions after that one.
3. An account can only have one transaction of a particular type in the blockchain.
4. Transaction type contain some data which needs to be unique across blockchain.
5. There is a new block forged/received which has transactions affecting accounts in the pool.
6. There is a  block deletion which has transactions affecting accounts in the pool.
7. Round has finished/rolled back.

## Specification
In order to cater for all the scenarios, we define following rules for properly managing transactions in pool
1. There can be at max 25 transactions from the same account in the pool. So, for every transaction received by the pool, pool should check that the sender account of incoming transaction has less than 25 transactions in the pool before adding it to the transaction pool queue. (If an account wants to send more than 25 transactions, it should configure it’s own node to accept more than 25 local transactions.)
2. For every transaction received by the pool, it should be verified against confirmed state of the blockchain before adding it to the transaction pool queue.
3. For every transaction received by the pool, if it’s transaction type is unique for an account or if it’s transaction type contains data which should be unique across blockchain, transaction pool should verify the transaction against transactions of the same type in the pool before adding it to the transaction pool queue.
4. If there is an event (block addition/deletion round finish/rollback), which changes the state of an account, application should reverify all transactions related to that account, retain the transactions which are valid and remove the transactions which are invalid from the transaction pool queue.
 
We will discuss these specifications in detail in order to understand their impact on the application.

### Rule 1:
Rule 1 is to ensure that an account cannot spam the node’s transaction pool with invalid conflicting transactions. It will act as an anti-spamming check, helpling node mitigate possible issues raised by **scenario 1**. In order to decide whether a group of transaction are conflicting with each other (which can be at max 25 transactions), node will do it once it’s creating/processing a block by applying those transactions on the accounts on top of each other.

### Rule 2:
Rule 2 will ensure that node does not add an invalid transaction in the transaction pool queue according to the current state of the blockchain. This will ensure that **scenario 2** is handled properly. Which means that, for example, if there is a second signature and transfer transaction from the same account in the pool, then transfer transaction will not require second signature irrespective of the order of transactions in the pool until second signature transaction has become part of the blockchain. (If both of these transactions become part of the same block in the blockchain, then transfer transaction will not require second signature because of the assumption specified at the beginning of the document)

### Rule 3:
Rule 3 will ensure that transactions in the pool are not conflicting with each other irrespective of the state of the blockchain. Every transaction type will have its custom implementation of *verifyTransactionAgainstTransactionsInPool* function. This function will have two responsibilities:

1. It will ensure that incoming transaction is rejected if it’s related to **scenario 3** because if pool receives a transaction which can only be made once from an account and the transaction pool already contains a transaction of the same type from the same account, it will reject the incoming transaction.
2. It will ensure that incoming transaction is rejected if it’s related to **scenario 4** because if the pool receives a transaction which contains data needed to be unique across blockchain, the function implementation will verify the transaction against all the transactions of the same type in the pool and reject the incoming transaction if the data is not unique. 

### Rule 4:
Rule 4 will ensure that the transactions related to the affected accounts due to the change in the blockchain state are reverified. This rule will ensure **scenarios 5, 6 and 7** are handled properly.

## Backwards Compatibility
This LIP limits the number of transactions in the transaction pool from an account to be 25. It's important to note that blocks with more than 25 transactions from the same account will still be valid. Another impact of this LIP is that since node will recalculate the unconfirmed state of the accounts (or return the same response for account's unconfirmed state as it does for confirmed state), the behaviour of endpoints like `/api/node/transactions/unconfirmed` and `/api/accounts` will be affected.

## Relevant changes in the rest of the applicaiton
The application should prioritze local transactions and broadcast them in such a way (it should only broadcast 25 transactions from the same account) so they are not rejecting by the network because of max transactions from the same account limit introduced in this LIP.
