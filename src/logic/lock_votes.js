"use strict";

function LockVotes() {
  this.create = function (data, trs) {
    trs.args = data.args;
    return trs;
  }

  this.calculateFee = function (trs, sender) {
    return library.base.block.calculateFee();
  }

  this.verify = function (trs, sender, cb) {
    let amount = Number(trs.args[0]);
    if(amount < 0){
      return cb('Invalid lock amount!');
    }

    let fee = this.calculateFee(trs, sender);
    if(sender.balance < amount + fee){
      return cb('Not enough balance');
    }

    cb(null, trs);
  }

  this.process = function (trs, sender, cb) {
    setImmediate(cb, null, trs);
  }

  this.getBytes = function (trs) {
    return null;
  }

  this.apply = function (trs, block, sender, cb) {
    // TODO
  }

  this.undo = function (trs, block, sender, cb) {
    // TODO
  }

  this.applyUnconfirmed = function (trs, sender, cb) {
    var key = sender.address + ':' + trs.type
    if (library.oneoff.has(key)) {
      return setImmediate(cb, 'Double submit')
    }
    library.oneoff.set(key, true)
    setImmediate(cb)
  }

  this.undeUnconfirmed = function (trs, sender, cb) {
    var key = sender.address + ':' + trs.type
    library.oneoff.delete(key)
    setImmediate(cb)
  }

  this.objectNormalize = function (trs) {
    return trs;
  }

  this.dbRead = function (raw) {
    // TODO
  }

  this.ready = function (trs, sender) {
    if (!__private.types[trs.type]) {
      throw Error('Unknown transaction type ' + trs.type);
    }

    if (!sender) {
      return false;
    }

    return __private.types[trs.type].ready.call(this, trs, sender);
  }

}

module.exports = LockVotes