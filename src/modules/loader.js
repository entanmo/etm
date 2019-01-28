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
var ip = require("ip");
var bignum = require('../utils/bignumber');
var Router = require('../utils/router.js');
var sandboxHelper = require('../utils/sandbox.js');
var slots = require('../utils/slots.js');
var scheme = require('../scheme/loader');
const reportor = require("../utils/kafka-reportor");
const shell = require("shelljs");
require('colors');

// Private fields
var modules, library, self, __private = {}, shared = {};

__private.loaded = false;
__private.isActive = false;
__private.syncing = false;
__private.loadingLastBlock = null;
__private.genesisBlock = null;
__private.total = 0;
__private.blocksToSync = 0;
__private.syncIntervalId = null;

// Constructor
function Loader(cb, scope) {
  library = scope;
  __private.genesisBlock = __private.loadingLastBlock = library.genesisblock;
  self = this;
  self.__private = __private;
  __private.attachApi();

  setImmediate(cb, null, self);
}

// Private methods
__private.attachApi = function () {
  var router = new Router();

  router.map(shared, {
    "get /status": "status",
    "get /status/sync": "sync"
  });

  library.network.app.use('/api/loader', router);
  library.network.app.use(function (err, req, res, next) {
    if (!err) return next();
    library.logger.error(req.url, err.toString());
    res.status(500).send({ success: false, error: err.toString() });
  });
}

__private.syncTrigger = function (turnOn) {
  if (turnOn === false && __private.syncIntervalId) {
    clearTimeout(__private.syncIntervalId);
    __private.syncIntervalId = null;
  }
  if (turnOn === true && !__private.syncIntervalId) {
    setImmediate(function nextSyncTrigger() {
      library.network.io.sockets.emit('loader/sync', {
        blocks: __private.blocksToSync,
        height: modules.blocks.getLastBlock().height
      });
      __private.syncIntervalId = setTimeout(nextSyncTrigger, 1000);
    });
  }
}

__private.loadFullDb = function (peer, cb) {
  var peerStr = peer ? ip.fromLong(peer.ip) + ":" + peer.port : 'unknown';

  var commonBlockId = __private.genesisBlock.block.id;

  library.logger.debug("Loading blocks from genesis from " + peerStr);

  modules.blocks.loadBlocksFromPeer(peer, commonBlockId, cb);
}

__private.findUpdate = function (lastBlock, peer, cb) {
  const peerStr = `${peer.host}:${peer.port - 1}`

  //library.logger.info("Looking for common block with " + peerStr);
  console.log("Looking for common block with " + peerStr);
  modules.blocks.getCommonBlock(peer, lastBlock.height, function (err, commonBlock) {
    if (err || !commonBlock) {
      library.logger.error("Failed to get common block", err);
      return cb();
    }

    library.logger.info("Found common block " + commonBlock.id + " (at " + commonBlock.height + ")" + " with peer " + peerStr + ", last block height is " + lastBlock.height);
    var toRemove = lastBlock.height - commonBlock.height;

    if (toRemove >= 5) {
      library.logger.error("long fork, with peer", peerStr);
     // modules.peer.state(peer.ip, peer.port, 0, 3600);
      return cb();
    }

    var unconfirmedTrs = modules.transactions.getUnconfirmedTransactionList(true);
    //library.logger.info('Undo unconfirmed transactions', unconfirmedTrs)
    modules.transactions.undoUnconfirmedList(function (err) {
      if (err) {
        library.logger.error('Failed to undo uncomfirmed transactions', err);
        reportor.report("nodejs", {
          subaction: "exit",
          data: {
            method: "findUpdate",
            reason: "Failed to undo unconfirmed transactions " + err.toString(),
          }
        });
        return process.exit(0);
      }

      function rollbackBlocks(cb) {
        if (commonBlock.id == lastBlock.id) {
          return cb();
        }

        async.series([
          function (next) {
            var currentRound = modules.round.calc(lastBlock.height);
            var backRound = modules.round.calc(commonBlock.height);
            var backHeight = commonBlock.height;
            if (currentRound != backRound || lastBlock.height % slots.roundBlocks === 0) {
              if (backRound == 1) {
                backHeight = 1;
              } else {
                backHeight = backHeight - backHeight % slots.roundBlocks;
              }
              modules.blocks.getBlock({ height: backHeight }, function (err, result) {
                if (result && result.block) {
                  commonBlock = result.block;
                }
                next(err);
              })
            } else {
              next();
            }
          },
          function (next) {
            library.logger.info('start to roll back blocks before ' + commonBlock.height);
            modules.round.directionSwap('backward', lastBlock, next);
          },
          function (next) {
            library.bus.message('deleteBlocksBefore', commonBlock);
            modules.blocks.deleteBlocksBefore(commonBlock, next);
          },
          function (next) {
            modules.round.directionSwap('forward', lastBlock, next);
          }
        ], function (err) {
          if (err) {
            library.logger.error("Failed to rollback blocks before " + commonBlock.height, err);
            reportor.report("nodejs", {
              subaction: "exit",
              data: {
                method: "findUpdate",
                reason: "Failed to rollback blocks before " + commonBlock.height + ", err: " + err.toString()
              }
            });
            process.exit(1);
            return;
          }
          cb();
        });
      }

      async.series([
        async.apply(rollbackBlocks),
        function (next) {
          library.logger.debug("Loading blocks from peer " + peerStr);

          modules.blocks.loadBlocksFromPeer(peer, commonBlock.id, function (err, lastValidBlock) {
            if (err) {
              library.logger.error("Failed to load blocks from: " + peerStr, err);
             // modules.peer.state(peer.ip, peer.port, 0, 3600);
            }
            next();
          });
        },
        function (next) {
          modules.transactions.receiveTransactions(unconfirmedTrs, function (err) {
            if (err) {
              library.logger.error('Failed to redo unconfirmed transactions', err);
            }
            next();
          });
        }
      ], cb)
    });
  });
}

__private.loadBlocks = function (lastBlock, cb) {
  modules.peer.randomRequest('getHeight', {}, (err, ret, peer) => {
    if (err) {
      library.logger.error('Failed to request form random peer', err)
      return cb()
    }

    const peerStr = `${peer.host}:${peer.port - 1}`
    library.logger.info(`Check blockchain on ${peerStr}`)

    ret.height = Number.parseInt(ret.height, 10)

    const report = library.scheme.validate(ret, {
      type: 'object',
      properties: {
        height: {
          type: 'integer',
          minimum: 0,
        },
      },
      required: ['height'],
    })

    if (!report) {
      library.logger.log("Failed to parse blockchain height: " + peerStr + "\n" + library.scheme.getLastError());
      return cb();
    }

    if (bignum(modules.blocks.getLastBlock().height).lt(ret.height)) { // Diff in chainbases
      __private.blocksToSync = ret.height;

      if (lastBlock.id != __private.genesisBlock.block.id) { // Have to find common block
        __private.findUpdate(lastBlock, peer, cb);
      } else { // Have to load full db
        __private.loadFullDb(peer, cb);
      }
    } else {
      cb();
    }
  });
}

__private.loadSignatures = function (cb) {
  modules.peer.randomRequest('getSignatures', {}, (err, data, peer) => {
    //console.log("getSignatures"+JSON.stringify(data))
    if (err) {
      return cb()
    }

    library.scheme.validate(data,  scheme.loadSignatures, function (err) {
      if (err) {
        return cb();
      }

      library.sequence.add(function loadSignatures(cb) {
        async.eachSeries(data.signatures, function (signature, cb) {
          async.eachSeries(signature.signatures, function (s, cb) {
            modules.multisignatures.processSignature({
              signature: s,
              transaction: signature.transaction
            }, function (err) {
              setImmediate(cb);
            });
          }, cb);
        }, cb);
      }, cb);
    });
  });
}

__private.loadUnconfirmedTransactions = function (cb) {

  modules.peer.randomRequest('getUnconfirmedTransactions', {}, (err, data, peer) => {
   // console.log("getUnconfirmedTransactions"+JSON.stringify(data))

    if (err) {
      return cb()
    }

    var report = library.scheme.validate(data,
       scheme.loadUnconfirmedTransactions);

    if (!report) {
      console.log("getUnconfirmedTransactions error "+report )
      return cb(report);
    }

    var transactions = data.transactions;
    //console.log("data.transactions"+JSON.stringify(transactions))
    for (var i = 0; i < transactions.length; i++) {
      try {
        transactions[i] = library.base.transaction.objectNormalize(transactions[i]);
      } catch (e) {
        var peerStr = peer ? ip.fromLong(peer.ip) + ":" + peer.port : 'unknown';
        library.logger.log('Transaction ' + (transactions[i] ? transactions[i].id : 'null') + ' is not valid', peerStr);
        return cb();//setImmediate()
      }
    }

    var trs = [];
    for (var i = 0; i < transactions.length; ++i) {
      if (!modules.transactions.hasUnconfirmedTransaction(transactions[i])) {
        trs.push(transactions[i]);
      }
    }
    library.balancesSequence.add(function (cb) {
      modules.transactions.receiveTransactions(trs, cb);
    }, cb);
  });
}

__private.loadBalances = function (cb) {
  library.model.getAllNativeBalances(function (err, results) {
    if (err) return cb('Failed to load native balances: ' + err)
    for (let i = 0; i < results.length; ++i) {
      let {address, balance} = results[i]
      library.balanceCache.setNativeBalance(address, balance)
    }
    library.balanceCache.commit()
    cb(null)
  })
}

__private.loadDelayTransfer = function (cb) {
  library.model.getAllDelayTransfer(function (err, results) {
    if (err) return cb("Failed to load delay transfer: " + err);
    for (let i = 0; i < results.length; i++) {
      let { transactionId, senderId, recipientId, amount, expired } = results[i];
      library.delayTransferMgr.addDelayTransfer(transactionId, {
        transactionId,
        senderId,
        recipientId,
        amount,
        expired
      });
    }
    cb(null);
  });
}

__private.loadBlockChain = function (cb) {
  var offset = 0, limit = Number(library.config.loading.loadPerIteration) || 1000;
  var verify = library.config.loading.verifyOnLoading;

  function load(count) {
    verify = true;
    __private.total = count;

    library.base.account.removeTables(function (err) {
      if (err) {
        throw err;
      } else {
        library.base.account.createTables(function (err) {
          if (err) {
            throw err;
          } else {
            async.until(
              function () {
                return count < offset
              }, function (cb) {
                if (count > 1) {
                  library.logger.info("Rebuilding blockchain, current block height:" + offset);
                }
                setImmediate(function () {
                  modules.blocks.loadBlocksOffset(limit, offset, verify, function (err, lastBlockOffset) {
                    if (err) {
                      return cb(err);
                    }

                    offset = offset + limit;
                    __private.loadingLastBlock = lastBlockOffset;

                    cb();
                  });
                })
              }, function (err) {
                if (err) {
                  library.logger.error('loadBlocksOffset', err);
                  if (err.block) {
                    library.logger.error('Blockchain failed at ', err.block.height)
                    modules.blocks.simpleDeleteAfterBlock(err.block.id, function (err, res) {
                      if (err) return cb(err)
                      library.logger.error('Blockchain clipped');
                      async.waterfall([
                        (next => __private.loadBalances(next)),
                        (next => __private.loadDelayTransfer(next)),
                        (next => modules.round.roundrewardsRecovery(next))
                      ], cb)
                      /*
                      __private.loadBalances(cb);
                      __private.loadDelayTransfer(cb);
                      */
                    })
                  } else {
                    cb(err);
                  }
                } else {
                  library.logger.info('Blockchain ready');
                  async.waterfall([
                    (next => __private.loadBalances(next)),
                    (next => __private.loadDelayTransfer(next)),
                    (next => modules.round.roundrewardsRecovery(next))
                  ], cb);
                  /*
                  __private.loadBalances(cb);
                  __private.loadDelayTransfer(cb);
                  */
                }
              }
            )
          }
        });
      }
    });
  }
  function loadDelegates(count,cb) {
    // Load delegates
    library.dbLite.query("SELECT lower(hex(publicKey)) FROM mem_accounts WHERE isDelegate > 0", ['publicKey'], function (err, delegates) {
     if (err || delegates.length == 0) {
       library.logger.error(err || "No delegates, reload database");
       library.logger.info("Failed to verify db integrity 3");
       load(count);
     } else {
       modules.blocks.loadBlocksOffset(1, count, verify, function (err, lastBlock) {
         if (err) {
           library.logger.error(err || "Unable to load last block");
           library.logger.info("Failed to verify db integrity 4");
           load(count);
         } else {
           library.logger.info('Blockchain ready');
           async.waterfall([
             (next => __private.loadBalances(next)),
             (next => __private.loadDelayTransfer(next)),
             (next => modules.round.roundrewardsRecovery(next))
           ], cb);
           /*
           __private.loadBalances(cb);
           __private.loadDelayTransfer(cb);
           */
         }
       });
     }
   });
 }
  library.base.account.createTables(function (err) {
    if (err) {
      throw err;
    } else {
      library.dbLite.query("select count(*) from mem_accounts where blockId = (select id from blocks where numberOfTransactions > 0 order by height desc limit 1)", { 'count': Number }, function (err, rows) {
        if (err) {
          throw err;
        }

        var reject = !(rows[0].count);

        modules.blocks.count(function (err, count) {
          if (err) {
            return library.logger.error('Failed to count blocks', err)
          }

          library.logger.info('Blocks ' + count);

          // Check if previous loading missed
          // if (reject || verify || count == 1) {
          if (verify || count == 1) {
            load(count);
          } else {
            library.dbLite.query(
              "UPDATE mem_accounts SET u_isDelegate=isDelegate,u_secondSignature=secondSignature,u_username=username,u_balance=balance,u_delegates=delegates,u_multisignatures=multisignatures"
              , function (err, updated) {
                if (err) {
                  library.logger.error(err);
                  library.logger.info("Failed to verify db integrity 1");
                  load(count);
                } else {
                  library.dbLite.query("select a.blockId, b.id from mem_accounts a left outer join blocks b on b.id = a.blockId where b.id is null", {}, ['a_blockId', 'b_id'], function (err, rows) {
                    if (err || rows.length > 0) {
                      library.logger.error(err || "Encountered missing block, looks like node went down during block processing");
                      library.logger.info("Failed to verify db integrity 2");

                      modules.system.backupDb(function(isbackup){
                        if(isbackup){
                          shell.exec('rm -f '+'data/'+library.config.dbName ,
                          function(code, stdout, stderr) {
                          // __private.isBackUp = false;
                           console.log('backupDb remove old db code:', code);
                           console.log('backupDb  remove old db Program stderr:', stderr);
                          if(code == 0){
                            loadDelegates(count,cb);
                          }else{
                            library.logger.error('Failed to load blockchain', err)
                            return process.exit(1)
                          }
                        });
                        }else{
                          loadDelegates(count,cb);
                        }
                      });
                    } else {
                      loadDelegates(count,cb);
                    }
                  });
                }
              });
          }
        });
      });
    }
  });
}
// Public methods
// Loader.prototype.syncing = function () {
//   return !!__private.syncIntervalId;
// }
Loader.prototype.syncing = () => __private.syncing

Loader.prototype.sandboxApi = function (call, args, cb) {
  sandboxHelper.callMethod(shared, call, args, cb);
}

Loader.prototype.startSyncBlocks = function () {
  library.logger.debug('startSyncBlocks enter')
  if (!__private.loaded || self.syncing()) {
    library.logger.debug('blockchain is already syncing')
    return
  }
  library.sequence.add(function syncBlocks(cb) {
    library.logger.debug('startSyncBlocks enter sequence');
    __private.syncing = true
    var lastBlock = modules.blocks.getLastBlock();
    __private.loadBlocks(lastBlock, (err) => {
      if (err) {
        library.logger.error('loadBlocks error:', err)
      }
      __private.syncing = false
      __private.blocksToSync = 0
      library.logger.debug('startSyncBlocks end')
      cb()
    });
  // }, function (err) {
  //   err && library.logger.error('loadBlocks timer:', err);
  //   __private.syncTrigger(false);
  //   __private.blocksToSync = 0;

  //   __private.isActive = false;
  //   library.logger.debug('startSyncBlocks end');
   });
}

// Events
Loader.prototype.onPeerReady = function () {
  setImmediate(function nextSync() {
    var lastBlock = modules.blocks.getLastBlock();
    var lastSlot = slots.getSlotNumber(lastBlock.timestamp);
    if (slots.getNextSlot() - lastSlot >= 3) {
      self.startSyncBlocks();
    }
    setTimeout(nextSync, 3 * 1000);
  });

  setImmediate(function nextLoadUnconfirmedTransactions() {
    if (!__private.loaded || self.syncing()) return;
    __private.loadUnconfirmedTransactions(function (err) {
      err && library.logger.error('loadUnconfirmedTransactions timer:', err);
      setTimeout(nextLoadUnconfirmedTransactions, 4 * 1000)
    });

  });
  // setImmediate(() => {
  //   if (!__private.loaded || self.syncing()) return
  //   __private.loadUnconfirmedTransactions((err) => {
  //     if (err) {
  //       library.logger.error('loadUnconfirmedTransactions timer:', err)
  //     }
  //   })
  // })
  setImmediate(function nextLoadSignatures() {
    if (!__private.loaded) return;
    __private.loadSignatures(function (err) {
      err && library.logger.error('loadSignatures timer:', err);

      setTimeout(nextLoadSignatures, 4 * 1000)
    });
  });
}

Loader.prototype.onBind = function (scope) {
  modules = scope;

  __private.loadBlockChain(function (err) {
    if (err) {
      library.logger.error('Failed to load blockchain', err)
      reportor.report("nodejs", {
        subaction: "exit",
        data: {
          method: "onBind",
          reason: "Failed to load blockchain " + err.toString()
        }
      });
      return process.exit(1)
    }
    library.bus.message('blockchainReady');
  });
}

Loader.prototype.onBlockchainReady = function () {
  __private.loaded = true;
}

Loader.prototype.cleanup = function (cb) {
  __private.loaded = false;
  cb();
  // if (!__private.isActive) {
  //   cb();
  // } else {
  //   setImmediate(function nextWatch() {
  //     if (__private.isActive) {
  //       setTimeout(nextWatch, 1 * 1000)
  //     } else {
  //       cb();
  //     }
  //   });
  // }
}

// Shared
shared.status = function (req, cb) {
  cb(null, {
    loaded: __private.loaded,
    now: __private.loadingLastBlock.height,
    blocksCount: __private.total
  });
}

shared.sync = function (req, cb) {
  cb(null, {
    syncing: self.syncing(),
    blocks: __private.blocksToSync,
    height: modules.blocks.getLastBlock().height
  });
}

// Export
module.exports = Loader;
