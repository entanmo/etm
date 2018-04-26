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

const shell = require("shelljs")
const os = require('os')

function exec(cmd){
  return shell.exec(cmd).stdout
}

function getProcessInfo(name){
  return exec("ps aux | grep " + name + " | egrep -v 'grep'")
}  

function getOsInfo(){
  let info = {}
  info.release = os.release()
  info.cpucore = os.cpus().length
  info.memfreemb = os.freemem()/1024/1024
  info.memtotalmb = os.totalmem()/1024/1024
  info.loadavg = os.loadavg()
  return info
}

function getInfo(){
  let info = getOsInfo()
  info.sqlite = getProcessInfo('blockchain.db')
  info.node = getProcessInfo('app.js')
  return info
}

// console.log(getInfo())
module.exports = {
  exec,
  getProcessInfo,
  getOsInfo,
  getInfo
}