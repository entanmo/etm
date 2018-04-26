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
var Tmdb = require('./tmdb.js')

class BalanceManager {
  constructor() {
    this.tmdb = new Tmdb
  }

  getNativeBalance(address) {
    return this.tmdb.get([address, 1])
  }

  setNativeBalance(address, balance) {
    if (typeof balance === 'number') balance = String(balance)
    this.tmdb.set([address, 1], bignum(balance).toString())
  }

  addNativeBalance(address, amount) {
    if (typeof amount === 'number') amount = String(amount)
    var keys = [address, 1]
    var balance = this.tmdb.get(keys) || '0'
    this.tmdb.set(keys, bignum(balance).plus(amount).toString())
  }

  getAssetBalance(address, currency) {
    return this.tmdb.get([address, currency])
  }

  setAssetBalance(address, currency, balance) {
    if (typeof balance === 'number') amount = String(balance)
    this.tmdb.set([address, currency], bignum(balance).toString())
  }

  addAssetBalance(address, currency, amount) {
    if (typeof amount === 'number') amount = String(amount)
    var keys = [address, currency]
    var balance = this.tmdb.get(keys) || '0'
    this.tmdb.set(keys, bignum(balance).plus(amount).toString())
  }

  rollback() {
    this.tmdb.rollback()
  }

  commit() {
    this.tmdb.commit()
  }
}

module.exports = BalanceManager