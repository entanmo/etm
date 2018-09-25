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
        // TODO
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
        // TODO
    }

    this.undeUnconfirmed = function (trs, sender, cb) {
        // TODO
    }

    this.objectNormalize = function (trs) {
        // TODO
    }

    this.dbRead = function (raw) {
        // TODO
    }

    this.ready = function (trs, sender) {
        // TODO
    }

}

module.exports = UnlockVotes