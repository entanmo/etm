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

"use strict";

const async = require("async");

function UnlockVotes() {
  this.create = function (data, trs) {
    trs.args = data.args;
    return trs;
  }

  this.calculateFee = function (trs, sender) {
    return library.base.block.calculateFee();
  }

  this.verify = function (trs, sender, cb) {
    let ids = trs.args;
    if(ids.length < 0){
      return cb('Invalid unlock transactions id!');
    }

    //验证交易id是否已写入数据库
    modules.lockvote.listLockVotes({
      address: sender.address,
      state: 1
    }, function (err, res) {
      if (err) {
        return cb(err);
      }
      if (res.count === 0) {
        return cb('get lock votes count 0');
      }

      let lockSet = new Set();
      for (let i = 0; i < res.trs.length; i++) {
        lockSet.add(res.trs[i].id);
      }
      for (let i = 0; i < ids.length; i++) {
        if (!lockSet.has(ids[i])) {
          return cb('Invalid lock transaction id:'+ ids[i]);
        }
      }

      cb(null, trs);
    });
  }

  this.process = function (trs, sender, cb) {
    setImmediate(cb, null, trs);
  }

  this.getBytes = function (trs) {
    return null;
  }

  this.apply = function (trs, block, sender, cb) {
    let ids = trs.args;
    let lockAmount = 0;
    async.eachSeries(ids, function (id, cb) {
      modules.lockvote.getLockVote(id, function (err, trs) {
        if (err) {
          return cb(err);
        }

        if (trs == null) {
          return cb(new Error("no transaction of LOCK with id:", id));
        }
        
        library.dbLite.query("UPDATE lock_votes SET state = 0 WHERE transactionId = $transactionId", {
          transactionId: id
        }, (err) => {
          if (err) {
            return cb(err);
          }
          lockAmount += trs.asset.lockAmount;
          cb();
        });
      });

    }, function (err) {
      if (err) {
        return cb(err);
      }

      library.base.account.merge(sender.address, {
        balance: lockAmount,
        u_balance: lockAmount,
        blockId: block.id,
        round: modules.round.calc(block.height)
      },cb);
    });
  }

  this.undo = function (trs, block, sender, cb) {
    let ids = trs.args;
    let lockAmount = 0;
    async.eachSeries(ids, function (id, cb) {
      modules.lockvote.getLockVote(id, function (err, trs) {
        if (err) {
          return cb(err);
        }

        if (trs == null) {
          return cb(new Error("no transaction of LOCK with id:", id));
        }

        library.dbLite.query("UPDATE lock_votes SET state = 1 WHERE transactionId = $transactionId", {
          transactionId: id
        }, (err) => {
          if (err) {
            return cb(err);
          }
          lockAmount += trs.asset.lockAmount;
          cb();
        });
      });
    }, function (err) {
      if (err) {
        return cb(err);
      }

      library.base.account.merge(sender.address, {
        balance: -lockAmount,
        u_balance: -lockAmount,
        blockId: block.id,
        round: modules.round.calc(block.height)
      },cb);
    });
  }

  this.applyUnconfirmed = function (trs, sender, cb) {
    const key = sender.address + ":" + trs.type;
    if (library.oneoff.has(key)) {
      return setImmediate(cb, "Double submit");
    }
    library.oneoff.set(key, true);
    setImmediate(cb);
  }

  this.undoUnconfirmed = function (trs, sender, cb) {
    const key = sender.address + ":" + trs.type;
    library.oneoff.delete(key);
    setImmediate(cb);
  }

  this.objectNormalize = function (trs) {
    return trs;
  }

  this.dbRead = function (raw) {
    // TODO
  }

  this.dbSave = function (trs, cb) {
    let ids = trs.args;
    async.eachSeries(ids, function (id, cb) {
      modules.lockvote.getLockVote(id, function (err, trs) {
        if (err) {
          return cb(err);
        }

        if (trs == null) {
          return cb(new Error("no transaction of LOCK with id:", id));
        }
        library.dbLite.query("UPDATE lock_votes SET state = 0 WHERE transactionId = $transactionId", {
          transactionId: id
        }, (err) => {
          if (err) {
            return cb(err);
          }
          cb();
        });
      });

    }, function (err) {
      if (err) {
        return cb(err);
      }
      cb();
    });
  }

  this.ready = function (trs, sender) {
    if (sender.multisignatures.length) {
      if (!trs.signatures) {
        return false;
      }

      return trs.signatures.length >= sender.multimin - 1;
    } else {
      return true;
    }
  }

}

module.exports = UnlockVotes