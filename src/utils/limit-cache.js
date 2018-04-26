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

const DEFAULT_LIMIT = 10000

class LimitCache  {
  constructor(options) {
    if (!options) options = {}
    this.limit = options.limit || DEFAULT_LIMIT
    this.index = []
    this.cache = new Map
  }

  set(key, value) {
    if (this.cache.size >= this.limit && !this.cache.has(key)) {
      let dropKey = this.index.shift()
      this.cache.delete(dropKey)
    }
    this.cache.set(key, value)
    this.index.push(key)
  }

  has(key) {
    return this.cache.has(key)
  }
}

module.exports = LimitCache