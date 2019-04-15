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
var slots = require('../utils/slots.js');

module.exports = {
    sanitize_port: {
        id: 'sanitize/port',
        type: "object",
        properties: {
          os: {
            type: "string",
            maxLength: 64
          },
          'magic': {
            type: 'string',
            maxLength: 8
          },
          'version': {
            type: 'string',
            maxLength: 11
          }
        },
        required: ['magic', 'version']        
    },

    sanitize_blocks_common: {
        id: 'sanitize/blocks/common',
        type: "object",
        properties: {
            max: {
                type: 'integer'
            },
            min: {
                type: 'integer'
            },
            ids: {
                type: 'string',
                format: 'splitarray'
            }
        },
        required: ['max', 'min', 'ids']
    },

    sanitize_blocks: {
        id: 'sanitize/blocks',
        type: 'object',
        properties: { 
            lastBlockId: { 
                type: 'string' 
            } 
        }       
    },

    headers: {
        id: 'req.headers',
        type: "object",
        properties: {
            port: {
                type: "integer",
                minimum: 1,
                maximum: 65535
            },
            magic: {
                type: "string",
                maxLength: 8
            }
        },
        required: ['port', 'magic']
    },

    votes: {
        id: 'votes',type: "object",
        properties: {
          height: {
            type: "integer",
            minimum: 1
          },
          id: {
            type: "string",
            maxLength: 64,
          },
          signatures: {
            type: "array",
            minLength: 1,
            maxLength: slots.delegates,
          }
        },
        required: ["height", "id", "signatures"]
    },

    propose: {
        id: 'propose',
        type: "object",
        properties: {
          height: {
            type: "integer",
            minimum: 1
          },
          id: {
            type: "string",
            maxLength: 64,
          },
          timestamp: {
            type: "integer"
          },
          generatorPublicKey: {
            type: "string",
            format: "publicKey"
          },
          address: {
            type: "string"
          },
          hash: {
            type: "string",
            format: "hex"
          },
          signature: {
            type: "string",
            format: "signature"
          }
        },
        required: ["height", "id", "timestamp", "generatorPublicKey", "address", "hash", "signature"]        
    },

    signatures: {
        type: "object",
        properties: {
            signature: {
                type: "object",
                properties: {
                    transaction: {
                        type: "string"
                    },
                    signature: {
                        type: "string",
                        format: "signature"
                    }
                },
                required: ['transaction', 'signature']
            }
        },
        required: ['signature']
    },

    dappReady: {
        id: 'dappReady',
        type: "object",
        properties: {
          dappId: {
            type: "string",
            length: 64
          }
        },
        required: ["dappId"]        
    },

    getFromPeer: {
        id: 'transport.getFromPeer',
        type: "object",
        properties: {
            os: {
                type: "string",
                maxLength: 64
            },
            port: {
                type: "integer",
                minimum: 1,
                maximum: 65535
            },
            'magic': {
                type: "string",
                maxLength: 8
            },
            version: {
                type: "string",
                maxLength: 11
            }
        },
        required: ['port', 'magic', 'version']
    }
}