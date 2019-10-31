"use strict";

const BlockHeader = require('./BlockHeader.js')
const LiskBFT = require('./LiskBFT.js')

function examplesUsage() {
  const bft = new LiskBFT();
  // Create 1801 blockheaders
  let b1 = {};
  for (let h = 0; h <= 1800; h++) {
    b1[h] = new BlockHeader(h, h, Math.max(h - 101,0), Math.max(h - 68, 0), 0, h % 101);
  }

  // 901 blockheaders are added to current chain
  let h1 = 901;
  for (let h = 0; h < h1; h++) {
    bft.addBlockheader(b1[h]);
  }

  // Example 1: Workflow when adding headers to BFT class and this class already contains at least 303 headers
  if (
    b1[h1].height == bft.getMaxHeightStored() + 1 &&
    b1[h1].maxHeightPrevoted == bft.getChainMaxHeightPrevoted() &&
    !bft.checkHeaderContradictingChain(b1[h1])
  ) {
    bft.addBlockheader(b1[h1]);
  } else {
    console.error("Error. Header cannot be added to chain.");
  }

  // Example 2: Workflow when removing at most 202 headers to move to a different chain
  // and at the same time at least 303 headers are still stored in the BFT class
  let lastCommonHeight = 781;
  let b2 = {}; // Alternative chain
  for (let h = lastCommonHeight + 1; h <= 1100; h++) {
    b2[h] = new BlockHeader(h, h, h - 78, Math.max(h - 68, 0), 0, h % 101);
  }

  if (bft.getChainMaxHeightFinalized() > lastCommonHeight) {
    console.error("Error. Cannot revert finalized block.");
  } else {
    if (
      bft.getMaxHeightStored() - lastCommonHeight > 202 ||
      lastCommonHeight - bft.getMinHeightStored() < 302
    ) {
    // Need so trigger sync, see Example 3 below
    } else {
      bft.removeBlockheadersToHeight(lastCommonHeight);
      for (let h = lastCommonHeight + 1; h <= 1100; h++) {
        if (
          b2[h].height == bft.getMaxHeightStored() + 1 &&
          b2[h].maxHeightPrevoted == bft.getChainMaxHeightPrevoted() &&
          !bft.checkHeaderContradictingChain(b2[h])
        ) {
          bft.addBlockheader(b2[h]);
        } else {
          console.error("Error. Header cannot be added to chain.");
        }
      }
    }
  }

  // Example 3: Workflow when removing more than 202 headers to move to chain b1 or after
  if (bft.getChainMaxHeightFinalized() > lastCommonHeight) {
    console.error("Error. Cannot revert finalized block.");
  } else {
    if (
      bft.getMaxHeightStored() - lastCommonHeight > 202 ||
      lastCommonHeight - bft.getMinHeightStored() < 302
    ) {
      bft.clearAllHeaders();
      let hStart = lastCommonHeight - 302;
      // Add 303 already verified blockheaders to chain to be able to compute correctHeightPrevoted
      for (let h = hStart; h <= lastCommonHeight; h++) {
        // No verication, as blockheaders previously added to the chain and therefore already verified
        bft.addBlockheader(b1[h]);
      }
      // Continue with new (unverified headers in b1)
      for (let h = lastCommonHeight + 1; h <= 1400; h++) {
        if (
          b1[h].height == bft.getMaxHeightStored() + 1 &&
          b1[h].maxHeightPrevoted == bft.getChainMaxHeightPrevoted() &&
          !bft.checkHeaderContradictingChain(b1[h])
        ) {
          bft.addBlockheader(b1[h]);
        } else {
          console.error("Error. Header cannot be added to chain.");
        }
      }
    } else {
      // Does not occur here, see above
    }
  }
}

examplesUsage();
