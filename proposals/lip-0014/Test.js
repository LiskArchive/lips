"use strict";

const BlockHeader = require('./BlockHeader.js')
const LiskBFT = require('./LiskBFT.js')

function runAllTests() {
  const t1 = test1_basic();
  const t2 = test2_headersContradicting();
  const t3 = test3_exampleEos();
  const t4 = test4_addBlockheader();
  const t5 = test5_removeBlockheader();
  const t6 = test6_changeActiveDelegates();
  const t = t1 && t2 && t3 && t4 && t5 && t6;
  if (t) {
    console.log("All tests passed.");
  } else {
    console.log("Tests failed.");
  }
}
runAllTests();

function test1_basic() {
  let test1Passed = true;
  const bft = new LiskBFT();
  const maxHeight = 500;
  for (let h = 0; h <= maxHeight; h++) {
    let b = new BlockHeader(h, h, h - 101, Math.max(h - 68, 0), 0, h % 101);
    bft.addBlockheader(b);
  }
  for (let i = 1; i <= 101; i++) {
    if (bft.prevotes.get(maxHeight - i + 1) != i) {
      console.log(
        "Test 1.1 failed: incorrect number of prevotes at height ",
        maxHeight - i + 1
      );
      test1Passed = false;
    }
  }
  for (let i = 0; i <= maxHeight - 100; i++) {
    if (bft.prevotes.get(i) != 101) {
      console.log(
        "Test 1.2 failed: incorrect number of prevotes at height ",
        i
      );
      test1Passed = false;
    }
  }
  for (let i = maxHeight - 67; i <= maxHeight; i++) {
    if (bft.precommits.get(i) != 0) {
      console.log(
        "Test 1.3 failed: incorrect number of precommits at height ",
        i
      );
      test1Passed = false;
    }
  }
  for (let i = 0; i <= 100; i++) {
    if (maxHeight - i - 68 < 0) {
      break;
    } else if (bft.precommits.get(maxHeight - i - 68) != i + 1) {
      console.log(
        "Test 1.4 failed: incorrect number of precommits at height ",
        maxHeight - i - 68
      );
      test1Passed = false;
    }
  }
  for (let i = 0; i <= maxHeight - 168; i++) {
    if (bft.precommits.get(i) != 101) {
      console.log(
        "Test 1.5 failed: incorrect number of precommits at height ",
        i
      );
      test1Passed = false;
    }
  }
  if (bft.getHeightFinalized() != Math.max(maxHeight - 135)) {
    console.log(
      "Test 1.6 failed: incorrect height finalized, expected: ",
      Math.max(maxHeight - 135),
      " returned: ",
      bft.getHeightFinalized()
    );
    test1Passed = false;
  }
  const bft2 = new LiskBFT();
  for (let h = 0; h <= 400; h++) {
    // constructor(blockID, height,heightPrevious,heightPrevoted,heightSinceActive,delegatePubKey) {
    let b = new BlockHeader(h, h, h - 100, Math.max(h - 68, 0), 0, h % 100);
    bft2.addBlockheader(b);
  }
  let b = new BlockHeader(401, 401, 0, 401 - 68, 0, 100);
  if (bft2.getHeightNotPrevoted(b) != 98) {
    console.log(
      "Test 1.6 failed: incorrect heightNotPrevoted. Returned: ",
      bft2.getHeightNotPrevoted(b),
      " Correct: 98"
    );
    test1Passed = false;
  }
  bft2.addBlockheader(b);
  for (let i = 0; i <= 98; i++) {
    if (bft2.precommits.get(i) != 100) {
      console.log(
        "Test 1.7 failed: incorrect number of precommits at height ",
        i
      );
      test1Passed = false;
      break;
    }
    if (bft2.prevotes.get(i) != 100) {
      console.log(
        "Test 1.8 failed: incorrect number of precommits at height ",
        i
      );
      test1Passed = false;
      break;
    }
  }
  for (let i = 99; i <= 333; i++) {
    if (bft2.precommits.get(i) != Math.min(334 - i, 101)) {
      console.log(
        "Test 1.9 failed: incorrect number of precommits at height ",
        i
      );
      test1Passed = false;
      break;
    }
  }
  for (let i = 334; i <= 401; i++) {
    if (bft2.precommits.get(i) != 0) {
      console.log(
        "Test 1.10 failed: incorrect number of precommits at height ",
        i
      );
      test1Passed = false;
      break;
    }
  }
  for (let i = 99; i <= 401; i++) {
    if (bft2.prevotes.get(i) != Math.min(402 - i, 101)) {
      console.log(
        "Test 1.11 failed: incorrect number of precommits at height ",
        i
      );
      test1Passed = false;
      break;
    }
  }
  return test1Passed;
}

function test2_headersContradicting() {
  let test2Passed = true;
  let b1 = new BlockHeader(1, 1, 0, 3, 0, 1);
  let b2 = new BlockHeader(1, 1, 0, 3, 0, 1);
  const bft = new LiskBFT();
  b1.blockID = 42;
  b2.blockID = 42;
  if (
    bft.checkHeadersContradicting(b1, b2) ||
    bft.checkHeadersContradicting(b2, b1)
  ) {
    console.log("Test 2.1 failed: same blockheaders so are not confliciting");
    test2Passed = false;
  }
  b1.delegatePubKey = 1;
  b1.blockID = 1;
  b2.delegatePubKey = 2;
  b2.blockID = 2;
  if (
    bft.checkHeadersContradicting(b1, b2) ||
    bft.checkHeadersContradicting(b2, b1)
  ) {
    console.log(
      "Test 2.2 failed: blocks by different delegats are never contradicting"
    );
    test2Passed = false;
  }
  b1.delegatePubKey = 1;
  b1.blockID = 1;
  b1.height = 5;
  b1.heightPrevoted = 0;
  b1.heightPrevious = 0;
  b2.delegatePubKey = 1;
  b2.blockID = 2;
  b2.height = 5;
  b2.heightPrevoted = 0;
  b2.heightPrevious = 0;
  if (
    !bft.checkHeadersContradicting(b1, b2) ||
    !bft.checkHeadersContradicting(b2, b1)
  ) {
    console.log(
      "Test 2.3 failed: two different blocks by the same delegate at the same height and heightPrevoted are contradicting"
    );
    test2Passed = false;
  }
  b1.delegatePubKey = 1;
  b1.blockID = 1;
  b1.height = 5;
  b1.heightPrevoted = 0;
  b1.heightPrevious = 0;
  b2.delegatePubKey = 1;
  b2.blockID = 2;
  b2.height = 6;
  b2.heightPrevoted = 0;
  b2.heightPrevious = 0;
  if (
    !bft.checkHeadersContradicting(b1, b2) ||
    !bft.checkHeadersContradicting(b2, b1)
  ) {
    console.log(
      "Test 2.4 failed: blocks are contradicting due to wrong heightPrevious"
    );
    test2Passed = false;
  }
  b1.delegatePubKey = 1;
  b1.blockID = 1;
  b1.height = 5;
  b1.heightPrevoted = 0;
  b1.heightPrevious = 0;
  b2.delegatePubKey = 1;
  b2.blockID = 2;
  b2.height = 5;
  b2.heightPrevoted = 1;
  b2.heightPrevious = 5;
  if (
    bft.checkHeadersContradicting(b1, b2) ||
    bft.checkHeadersContradicting(b2, b1)
  ) {
    console.log(
      "Test 2.5 failed: blocks not contradicting as heightPrevoted increased"
    );
    test2Passed = false;
  }
  b1.delegatePubKey = 1;
  b1.blockID = 1;
  b1.height = 5;
  b1.heightPrevoted = 0;
  b1.heightPrevious = 51;
  b2.delegatePubKey = 1;
  b2.blockID = 2;
  b2.height = 32;
  b2.heightPrevoted = 0;
  b2.heightPrevious = 50;
  if (
    !bft.checkHeadersContradicting(b1, b2) ||
    !bft.checkHeadersContradicting(b2, b1)
  ) {
    console.log("Test 2.6 failed: block contains wrong heightPrevious");
    test2Passed = false;
  }
  b1.delegatePubKey = 1;
  b1.blockID = 1;
  b1.height = 75;
  b1.heightPrevoted = 34;
  b1.heightPrevious = 51;
  b2.delegatePubKey = 1;
  b2.blockID = 2;
  b2.height = 135;
  b2.heightPrevoted = 33;
  b2.heightPrevious = 75;
  if (
    !bft.checkHeadersContradicting(b1, b2) ||
    !bft.checkHeadersContradicting(b2, b1)
  ) {
    console.log("Test 2.7 failed: blocks show violation of fork choice rule");
    test2Passed = false;
  }
  b1.delegatePubKey = 1;
  b1.blockID = 1;
  b1.height = 75;
  b1.heightPrevoted = 34;
  b1.heightPrevious = 51;
  b2.delegatePubKey = 1;
  b2.blockID = 2;
  b2.height = 135;
  b2.heightPrevoted = 34;
  b2.heightPrevious = 75;
  if (
    bft.checkHeadersContradicting(b1, b2) ||
    bft.checkHeadersContradicting(b2, b1)
  ) {
    console.log("Test 2.8 failed: no conflict between blockheaders");
    test2Passed = false;
  }
  b1.delegatePubKey = 1;
  b1.blockID = 1;
  b1.height = 75;
  b1.heightPrevoted = 34;
  b1.heightPrevious = 75;
  b2.delegatePubKey = 1;
  b2.blockID = 2;
  b2.height = 135;
  b2.heightPrevoted = 34;
  b2.heightPrevious = 75;
  if (
    bft.checkHeadersContradicting(b1, b2) ||
    bft.checkHeadersContradicting(b2, b1)
  ) {
    console.log("Test 2.9: no conflict between blockheaders");
    test2Passed = false;
  }
  b1.delegatePubKey = 1;
  b1.blockID = 1;
  b1.height = 75;
  b1.heightPrevoted = 34;
  b1.heightPrevious = 80;
  b2.delegatePubKey = 1;
  b2.blockID = 2;
  b2.height = 135;
  b2.heightPrevoted = 34;
  b2.heightPrevious = 80;
  if (
    bft.checkHeadersContradicting(b1, b2) ||
    bft.checkHeadersContradicting(b2, b1)
  ) {
    console.log("Test 2.10: no conflict between blockheaders");
    test2Passed = false;
  }
  return test2Passed;
}

function test3_exampleEos() {
  let test3Passed = true;

  const numRounds = 4;
  const numDelegates = 4;
  const threshold = Math.floor((2 / 3) * numDelegates) + 1;
  const bft = new LiskBFT();
  bft.PREVOTE_THRESHOLD = threshold;
  bft.PRECOMMIT_THRESHOLD = threshold;
  let b = {};
  b[1] = new BlockHeader(1, 1, 0, 0, 0, "A");
  b[2] = new BlockHeader(2, 2, 0, 0, 0, "B");
  b[3] = new BlockHeader(3, 3, 0, 0, 0, "C");
  b[4] = new BlockHeader(4, 4, 3, 1, 0, "C");
  b[5] = new BlockHeader(5, 5, 3, 1, 0, "B");
  b[6] = new BlockHeader(6, 6, 4, 1, 0, "C");
  b[7] = new BlockHeader(7, 7, 5, 1, 0, "A");
  b[8] = new BlockHeader(8, 8, 5, 1, 0, "B");
  for (let i = 1; i <= 8; i++) {
    bft.addBlockheader(b[i]);
  }

  const correctPrevotes1 = [0, 3, 2, 1, 2, 2, 3, 2, 1];
  const correctPrecommits1 = [0, 1, 0, 0, 0, 0, 0, 0, 0];
  const correctHeightFinalized1 = 0;
  if (bft.getHeightFinalized() != correctHeightFinalized1) {
    console.log("Test 3.1 failed: incorrect chainHeightFinalized");
    test3Passed = false;
  }
  for (let i = 1; i <= 8; i++) {
    if (bft.prevotes.get(i) != correctPrevotes1[i]) {
      console.log(
        "Test 3.2 failed: incorrect number of Prevotes at height ",
        i
      );
      test3Passed = false;
    }
    if (bft.precommits.get(i) != correctPrecommits1[i]) {
      console.log(
        "Test 3.3 failed: incorrect number of Precommits at height ",
        i
      );
      test3Passed = false;
    }
  }
  bft.removeBlockheadersToHeight(0);

  b = {};
  b[1] = new BlockHeader(1, 1, 0, 0, 0, "D");
  b[2] = new BlockHeader(2, 2, 1, 0, 0, "A");
  b[3] = new BlockHeader(3, 3, 2, 0, 0, "B");
  b[4] = new BlockHeader(4, 4, 1, 0, 0, "D");
  b[5] = new BlockHeader(5, 5, 2, 0, 0, "A");
  b[6] = new BlockHeader(6, 6, 4, 3, 0, "D");
  b[7] = new BlockHeader(7, 7, 6, 3, 0, "C");
  b[8] = new BlockHeader(8, 8, 6, 3, 0, "D");
  for (let i = 1; i <= 8; i++) {
    bft.addBlockheader(b[i]);
  }

  const correctPrevotes2 = [0, 1, 2, 3, 2, 2, 1, 2, 1];
  const correctPrecommits2 = [0, 0, 0, 1, 0, 0, 0, 0, 0];
  const correctHeightFinalized2 = 0;
  if (bft.getHeightFinalized() != correctHeightFinalized1) {
    console.log("Test 3.4 failed: incorrect chainHeightFinalized");
    test3Passed = false;
  }
  for (let i = 1; i <= 8; i++) {
    if (bft.prevotes.get(i) != correctPrevotes2[i]) {
      console.log(
        "Test 3.5 failed: incorrect number of Prevotes at height ",
        i
      );
      test3Passed = false;
    }
    if (bft.precommits.get(i) != correctPrecommits2[i]) {
      console.log(
        "Test 3.6 failed: incorrect number of Precommits at height ",
        i
      );
      test3Passed = false;
    }
  }
  return test3Passed;
}

function test4_addBlockheader() {
  let test4Passed = true;

  const bft = new LiskBFT();
  const startHeight = 900;
  const maxNumBlocks = 1000;
  const hMax = startHeight + maxNumBlocks;

  let b = {};
  for (let h = startHeight; h <= hMax; h++) {
    b[h] = new BlockHeader(h, h, h - 101, Math.max(h - 68, 0), 0, h % 101);
  }
  for (let h = startHeight; h <= startHeight + 237; h++) {
    bft.addBlockheader(b[h]);
  }
  try {
    bft.addBlockheader(b[startHeight + 237]);
    test4Passed = false;
    console.log("Test 4.1 failed: accepted block with invalid height.");
  } catch (e) {}
  for (let h = startHeight + 238; h <= startHeight + 301; h++) {
    bft.addBlockheader(b[h]);
  }
  let h1 = startHeight + 302;
  let h2 = startHeight + 303;
  // Invalid heightPrevoted not detected if <=302 headers
  try {
    b[h1] = new BlockHeader(h1, h1, h1 - 101, h1 - 100, 0, h1 % 101);
    bft.addBlockheader(b[h1]);
  } catch (e) {
    console.log(
      "Test 4.2 failed: rejected block due to heightPrevoted although only <=302 headers stored."
    );
  }
  // Invalid heightPrevoted must be detected if >=303 headers
  b[h2] = new BlockHeader(h2, h2, h2 - 101, Math.max(h2 - 65, 0), 0, h2 % 101);
  try {
    bft.addBlockheader(b[h2]);
    test4Passed = false;
    console.log("Test 4.3 failed: accepted block with invalid heightPrevoted.");
  } catch (e) {}
  bft.removeBlockheadersToHeight(h2 - 1);
  b[h2] = new BlockHeader(h2, h2, h2 - 102, Math.max(h2 - 68, 0), 0, h2 % 101);
  try {
    bft.addBlockheader(b[h2]);
    test4Passed = false;
    console.log("Test 4.4 failed: accepted block with invalid heightPrevious.");
  } catch (e) {}
  b[h2] = new BlockHeader(h2, h2, h2 - 101, Math.max(h2 - 68, 0), 0, h2 % 101);
  try {
    bft.removeBlockheadersToHeight(h2 - 1);
    bft.addBlockheader(b[h2]);
  } catch (e) {
    test4Passed = false;
    console.log("Test 4.5 failed: heightPrevoted false after removing blocks.");
  }
  let h3 = startHeight + 538;
  for (let h = h2 + 1; h <= h3; h++) {
    bft.addBlockheader(b[h]);
  }
  let curHeightFinalized = h3 - 67 - 68;
  if (bft.getHeightFinalized() != curHeightFinalized) {
    test4Passed = false;
    console.log(
      "Test 4.6 failed: heightFinalized incorrect. Expected: ",
      curHeightFinalized,
      " Returned: ",
      bft.getHeightFinalized()
    );
  }
  for (let h = h3 + 1; h <= hMax; h++) {
    b[h].heightPrevious = h - 100;
    bft.addBlockheader(b[h]);
  }
  if (bft.getHeightFinalized() != curHeightFinalized) {
    test4Passed = false;
    console.log(
      "Test 4.7 failed: heightFinalized incorrect. Expected: ",
      curHeightFinalized,
      " Returned: ",
      bft.getHeightFinalized()
    );
  }
  bft.removeBlockheadersToHeight(h3);
  let curHeightPrevoted = h3 - 68;
  if (bft.getHeightPrevoted() != curHeightPrevoted) {
    test4Passed = false;
    console.log(
      "Test 4.8 failed: heightPrevoted incorrect. Expected: ",
      curHeightPrevoted,
      " Returned: ",
      bft.getHeightPrevoted()
    );
  }
  // No further commits as heightPrevious=height-67 so that all bloccks only get 67 Prevotes
  for (let h = h3 + 1; h <= hMax; h++) {
    b[h].heightPrevious = h - 67;
    b[h].heightPrevoted = curHeightPrevoted;
    bft.addBlockheader(b[h]);
  }
  if (bft.getHeightPrevoted() != curHeightPrevoted) {
    test4Passed = false;
    console.log(
      "Test 4.9 failed: heightPrevoted incorrect. Expected: ",
      curHeightPrevoted,
      " Returned: ",
      bft.getHeightPrevoted()
    );
  }
  // Removing last 202 blocks should not change heightPrevoted or heightFinalized as these blocks do not increase these values
  bft.removeBlockheadersToHeight(hMax - 202);
  if (
    bft.getHeightPrevoted() != curHeightPrevoted ||
    bft.getHeightFinalized() != curHeightFinalized
  ) {
    test4Passed = false;
    console.log(
      "Test 4.10 failed: heightPrevoted or heightFinalized incorrect."
    );
  }
  // Remove all blocks up to startHeight+maxNumBlocks-500,
  // then add blocks up to height maxNumBlocks-202 that do not imply any Prevote
  bft.removeBlockheadersToHeight(hMax - 500);
  curHeightPrevoted = hMax - 500 - 68;
  for (let h = hMax - 499; h <= hMax - 202; h++) {
    b[h].heightPrevious = h;
    b[h].heightPrevoted = curHeightPrevoted;
    bft.addBlockheader(b[h]);
  }
  for (let h = hMax - 201; h <= hMax - 201 + 66; h++) {
    try {
      b[h].heightPrevious = h - 68;
      b[h].heightPrevoted = curHeightPrevoted;
      bft.addBlockheader(b[h]);
    } catch (e) {
      break;
    }
  }
  // After 67 additional blocks the heightPrevoted has not increased
  if (
    bft.getHeightPrevoted() != curHeightPrevoted ||
    bft.getHeightFinalized() != curHeightFinalized
  ) {
    test4Passed = false;
    console.log(
      "Test 4.11 failed: heightPrevoted or heightFinalized incorrect.",
      bft.getHeightPrevoted(),
      curHeightPrevoted,
      bft.getHeightFinalized(),
      curHeightFinalized
    );
  }
  // Add block 68 to current chain, no the heightPrevoted must increase
  let h4 = hMax - 201 + 67;
  b[h4].heightPrevious = h4 - 68;
  b[h4].heightPrevoted = curHeightPrevoted;
  bft.addBlockheader(b[h4]);
  if (
    bft.getHeightPrevoted() != h4 - 67 ||
    bft.getHeightFinalized() != curHeightFinalized
  ) {
    test4Passed = false;
    console.log(
      "Test 4.12 failed: heightPrevoted or heightFinalized incorrect.",
      bft.getHeightPrevoted(),
      h2 - 68,
      bft.getHeightFinalized(),
      curHeightFinalized
    );
  }
  // Add all blocks up to startHeight + maxNumBlocks
  for (let h = h4 + 1; h <= hMax; h++) {
    try {
      b[h].heightPrevious = h - 68;
      b[h].heightPrevoted = h - 68;
      bft.addBlockheader(b[h]);
    } catch (e) {
      console.log(e);
      break;
    }
  }
  if (
    bft.getHeightPrevoted() != hMax - 67 ||
    bft.getHeightFinalized() != curHeightFinalized
  ) {
    test4Passed = false;
    console.log(
      "Test 4.13 failed: heightPrevoted or heightFinalized incorrect."
    );
  }
  return test4Passed;
}

function test5_removeBlockheader() {
  let test5Passed = true;
  const bft = new LiskBFT();

  const startHeight = 500;
  const maxHeight = startHeight + 1000;
  let b = {};
  for (let h = startHeight; h <= maxHeight; h++) {
    b[h] = new BlockHeader(h, h, h - 101, Math.max(h - 68, 0), 0, h % 101);
    bft.addBlockheader(b[h]);
  }
  let tempHeightPrevoted = bft.getHeightPrevoted();
  let tempHeightFinalized = bft.getHeightFinalized();
  bft.clearAllHeaders();
  for (let h = startHeight + 300; h <= maxHeight; h++) {
    bft.addBlockheader(b[h]);
  }
  bft.removeBlockheadersToHeight(-1);
  bft.removeBlockheadersToHeight(100);

  for (let h = startHeight + 500; h <= maxHeight - 2; h++) {
    bft.addBlockheader(b[h]);
  }
  bft.removeBlockheadersToHeight(10000);
  bft.addBlockheader(b[maxHeight - 1]);
  bft.addBlockheader(b[maxHeight]);
  if (
    tempHeightPrevoted != bft.getHeightPrevoted() ||
    tempHeightFinalized != bft.getHeightFinalized()
  ) {
    test5Passed = false;
    console.log(
      "Test 5.1 failed: heightPrevoted or heightFinalized incorrect."
    );
  }
  return test5Passed;
}

function test6_changeActiveDelegates() {
  let b = {};
  const bft = new LiskBFT();
  let test6Passed = true;
  for (let h = 0; h < 101; h++) {
    b[h] = new BlockHeader(h, h, -1, 0, 0, h % 101);
    bft.addBlockheader(b[h]);
  }
  if (bft.getHeightPrevoted() != 100 - 67) {
    console.log("Test 6.1 failed: incorrect heightPrevoted");
    test6Passed = false;
  }
  // All block proposers change from heigh 101 onwards
  for (let h = 101; h < 202; h++) {
    b[h] = new BlockHeader(h, h, -1, 0, 101, (h % 101) + 101);
    bft.addBlockheader(b[h]);
  }
  if (bft.getHeightPrevoted() != 201 - 67) {
    console.log("Test 6.2 failed: incorrect heightPrevoted");
    test6Passed = false;
  }
  // All block proposers change from height 202 onwards
  for (let h = 202; h < 303; h++) {
    b[h] = new BlockHeader(h, h, -1, 0, 202, (h % 101) + 202);
    bft.addBlockheader(b[h]);
  }
  if (bft.getHeightPrevoted() != 302 - 67) {
    console.log("Test 6.3 failed: incorrect heightPrevoted");
    test6Passed = false;
  }
  for (let i = 1; i <= 3; i++) {
    for (let h = 0; h < 101; h++) {
      if (bft.prevotes.get(i * 101 - 1 - h) != h + 1) {
        console.log(
          "Test 6.4 failed: incorrect numer of prevotes, expected:",
          h,
          " returned: ",
          bft.prevotes.get(i * 101 - 1 - h)
        );
        test6Passed = false;
        break;
      }
    }
  }

  bft.clearAllHeaders();
  for (let h = 0; h < 303; h++) {
    b[h] = new BlockHeader(h, h, h - 101, 0, 0, h % 101);
  }
  // 33 block proposers change from heigh 101 onwards
  for (let h = 101; h < 202; h = h + 3) {
    b[h] = new BlockHeader(h, h, 55, 0, 101, (h % 101) + 101);
  }
  // 33 block proposers change from heigh 101 onwards
  for (let h = 202; h < 303; h = h + 3) {
    b[h] = new BlockHeader(h, h, 55, 0, 202, (h % 101) + 202);
  }
  for (let h = 0; h < 303; h++) {
    bft.addBlockheader(b[h]);
  }
  for (let i = 1; i <= 2; i++) {
    for (let j = 1; j <= 101; j++) {
      if (bft.prevotes.get(i * 101 - j) != 67 + Math.floor((j + 1) / 3)) {
        console.log(
          "Test 6.5 failed: incorrect numer of prevotes at height ",
          i * 101 - j,
          ", expected:",
          67 + Math.floor((j + 2) / 3),
          " returned: ",
          bft.prevotes.get(i * 101 - j)
        );
        test6Passed = false;
        break;
      }
    }
  }
  return test6Passed;
}
