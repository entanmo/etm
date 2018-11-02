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

var path = require('path');
var fs = require('fs');

var Logger = require('./log/logger');

module.exports = function init(options) {
    const { program, version } = options;

    // 获取工作目录
    var baseDir = program.base || path.resolve('.');
    
    var pidFile = path.join(baseDir, 'etm.pid');
    if (fs.existsSync(pidFile)) {
        console.log('Failed: etm server already started.');
        return ;
    }
    
    var appConfigFile = path.join(baseDir, 'config', 'config.json');
    if (program.config) {
        appConfigFile = path.resolve(process.cwd(), program.config);
    }
    var appConfig = JSON.parse(fs.readFileSync(appConfigFile, 'utf8'));

    if (!appConfig.dapp.masterpassword) {
        var randomstring = require("randomstring");
        appConfig.dapp.masterpassword = randomstring.generate({
            length: 12,
            readable: true,
            charset: 'alphanumeric'
        });
        fs.writeFileSync(appConfigFile, JSON.stringify(appConfig, null, 2), "utf8");
    }
    
    // if(!(appConfig.forging && appConfig.forging.secret && Array.isArray(appConfig.forging.secret) && appConfig.forging.secret.length < 2)){
    //     console.log('secret error,the length needs to be less than or equal to 1');
    //     return;
    // }

    appConfig.version = version;
    appConfig.baseDir = baseDir;
    appConfig.buildVersion = 'development';
    appConfig.netVersion = process.env.NET_VERSION || 'localnet';
    appConfig.publicDir = path.join(baseDir, 'public', 'dist');
    appConfig.dappsDir = program.dapps || path.join(baseDir, 'dapps')
    appConfig.upnp = program.upnp;
    appConfig.acquireip = program.acquireip;
    appConfig.checkpriip = program.checkpriip;

    global.Config = appConfig;

    var genesisblockFile = path.join(baseDir, 'config', 'genesisBlock.json');
    if (program.genesisblock) {
        genesisblockFile = path.resolve(process.cwd(), program.genesisblock);
    }
    var genesisblock = JSON.parse(fs.readFileSync(genesisblockFile, 'utf8'));

    if (program.port) {
        appConfig.port = program.port;
    }

    if (program.address) {
        appConfig.address = program.address;
    }

    if (program.peers) {
        if (typeof program.peers === 'string') {
            appConfig.peers.list = program.peers.split(',').map(function (peer) {
                peer = peer.split(":");
                return {
                    ip: peer.shift(),
                    port: peer.shift() || appConfig.port
                };
            });
        } else {
            appConfig.peers.list = [];
        }
    }

    if (appConfig.netVersion === 'mainnet') {
        var seeds = [
            757137132,
            1815983436,
            759980934,
            759980683,
            1807690192,
            1758431015,
            1760474482,
            1760474149,
            759110497,
            757134616
        ];
        var ip = require('ip');
        for (var i = 0; i < seeds.length; ++i) {
            appConfig.peers.list.push({ ip: ip.fromLong(seeds[i]), port: 80 });
        }
    }

    if (program.log) {
        appConfig.logLevel = program.log;
    }

    var protoFile = path.join(baseDir, 'src', 'proto', 'index.proto');
    if (!fs.existsSync(protoFile)) {
        console.log('Failed: proto file not exists!');
        return;
    }

    if (program.daemon) {
        console.log('etm server started as daemon ...');
        require('daemon')({cwd: process.cwd()});
        fs.writeFileSync(pidFile, process.pid, 'utf8');
    }

    var logger = new Logger({
        filename: path.join(baseDir, 'logs', 'etm.log'),
        echo: program.deamon ? null : appConfig.logLevel,
        errorLevel: appConfig.logLevel
    });

    /*
    var options = {
        dbFile: program.blockchain || path.join(baseDir, 'blockchain.db'),
        appConfig: appConfig,
        genesisblock: genesisblock,
        logger: logger,
        protoFile: protoFile
    };
    */

    if (program.reindex) {
        appConfig.loading.verifyOnLoading = true;
    }

    global.featureSwitch = {}
    global.state = {}
    
    global.featureSwitch.enableLongId = true
    global.featureSwitch.enable1_3_0 = true
    global.featureSwitch.enableClubBonus = (!!global.state.clubInfo)
    global.featureSwitch.enableMoreLockTypes = true
    global.featureSwitch.enableLockReset = true
    global.featureSwitch.enableUIA = true


    return {
        dbFile: program.blockchain || path.join(baseDir, 'blockchain.db'),
        appConfig: appConfig,
        genesisblock: genesisblock,
        logger: logger,
        protoFile: protoFile
    };
}