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

var crypto = require('crypto')
var base58check = require('./base58check')

const NORMAL_PREFIX = 'A' // A

module.exports = {
  isAddress: function (address) {
    /*
    if (typeof address !== 'string') {
      return false
    }
    if (!/^[0-9]{1,20}$/g.test(address)) {
      if (!base58check.decodeUnsafe(address.slice(1))) {
        return false
      }
      if (['A'].indexOf(address[0]) == -1) {
        return false
      }
    }
    return true
    */
    return this.isBase58CheckAddress(address);
  },

  isBase58CheckAddress: function (address) {
    if (typeof address !== 'string') {
      return false
    }
    if (!base58check.decodeUnsafe(address.slice(1))) {
      return false
    }
    if (['A'].indexOf(address[0]) == -1) {
      return false
    }
    return true
  },

  generateBase58CheckAddress: function (publicKey) {
    if (typeof publicKey === 'string') {
      publicKey = Buffer.from(publicKey, 'hex')
    }
    var h1 = crypto.createHash('sha256').update(publicKey).digest()
    var h2 = crypto.createHash('ripemd160').update(h1).digest()
    return NORMAL_PREFIX + base58check.encode(h2)
  },
}