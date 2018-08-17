```
LIP: LIP-ikeralus-uniformity
Title: Uniform ordering of delegates list
Authors: Iker Alustiza, iker@lightcurve.io
Status: Draft
Type: Standards Track
Module: Delegates
Created: -
Updated: -
```

## Abstract

This LIP addresses the current delegate list uniformity issues and proposes a way to order uniformly the delegates list based on hashing each delegate’s unique identifier together with a unique identifier for the round.

## Copyright

This LIP is licensed under the  [GNU General Public License, version 3](http://www.gnu.org/licenses/gpl-3.0.html "GNU General Public License, version 3").

## Motivation

Currently, there is a bug in how the order of delegates is generated for the delegates’ list every round. This is implemented in the `Delegates.prototype.generateDelegateList` function (see the line 399 at [./modules/delegates.js](https://github.com/LiskHQ/lisk/blob/832c565c641c8a7436c9c164e21a35641096de93/modules/delegates.js#L399)). Below this paragraph you can find the lines of code which generate the delegate list every round:

```
var seedSource = modules.rounds.calc(height).toString();
var currentSeed = crypto.createHash('sha256').update(seedSource, 'utf8').digest();

for (var i = 0, delCount = truncDelegateList.length; i < delCount; i++) {
	for (var x = 0; x < 4 && i < delCount; i++, x++) {
		var newIndex = currentSeed[x] % delCount;
		var b = truncDelegateList[newIndex];
		truncDelegateList[newIndex] = truncDelegateList[i];
		truncDelegateList[i] = b;
	}
	currentSeed = crypto.createHash('sha256').update(currentSeed).digest();
}
```

This code snippet contains two unrelated issues, either of which is sufficient to introduce the generation of non-uniform lists of delegates:

1. The third and fourth lines of code contain two `for` loops that increment the variable `i` twice, every 5th time (in the inner and outer loop). This means that the shuffling logic is skipped for every 5th delegate.

2. The line of code after the second `for` loop calculates the new index for the current delegate. It takes what can be assumed to be a uniformly distributed random number between 0 and 255 (`currentSeed[x]`) and calculates the mod101 of it (_delCount = 101_). This implies that some indices are more probable than others. This happens because, for example:

_0 mod 101 = 101 mod 101 = 202 mod 101 = 0_

but,

_100 mod 101 = 201 mod 101 = 100_

Therefore, delegates in positions from 1 to 54 are 50% more likely to be chosen in the loop process than the others.

Consider the worst affected cases caused by the two issues mentioned above:

1. Being a delegate in the 5th position, 10th position, 15th position... until 55 i.e. [4, 9, ..., 54].
2. Being a delegate in the 60th position, 65th position, 70th position... until 101 i.e. [59, 64,..., 99].

Let’s assume the vote weighting **does not change** between rounds, which is the worst case scenario.

For case 1, taking for example _delegate[4]_:

Knowing that the probability of _delegate[4]_ being swapped by _delegate[0]_ (during the first loop) is 3/253, we have that:

The probability of _delegate[4]_ not being swapped by any of the looped delegates (82 loops) is 0.38. In other words, the _delegate[4]_ will change its position 61.9% of the rounds. Same for the rest of the delegates considered in this case since we assumed a uniform distribution in the hash generated.

For case 2, taking for example _delegate[99]_:

Knowing that the probability of _delegate[99]_ being swapped by _delegate[0]_ (during the first loop) is 2/253, we have that:

The probability of _delegate[99]_ not being swapped by any of the looped delegates (82 loops) is 0.526. In other words, the _delegate[99]_ will change its position 47.4% of the rounds. Same for the rest of the delegates considered in this case since we assumed a uniform distribution in the hash generated.
So given the current situation, it is noticeable when a delegate is one of these in the case 2, and it may likely not change its position in 2 or more rounds.

## Rationale

Given the study of the issue presented in the previous section, this LIP proposes a solution which will ensure that every delegate's position in the list is recalculated every round, and the probability for a delegate to end up in any position is the same for the whole set of possible positions.

The fix is based on hashing each delegate’s unique identifier together with a unique identifier for the round:

- The delegate's unique identifier can be the public key or the ID of the delegate. Arguably, it is better to use the public key since the ID system is likely to be changed in the future. However, this is something to be discussed for the reference implementation. Both options are equal in terms of generating randomness.
- The round's unique identifier can be the height of the block in which the new round starts or the height of the round itself. As an example, it can be calculated in the same way it is calculated currently, using the height of the round:

	```
	modules.rounds.calc(height).toString();
	```

By having a unique hash per delegate for every round, we will ensure that in every round the list of delegates will be re-ordered based on a uniform distribution.

## Specification

The changes will only affect the `Delegates.prototype.generateDelegateList` function mentioned above. These changes consist of removing the nested `for` loops and generating a new list of “delegate hashes” to be re-calculated and ordered every round. In particular, the proposed fix implements a new algorithm that goes as follows:

1. The variable seedSource is generated in the same way as now:

	```
	var seedSource = modules.rounds.calc(height).toString();
	```

2. Generate one hash per delegate using seedSource and the delegate public key (or ID). For simplicity, we propose to use the hashing function already utilised in existing code, although the final choice here is left to the reference implementation. Example in pseudo-code:

	```
	forEach delegate
		delegate.pubKeyHash = createHash(seedSource + delegate.publicKey)
	```

3. Reorder the delegates according to the hashes generated in step 2. This can be done according to any criteria (in an ascending order, for example) a long as the list is sorted in a deterministic and consistent way. Hence, the sorting algorithm must be [stable](https://en.wikipedia.org/wiki/Sorting_algorithm#Stability) to generate the same list of delegates in every node of the network even in the unlikely event of a hash collision in the second point. As an example, the `sort()` method in Javascript can be used for this purpose.

This will not only fix the uniformity issue (caused by the two issues raised in the _Motivation_ Section) but reduce the complexity, allowing simpler, more human-readable code in implementations.

## Backwards Compatibility

This change will cause a hard fork. Nodes implementing this fix will generate a different delegate list every round than the previous version, therefore every node will need to be in the version with the fix to maintain consensus.

Additionally, the current algorithm will need to be maintained for syncing/validation of blocks before this proposal is implemented.

## Reference Implementation

TBD
