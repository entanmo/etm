"use strict";

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
    modules.transactions.listLockVotes({
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
          return cb('Invalid address not found', ids[i]);
        }
      }
    })

    cb(null, trs);
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
    async.eachSeries(ids, function (id, cb0) {
      modules.transactions.getLockVote(id, function (err, trs) {
        if (err) {
          return cb(err);
        }
        lockAmount += trs.lockAmount;
      });

      library.dbLite.query("UPDATE lock_votes SET state = 0 WHERE transactionId = $transactionId", {
        transactionId: id
      }, cb0);
    }, function () {
      library.base.account.merge(sender.address, {
        balance: lockAmount,
        blockId: block.id,
        round: modules.round.calc(block.height)
      },cb);
    });
  }

  this.undo = function (trs, block, sender, cb) {
    let ids = trs.args;
    let lockAmount = 0;
    async.eachSeries(ids, function (id, cb0) {
      modules.transactions.getLockVote(id, function (err, trs) {
        if (err) {
          return cb(err);
        }
        lockAmount += trs.lockAmount;
      });

      library.dbLite.query("UPDATE lock_votes SET state = 1 WHERE transactionId = $transactionId", {
        transactionId: id
      }, cb0);
    }, function () {
      library.base.account.merge(sender.address, {
        balance: -lockAmount,
        blockId: block.id,
        round: modules.round.calc(block.height)
      },cb);
    });
  }

  this.applyUnconfirmed = function (trs, sender, cb) {
    setImmediate(cb);
  }

  this.undoUnconfirmed = function (trs, sender, cb) {
    setImmediate(cb);
  }

  this.objectNormalize = function (trs) {
    return trs;
  }

  this.dbRead = function (raw) {
    return null;
  }

  this.dbSave = function (trs, cb) {
    return null;
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