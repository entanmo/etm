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

var util = require('util');
var async = require('async');
var path = require('path');
var Router = require('../utils/router.js');
var sandboxHelper = require('../utils/sandbox.js');

// Private fields
var modules, library, self, __private = {}, shared = {};

__private.loaded = false

// Constructor
function Server(cb, scope) {
  library = scope;
  self = this;
  self.__private = __private;
  __private.attachApi();

  setImmediate(cb, null, self);
}

// Private methods
__private.attachApi = function() {
  var router = new Router();

  router.use(function (req, res, next) {
    if (modules) return next();
    res.status(500).send({success: false, error: "Blockchain is loading"});
  });

  router.get('/', function (req, res) {
    if (__private.loaded) {
      res.render('wallet.html', {layout: false});
    } else {
      res.render('index.html');
    }
  });

  router.get('/api/blocks/totalsupply', function (req, res) {
    res.status(200).send('' + modules.blocks.getSupply() / 100000000);
  });

  router.get('/api/blocks/circulatingsupply', function (req, res) {
    res.status(200).send('' + modules.blocks.getCirculatingSupply() / 100000000);
  });

  router.get('/dapps/:id', function (req, res) {
    res.render('dapps/' + req.params.id + '/index.html');
  });

  router.use(function (req, res, next) {
    if (req.url.indexOf('/api/') == -1 && req.url.indexOf('/peer/') == -1) {
      return res.redirect('/');
    }
    next();
    // res.status(500).send({ success: false, error: 'api not found' });
  });

  library.network.app.use('/', router);
}

// Public methods

Server.prototype.sandboxApi = function (call, args, cb) {
  sandboxHelper.callMethod(shared, call, args, cb);
}

// Events
Server.prototype.onBind = function (scope) {
  modules = scope;
}

Server.prototype.onBlockchainReady = function () {
  __private.loaded = true;
}

Server.prototype.cleanup = function (cb) {
  __private.loaded = false;
  cb();
}

// Shared

// Export
module.exports = Server;
