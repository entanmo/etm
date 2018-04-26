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

module.exports = {
    updatePeerList: [
        {
            type: "array", 
            required: true, 
            uniqueItems: true
        }, 
        {
            id: 'peer.updatePeerList',
            type: "object",
            properties: {
                peers: {
                    type: "array",
                    uniqueItems: true
                }
            },
            required: ['peers']
        }, 
        {
            type: "object",
            properties: {
              ip: {
                type: "string"
              },
              port: {
                type: "integer",
                minimum: 1,
                maximum: 65535
              },
              state: {
                type: "integer",
                minimum: 0,
                maximum: 3
              },
              os: {
                type: "string"
              },
              version: {
                type: "string"
              },
              dappId: {
                type: "string",
                length: 64
              }
            },
            required: ['ip', 'port', 'state']
        }
    ],

    getPeers: {
        id: 'peer.getPeers',
        type: "object",
        properties: {
            state: {
                type: "integer",
                minimum: 0,
                maximum: 3
            },
            os: {
                type: "string"
            },
            version: {
                type: "string"
            },
            limit: {
                type: "integer",
                minimum: 0,
                maximum: 100
            },
            orderBy: {
                type: "string"
            },
            offset: {
                type: "integer",
                minimum: 0
            },
            port: {
                type: "integer",
                minimum: 1,
                maximum: 65535
            }
        }
    },

    getPeer: {
        id: 'peer.getPeer',
        type: "object",
        properties: {
            ip: {
                type: "string",
                minLength: 1
            },
            port: {
                type: "integer",
                minimum: 0,
                maximum: 65535
            }
        },
        required: ['ip', 'port']
    }


}