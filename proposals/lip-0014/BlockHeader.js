"use strict";

/*
 * Basic class containing only the blockheader fields relevant
 * for the Lisk-BFT consensus algorithm.
 */
class BlockHeader {
  constructor(
    blockID,
    height,
    maxHeightPreviouslyForged,
    maxHeightPrevoted,
    heightSinceActive,
    delegatePubKey
  ) {
    // Hash of the blockheader
    this.blockID = blockID;
    // Height of the block
    this.height = height;
    // Largest height at which delegate previously forged a block, see LIP/paper
    this.maxHeightPreviouslyForged = maxHeightPreviouslyForged;
    // Largest height of a block in the current chain (up to the predecessor of this block) that has at least 68 prevotes
    this.maxHeightPrevoted = maxHeightPrevoted;
    // Height since when the delegate has been continuously active,
    // i.e., the first block of that round since when the delegate is continuosly active
    // note that this information is typically obtained from a separate data structure
    // and only put here for convenience
    this.heightSinceActive = heightSinceActive;
    // Public key of delegate forging the block
    this.delegatePubKey = delegatePubKey;
  }
}

module.exports = BlockHeader;
