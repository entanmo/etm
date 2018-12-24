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

const constants = require('../utils/constants.js');
const addressHelper = require("../utils/address");

function DelayTransfer() {
  this.create = function (data, trs) {
    trs.recipientId = data.recipientId;
    trs.amount = data.amount;
    trs.args = data.args;
    return trs;
  }

  this.calculateFee = function (trs, sender) {
    return library.base.block.calculateFee();
  }

  this.verify = function (trs, sender, cb) {
    let expired = Number(trs.args[0]);
    if(!Number.isSafeInteger(expired) || expired <= 0 /* || //TODO */){
        return cb('Invalid expired value');
    }

    if (!addressHelper.isAddress(trs.recipientId)) {
        return cb("Invalid recipientId");
    }

    if (trs.amount <= 0) {
        return cb("Invalid delay transfer amount");
    }

    if (trs.recipientId == sender.address) {
        return cb("Invalid recipientId, cannot be your self");
    }

    return cb(null, trs);
  }

  this.process = function (trs, sender, cb) {
    setImmediate(cb, null, trs);
  }

  this.getBytes = function (trs) {
    return null;
  }

  this.apply = function (trs, block, sender, cb) {
    const expired = Number(trs.args[0]);
    library.delayTransferMgr.addDelayTransfer(trs.id, {
      transactionId: trs.id,
      senderId: trs.senderId,
      recipientId: trs.recipientId,
      amount: trs.amount,
      expired: block.height + expired
    })
    setImmediate(cb);
  }

  this.undo = function (trs, block, sender, cb) {
    library.delayTransferMgr.removeDelayTransfer(trs.id);
    setImmediate(cb);
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
    delete trs.blockId;
    return trs;
  }

  this.dbRead = function (raw) {
    if (!raw.dt_expired || (raw.dt_state != 0 && raw.dt_state != 1)) {
        return null;
    } else {
        return {
            expired: raw.dt_expired,
            state: parseInt(raw.dt_state)
        };
    }
  }

  this.dbSave = function (trs, cb) {
    const expired = Number(trs.args[0]);
    if (library.genesisblock.block.id == trs.blockId) {
        // genesis block
        const block = library.genesisblock.block;
        library.dbLite.query("INSERT INTO delay_transfer(expired, transactionId, state)"+
        "VALUES($expired, $transactionId, 0);", {
            expired: block.height + expired,
            transactionId: trs.id
        }, cb);
    } else {
        global.modules.blocks.getBlock({id: trs.blockId}, (err, result) => {
            if (err) {
                return cb(err);
            }

            const block = result.block;
            library.dbLite.query("INSERT INTO delay_transfer(expired, transactionId, state)"+
            "VALUES($expired, $transactionId, 0);", {
                expired: block.height + expired,
                transactionId: trs.id
            }, cb);
        })
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

module.exports = DelayTransfer;