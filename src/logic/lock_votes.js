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

var constants = require('../utils/constants.js');

function LockVotes() {
  this.create = function (data, trs) {
    trs.args = data.args;
    return trs;
  }

  this.calculateFee = function (trs, sender) {
    return library.base.block.calculateFee();
  }

  this.verify = function (trs, sender, cb) {
    let lockAmount = Number(trs.args[0]);
    const amount = lockAmount + trs.fee;
    if(!Number.isSafeInteger(lockAmount) || lockAmount < constants.fixedPoint){
      return setImmediate(cb, 'Invalid lock amount!');
    }
    if(sender.balance < amount){
      return setImmediate(cb, 'Not enough balance');
    }

    setImmediate(cb, null, trs);
  }

  this.process = function (trs, sender, cb) {
    setImmediate(cb, null, trs);
  }

  this.getBytes = function (trs) {
    return null;
  }

  this.apply = function (trs, block, sender, cb) {
    const lockAmount = Number(trs.args[0]);
    const amount = lockAmount + trs.fee;

    if(sender.balance < amount){
      return setImmediate(cb, 'Not enough balance');
    }

    library.base.account.merge(sender.address, {
      balance: -amount,
      u_balance: -amount,
      blockId: block.id,
      round: modules.round.calc(block.height)
    }, function (err, sender) {
      void (sender);

      if (err) {
        return cb(err);
      }
      return cb();

      /*
      return library.dbLite.query("INSERT INTO lock_votes(address, lockAmount, originHeight, currentHeight, transactionId, state) VALUES($address, $lockAmount, $originHeight, $currentHeight, $transactionId, 1)", {
        address: sender.address,
        lockAmount: lockAmount,
        originHeight: block.height,
        currentHeight: block.height,
        transactionId: trs.id
      }, cb);
      */
    });
  }

  this.undo = function (trs, block, sender, cb) {
    const amount = Number(trs.args[0]) + trs.fee;
    library.base.account.merge(sender.address, {
      balance: amount,
      u_balance: amount,
      blockId: block.id,
      round: modules.round.calc(block.height)
    }, function (err, sender) { return cb(err); });
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
    if (!raw.lv_lockAmount || (raw.lv_state !== 0 && raw.lv_state !== 1) || !raw.lv_address || !raw.lv_originHeight || !raw.lv_currentHeight) {
      return null;
    } else {
      return {
        address: raw.lv_address,
        originHeight: parseInt(raw.lv_originHeight),
        currentHeight: parseInt(raw.lv_currentHeight),
        lockAmount: parseInt(raw.lv_lockAmount),
        state: parseInt(raw.lv_state)
      };
    }
  }

  this.dbSave = function (trs, cb) {
    const lockAmount = Number(trs.args[0]);
    if (library.genesisblock.block.id == trs.blockId) {
      const block = library.genesisblock.block;
      library.dbLite.query("INSERT INTO lock_votes(address, lockAmount, originHeight, currentHeight, transactionId, state) VALUES($address, $lockAmount, $originHeight, $currentHeight, $transactionId, 1)", {
        address: trs.senderId,
        lockAmount: lockAmount,
        originHeight: block.height,
        currentHeight: block.height,
        transactionId: trs.id
      }, cb);
    } else {
      global.modules.blocks.getBlock({id: trs.blockId}, (err, result) => {
        if (err) {
          return cb(err);
        }

        const block = result.block;
        library.dbLite.query("INSERT INTO lock_votes(address, lockAmount, originHeight, currentHeight, transactionId, state) VALUES($address, $lockAmount, $originHeight, $currentHeight, $transactionId, 1)", {
          address: trs.senderId,
          lockAmount: lockAmount,
          originHeight: block.height,
          currentHeight: block.height,
          transactionId: trs.id
        }, cb);
      });
    }
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

module.exports = LockVotes