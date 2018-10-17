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
This LIP proposes a new implementation of the transaction pool. We suggest executing database queries in parallel, verifying transactions against other transactions in the transaction pool and processing transactions in memory. The goal is to improve the performance of the transaction pool by decreasing the number of database queries and unnecessarily repeated verifications of transactions.


## Copyright
This LIP is licensed under the [GNU General Public License, version 3](http://www.gnu.org/licenses/gpl-3.0.html "GNU General Public License, version 3").

## Motivation
In the current implementation, the transaction pool verifies the transactions by performing application logic and database queries alternately. Moreover, the transaction pool maintains a queue of up to 25 transactions that are ready to be included into a block, and the database keeps track of the account state that would result if all these transactions were applied. Consequently, the relevant entries in the database get updated whenever this queue receives a new transaction. These transactions are called *unconfirmed transactions*, and the resulting state is called *unconfirmed* state. Furthermore, all entries of the unconfirmed state get set to the actual state of the blockchain whenever a block gets added or deleted.

The current transaction pool does not scale and is inefficient. This is due to the transaction pool performing application logic and database queries alternately, the way unconfirmed transactions are maintained in a queue, and due to keeping the unconfirmed state in the database. The inefficiency of the transaction pool is highlighted when executing stress tests where the transaction pool receives thousands of transactions. 

This proposal addresses the performance inefficiencies and scalability issues in the current transaction pool. It suggests to collect database queries, retrieve relevant records from the database in parallel, and then perform application logic for the verification of transactions. Furthermore, this proposal improves the processing of unconfirmed transactions by removing columns related to the unconfirmed state from the database and by recalculating the state of accounts in memory, when required. The suggested changes reduce and parallelize database queries, thus, improving transaction pool performance and increasing the number of transactions processable in the transaction pool.

## Rationale
The purpose of the transaction pool is to validate and store transactions efficiently and to provide valid transactions to delegates when the node is forging a block. Therefore, in order to improve the performance of these tasks, this proposal focuses on three improvements:
* Refactor and optimize the verification of transactions against the blockchain state.
* Perform validation of transactions against transactions in the transaction pool.
* Remove maintaining the unconfirmed state in the database and perform state calculations in memory.

We will explain the rationale behind these improvements in the following sub-sections.

### Refactor and optimize the verification of transactions
In the current implementation, the verification of transactions includes static validations on the transaction body and verification based on the database state. Moreover, the transaction verification requires multiple database queries, which are executed alternately with the application logic. Executing I/O tasks in series is inefficient because of the single-threaded nature of applications. Therefore, serially executing database queries impacts the performance of verifying a transaction.
In this proposal, we suggest to refactor the verification of a transaction by dividing it into three steps:
* In the first step, static validation checks should be performed on the transaction like schema and signature validation.
* In the second step, the database queries required for the transaction verification should be executed in parallel.
* In the third step, the transaction gets verified against the database state using the state retrieved in the second step, e.g., by verifying account balances.

By refactoring the transaction verification process, we divide the task of the verification process into discrete steps. Therefore, the control flow does not jump back and forth between executing database queries and application logic. Furthermore, when verifying multiple transactions, the process can be further optimized by performing static validation on all transaction, then executing database queries for all transactions and finally performing the verification of all transactions based on the database state. 

### Perform validation of transactions against transactions in the transaction pool
Transactions in the transaction pool can be conflicting in such a way that they cannot be processed irrespective of the blockchain state. For example:
* Transactions contain duplicated data that is required to be unique for that transaction type. E.g, two delegate registration transactions using the same username.
* Multiple transactions of a specific type are received from an account where an account can only make one transaction of that type. E.g, two second signature registration transactions from one account.
 
Validating transactions with other transactions in the transaction pool is inexpensive because it does not require any database state. Therefore, incoming transactions should be validated against other transactions in the transaction pool before further verification.

### Perform state calculation for handling unconfirmed transactions in memory
As mentioned before, currently the transaction pool maintains a queue for the unconfirmed transactions, which we call the `unconfirmed` queue. The transactions in the `unconfirmed` queue change the state of accounts by updating the *unconfirmed state* in the database.  The unconfirmed state is stored in the `u_*` columns of the `mem_accounts` table like `u_balance` and `u_delegates` as well as in separate tables. 

By calculating the unconfirmed state, the transaction pool validates that transactions can be processed together in a block. Transactions that are valid separately, but may become invalid when processed together, are called *conflicting transactions*. By storing the unconfirmed state in the database, the transaction pool does not only verify transactions against the blockchain state, but also against the other transactions in the `unconfirmed` queue. This approach allows the transaction pool to handle conflicting transactions. The drawback of using this approach is that the transaction pool performs extraneous database queries because it maintains the unconfirmed state in the database.

In this proposal, we suggest to remove the maintenance of the unconfirmed state in the database and to perform calculations of the unconfirmed state in memory, when required. The new transaction pool should sanitize transactions in the transaction pool periodically by calculating the unconfirmed state in memory. Furthermore, valid transactions can become invalid due to a change in the blockchain state. Therefore, relevant transactions in the transaction pool should be verified when there is a change in the blockchain state. 

By calculating the unconfirmed state of transactions in memory and revalidating transactions on the blockchain state changes, the invalid transactions will be removed from the transaction pool. Hence, the delegates will be able to extract valid transactions from the transaction pool quickly when forging a block.

## Specification
### Data structures used in the transaction pool 
The new transaction pool manages transactions in multiple queues. The queues are listed with their short description below:
`received`: This queue contains newly received transactions from other peers.
`validated`: This queue contains transactions which are validated by performing schema and signature validations. 
`verified`: This queue contains transactions which are independently verified against the blockchain state.
`pending`: This queue contains transactions which are independently verified against the blockchain state and are awaiting signatures to be processed.
`ready`: This queue contains transactions which are verified against the blockchain state and can be processed in the same block.

For each queue there will additionally be a hashmap where the keys are the transaction IDs and the values are the corresponding transaction objects. This hashmap is useful for quick lookup of transactions in a queue. 

### Lifetime of transactions in the transaction pool
Transactions are received in the transaction pool from clients and peers. Transactions in the transaction pool move between different queues during their lifetime before they are rejected or become part of the blockchain. 
The transactions received from the peers are put in the `received` queue. The transactions move between queues by a job called `processQueues`, which runs periodically.
The `processQueue` job will call the functions `validateTransactions` and `verifyTransactions`. Firstly, the `validateTransactions` function performs schema validation and signature validation on all transactions in the received queue. The transactions for which the validation check fails are removed from the transaction pool. Whereas, the transactions for which the validation check passes are moved to the `validated` queue. Secondly, the `verifyTransactions` function performs verification of all transactions in the `validated` queue against other transactions in the transaction pool (this is explained later in a separate section) and against the blockchain state. The transactions for which the verification check fails are removed from the transaction pool. The transactions for which the verification check passes and that require further signatures for the multi-signature processing are moved to the `pending` queue. The transactions for which the verification check passes and that do not require further signatures are moved to the `verified` queue.
Once a transaction from the `pending` queue has the required signatures, it is moved to the `verified` queue.
Transactions received from a client are processed as soon as they are received and the client is notified about success or failure. On receiving a transaction from a client, the transaction is validated and verified. A transaction for which validation and verification checks pass is added to the `verified` queue and the client is notified about the success. Whereas, a transaction for which validation or verification checks fail is discarded and the client is notified about the failure. 
The transaction pool also defines `processTransactions` job. This job takes transactions from the `verified` queue, and checks whether transactions can be processed together by calculating the resulting state in memory. If the state is valid, the transactions are moved to the `ready` queue, otherwise, the transactions are rejected. 

Transaction pool defines `expireTransactions` job to remove old transactions from the transaction pool. This job iterates over transactions in all queues, and removes the transactions which were received in the transaction pool earlier than the transaction timeout period. Transaction timeout period is defined [here](https://github.com/LiskHQ/lisk/blob/1.0.0/logic/transaction_pool.js#L972)

Transactions are forwarded in the P2P network after they are verified against the blockchain state. Consequently, transactions which are added to the `verified` and the `pending` queue for the first time are sent to the broadcaster module. The transaction pool achieves this by firing the event `verifiedTransaction` with the transaction object. The broadcaster module listens for the `verifiedTransaction` event, and forwards the transactions among peers.

When forging a block, transactions are taken from the `ready` queue. The details of processing transactions in memory are explained later in a separate section.
In the case of a blockchain state change event, the relevant transactions from the `verified`, the `pending` and the `ready` queue are moved back to the `validated` queue. The details of this process are also explained later in a separate section.
When a block is deleted, the transactions included in the block are also removed from the blockchain. The transactions from the deleted block are put into the `validated` queue such that they can be processed again.

 
### Refactor verification of transactions
The verification of transactions requires the blockchain state, which is stored in the database. In order to optimize fetching the state from the database, there will be a function  `getRequiredState` for each transaction type. This function will return information required to fetch the state from the database for a particular transaction. For example, for a delegate registration transaction, this function will return:
```
{
‘ACCOUNT’: <sender_account_id>,
‘UNIQUE_USERNAME’: <username specified in the transaction>
}
```
Using this information, the database module will execute the queries in parallel. In the case of a delegate registration transaction, as described above, one query will be executed for fetching the sender account and another for checking if the username already exists in the database. 
When verifying multiple transactions, the required state for verifying those transactions will be queried from the database and collected. Afterwards, the transactions will be verified using the relevant data fetched from the database. 

### Verifying transactions against transactions in transaction pool
In order to check whether transactions are conflicting, the transactions are verified against existing transactions in the transaction pool. The verification of transactions against other transactions is triggered by the `verifyTransactions` function. In `verifyTransactions`, every transaction that is supposed to be moved from `validated` will be verified against all transactions in the `verified`, `pending` and `ready` queues.
In order to understand the verifications performed at this step, we look at how various transaction types affect the accounts and blockchain state.

As shown in the table below, second signature registration, delegate registration, and multi-signature registration transactions are only allowed once per account. Therefore, if an account sends two or more transactions of one of these types to the transaction pool, then all of these transactions following the first one will be rejected during the verification against the transaction pool. In the same way, delegate registration transactions and dapp registration transactions contain unique data. Therefore, if the transaction pool receives two or more transactions of one of these types, then the transactions following the first one will be rejected.

| Transaction type                          | Allowed once for an account | Contains unique data |
|-------------------------------------------|-----------------------------|----------------------|
| Transfer transaction                      |                             |                      |
| Second signature registration transaction |              X              |                      |
| Delegate registration transaction         |              X              |           X          |
| Vote transaction                          |                             |          X           |
| Multi-signature registration transaction  |              X              |                      |
| Dapp registration transaction             |                             |           X          |
| In transfer transaction            |                             |                             |
| Out transfer transaction             |                             |                             |

To perform these checks, there will be a function `verifyAgainstOtherTransactions` for every transaction type. This function will accept two parameters. Firstly, the transaction that needs to be verified and secondly, an array of already verified transactions of the same type. It will check the transaction against the verified transactions and return an error if the transaction is invalid due to another transaction based on some constraints for that transaction.

### Processing transactions in memory
In order to check whether transactions can become part of the blockchain, the transactions need to be processed together. The transaction pool processes transactions together via the `processTransactions` job. The `processTransactions` job tries to process the maximum number of transactions allowed in a block. It takes transactions from the `verified` queue, and it puts the transactions that can be processed together to the `ready` queue and removes the unprocessable transactions from the transaction pool.
More precisely, the data required for processing transactions are collected and fetched from the database in `processTransactions`. Afterward, the transactions are applied on the fetched accounts in memory. The transactions that are processable with each other are kept whereas if there are some conflicting transactions, they are removed from the transaction pool. For example, if the balance of an account is 10 LSK and there were two transfer transactions of 10 LSK each, then after applying both of these transactions, the balance of the account would be less than 0 LSK. Therefore, one of the transactions will be rejected.

### Verify transactions on blockchain state change
The transactions are verified against the blockchain state. The blockchain state changes may cause some transactions to become invalid. The following changes in the blockchain state may invalidate transactions in the transaction pool:
1. A new block is added to the blockchain. Therefore, new transactions that affect the validity of transactions in the transaction pool may be added to the blockchain.
2. A block is deleted from the blockchain. Therefore, transactions that affect the validity of transactions in the transaction pool may be removed from blockchain. 
3. The application rolls back to the previous round. Therefore, the balance of active delegates is updated.

A blockchain state change only affects a subset of accounts and transactions. Therefore, only the affected transactions in the transaction pool should be verified again. Upon a change in the blockchain state, the transactions in the `verified`, the `pending` and the `ready` queues should be reverified if
- the transaction is from an account affected by the blockchain state change, or
- the transaction is of a type that requires unique data and this transaction type was included in the block causing the blockchain change

The transaction pool registers to `onNewBlock`, `onDeleteBlock` and `onRoundRollback` events. Upon these events, it deduces the affected transactions in the transaction pool. Afterwards, the transaction pool moves all the affected transactions from the `verifed`, the `pending` and the `ready` queue to the `validated` queue where they will be verified again via the `processQueue` job. Moreover, in the case of the `onDeleteBlock` event, the transactions included in the deleted block are put back in the `verified` queue such that they can become part of the blockchain in a later block.

## Backwards Compatibility
This LIP is backward compatible. 

## Reference Implementation
TBD
