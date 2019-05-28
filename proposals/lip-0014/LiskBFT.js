"use strict";

const BlockHeader = require("./BlockHeader.js");
/*
 * This class stores the last MAX_HEADERS blockheaders of the current chain and is used for the following:
 * - Update the Prevote and Precommit counts for these blocks according to the Lisk-BFT consensus
 * - Update up to which height all blocks are finalized
 * - Update the current value of heightPrevoted in order to check this value for new blocks
 * - Check if a blockheader is contradicting one of the last blockheaders
 */
class LiskBFT {
  constructor() {
    // Largest height of a block in the current chain that has at least 68 prevotes
    this.chainHeightPrevoted = 0;
    // Height up to which all blocks are finalized
    this.chainHeightFinalized = 0;
    // Only the blockheaders in the range [minHeightStored, ..., maxHeightStored] are stored in blockheaders
    // the total number is bounded by MAX_HEADERS
    this.minHeightStored = -1;
    this.maxHeightStored = -1;
    this.MAX_HEADERS = 505;
    // Any Prevote or Precommit implied by a block at height h, must be for a block at height >= h-HEIGHT_OFFSET_PREVOTES_PRECOMMITS
    this.HEIGHT_OFFSET_PREVOTES_PRECOMMITS = 302;
    this.blockheaders = new Map();
    // For every blockheader at height i, prevotes.get(i) stores the current number of Prevotes for that blockheader
    this.prevotes = new Map();
    // For every blockheader at height i, precommits.get(i) stores the current number of Precommits for that blockheader
    this.precommits = new Map();
    // For every delegatePubKey, this map stores the largest height of a previous Precommit
    this.delegatePubKeyToHeightPrecommit = new Map();
    // Constant for the number of Prevotes needed to Precommit for a block (>2/3)
    this.PREVOTE_THRESHOLD = 68;
    // Constant for the number of Prevotes needed to finalize a block (>2/3)
    this.PRECOMMIT_THRESHOLD = 68;
  }

  /**
   * Adds the Prevotes and Precommits implied by the newBlockheader to the maps counting these votes for
   * every height. The details are specified in the related LIP/paper.
   *
   * @param  newBlockheader  instance of Blockheader for which to add the implied Prevotes and Precommits
   */
  applyPrevotesPrecommits(newBlockheader) {
    // In this case the blockheader does not imply any Prevote or Precommit
    if (newBlockheader.heightPrevious >= newBlockheader.height) {
      return;
    }
    const largestHeightPrecommit = this.delegatePubKeyToHeightPrecommit.get(
      newBlockheader.delegatePubKey
    );
    // Add implied Precommits by newBlockheader. Note that the smallest height of a Precommit is
    // newBlockheader.height-HEIGHT_OFFSET_PREVOTES_PRECOMMITS as specified in the respective section in the LIP.
    const minPrecommitHeight = Math.max(
      this.getHeightNotPrevoted(newBlockheader) + 1,
      newBlockheader.heightSinceActive,
      largestHeightPrecommit + 1
    );
    const maxPrecommitHeight = newBlockheader.height - 1;
    let precommitted = false;
    for (let j = maxPrecommitHeight; j >= minPrecommitHeight; j--) {
      // Add Precommit if threshold is reached
      if (this.prevotes.get(j) >= this.PREVOTE_THRESHOLD) {
        this.precommits.set(j, this.precommits.get(j) + 1);
        // Store the largest j for which the delegate made a precommit
        if (!precommitted) {
          precommitted = true;
          this.delegatePubKeyToHeightPrecommit.set(
            newBlockheader.delegatePubKey,
            j
          );
        }
      }
    }
    // Add implied Prevotes by newBlockheader.  Note that the smallest height of a Prevote is
    // newBlockheader.height-HEIGHT_OFFSET_PREVOTES_PRECOMMITS as specified in the respective section in the LIP.
    const minPrevoteHeight = Math.max(
      this.minHeightStored,
      newBlockheader.heightPrevious + 1,
      newBlockheader.heightSinceActive,
      newBlockheader.height - this.HEIGHT_OFFSET_PREVOTES_PRECOMMITS
    );
    const maxPrevoteHeight = newBlockheader.height;
    for (let j = minPrevoteHeight; j <= maxPrevoteHeight; j++) {
      this.prevotes.set(j, this.prevotes.get(j) + 1);
    }
  }

  /**
   * Compute the largestHeight in [newBlockheader.height-HEIGHT_OFFSET_PREVOTES_PRECOMMITS, newBlockheader.height] for which delegate
   * corresponding to newBlockheader.delegatePubKey did NOT cast a prevote. If the delegate cast a prevote for all these heights,
   * then newBlockheader-HEIGHT_OFFSET_PREVOTES_PRECOMMITS-1 is returned. Note that only headers up to this.minHeightStored
   * are considered, so this assumes newBlockheader.height-HEIGHT_OFFSET_PREVOTES_PRECOMMITS>=this.minHeightStored.
   *
   * @param  newBlockheader  instance of Blockheader determining delegate and heights considered,
   */
  getHeightNotPrevoted(newBlockheader) {
    const minHeightConsidered = Math.max(
      this.minHeightStored,
      newBlockheader.height - this.HEIGHT_OFFSET_PREVOTES_PRECOMMITS
    );
    let heightPreviousBlock = newBlockheader.heightPrevious;
    let h = Math.max(
      newBlockheader.heightPrevious,
      newBlockheader.height - this.HEIGHT_OFFSET_PREVOTES_PRECOMMITS
    );
    while (h >= minHeightConsidered) {
      // We need to ensure that the delegate forging newBlockheader did not forge on any other chain, i.e.,
      // previousHeight always refers to a height with a block forged by the same delegate.
      if (h == heightPreviousBlock) {
        if (
          this.blockheaders.get(h).delegatePubKey !=
            newBlockheader.delegatePubKey ||
          this.blockheaders.get(h).heightPrevious >= h
        ) {
          break;
        } else {
          heightPreviousBlock = this.blockheaders.get(h).heightPrevious;
        }
      }
      h--;
    }
    return h;
  }

  /**
   * Reset all Prevote and Precommit counts to 0 and recompute them from scratch using all blockheaders.
   */
  recomputePrevotesPrecommits() {
    this.delegatePubKeyToHeightPrecommit.clear();
    for (let i = this.minHeightStored; i <= this.maxHeightStored; i++) {
      this.prevotes.set(i, 0);
      this.precommits.set(i, 0);
      this.delegatePubKeyToHeightPrecommit.set(
        this.blockheaders.get(i).delegatePubKey,
        this.minHeightStored - 1
      );
    }
    for (let i = this.minHeightStored; i <= this.maxHeightStored; i++) {
      this.applyPrevotesPrecommits(this.blockheaders.get(i));
    }
    this.updateHeightPrevotedFinalized();
  }

  /**
   * Updates the values of heightPrevoted and chainHeightFinalized from the current Prevote and Precommit counts.
   */
  updateHeightPrevotedFinalized() {
    if (this.blockheaders.size == 0) {
      return;
    }
    // heightPrevoted is only ever decreased if blockheaders are deleted. The heightPrevoted of
    // the block at the tip of the chain has been verified and is used as start value.
    this.chainHeightPrevoted = this.blockheaders.get(
      this.maxHeightStored
    ).heightPrevoted;
    const minNewHeightPrevoted = Math.max(
      this.minHeightStored,
      this.chainHeightPrevoted
    );
    for (let i = this.maxHeightStored; i >= minNewHeightPrevoted; i--) {
      if (this.prevotes.get(i) >= this.PREVOTE_THRESHOLD) {
        this.chainHeightPrevoted = i;
        break;
      }
    }
    // chainHeightFinalized is NEVER decreased within this class
    const minNewHeightFinalized = Math.max(
      this.minHeightStored,
      this.chainHeightFinalized
    );
    for (let i = this.chainHeightPrevoted; i >= minNewHeightFinalized; i--) {
      if (this.precommits.get(i) >= this.PRECOMMIT_THRESHOLD) {
        this.chainHeightFinalized = i;
        break;
      }
    }
  }

  /**
   * Check whether blockheader b is contradicting any block at height [maxHeightStored-heightOffset, maxHeightStored].
   * If maxHeightStored-heightOffset<minHeightStored, only the blocks at heights [minHeightStored,maxHeightStored] are checked.
   *
   * @param  b  instance of BlockHeader
   * @param  heightOffset (optional) gives the height up to which to check the headers, default value HEIGHT_OFFSET_PREVOTES_PRECOMMITS
   * @return true if and only if b is contradicting any header at the specified heights
   */
  checkHeaderContradictingChain(
    b,
    heightOffset = this.HEIGHT_OFFSET_PREVOTES_PRECOMMITS
  ) {
    const minHeightCheck = Math.max(
      this.minHeightStored,
      this.maxHeightStored - heightOffset
    );
    const maxHeightCheck = this.maxHeightStored;
    for (let i = maxHeightCheck; i >= minHeightCheck; i--) {
      if (this.blockheaders.get(i).delegatePubKey == b.delegatePubKey) {
        if (this.checkHeadersContradicting(this.blockheaders.get(i), b)) {
          return true;
        } else {
					return false;
				}
      }
    }
    return false;
  }

  /**
   * Check whether blockheader1 and blockheader2 are contradicting according to the Lisk-BFT consensus rules.
   *
   * @param  blockheader1  instance of BlockHeader
   * @param  blockheader2  instance of BlockHeader
   * @return true if and only if blockheader1 and blockheader2 are contradicting
   */
  checkHeadersContradicting(blockheader1, blockheader2) {
    // Order the two blockheaders such that b1 must be forged first
    let b1 = blockheader1;
    let b2 = blockheader2;
    if (
      b1.heightPrevious > b2.heightPrevious ||
      (b1.heightPrevious == b2.heightPrevious &&
        b1.heightPrevoted > b2.heightPrevoted) ||
      (b1.heightPrevious == b2.heightPrevious &&
        b1.heightPrevoted == b2.heightPrevoted &&
        b1.height > b2.height)
    ) {
      b1 = blockheader2;
      b2 = blockheader1;
    }
    // Order of cases is essential here
    if (b1.delegatePubKey != b2.delegatePubKey) {
      // Blocks by different delegates are never contradicting
      return false;
    } else if (b1.blockID == b2.blockID) {
      // No contradiction, as blockheaders are the same
      return false;
    } else if (
      b1.heightPrevoted == b2.heightPrevoted &&
      b1.height >= b2.height
    ) {
      // Violation of the fork choice rule as delegate moved to different chain
      // without strictly larger heightPrevoted or larger height as justification.
      // This in particular happens, if a delegate is double forging.
      return true;
    } else if (b1.height > b2.heightPrevious) {
      // Violates disjointness condition
      return true;
    } else if (b1.heightPrevoted > b2.heightPrevoted) {
      // Violates that delegate chooses branch with largest heightPrevoted
      return true;
    } else {
      // No contradiction between blockheaders
      return false;
    }
  }

  /**
   * Deletes any delegatePubKey from this.delegatePubKeyToHeightPrecommit for which the corresponding delegate
   * has not forged any block currently stored. This ensures that this map does not become too large over time.
   */
  clearStalePubKeys() {
    const curDelegatePubKeys = new Set();
    for (let i = this.minHeightStored; i <= this.maxHeightStored; i++) {
      curDelegatePubKeys.add(this.blockheaders.delegatePubKey);
    }
    for (delegatePubKey in this.delegatePubKeyToHeightPrecommit) {
      if (!curDelegateIDs.has(delegatePubKey)) {
        this.delegatePubKeyToHeightPrecommit.delete(delegatePubKey);
      }
    }
  }

  /**
   * Get the largest height of a block with PRECOMMIT_THRESHOLD many Precommits, i.e., the height up to which all blocks are finalized.
   *
   * @return height up to which all blocks are finalized
   */
  getHeightFinalized() {
    return this.chainHeightFinalized;
  }

  /**
   * Get the largest height of a block with PREVOTE_THRESHOLD many Prevotes considering the stored blockheaders.
   * That that HEIGHT_OFFSET_PREVOTES_PRECOMMITS+1 blockheaders must be stored so that this value is guaranteed to be computed
   * correctly.
   *
   * @return heightPrevoted of current chain
   */
  getHeightPrevoted() {
    return this.chainHeightPrevoted;
  }

  /**
   * Obtain the minimum height of a blockheader that is currently stored.
   *
   * @return minimum height of a blockheader stored
   */
  getMinHeightStored() {
    return this.minHeightStored;
  }

  /**
   * Obtain the maximum height of a blockheader that is currently stored.
   *
   * @return maximum height of a blockheader stored
   */
  getMaxHeightStored() {
    return this.maxHeightStored;
  }

  /**
   * Append a blockheader to the current chain. The implied Prevotes and Precommits
   * are added to the map data structures counting the overall Prevotes and Precommits.
   * Moreover, the heightPrevoted and chainHeightFinalized of the current chain are updated.
   *
   * @param  newBlockheader  instance of BlockHeader satisfying b.height = this.maxHeightStored+1
   */
  addBlockheader(newBlockheader) {
    if (this.blockheaders.size == 0) {
      this.minHeightStored = newBlockheader.height;
      this.maxHeightStored = newBlockheader.height;
    } else {
      if (newBlockheader.height != this.maxHeightStored + 1) {
        throw new Error(
          "Error: Height of inserted blocks need to be montonously increasing by 1."
        );
      } else if (
        newBlockheader.heightPrevoted != this.chainHeightPrevoted &&
        this.maxHeightStored - this.minHeightStored >=
          this.HEIGHT_OFFSET_PREVOTES_PRECOMMITS
      ) {
        // Only if we have this.HEIGHT_OFFSET_PREVOTES_PRECOMMITS headers stored, we can guarantee that heightPrevoted is computed correctly
        throw new Error("Error: Wrong heightPrevoted in blockheader.");
      } else if (
        this.checkHeaderContradictingChain(
          newBlockheader,
          this.HEIGHT_OFFSET_PREVOTES_PRECOMMITS
        )
      ) {
        throw new Error("Error: Contradicting heightPrevious in blockheader.");
      }
      this.maxHeightStored += 1;

      if (this.blockheaders.size > this.MAX_HEADERS) {
        this.blockheaders.delete(this.minHeightStored);
        this.prevotes.delete(this.minHeightStored);
        this.precommits.delete(this.minHeightStored);
        this.minHeightStored += 1;
      }
      if (this.delegatePubKeyToHeightPrecommit.size > this.MAX_HEADERS) {
        this.clearStalePubKeys();
      }
    }
    this.prevotes.set(this.maxHeightStored, 0);
    this.precommits.set(this.maxHeightStored, 0);
    this.blockheaders.set(this.maxHeightStored, newBlockheader);
    if (
      !this.delegatePubKeyToHeightPrecommit.has(newBlockheader.delegatePubKey)
    ) {
      this.delegatePubKeyToHeightPrecommit.set(
        newBlockheader.delegatePubKey,
        this.minHeightStored - 1
      );
    }
    this.applyPrevotesPrecommits(newBlockheader);
    this.updateHeightPrevotedFinalized();
  }

  /**
   * Removes all stored blockheaders up to height h, i.e., all blockheaders in the range [h+1,...,maxHeightStored].
   * The Prevote and Precommit counts are updated afterwards together with the heightPrevoted of the current chain.
   *
   * @param  h  integer giving the height up to which to remove the blockheaders.
   */
  removeBlockheadersToHeight(h) {
    if (h >= this.maxHeightStored) {
      return;
    } else if (h >= this.minHeightStored) {
      for (let i = h + 1; i <= this.maxHeightStored; i++) {
        this.blockheaders.delete(i);
        this.prevotes.delete(i);
        this.precommits.delete(i);
      }
      this.maxHeightStored = h;
      this.recomputePrevotesPrecommits();
      this.updateHeightPrevotedFinalized();
    } else {
      this.blockheaders.clear();
      this.prevotes.clear();
      this.precommits.clear();
      this.delegatePubKeyToHeightPrecommit.clear();
      this.minHeightStored = -1;
      this.maxHeightStored = -1;
    }
  }

  /**
   * Removes all stored blockheaders and resets the corresponding data structures.
   */
  clearAllHeaders() {
    this.removeBlockheadersToHeight(this.minHeightStored - 1);
  }
}

module.exports = LiskBFT;
