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

module.exports = function (zscheme) {
  return function(req, res, next) {
    req.sanitize = sanitize;

    function sanitize(value, scheme, callback) {
      return zscheme.validate(value, scheme, function (err, valid) {
        return callback(null, {
          isValid: valid,
          issues: err? err[0].message + ": " + err[0].path : null
        }, value);
      });
    }

    next();
  };
}
