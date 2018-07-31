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
var os = require('os');
var https = require('https');
var EventEmitter = require('events');
var async = require('async');
var z_schema = require('z-schema');
var ip = require('ip');
var Sequence = require('./utils/sequence.js');
var slots = require('./utils/slots.js');
var natUpnp = require('nat-upnp');

function getPublicIp() {
    var publicIp = null;
    try {
        var ifaces = os.networkInterfaces();
        Object.keys(ifaces).forEach(function (ifname) {
        ifaces[ifname].forEach(function (iface) {
            if ('IPv4' !== iface.family || iface.internal !== false) {
            // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
            return;
            }
            if (!ip.isPrivate(iface.address)) {
            publicIp = iface.address;
            }
        });
        });
    } catch (e) {
    }
    return publicIp;
}

function portMapping(publicPort, privatePort) {
  var client = natUpnp.createClient();
  client.portMapping({
    public: publicPort,
    private: privatePort,
    ttl: 10
  }, function (err) {
    if(err){
      console.log('UPnP port Mapping Error:', err);
    }
  });
}
/*
const moduleNames = [
  'server',
  'accounts',
  'transactions',
  'signatures',
  'transport',
  'loader',
  'system',
  'peer',
  'delegates',
  'round',
  'multisignatures',
  'uia',
  'dapps',
  'sql',
  'blocks',
];

const api = [
  'accounts',
  'transactions',
  'signatures',
  'transport',
  'peer',
  'delegates',
  'multisignatures',
  'dapps',
  'blocks'
];
*/

const config = {
  modules: {
    'server': './modules/server.js',
    'accounts': './modules/accounts.js',
    'transactions': './modules/transactions.js',
    'signatures': './modules/signatures.js',
    'transport': './modules/transport.js',
    'loader': './modules/loader.js',
    'system': './modules/system.js',
    'peer': './modules/peer.js',
    'delegates': './modules/delegates.js',
    'round': './modules/round.js',
    'multisignatures': './modules/multisignatures.js',
    'uia': './modules/uia.js',
    'dapps': './modules/dapps.js',
    'sql': './modules/sql.js',
    'blocks': './modules/blocks.js',
    'p2phelper': './modules/p2phelper.js'
  },

  api: {
    // 'accounts': { http: './api/http/accounts.js' },
  }
};

module.exports = function setup(options, done) {
    var modules = [];
    var dbFile = options.dbFile;
    var appConfig = options.appConfig;
    var genesisblock = options.genesisblock;

    portMapping(appConfig.port,appConfig.port);
    
    if (!appConfig.publicIp) {
      appConfig.publicIp = getPublicIp();
    }
    else{
      if (ip.isPrivate(appConfig.publicIp)) {
        appConfig.publicIp = null;
        }
    }

    async.auto({
      config: function (cb) {
        cb(null, appConfig);
      },
  
      logger: function (cb) {
        cb(null, options.logger);
      },
  
      genesisblock: function (cb) {
        cb(null, {
          block: genesisblock
        });
      },
  
      protobuf: function (cb) {
        var protobuf = require('./utils/protobuf.js');
        protobuf(options.protoFile, cb);
      },
  
      scheme: function (cb) {
        z_schema.registerFormat("hex", function (str) {
          var b = null
          try {
            b = new Buffer(str, "hex");
          } catch (e) {
            return false;
          }
  
          return b && b.length > 0;
        });
  
        z_schema.registerFormat('publicKey', function (str) {
          if (str.length == 0) {
            return true;
          }
  
          try {
            var publicKey = new Buffer(str, "hex");
  
            return publicKey.length == 32;
          } catch (e) {
            return false;
          }
        });
  
        z_schema.registerFormat('splitarray', function (str) {
          try {
            var a = str.split(',');
            if (a.length > 0 && a.length <= 1000) {
              return true;
            } else {
              return false;
            }
          } catch (e) {
            return false;
          }
        });
  
        z_schema.registerFormat('signature', function (str) {
          if (str.length == 0) {
            return true;
          }
  
          try {
            var signature = new Buffer(str, "hex");
            return signature.length == 64;
          } catch (e) {
            return false;
          }
        })
  
        z_schema.registerFormat('listQuery', function (obj) {
          obj.limit = 100;
          return true;
        });
  
        z_schema.registerFormat('listDelegates', function (obj) {
          obj.limit = slots.delegates;
          return true;
        });
  
        z_schema.registerFormat('checkInt', function (value) {
          if (isNaN(value) || parseInt(value) != value || isNaN(parseInt(value, 10))) {
            return false;
          }
  
          value = parseInt(value);
          return true;
        });
  
        z_schema.registerFormat('ip', function (value) {
  
        });
  
        cb(null, new z_schema())
      },
  
      network: ['config', function (scope, cb) {
        var express = require('express');
        var compression = require('compression');
        var cors = require('cors');
        var app = express();
        
        app.use(compression({ level: 6 }));
        app.use(cors());
        app.options("*", cors());
  
        var server = require('http').createServer(app);
        var io = require('socket.io')(server);
  
        if (scope.config.ssl.enabled) {
          var privateKey = fs.readFileSync(scope.config.ssl.options.key);
          var certificate = fs.readFileSync(scope.config.ssl.options.cert);
  
          var https = require('https').createServer({
            key: privateKey,
            cert: certificate,
            ciphers: "ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:"
                   + "ECDHE-RSA-AES128-SHA256:DHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384:DHE-RSA-AES256-SHA384:ECDHE-RSA-AES256-SHA256:DHE-RSA-AES256-SHA256:HIGH:"
                   + "!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA"
          }, app);
  
          var https_io = require('socket.io')(https);
        }
  
        cb(null, {
          express: express,
          app: app,
          server: server,
          io: io,
          https: https,
          https_io: https_io
        });
      }],
  
      dbSequence: ["logger", function (scope, cb) {
        var sequence = new Sequence({
          name: "db",
          onWarning: function (current, limit) {
            scope.logger.warn("DB queue", current)
          }
        });
        cb(null, sequence);
      }],
  
      sequence: ["logger", function (scope, cb) {
        var sequence = new Sequence({
          name: "normal",
          onWarning: function (current, limit) {
            scope.logger.warn("Main queue", current)
          }
        });
        cb(null, sequence);
      }],
  
      balancesSequence: ["logger", function (scope, cb) {
        var sequence = new Sequence({
          name: "balance",
          onWarning: function (current, limit) {
            scope.logger.warn("Balance queue", current)
          }
        });
        cb(null, sequence);
      }],
  
      connect: ['config', 'genesisblock', 'logger', 'network', function (scope, cb) {
        var bodyParser = require('body-parser');
        var methodOverride = require('method-override');
        var requestSanitizer = require('./utils/request-sanitizer');
        var queryParser = require('./utils/express-query-int');
        
        scope.network.app.engine('html', require('ejs').renderFile);
        scope.network.app.use(require('express-domain-middleware'));
        scope.network.app.set('view engine', 'ejs');
        scope.network.app.set('views', scope.config.publicDir);
        scope.network.app.use(scope.network.express.static(scope.config.publicDir));
        scope.network.app.use(bodyParser.raw({limit: "8mb"}));
        scope.network.app.use(bodyParser.urlencoded({extended: true, limit: "8mb", parameterLimit: 5000}));
        scope.network.app.use(bodyParser.json({limit: "8mb"}));
        scope.network.app.use(methodOverride());
  
        var ignore = ['id', 'name', 'lastBlockId', 'blockId', 'transactionId', 'address', 'recipientId', 'senderId', 'previousBlock'];
        scope.network.app.use(queryParser({
          parser: function (value, radix, name) {
            if (ignore.indexOf(name) >= 0) {
              return value;
            }
  
            if (isNaN(value) || parseInt(value) != value || isNaN(parseInt(value, radix))) {
              return value;
            }
  
            return parseInt(value);
          }
        }));
  
        scope.network.app.use(require('./utils/zscheme-express.js')(scope.scheme));
  
        scope.network.app.use(function (req, res, next) {
          var parts = req.url.split('/');
          var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  
          scope.logger.debug(req.method + " " + req.url + " from " + ip);
  
          /* Instruct browser to deny display of <frame>, <iframe> regardless of origin.
           *
           * RFC -> https://tools.ietf.org/html/rfc7034
           */
          res.setHeader('X-Frame-Options', 'DENY');
  
          /* Set Content-Security-Policy headers.
           *
           * frame-ancestors - Defines valid sources for <frame>, <iframe>, <object>, <embed> or <applet>.
           *
           * W3C Candidate Recommendation -> https://www.w3.org/TR/CSP/
           */
          res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
          
          //allow CORS
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Headers", "Origin, Content-Length,  X-Requested-With, Content-Type, Accept, request-node-status");
          res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD, PUT, DELETE");        
  
          if (req.method == "OPTIONS"){
            res.sendStatus(200);
            scope.logger.debug("Response pre-flight request");
            return;
          }
  
          var isApiOrPeer = parts.length > 1 && (parts[1] == 'api'|| parts[1] == 'peer') ;
          var whiteList = scope.config.api.access.whiteList;
          var blackList = scope.config.peers.blackList;
  
          var forbidden = isApiOrPeer && ( 
              (whiteList.length > 0 && whiteList.indexOf(ip) < 0) ||
              (blackList.length > 0 && blackList.indexOf(ip) >= 0) );
  
          if (isApiOrPeer && forbidden){
            res.sendStatus(403);
          }
          else if ( isApiOrPeer && req.headers["request-node-status"] == "yes"){         
            //Add server status info to response header
            var lastBlock = scope.modules.blocks.getLastBlock();         
            res.setHeader('Access-Control-Expose-Headers',"node-status");
            res.setHeader("node-status",JSON.stringify({
              blockHeight: lastBlock.height,
              blockTime: slots.getRealTime(lastBlock.timestamp),
              blocksBehind: slots.getNextSlot() - (slots.getSlotNumber(lastBlock.timestamp) +1)
            }));
            next();
          }
          else{
            next();
          }
        });
  
        scope.network.server.listen(scope.config.port, scope.config.address, function (err) {
          scope.logger.log("EnTanMo started: " + scope.config.address + ":" + scope.config.port);
  
          if (!err) {
            if (scope.config.ssl.enabled) {
              scope.network.https.listen(scope.config.ssl.options.port, scope.config.ssl.options.address, function (err) {
                scope.logger.log("EnTanMo https started: " + scope.config.ssl.options.address + ":" + scope.config.ssl.options.port);
  
                cb(err, scope.network);
              });
            } else {
              cb(null, scope.network);
            }
          } else {
            cb(err, scope.network);
          }
        });
  
      }],
  
      bus: function (cb) {
        var changeCase = require('change-case');
  
        class Bus extends EventEmitter {
          message() {
            var args = [];
            Array.prototype.push.apply(args, arguments);
            var topic = args.shift();
            modules.forEach(function (module) {
              var eventName = 'on' + changeCase.pascalCase(topic);
              if (typeof (module[eventName]) == 'function') {
                module[eventName].apply(module[eventName], args);
              }
            });
            this.emit.apply(this, arguments);
          }
        }
        cb(null, new Bus)
      },
  
      dbLite: function (cb) {
        var dbLite = require('./utils/dblite-helper.js');
        dbLite.connect(dbFile, cb);
      },
  
      oneoff: function (cb) {
        cb(null, new Map)
      },
  
      balanceCache: function (cb) {
        var BalanceManager = require('./utils/balance-manager.js')
        cb(null, new BalanceManager)
      },
  
      model: ['dbLite', function (scope, cb) {
        var Model = require('./utils/model.js')
        cb(null, new Model(scope.dbLite))
      }],
  
      base: ['dbLite', 'bus', 'scheme', 'genesisblock', function (scope, cb) {
        var Transaction = require('./logic/transaction.js');
        var Block = require('./logic/block.js');
        var Account = require('./logic/account.js');
        var Consensus = require('./logic/consensus.js');
  
        async.auto({
          bus: function (cb) {
            cb(null, scope.bus);
          },
          dbLite: function (cb) {
            cb(null, scope.dbLite);
          },
          scheme: function (cb) {
            cb(null, scope.scheme);
          },
          genesisblock: function (cb) {
            cb(null, {
              block: genesisblock
            });
          },
          consensus: ["dbLite", "bus", "scheme", "genesisblock", function (scope, cb) {
            new Consensus(scope, cb);
          }],
          account: ["dbLite", "bus", "scheme", 'genesisblock', function (scope, cb) {
            new Account(scope, cb);
          }],
          transaction: ["dbLite", "bus", "scheme", 'genesisblock', "account", function (scope, cb) {
            new Transaction(scope, cb);
          }],
          block: ["dbLite", "bus", "scheme", 'genesisblock', "account", "transaction", function (scope, cb) {
            new Block(scope, cb);
          }]
        }, cb);
      }],
  
      modules: ['network', 'connect', 'config', 'logger', 'bus', 'sequence', 'dbSequence', 'balancesSequence', 'dbLite', 'base', 'oneoff', 'balanceCache', 'model', function (scope, cb) {
        global.library = scope
        var tasks = {};
        /*
        moduleNames.forEach(function (name) {
          tasks[name] = function (cb) {
            var d = require('domain').create();
  
            d.on('error', function (err) {
              scope.logger.fatal('Domain ' + name, {message: err.message, stack: err.stack});
            });
  
            d.run(function () {
              scope.logger.debug('Loading module', name)
              var Klass = require('./modules/' + name);
              var obj = new Klass(cb, scope)
              modules.push(obj);
            });
          }
        });
        */
        Object.keys(config.modules).forEach(function (name) {
          tasks[name] = function (cb) {
            var d = require('domain').create();

            d.on('error', function (err) {
              scope.logger.fatal('Domain ' + name, {message: err.message, stack: err.stack});
            });

            d.run(function () {
              scope.logger.debug(`Loading module[${name}]`);
              var Klass = require(config.modules[name]);
              var obj = new Klass(cb, scope);
              modules.push(obj);
              scope.logger.debug(`Loading module[${name}] finished.......`);
            });
          }
        });
        async.parallel(tasks, function (err, results) {
          cb(err, results);
        });
      }],

      api: ['modules', 'logger', 'network', function (scope, cb) {
          var tasks = {};

          Object.keys(config.api).forEach(function (moduleName) {
            Object.keys(config.api[moduleName]).forEach(function (protocol) {
              var apiEndpointPath = config.api[moduleName][protocol];
              try {
                var ApiEndpoint = require(apiEndpointPath);
                new ApiEndpoint(scope.modules[moduleName], scope);
              } catch(e) {
                scope.logger.error('Unable to load API endpoint for ' + moduleName + ' of ' + protocol, e);
              }
            });
          });

          cb();
      }],
    }, done);
};

