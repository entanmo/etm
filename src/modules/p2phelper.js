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

const Router = require('../utils/router');
const sandboxHelper = require('../utils/sandbox');
const ip = require('ip');
const request = require('request');
const net = require('net');
var extend = require('extend');

var modules, library, self, __private = {}, shared = {};

function P2PHelper(cb, scope) {
    library = scope;
    self = this;
    self.__private = __private;
    __private.attachApi();

    setImmediate(cb, null, self);
}

__private.attachApi = function () {
    var router = new Router();

    router.use(function (req, res, next) {
        if (modules) return next();

        res.status(500).send({success: false, error: "Blockchain is loading"});
    });

    /*
    router.map(shared, {
        "get /": "acquireIp"
    });
    */
   router.get("/", shared.acquireIp.bind(shared));

    router.use(function(req, res) {
        res.status(500).send({success: false, error: "API endpoint not found"});
    });

    library.network.app.use('/api/p2phelper', router);
    library.network.app.use(function (err, req, res, next) {
        if (!err) return next();
        library.logger.error(req.url, err.toString());
        res.status(500).send({success: false, error: err.toString()});
    });
}

P2PHelper.prototype.onBind = function (scope) {
    modules = scope;
}

P2PHelper.prototype.onBlockchainReady = function () {
    setImmediate(function nextUpdatePublicIp() {
        modules.peer.list({limit: 1}, function (err, peers) {
            if (!err && peers.length) {
                var peer = peers[0];

                var url = "/api/p2phelper";
                if (peer.address) {
                    url = "http://" + peer.address + url;
                } else {
                    url = "http://" + ip.fromLong(peer.ip) + ":" + peer.port + url;
                }

                var req = {
                    url: url,
                    method: "GET",
                    json: true,
                    timeout: library.config.peers.options.timeout,
                    forever: true
                };
                request(req, function (err, response, body) {
                    if (err || response.statusCode != 200) {
                        return ;
                    }
                    if (body.ip && typeof body.ip === "string" && net.isIPv4(body.ip)) {
                        const currentIp = library.config.publicIp;
                        const newIp = body.ip;
                        if (currentIp !== newIp) {
                            library.logger.log("acquireSelfIp: ", newIp);
                            library.config.publicIp = newIp;
                            modules.transport.onPublicIpChanged(library.config.publicIp, library.config.port, true);
                        }                        
                    }
                });
            }
        });
        setTimeout(nextUpdatePublicIp, 5 * 1000);
    });
}

P2PHelper.prototype.onPeerReady = function () {
}

P2PHelper.prototype.sandboxApi = function (call, args, cb) {
    sandboxHelper.callMethod(shared, call, args, cb);
}

shared.acquireIp = function (req, res) {
    const remoteAddress = req.socket.remoteAddress;
    const remoteFamily = req.socket.remoteFamily;
    library.logger.info("acquireIp: ", remoteAddress, remoteFamily);
    const response = {
        ip: remoteAddress,
        family: remoteFamily
    };
    return res.json(extend({}, {"success": true}, response));
}

module.exports = P2PHelper;