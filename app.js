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

var crypto = require('crypto');
var assert = require('assert');
var program = require('commander');
var async = require('async');
var fs = require('fs');

var init = require('./src/init');
var setup = require('./src/setup');
var packageJson = require('./package.json');

function verifyGenesisBlock(scope, block) {
  try {
    var payloadHash = crypto.createHash('sha256');
    var payloadLength = 0;

    for (var i = 0; i < block.transactions.length; ++i) {
      var trs = block.transactions[i];
      var bytes = scope.base.transaction.getBytes(trs);
      payloadLength += bytes.length;
      payloadHash.update(bytes);
    }
    var id = scope.base.block.getId(block);
    // console.log(`payloadLength: ${payloadLength}`);
    // console.log(`payloadHash: ${payloadHash.digest().toString('hex')}`);
    assert.equal(payloadLength, block.payloadLength, 'Unexpected payloadLength');
    assert.equal(payloadHash.digest().toString('hex'), block.payloadHash, 'Unexpected payloadHash');
    assert.equal(id, block.id, 'Unexpected block id');
  } catch (e) {
    console.log('verifyGenesisBlock: ', block);
    assert(false, 'Failed to verify genesis block: ' + e);
  }
}

function main() {
  process.stdin.resume();

  program
    .version(packageJson.version)
    .option('-c, --config <path>', 'Config file path')
    .option('-p, --port <port>', 'Listening port number')
    .option('-a, --address <ip>', 'Listening host name or ip')
    .option('-b, --blockchain <path>', 'Blockchain db path')
    .option('-g, --genesisblock <path>', 'Genesisblock path')
    .option('-x, --peers [peers...]', 'Peers list')
    .option('-l, --log <level>', 'Log level')
    .option('-d, --daemon', 'Run entanmo node as daemon')
    .option('-e, --execute <path>', 'exe')
    .option('--dapps <dir>', 'DApps directory')
    .option('--base <dir>', 'Base directory')
    .option('--dataDir <dir>', 'Data directory')
    .option('--no-upnp', "Disable unpn feature")
    .option('--no-acquireip', "Disable acquire ip feature")
    .option('--no-checkpriip', "Disable check private ip type")
    .option("--reportKafka", "Flag - enable to report performance information to kafka")
    .parse(process.argv);

  global.reportKafka = program.reportKafka;

  const options = {
    program: program,
    version: packageJson.version
  }

  var initOptions = init(options);
  if (initOptions == null) {
    console.log('system initialize failure.......');
    return ;
  }

  setup(initOptions, (err, scope) => {
    if (err) {
        scope.logger.fatal(err);
        var baseDir = program.base || path.resolve('.');
        var pidFile = path.join(baseDir, 'etm.pid');
        if (fs.existsSync(pidFile)) {
            fs.unlinkSync(pidFile);
        }
        process.exit(1);
        return;
      }
      verifyGenesisBlock(scope, scope.genesisblock.block);

      if (program.execute) {
        // only for debug use
        // require(path.resolve(program.execute))(scope);
      }

      if (!scope.config.acquireip && scope.config.publicIp == null) {
        scope.logger.warn('Acquire ip is disable, But public ip is not config.');
      }

      scope.bus.message('bind', scope.modules);
      global.modules = scope.modules

      scope.logger.info('Modules ready and launched');
      if (!scope.config.publicIp) {
        scope.logger.warn('Failed to get public ip, block forging MAY not work!');
      }

      process.once('cleanup', function () {
        scope.logger.info('Cleaning up...');
        async.eachSeries(scope.modules, function (module, cb) {
          if (typeof (module.cleanup) == 'function') {
            module.cleanup(cb);
          } else {
            setImmediate(cb);
          }
        }, function (err) {
          if (err) {
            scope.logger.error('Error while cleaning up', err);
          } else {
            scope.logger.info('Cleaned up successfully');
          }
          scope.dbLite.close();
          if (fs.existsSync(pidFile)) {
            fs.unlinkSync(pidFile);
          }
          process.exit(1);
        });
      });

      process.once('SIGTERM', function () {
        process.emit('cleanup');
      })

      process.once('exit', function () {
        scope.logger.info('process exited');
      });

      process.once('SIGINT', function () {
        process.emit('cleanup');
      });

      process.on('uncaughtException', function (err) {
        // handle the error safely
        scope.logger.fatal('uncaughtException', { message: err.message, stack: err.stack });
        process.emit('cleanup');
      });

      if (typeof gc !== 'undefined') {
        setInterval(function () {
          gc();
        }, 60000);
      }
    });
}

main();