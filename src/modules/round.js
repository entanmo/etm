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

var async = require('async');
var slots = require('../utils/slots.js');
var sandboxHelper = require('../utils/sandbox.js');
var constants = require('../utils/constants.js');
var ethos = require('../utils/ethos-mine.js');
const reportor = require("../utils/kafka-reportor");
const BlockStatus = require("../utils/block-status");
const VoterBonus = require("../utils/voter-bonus");

// Private fields
var modules, library, self, __private = {}, shared = {};

__private.loaded = false;

__private.feesByRound = {};
__private.bonusByRound = {};
__private.rewardsByRound = {};
__private.delegatesByRound = {};
__private.unFeesByRound = {};
__private.unbonusByRound = {};
__private.unRewardsByRound = {};
__private.unDelegatesByRound = {};

__private.blockStatus = new BlockStatus();
__private.voterBonus = new VoterBonus();

const CLUB_BONUS_RATIO = 0.2

// Constructor
function Round(cb, scope) {
  library = scope;
  self = this;
  self.__private = __private;
  setImmediate(cb, null, self);
}

// Round changes
function RoundChanges(round, back) {
  if (!back) {
    var roundFees = parseInt(__private.feesByRound[round]) || 0;
    var roundRewards = (__private.rewardsByRound[round] || []);
    var bonusRewards = (__private.bonusByRound[round] || []);
  } else {
    var roundFees = parseInt(__private.unFeesByRound[round]) || 0;
    var roundRewards = (__private.unRewardsByRound[round] || []);
    var bonusRewards = (__private.unbonusByRound[round] || []);
  }

  this.at = function (index) {
    var ratio = global.featureSwitch.enableClubBonus ? (1 - CLUB_BONUS_RATIO) : 1
    var totalDistributeFees = Math.floor(roundFees * ratio)
    var fees = Math.floor(totalDistributeFees / slots.delegates)
    var feesRemaining = totalDistributeFees - (fees * slots.delegates)
    var rewards = Math.floor(parseInt(roundRewards[index]) * ratio) || 0

    return {
      fees: fees,
      feesRemaining: feesRemaining,
      rewards: rewards,
      balance: fees + rewards
    };
  }

  this.getClubBonus = function () {
    var fees = roundFees - Math.floor(roundFees * (1 - CLUB_BONUS_RATIO))
    var rewards = 0
    for (let i = 0; i < roundRewards.length; ++i) {
      let reward = parseInt(roundRewards[i])
      rewards += (reward - Math.floor(reward * (1 - CLUB_BONUS_RATIO)))
    }
    return fees + rewards
  }

  this.getDelegateVotersBonus = function () {

  }
}

// Public methods
Round.prototype.loaded = function () {
  return __private.loaded;
}

Round.prototype.calc = function (height) {
  return Math.floor(height / slots.roundBlocks) + (height % slots.roundBlocks > 0 ? 1 : 0);
}

// Round.prototype.getVotes = function (round, cb) {
//   library.dbLite.query("select delegate, amount from ( " +
//     "select m.delegate, sum(m.amount) amount, m.round from mem_round m " +
//     "group by m.delegate, m.round " +
//     ") where round = $round", { round: round }, { delegate: String, amount: Number }, function (err, rows) {
//       cb(err, rows)
//     });
// }

Round.prototype.flush = function (round, cb) {
  library.dbLite.query("delete from mem_round where round = $round", {
    round: round
  }, cb);
}

Round.prototype.directionSwap = function (direction, lastBlock, cb) {
  cb()
  // if (direction == 'backward') {
  //   __private.feesByRound = {};
  //   __private.rewardsByRound = {};
  //   __private.delegatesByRound = {};
  //   self.flush(self.calc(lastBlock.height), cb);
  // } else {
  //   __private.unFeesByRound = {};
  //   __private.unRewardsByRound = {};
  //   __private.unDelegatesByRound = {};
  //   self.flush(self.calc(lastBlock.height), cb);
  // }
}

Round.prototype.backwardTick = function (block, previousBlock, cb) {
  let round = self.calc(block.height);
  let prevRound = self.calc(previousBlock.height);

  async.series([
    (next) => { //剔除出块人
      modules.accounts.mergeAccountAndGet({
        publicKey: block.generatorPublicKey,
        producedblocks: -1,
        blockId: block.id,
        round: round
      }, next);
    },
    (next) => { //剔除未出块人
      let lastBlock = previousBlock;
      let timeDiff = block.timestamp - lastBlock.timestamp;
      //出块时间差大于3秒且小于1/3的代理人数，算作中间有人没有出块
      if (timeDiff > slots.interval && timeDiff < Math.floor(slots.interval * slots.delegates * 1 / 3)) {
        let stamp = {
          start: lastBlock.timestamp,
          end: block.timestamp
        }
        console.log("MMMMMMMMMMMMMMMMMMMMMMMMissedBlock", block.height, lastBlock.timestamp, block.timestamp)
        modules.delegates.getMissedDelegates(block.height, stamp, (err, missedDelegates) => {
          if (err) {
            return next(err);
          }
          console.log("MisssssssssssssssssssssssedBlock", missedDelegates)
          async.eachSeries(missedDelegates, (generator, cb) => {
            modules.accounts.mergeAccountAndGet({
              publicKey: generator,
              missedblocks: -1,
              blockId: block.id,
              round: round
            }, cb);
          }, (err) => {
            return next(err);
          });
        });
      } else {
        next();
      }
    },
    (next) => { //更新缓存
      __private.feesByRound[round] = (__private.feesByRound[round] || 0);
      __private.feesByRound[round] -= block.totalFee;
      __private.unFeesByRound[round] = (__private.unFeesByRound[round] || 0)
      __private.unFeesByRound[round] += block.totalFee

      __private.rewardsByRound[round] = (__private.rewardsByRound[round] || []);
      let removedReward = __private.rewardsByRound[round].pop()
      __private.unRewardsByRound[round] = (__private.unRewardsByRound[round] || [])
      __private.unRewardsByRound[round].push(removedReward)

      __private.delegatesByRound[round] = __private.delegatesByRound[round] || [];
      let removedDelegate = __private.delegatesByRound[round].pop()
      __private.unDelegatesByRound[round] = (__private.unDelegatesByRound[round] || [])
      __private.unDelegatesByRound[round].push(removedDelegate)

      __private.bonusByRound[round] = (__private.bonusByRound[round] || []);
      let removeBonus = __private.bonusByRound[round].pop();
      __private.unbonusByRound[round] = (__private.unbonusByRound[round] || []);
      __private.unbonusByRound[round].push(removeBonus);

      next();
    },
    (next) => { // 处理换轮
      if (prevRound === round && previousBlock.height !== 1) {
        return done();
      }

      if (__private.unDelegatesByRound[round].length !== slots.roundBlocks && previousBlock.height !== 1) {
        return done();
      }
      library.logger.warn('Unexpected roll back cross round', {
        round: round,
        prevRound: prevRound,
        block: block,
        previousBlock: previousBlock
      });

      reportor.report("nodejs", {
        subaction: "exit",
        data: {
          method: "backwardTick",
          reason: "unexpected roll back cross round",
          round: round,
          prevRound: prevRound,
          block: block,
          previousBlock: previousBlock
        }
      });
      process.exit(1);
    }
  ], (err) => {
    if (err) {
      library.logger.error("Round backward tick failed: " + err);
    } else {
      library.logger.debug("Round backward tick completed", {
        block: block,
        previousBlock: previousBlock
      });
    }
    cb && cb(err);
  });
}

Round.prototype.tick = function (block, cb) {
  let round = self.calc(block.height);
  let nextRound = self.calc(block.height + 1);

  async.series([
    (next) => { //合并出块人
      modules.accounts.mergeAccountAndGet({
        publicKey: block.generatorPublicKey,
        producedblocks: 1,
        blockId: block.id,
        round: round
      }, next);
    },
    (next) => { //合并未出块人
      if (block.height > 2) {
        modules.blocks.getBlock({
          height: block.height - 1
        }, (err, getBlock) => {
          if (err) {
            return next(err);
          }
          let lastBlock = getBlock.block;
          let timeDiff = block.timestamp - lastBlock.timestamp;
          //出块时间差大于3秒且小于1/3的代理人数，算作中间有人没有出块
          if (timeDiff > slots.interval && timeDiff < Math.floor(slots.interval * slots.delegates * 1 / 3)) {
            let stamp = {
              start: lastBlock.timestamp,
              end: block.timestamp
            }
            console.log("MMMMMMMMMMMMMMMMMMMMMMMMissedBlock", block.height, lastBlock.timestamp, block.timestamp)
            modules.delegates.getMissedDelegates(block.height, stamp, (err, missedDelegates) => {
              if (err) {
                return next(err);
              }
              console.log("MisssssssssssssssssssssssedBlock", missedDelegates)
              async.eachSeries(missedDelegates, (generator, cb) => {
                modules.accounts.mergeAccountAndGet({
                  publicKey: generator,
                  missedblocks: 1,
                  blockId: block.id,
                  round: round
                }, cb);
              }, (err) => {
                return next(err);
              });
            });
          } else {
            next();
          }
        });
      } else {
        next();
      }
    },
    (next) => { //更新缓存
      __private.feesByRound[round] = (__private.feesByRound[round] || 0);
      __private.feesByRound[round] += block.totalFee;

      __private.rewardsByRound[round] = (__private.rewardsByRound[round] || []);
      __private.rewardsByRound[round].push(block.reward);

      __private.delegatesByRound[round] = __private.delegatesByRound[round] || [];
      __private.delegatesByRound[round].push(block.generatorPublicKey);

      __private.bonusByRound[round] = (__private.bonusByRound[round] || []);
      __private.bonusByRound[round].push(__private.blockStatus.calcDelegateVotersBonus(block.height));

      next();
    },
    (next) => { // 处理换轮
      if (round === nextRound && block.height !== 1) {
        return next();
      }
      if (__private.delegatesByRound[round].length !== slots.roundBlocks && block.height !== 1 && block.height !== slots.roundBlocks) {
        return next();
      }

      let producedAvg = 1;
      async.series([
        // function(cb){
        //   if(block.height ===1){
        //     return cb();
        //   }
        //   cb();
        // },
        function (cb) { //绑定出块人收益
          var roundChanges = new RoundChanges(round);

          async.forEachOfSeries(__private.delegatesByRound[round], function (delegate, index, next) {
            var changes = roundChanges.at(index);
            var changeBalance = changes.balance;
            var changeFees = changes.fees;
            var changeRewards = changes.rewards;
            if (index === __private.delegatesByRound[round].length - 1) {
              changeBalance += changes.feesRemaining;
              changeFees += changes.feesRemaining;
            }

            modules.accounts.mergeAccountAndGet({
              publicKey: delegate,
              balance: changeBalance,
              u_balance: changeBalance,
              blockId: block.id,
              round: round,
              fees: changeFees,
              rewards: changeRewards
            }, next);
          }, cb);
        },
        function (cb) {
          // distribute club bonus
          if (!global.featureSwitch.enableClubBonus) {
            return cb()
          }
          var bonus = new RoundChanges(round).getClubBonus()
          var dappId = global.state.clubInfo.transactionId
          const BONUS_CURRENCY = 'ETM'
          library.logger.info('EnTanMo witness club get new bonus: ' + bonus)
          library.balanceCache.addAssetBalance(dappId, BONUS_CURRENCY, bonus)
          library.model.updateAssetBalance(BONUS_CURRENCY, bonus, dappId, cb)
        },
        function (cb) {
          const bonusByRound = __private.bonusByRound[round] || [];
          const totalBonus = bonusByRound.length <= 0 ? 0 : bonusByRound.reduce((prevValue, currValue) => {
            return prevValue + currValue;
          }, 0);
          __private.voterBonus.commitBonus(round, bonusByRound, block)
            .then(result => {
              void(result);
              cb();
            })
            .catch(error => {
              cb(error);
            });
        },
        function (cb) { //计算当前代理人出块率平均值
          let totalProduce = 0;
          async.eachSeries(__private.delegatesByRound[round], function (delegate, cb) {
            modules.accounts.getAccount({
              publicKey: delegate
            }, (err, account) => {
              if (err || !account) {
                return cb("Failure in calculating trustee's average block rate" + err);
              }
              totalProduce += (account.producedblocks / (account.producedblocks + account.missedblocks));
              cb();
            });
          }, function (err) {
            if (err) {
              return cb(err);
            }
            producedAvg = (totalProduce / __private.delegatesByRound[round].length).toFixed(2);

            cb();
          });
        },
        function (cb) { //更新受托人票数
          modules.accounts.getAccounts({
            isDelegate: {
              $gt: 0
            },
            sort: {
              "vote": -1,
              "publicKey": 1
            }
          }, ["publicKey", "address"], function (err, delegates) {
            if (err) {
              return cb(err);
            }

            async.eachSeries(delegates, function (delegate, cb) {

              modules.delegates.getDelegateVoters(delegate.publicKey, function (err, voters) {
                if (err) {
                  return cb(err);
                }

                let totalVotes = 0;
                async.eachSeries(voters.accounts, function (voter, cb) {
                  modules.lockvote.refreshRoundLockVotes(voter.address, block.height, function (err, votes) {
                    if (err) {
                      return cb(err);
                    }

                    totalVotes += votes;
                    cb();
                  });
                }, function (err) {
                  if (err) {
                    return cb(err);
                  }

                  let producedblocks = delegate.producedblocks ? delegate.producedblocks : 0;
                  let missedblocks = delegate.missedblocks ? delegate.missedblocks : 0;
                  let v = __private.calcProductivity(producedblocks, producedblocks + missedblocks, producedAvg); //生产率

                  let votes = Math.floor(Math.pow(totalVotes, 3 / 4) * v);
                  library.dbLite.query('update mem_accounts set vote = $vote where address = $address', {
                    address: delegate.address,
                    vote: votes
                  }, cb);
                });
              });
            }, function (err) {
              self.flush(round, function (err2) {
                cb(err || err2);
              });
            });

          });
        },
        function (cb) { // 改变代理人信息
          modules.accounts.getAccounts({
            isDelegate: 2,
            sort: {
              "vote": -1,
              "publicKey": 1
            }
          }, function (err, delegates) {
            if (err) {
              return cb(err);
            }
            async.eachSeries(delegates, function (delegate, cb) {
              var data = {
                address: delegate.address,
                u_isDelegate: 2,
                isDelegate: 0,
                username: null,
                u_username: delegate.username,
                vote: 0
              }

              modules.accounts.setAccountAndGet(data, cb);
            }, function (err) {
              cb(err);
            });
          });
        },
        function (cb) { // 更新锁仓系数
          modules.delegates.generateDelegateList(block.height + 1, function (err, roundDelegates) {
            if (err) {
              return cb(err);
            }

            // 被选中受托人的投票者票系数减半（每次进入下一轮时减一次，创世块不减）
            async.eachSeries(roundDelegates, function (delegate, cb) {
              modules.delegates.getDelegateVoters(delegate, function (err, voters) {
                if (err) {
                  return cb(err);
                }

                async.eachSeries(voters.accounts, function (voter, cb) {
                  modules.lockvote.updateLockVotes(voter.address, block.height, 0.5, function (err) {

                    return cb(err);
                  });
                }, function (err) {
                  return cb(err);
                });
              });
            }, function (err) {
              library.bus.message('finishRound', round);
              return cb(err);
            });
          });
        },
        function (callback) {
          __private.voterBonus.beginBonus(nextRound, block)
            .then(result => {
              void(result);
              callback();
            })
            .catch(error => {
              callback(error);
            });
        }
      ], function (err) {
        delete __private.feesByRound[round];
        delete __private.rewardsByRound[round];
        delete __private.delegatesByRound[round];

        next(err);
      });
    }
  ], (err) => {
    if (err) {
      library.logger.error("Round tick failed: " + err);
    } else {
      let blocklog = Object.assign({}, block); //let blocklog = JSON.parse(JSON.stringify(obj1));
      delete blocklog.transactions
      library.logger.debug("Round tick completed", {
        block: blocklog
      });
    }

    cb && setImmediate(cb, err);
  });
}

Round.prototype.roundrewardsRecovery = function (cb) {
  __private.voterBonus.recovery()
    .then(result => {
      return cb();
    })
    .catch(error => {
      return cb(error);
    });
}

Round.prototype.sandboxApi = function (call, args, cb) {
  sandboxHelper.callMethod(shared, call, args, cb);
}

// Events
Round.prototype.onBind = function (scope) {
  modules = scope;
}

Round.prototype.onBlockchainReady = function () {
  /*
  setInterval(() => {
    console.log("delegateByRound:", JSON.stringify(__private.delegatesByRound));
  }, 4000);
  */
  var round = self.calc(modules.blocks.getLastBlock().height);
  library.dbLite.query("select sum(b.totalFee), GROUP_CONCAT(b.reward), GROUP_CONCAT(lower(hex(b.generatorPublicKey))) from blocks b where (select (cast(b.height / " + slots.roundBlocks + " as integer) + (case when b.height % " + slots.roundBlocks + " > 0 then 1 else 0 end))) = $round", {
    round: round
  }, {
    fees: Number,
    rewards: Array,
    delegates: Array
  }, function (err, rows) {
    __private.feesByRound[round] = rows[0].fees;
    __private.rewardsByRound[round] = rows[0].rewards;
    __private.delegatesByRound[round] = rows[0].delegates;
    __private.loaded = true;
  });
}

Round.prototype.onFinishRound = function (round) {
  library.network.io.sockets.emit('rounds/change', {
    number: round
  });

  library.modules.delegates.isDelegatesContainKeypairs(round, function (err, isFind) {
    if (!err) {
      if (isFind) {
        // ethos.stop();
        console.log("++++++++++++++++++++++++++++++ stop")
      } else {
        // ethos.start();
        console.log("++++++++++++++++++++++++++++++ start")
      }
    } else {
      // ethos.stop();
    }
  })
}

Round.prototype.cleanup = function (cb) {
  __private.loaded = false;
  cb();
}

__private.calcProductivity = function (m, n, avg) {
  let v = 1;
  if (n === 0) {
    v = avg;
  } else if (m === 0) {
    v = 1 / (10 * n * n);
  } else {
    v = m / n;
  }
  return v;
}

// Export
module.exports = Round;