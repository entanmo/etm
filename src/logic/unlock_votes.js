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
    // TODO
  }

  this.dbRead = function (raw) {
    // TODO
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