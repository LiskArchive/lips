```
LIP: <LIP number>
Title: Introduce numbering scheme for transaction types
Author: Nazar Hussain <nazar@lightcurve.io>
        Iker Alustiza <iker@lightcurve.io>
Discussions-To: https://research.lisk.io/t/introduce-numbering-scheme-for-transaction-types/220
Type: Informational
Created: 2020-03-26
Updated: 2020-05-07
```

## Abstract

This LIP proposes a consistent versioning system for transaction types. This versioning system may also be used in the SDK for custom transaction development.

## Copyright

This LIP is licensed under the [Creative Commons Zero 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).

## Motivation

The successive objectives defined in the [protocol roadmap](https://lisk.io/roadmap) for Lisk will introduce new transaction types and several breaking changes in the current transaction objects. In order to have a consistent way to release these breaking changes, an unambiguous and straightforward versioning scheme for transaction types should be defined. This versioning scheme has to link unequivocally a transaction type with a specific transaction schema, validation and execution logic. This facilitates not only future development and code maintenance but also the compatibility with third party services.

Moreover, this proper versioning scheme has to ensure that transactions confirmed in previous protocol versions cannot be replayed in the current or any future version.

## Rationale

This LIP proposes a consistent procedure to assign a value to the type property of any  transaction. In [LIP 0028](https://github.com/LiskHQ/lips/blob/master/proposals/lip-0028.md) the property `type` has already been declared as `uint32`, so we have a larger range to use.   

Since we don’t have a separate attribute for transaction type versioning, we have to build a numbering scheme which can help us to identify both information. We will assign that number to the existing attribute `type`, so on the protocol level, every change in this attribute will be considered a new transaction type. But semantically we will be able to identify if some types are related to each other or to say are different versions of the same transaction type.

Whenever there is a change or addition applied as per the rules given in the specification, we will refer to this numbering scheme to identify the new integer value to be used for the transaction type. The numbering scheme will provide an integer value that is currently not used and has not been used in the past for any other transaction type. Every improvement proposal for the Lisk protocol introducing changes to any transaction type should follow the above procedure. Moreover, SDK developers creating new transaction types for their applications are encouraged to follow this convention.

## Specification

Every time a breaking change for a certain transaction type is introduced regarding its:

* transaction schema,
* transaction validation and verification logic,
* transaction execution logic,

the property `type` of the affected transaction type has to be modified. If the change affects the base transaction, then the `type` property for every active transaction type will be updated based on the numbering scheme defined.

The transaction type numbering scheme works as follows. Every transaction type will reserve the range of 100 integer values, meaning every next transaction type will start from an offset of 100. And for each change in a particular transaction type, the `type` value will be incremented by one. E.g. Balance transfer transaction will start from 100, and if there is a revision that happens to it as per the above rules, we will change the `type` property of said transaction type to 101, then 102 and so on. This way, each value of the `type` property represents a separate and independent transaction type for the protocol, but semantically we can identify which transaction types are revisions of some other transaction types.

The following table specifies the transaction type values we will be using for the protocol.

| Transaction Type             | Network Security<br>3.0 | Base Type Value  | Network Economics/Consensus/Longevity<br>4.0 | Blockchain Interoperability<br>5.0 |
|------------------------------|-------------------------|------------------|----------------------------------------------|------------------------------------|
| Transfer                     | 8                       | 100              | 100                                          | 101                                |
| Delegate Registration        | 10                      | 200              | 200                                          | 201                                |
| Vote                         | 11                      | 300              | 300                                          | 301                                |
| Multisignature Registration  | 12                      | 400              | 400                                          | 401                                |
| Unlock Vote                  |                         | 500              | 500                                          | 501                                |
| PoM                          |                         | 600              | 600                                          | 601                                |
| Reclaim                      |                         | 700              | 700                                          | 701                                |
| Second passphrase            | 9                       | Disabled         |                                              |                                    |
| Dapp Registration            | 5                       | Disabled for now |                                              |                                    |
| Dapp In                      | 6                       | Disabled for now |                                              |                                    |
| Dapp Out                     | 7                       | Disabled for now |                                              |                                    |

The following points should be considered:

* We will reserve the first 2500 values (up to 25 different transaction types) for default transactions shipped with the SDK.
* The transactions which are currently disabled will not be assigned any values.

## Backward Compatibility

The LIP provides specific guidelines for the implementation of certain changes in the Lisk protocol. However, it does not imply any change in the Lisk protocol per se. Hence, the activation of this proposal is totally backward compatible.
