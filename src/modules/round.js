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

// Private fields
var modules, library, self, __private = {}, shared = {};

__private.loaded = false;

__private.feesByRound = {};
__private.rewardsByRound = {};
__private.delegatesByRound = {};
__private.unFeesByRound = {};
__private.unRewardsByRound = {};
__private.unDelegatesByRound = {};

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
  } else {
    var roundFees = parseInt(__private.unFeesByRound[round]) || 0;
    var roundRewards = (__private.unRewardsByRound[round] || []);
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
}

Round.prototype.loaded = function () {
  return __private.loaded;
}

// Public methods
Round.prototype.calc = function (height) {
  return Math.floor(height / slots.delegates) + (height % slots.delegates > 0 ? 1 : 0);
}

Round.prototype.getVotes = function (round, cb) {
  library.dbLite.query("select delegate, amount from ( " +
    "select m.delegate, sum(m.amount) amount, m.round from mem_round m " +
    "group by m.delegate, m.round " +
    ") where round = $round", { round: round }, { delegate: String, amount: Number }, function (err, rows) {
      cb(err, rows)
    });
}

Round.prototype.flush = function (round, cb) {
  library.dbLite.query("delete from mem_round where round = $round", { round: round }, cb);
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
  function done(err) {
    if (err) {
      library.logger.error("Round backward tick failed: " + err);
    } else {
      library.logger.debug("Round backward tick completed", {
        block: block,
        previousBlock: previousBlock
      });
    }
    cb && cb(err);
  }

  modules.accounts.mergeAccountAndGet({
    publicKey: block.generatorPublicKey,
    producedblocks: -1,
    blockId: block.id,
    round: modules.round.calc(block.height)
  }, function (err) {
    if (err) {
      return done(err);
    }

    var round = self.calc(block.height);

    var prevRound = self.calc(previousBlock.height);

    // __private.unFeesByRound[round] = (__private.unFeesByRound[round] || 0);
    // __private.unFeesByRound[round] += block.totalFee;

    // __private.unRewardsByRound[round] = (__private.unRewardsByRound[round] || []);
    // __private.unRewardsByRound[round].push(block.reward);

    // __private.unDelegatesByRound[round] = __private.unDelegatesByRound[round] || [];
    // __private.unDelegatesByRound[round].push(block.generatorPublicKey);

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
    

    if (prevRound === round && previousBlock.height !== 1) {
      return done();
    }

    if (__private.unDelegatesByRound[round].length !== slots.delegates && previousBlock.height !== 1) {
      return done();
    }
    library.logger.warn('Unexpected roll back cross round', {
      round: round,
      prevRound: prevRound,
      block: block,
      previousBlock: previousBlock
    });
    process.exit(1);
    // FIXME process the cross round rollback
    var outsiders = [];
    async.series([
      function (cb) {
        if (block.height === 1) {
          return cb();
        }
        modules.delegates.generateDelegateList(block.height, function (err, roundDelegates) {
          if (err) {
            return cb(err);
          }
          for (var i = 0; i < roundDelegates.length; i++) {
            if (__private.unDelegatesByRound[round].indexOf(roundDelegates[i]) == -1) {
              if (global.featureSwitch.fixVoteNewAddressIssue) {
                outsiders.push(modules.accounts.generateAddressByPublicKey2(roundDelegates[i]));
              } else {
                outsiders.push(modules.accounts.generateAddressByPublicKey(roundDelegates[i]));
              }
            }
          }
          cb();
        });
      },
      function (cb) {
        if (!outsiders.length) {
          return cb();
        }
        var escaped = outsiders.map(function (item) {
          return "'" + item + "'";
        });
        library.dbLite.query('update mem_accounts set missedblocks = missedblocks - 1 where address in (' + escaped.join(',') + ')', function (err, data) {
          cb(err);
        });
      },
      // function (cb) {
      //   self.getVotes(round, function (err, votes) {
      //     if (err) {
      //       return cb(err);
      //     }
      //     async.eachSeries(votes, function (vote, cb) {
      //       library.dbLite.query('update mem_accounts set vote = vote + $amount where address = $address', {
      //         address: modules.accounts.generateAddressByPublicKey(vote.delegate),
      //         amount: vote.amount
      //       }, cb);
      //     }, function (err) {
      //       self.flush(round, function (err2) {
      //         cb(err || err2);
      //       });
      //     })
      //   });
      // },
      function (cb) {
        var roundChanges = new RoundChanges(round, true);

        async.forEachOfSeries(__private.unDelegatesByRound[round], function (delegate, index, next) {
          var changes = roundChanges.at(index);
          var changeBalance = changes.balance;
          var changeFees = changes.fees;
          var changeRewards = changes.rewards;

          if (index === 0) {
            changeBalance += changes.feesRemaining;
            changeFees += changes.feesRemaining;
          }

          modules.accounts.mergeAccountAndGet({
            publicKey: delegate,
            balance: -changeBalance,
            u_balance: -changeBalance,
            blockId: block.id,
            round: modules.round.calc(block.height),
            fees: -changeFees,
            rewards: -changeRewards
          }, next);
        }, cb);
      },
      function (cb) {
        // distribute club bonus
        if (!global.featureSwitch.enableClubBonus) {
          return cb()
        }
        var bonus = '-' + new RoundChanges(round).getClubBonus()
        var dappId = global.state.clubInfo.transactionId
        const BONUS_CURRENCY = 'XAS'
        library.logger.info('EnTanMo witness club get new bonus: ' + bonus)
        library.balanceCache.addAssetBalance(dappId, BONUS_CURRENCY, bonus)
        library.model.updateAssetBalance(BONUS_CURRENCY, bonus, dappId, cb)
      },
      function (cb) {
        modules.accounts.getAccounts({
          isDelegate: 1,
          sort: {
            "vote": -1,
            "publicKey": 1
          }
        }, ["address"], function (err, delegates) {
          if (err) {
            return cb(err);
          }

          async.eachSeries(delegates, function (delegate, cb) {

            modules.delegates.getDelegateVoters(delegate.publicKey, function (err, voters) {
              if(err){
                cb(err);
              }

              let totalVotes = 0;
              async.eachSeries(voters, function (voter, cb) {
                modules.lockvote.calcLockVotes(voter.address, block.height, function (err, votes) {
                  if(err){
                    cb(err);
                  }

                  totalVotes += votes;
                });
              },function(err){
                if(err){
                  cb(err);
                }

                let votes = Math.pow(totalVotes, 3 / 4);
                library.dbLite.query('update mem_accounts set vote = $amount where address = $address', {
                  address: delegate.address,
                  amount: votes
                }, cb);
              });
            });
          },function (err) {
                  
            library.bus.message('finishRound', round);
            self.flush(round, function (err2) {
              cb(err || err2);
            });
          });
          
        });


        // self.getVotes(round, function (err, votes) {
        //   if (err) {
        //     return cb(err);
        //   }
        //   async.eachSeries(votes, function (vote, cb) {
        //     var address = null
        //     if (global.featureSwitch.fixVoteNewAddressIssue) {
        //       address = modules.accounts.generateAddressByPublicKey2(vote.delegate)
        //     } else {
        //       address = modules.accounts.generateAddressByPublicKey(vote.delegate)
        //     }
        //     library.dbLite.query('update mem_accounts set vote = vote + $amount where address = $address', {
        //       address: address,
        //       amount: vote.amount
        //     }, cb);
        //   }, function (err) {
        //     self.flush(round, function (err2) {
        //       cb(err || err2);
        //     });
        //   })
        // });
      }
    ], function (err) {
      delete __private.unFeesByRound[round];
      delete __private.unRewardsByRound[round];
      delete __private.unDelegatesByRound[round];
      done(err)
    });
  });
}

Round.prototype.tick = function (block, cb) {
  function done(err) {
    if (err) {
      library.logger.error("Round tick failed: " + err);
    } else {
      library.logger.debug("Round tick completed", {
        block: block
      });
    }
    cb && setImmediate(cb, err);
  }

  modules.accounts.mergeAccountAndGet({
    publicKey: block.generatorPublicKey,
    producedblocks: 1,
    blockId: block.id,
    round: modules.round.calc(block.height)
  }, function (err) {
    if (err) {
      return done(err);
    }
    var round = self.calc(block.height);

    __private.feesByRound[round] = (__private.feesByRound[round] || 0);
    __private.feesByRound[round] += block.totalFee;

    __private.rewardsByRound[round] = (__private.rewardsByRound[round] || []);
    __private.rewardsByRound[round].push(block.reward);

    __private.delegatesByRound[round] = __private.delegatesByRound[round] || [];
    __private.delegatesByRound[round].push(block.generatorPublicKey);

    var nextRound = self.calc(block.height + 1);

    if (round === nextRound && block.height !== 1) {
      return done();
    }

    if (__private.delegatesByRound[round].length !== slots.delegates && block.height !== 1 && block.height !== slots.delegates) {
      return done();
    }

    var outsiders = [];

    async.series([
      function (cb) {
        if (block.height === 1) {
          return cb();
        }
        modules.delegates.generateDelegateList(block.height, function (err, roundDelegates) {
          if (err) {
            return cb(err);
          }
          for (var i = 0; i < roundDelegates.length; i++) {
            if (__private.delegatesByRound[round].indexOf(roundDelegates[i]) == -1) {
              if (global.featureSwitch.fixVoteNewAddressIssue) {
                outsiders.push(modules.accounts.generateAddressByPublicKey2(roundDelegates[i]));
              } else {
                outsiders.push(modules.accounts.generateAddressByPublicKey(roundDelegates[i]));
              }
            }
          }
          cb();
        });
      },
      function (cb) {
        if (!outsiders.length) {
          return cb();
        }
        var escaped = outsiders.map(function (item) {
          return "'" + item + "'";
        });
        library.dbLite.query('update mem_accounts set missedblocks = missedblocks + 1 where address in (' + escaped.join(',') + ')', function (err, data) {
          cb(err);
        });
      },
      // function (cb) {
      //   self.getVotes(round, function (err, votes) {
      //     if (err) {
      //       return cb(err);
      //     }
      //     async.eachSeries(votes, function (vote, cb) {
      //       library.dbLite.query('update mem_accounts set vote = vote + $amount where address = $address', {
      //         address: modules.accounts.generateAddressByPublicKey(vote.delegate),
      //         amount: vote.amount
      //       }, cb);
      //     }, function (err) {
      //       self.flush(round, function (err2) {
      //         cb(err || err2);
      //       });
      //     })
      //   });
      // },
      function (cb) {
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
            round: modules.round.calc(block.height),
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
        const BONUS_CURRENCY = 'XAS'
        library.logger.info('EnTanMo witness club get new bonus: ' + bonus)
        library.balanceCache.addAssetBalance(dappId, BONUS_CURRENCY, bonus)
        library.model.updateAssetBalance(BONUS_CURRENCY, bonus, dappId, cb)
      },
      function (cb) {
        modules.accounts.getAccounts({
          isDelegate: 1,
          sort: {
            "vote": -1,
            "publicKey": 1
          }
        }, ["publicKey","address"], function (err, delegates) {
          if (err) {
            return cb(err);
          }

          async.eachSeries(delegates, function (delegate, cb) {

            modules.delegates.getDelegateVoters(delegate.publicKey, function (err, voters) {
              if(err){
                cb(err);
              }

              let totalVotes = 0;
              async.eachSeries(voters.accounts, function (voter, cb) {
                modules.lockvote.calcLockVotes(voter.address, block.height, function (err, votes) {
                  if(err){
                    cb(err);
                  }

                  totalVotes += votes;
                });
              },function(err){
                if(err){
                  cb(err);
                }

                let votes = Math.pow(totalVotes, 3 / 4);
                library.dbLite.query('update mem_accounts set vote = $amount where address = $address', {
                  address: delegate.address,
                  amount: votes
                }, cb);
              });
            });
          },function (err) {
                  
            library.bus.message('finishRound', round);
            self.flush(round, function (err2) {
              cb(err || err2);
            });
          });

        });




        // self.getVotes(round, function (err, votes) {
        //   if (err) {
        //     return cb(err);
        //   }
        //   async.eachSeries(votes, function (vote, cb) {
        //     var address = null
        //     if (global.featureSwitch.fixVoteNewAddressIssue) {
        //       address = modules.accounts.generateAddressByPublicKey2(vote.delegate)
        //     } else {
        //       address = modules.accounts.generateAddressByPublicKey(vote.delegate)
        //     }
        //     library.dbLite.query('update mem_accounts set vote = vote + $amount where address = $address', {
        //       address: address,
        //       amount: vote.amount
        //     }, cb);
        //   }, function (err) {
        //     library.bus.message('finishRound', round);
        //     self.flush(round, function (err2) {
        //       cb(err || err2);
        //     });
        //   })
        // });
      },
      function (cb) {
        // Fix NaN asset balance issue caused by flowed amount validate function
        // [HARDFORK] Need to be reviewed by entanmo community
        if (round === 33348) {
          library.balanceCache.setAssetBalance('ABrWsCGv25nahd4qqZ7bofj3MuSfpSX1Rg', 'ABSORB.YLB', '32064016000000')
          library.balanceCache.setAssetBalance('A5Hyw75AHCthHnevjpyP9J4146uXvHTX4P', 'ABSORB.YLB', '15932769000000')
          var sql = 'update mem_asset_balances set balance = "32064016000000" where currency="ABSORB.YLB" and address="ABrWsCGv25nahd4qqZ7bofj3MuSfpSX1Rg";' +
                    'update mem_asset_balances set balance = "15932769000000" where currency="ABSORB.YLB" and address="A5Hyw75AHCthHnevjpyP9J4146uXvHTX4P";'
          library.dbLite.query(sql, cb)
        } else {
          cb()
        }
      }
    ], function (err) {
      delete __private.feesByRound[round];
      delete __private.rewardsByRound[round];
      delete __private.delegatesByRound[round];

      done(err);
    });
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
  var round = self.calc(modules.blocks.getLastBlock().height);
  library.dbLite.query("select sum(b.totalFee), GROUP_CONCAT(b.reward), GROUP_CONCAT(lower(hex(b.generatorPublicKey))) from blocks b where (select (cast(b.height / "+slots.delegates+" as integer) + (case when b.height % "+slots.delegates+" > 0 then 1 else 0 end))) = $round",
    {
      round: round
    },
    {
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
  library.network.io.sockets.emit('rounds/change', { number: round });

  library.modules.delegates.isDelegatesContainKeypairs(round,function(err,isFind){
    if(!err){
      if(isFind) {
        // ethos.stop();
        console.log("++++++++++++++++++++++++++++++ stop")
      }
      else{
        // ethos.start();
        console.log("++++++++++++++++++++++++++++++ start")
      }
    }
    else{
      // ethos.stop();
    }
  })
}

Round.prototype.cleanup = function (cb) {
  __private.loaded = false;
  cb();
}

// Shared

// Export
module.exports = Round;
