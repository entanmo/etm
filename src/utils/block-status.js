/*
 * Copyright © 2018 EnTanMo Foundation
 *
 * See the LICENSE file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with the EnTanMo Foundation,
 * no part of this software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE file.
 *
 * Removal or modification of this copyright notice is prohibited.
 */

'use strict';

var constants = require('./constants.js');
var slots = require('./slots.js')

function BlockStatus() {
  var milestones = [
    600000000, // Initial Reward
    500000000, // Milestone 1
    400000000, // Milestone 2
    400000000, // Milestone 3
    300000000, // Milestone 4
    200000000  // Milestone 5
  ];

  var distance = 10112000, // Distance between each milestone
    rewardOffset = 1, // Start rewards at block (n)
    lastRewardHeight = 59328000;

  // if (global.Config.netVersion === 'mainnet') {
  //   rewardOffset = 464500;
  // }

  var parseHeight = function (height) {
    height = parseInt(height);

    if (isNaN(height)) {
      throw new Error('Invalid block height');
    } else {
      return Math.abs(height);
    }
  };

  this.calcMilestone = function (height) {
    var location = Math.floor(parseHeight(height - rewardOffset) / distance),
      lastMile = milestones[milestones.length - 1];

    if (location > (milestones.length - 1)) {
      return milestones.lastIndexOf(lastMile);
    } else {
      return location;
    }
  };

  this.calcReward = function (height) {
    var height = parseHeight(height);

    if (height < rewardOffset || height <= 1 || height > lastRewardHeight) {
      return 0;
    } else {
      return milestones[this.calcMilestone(height)];
    }
  };

  this.calcSupply = function (height) {
    var height = parseHeight(height);
    height -= height % slots.roundBlocks;
    var milestone = this.calcMilestone(height);
    var supply = constants.totalAmount;
    var rewards = [];

    if (height <= 0) {
      return supply;
    }
    var amount = 0,
      multiplier = 0;
    height = height - rewardOffset + 1;
    for (var i = 0; i < milestones.length; i++) {
      if (milestone >= i) {
        multiplier = milestones[i];

        if (height <= 0) {
          break; // Rewards not started yet
        } else if (height < distance) {
          amount = height % distance; // Measure distance thus far
        } else {
          amount = distance; // Assign completed milestone
        }
        rewards.push([amount, multiplier]);
        height -= distance; // Deduct from total height
      } else {
        break; // Milestone out of bounds
      }
    }
    if (height > 0) {
      rewards.push([height, milestones[milestones.length - 1]]);
    }

    for (i = 0; i < rewards.length; i++) {
      var reward = rewards[i];
      supply += reward[0] * reward[1];
    }

    if (rewardOffset <= 1) {
      supply -= milestones[0];
    }

    return supply;
  };
}

// Exports
module.exports = BlockStatus;