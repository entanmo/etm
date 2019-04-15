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

var os = require("os");
var sandboxHelper = require('../utils/sandbox.js');
var slots = require('../utils/slots.js');
var Router = require('../utils/router.js');
var shell = require('../utils/shell.js');
const shell2 = require("shelljs")
var fs= require("fs");
var chaos = require('../utils/chaos.js');
var ip = require('ip');
var crypto = require('crypto');
var path = require('path');
// Private fields
var modules, library, self, __private = {}, shared = {};

__private.version, __private.osName, __private.port;

// Constructor
function System(cb, scope) {
  library = scope;
  self = this;
  self.__private = __private;
  __private.backupDate ;
  __private.isBackUp = false; 
  __private.version = library.config.version;
  __private.port = library.config.port;
  __private.magic = library.config.magic;
  __private.osName = os.platform() + os.release();
  __private.dbPath = path.join(global.Config.baseDir, global.Config.dbName);
  __private.backupPath =path.join(global.Config.dataDir, global.Config.dbName);
  //library.logger.debug("dbPath ---"+__private.dbPath)
  //library.logger.debug("backupPath ---"+ __private.backupPath)
  __private.attachApi();

  setImmediate(cb, null, self);
}
System.prototype.onNewBlock = function (block, votes, broadcast) {
  if(block.height%slots.roundBlocks == slots.roundBlocks - 80){
    var d = new Date();
    var fullday= d.getFullYear().toString() + (d.getMonth()+1).toString() + d.getDate().toString();
    if( __private.isBackUp == true || __private.backupDate == fullday  ){
      __private.isBackUp == true ?
      library.logger.debug("__private.isBackUp "+__private.isBackUp ):library.logger.debug("backuped today "+fullday)
      return
    }
    let hash = crypto.createHash('sha256').update(library.config.magic).digest('hex');
    let index ;
    var hours = d.getHours();
    //console.log("chaos get days "+fullday)
    //console.log("chaos get hours "+hours)
    if(library.config.publicIp){
      index = chaos(hash, ip.toLong(library.config.publicIp)+ __private.port  , 24);// 0 - 23
      library.logger.debug("backupDb chaos get index "+index)
    }else{
      index = chaos(hash, ip.toLong('127.0.0.0')+ __private.port , 24);
      library.logger.debug("backupDb chaos get index "+index)
    }
    library.logger.debug("chaos get hours "+hours)
    if(index == hours){// 0 - 23   hours
      if(os.platform() == 'win32'){
          shell2.exec('copy /y '+ __private.dbPath + ' '+ __private.backupPath ,
          function(code, stdout, stderr) {
          library.logger.debug('Exit code:', code);
          library.logger.debug('backupDb Program stderr:', stderr);
          library.logger.debug("copy blockchain.db in system at height : "+JSON.stringify(block.height));
          if(!stderr){
            __private.backupDate = fullday
            library.logger.debug("backupDb ok "+fullday + ' at hours ' + hours)
          }
        });
      }else{
        shell2.exec('cp -f '+ __private.dbPath + ' '+ __private.backupPath ,
        function(code, stdout, stderr) {
        library.logger.debug('Exit code:', code);
        library.logger.debug('backupDb Program stderr:', stderr);
        library.logger.debug("copy blockchain.db in system at height : "+JSON.stringify(block.height));
        if(!stderr){
          __private.backupDate = fullday
          library.logger.debug("backupDb ok "+fullday + ' at hours ' + hours)
        }
      });
    }
   }
 }
}
System.prototype.recovery = function (cb) {
  fs.exists(__private.backupPath, function(exists) {
    if(exists){
     // shell2.cp('-f','data/'+library.config.dbName, library.config.dbName);
     // library.logger.debug("recovery");
     __private.isBackUp = true;

     if(os.platform() == 'win32'){
          shell2.exec('copy  '+__private.backupPath+ ' '+ __private.dbPath,
          function(code, stdout, stderr) {
          __private.isBackUp = false;
          library.logger.debug('recovery code:', code);
          library.logger.debug('recovery blockchain.db  Program stderr:', stderr);
          cb(exists)
        });
     }else{
        shell2.exec('cp -f '+__private.backupPath +' '+__private.dbPath,
        function(code, stdout, stderr) {
        __private.isBackUp = false;
        library.logger.debug('recovery code:', code);
        library.logger.debug('recovery blockchain.db  Program stderr:', stderr);
        cb(exists)
      });
     }
    }else{
      cb(false)
    }
  })
}
// Private methods
__private.attachApi = function () {
  var router = new Router();

  router.use(function (req, res, next) {
    if (modules) return next();
    res.status(500).send({ success: false, error: "Blockchain is loading" });
  });

  router.map(shared, {
    "get /": "getSystemInfo"
  });

  router.use(function (req, res, next) {
    res.status(500).send({ success: false, error: "API endpoint not found" });
  });

  library.network.app.use('/api/system', router);
  library.network.app.use(function (err, req, res, next) {
    if (!err) return next();
    library.logger.error(req.url, err.toString());
    res.status(500).send({ success: false, error: err.toString() });
  });
}


//Shared methods

shared.getSystemInfo = function (req, cb) {

  var lastBlock = modules.blocks.getLastBlock();
  var systemInfo = shell.getOsInfo();

  return cb(null, {
    os: os.platform() +"_"+ os.release(),    
    version: library.config.version,
    timestamp : Date.now(),

    lastBlock:{
      height: lastBlock.height,
      timestamp : slots.getRealTime(lastBlock.timestamp),
      behind: slots.getNextSlot() - (slots.getSlotNumber(lastBlock.timestamp) +1)
    },

    systemLoad:{
      cores : systemInfo.cpucore,
      loadAverage : systemInfo.loadavg,
      freeMem: systemInfo.memfreemb, 
      totalMem: systemInfo.memtotalmb
    }
  });  
}

// Private methods


// Public methods
System.prototype.getOS = function () {
  return __private.osName;
}

System.prototype.getVersion = function () {
  return __private.version;
}

System.prototype.getPort = function () {
  return __private.port;
}

System.prototype.getMagic = function () {
  return __private.magic;
}

System.prototype.sandboxApi = function (call, args, cb) {
  sandboxHelper.callMethod(shared, call, args, cb);
}

// Events
System.prototype.onBind = function (scope) {
  modules = scope;
}

// Shared

// Export
module.exports = System;
