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

var bignum = require('./bignumber')

module.exports = {
  validate: function (amount) {
    if (typeof amount != 'string') return 'Invalid amount type'
    if (!/^[1-9][0-9]*$/.test(amount)) return 'Amount should be integer'

    var bnAmount
    try {
      bnAmount = bignum(amount)
    } catch (e) {
      return 'Failed to convert'
    }
    if (bnAmount.lt(1) || bnAmount.gt('1e48')) return 'Invalid amount range'
    return null
  },

  calcRealAmount: function (amount, precision) {
    let ba = bignum(amount)
    while (precision > 0) {
      if (precision > 8) {
        ba = ba.div(Math.pow(10, 8))
      } else {
        ba = ba.div(Math.pow(10, precision))
      }
      precision -= 8
    }
    return ba.toString()
  }
}