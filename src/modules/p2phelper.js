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

    router.map(shared, {
        "get /": "acquireIp"
    });

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
    console.log('========================== onBlockchainReady =======================');
    setImmediate(function nextUpdatePublicIp() {
        console.log('================ nextUpdatePublicIp ================');
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
                    console.log('================= acquireSelfIp =================', body);
                    if (err || response.statusCode != 200) {
                        return ;
                    }
                    if (body.ip && typeof body.ip === "string" && net.isIPv4(body.ip)) {
                        const currentIp = library.config.publicIp;
                        const newIp = body.ip;
                        if (currentIp !== newIp) {
                            library.logger.log("acquireSelfIp: ", newIp);
                            library.config.publicIp = newIp;
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

shared.acquireIp = function (req, cb) {
    const remoteAddress = req.origin.socket.remoteAddress;
    const remoteFamily = req.origin.socket.remoteFamily;
    library.logger.info("acquireIp: ", remoteAddress, remoteFamily);
    setImmediate(() => {
        cb(null, {
            ip: remoteAddress,
            family: remoteFamily
        });
    });
}

module.exports = P2PHelper;