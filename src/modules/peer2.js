const path = require('path')
const ip = require('ip')
const crypto = require('crypto')
const _ = require('lodash')
const DHT = require('bittorrent-dht')
const request = require('request')
const Router = require('../utils/router.js')
const sandboxHelper = require('../utils/sandbox.js')
const { promisify } = require('util')
const Database = require('nedb')
const async = require('async');
const axios = require('axios')
const { EventEmitter } = require('events')

// const fs = require('fs')

let modules
let library
let self
const SAVE_PEERS_INTERVAL = 1 * 60 * 1000
const CHECK_BUCKET_OUTDATE = 3 * 60 * 1000
const RECONNECT_SEED_INTERVAL = 30 * 1000
const DISCOVER_PEERS_TIMEOUT = 12 * 1000


const CHECK_COMPATIBLE_NODES_INTERVAL = 5 * 60 * 1000
const CHECK_INCOMPATIBLE_NODES_INTERVAL = 15 * 60 * 1000

// interface NodeInfo {
//   host: string
//   port: number
//   status: NodeStatus
//   updateAt: timestamp
//   isSeed: boolean

//   height: number
//   blockId: string
//   magic: string
//   net: string
//   version: string
// }

const NodeStatus = {
  Unknow : 0,
  Healthy : 1,
  Unhealthy : 2,

  Incompatible : -1
}

class NodeManager extends EventEmitter {
  constructor() {
    super()
    this._allNodes = new Map()
    this._shackingNodes = new Set()
    this._isChecking = false
    this._checkCompatibleTimer = undefined
    this._checkIncompatileTimer = undefined
  }

  get healthyNodes() {
    return [...this._allNodes.values()].filter(n => n.status === NodeStatus.Healthy)
  }

  get compatibleNodes() {
    return [...this._allNodes.values()].filter(n => n.status === NodeStatus.Healthy || n.status === NodeStatus.Unhealthy)
  }

  get incompatibleNodes() {
    return [...this._allNodes.values()].filter(n => n.status === NodeStatus.Incompatible || n.status === NodeStatus.Unknow)
  }

  isHealthy( height, blockId ) {
    const lastBlock = modules.blocks.getLastBlock()
    return lastBlock.height <= height + 100
  }

  isCompatible ( net, version, magic ) {
    const config = library.config
    if (net !== config.netVersion) return false
    if (magic && magic !== config.magic) return false

    if (version === config.version)  return true

    const [nodeMajor, nodeMinor, nodePatch] = version.split('.').map(p => Number.parseInt(p))

    const invalidVersion = ([nodeMajor, nodeMinor, nodePatch]).some(v => !Number.isInteger(v))
    if (invalidVersion) return false

    const [major, minor, patch] = config.version.split('.').map(p => Number.parseInt(p))

    return nodeMajor === major && minor === nodeMinor // && patch <= nodePatch
  }

  startCheckNodes() {
    const checkCompatibleNodes = () => this.compatibleNodes
      .forEach( node => this._checkCompatibleNode(node) )

    const checkIncompatileNodes = () => this.incompatibleNodes
      .forEach( node => this._checkIncompatibleNode(node) )

    if (this._isChecking) return 

    library.logger.debug(`start check nodes`)

    this._isChecking = true
    this._checkCompatibleTimer = setInterval(checkCompatibleNodes, CHECK_COMPATIBLE_NODES_INTERVAL)
    this._checkIncompatileTimer = setInterval(checkIncompatileNodes, CHECK_INCOMPATIBLE_NODES_INTERVAL)
  }

  stopCheckNodes() {
    if (!this._isChecking) return 

    if (this._checkCompatibleTimer)
      clearInterval(this._checkCompatibleTimer)
    if (this._checkIncompatileTimer)
      clearInterval(this._checkIncompatileTimer)
  }

  updateNodeHealthy(peer, height, blockId) {
    const node = this.getNodeInfo(peer)
    if (node === undefined)  return false
    if (node.status === NodeStatus.Incompatible || node.status === NodeStatus.Unknow) return false

    const status = this.isHealthy(height, blockId) ? NodeStatus.Healthy : NodeStatus.Unhealthy
    this._updateNode(node, { status, height, blockId })

    return true
  }

  setIncompatible(ip, magic) {
    this._allNodes.forEach( node => {
      if (node.host === ip && node.status !== NodeStatus.Incompatible) {
        this._updateNode(node, { magic, status: NodeStatus.Incompatible})
      }
    })
  }

  getNodeInfo(peer) {
    return this._allNodes.get(this._makeId(peer))
  }

  addPeer(peer, id) {
    id = id || this._makeId(peer)
    library.logger.debug(`addPeer ---`, JSON.stringify(peer))
    if (this._allNodes.has(id) || this._shackingNodes.has(id)) return 
    if (peer.host === library.config.publicIp && peer.port === library.config.peerPort) return

    this._shackingNodes.add(id)
    this._shackhands(peer, (err, info) => {
      this._shackingNodes.delete(id)
      const { host, port, isSeed, status } = peer
      const node = { host, port, isSeed } 
      if (err && status === NodeStatus.Incompatible) {
        return
      }
      const updateInfo = info || { status: NodeStatus.Unknow }
      this._updateNode(node, updateInfo)
      const nodes = [...this._allNodes.values()]
      nodes.filter(node => node.host === peer.host && node.port === peer.port)
        .forEach(node => this._allNodes.delete(node.id))

      this._allNodes.set(id, node)
    })
  }

  removePeer(id) {
    this._allNodes.delete(id)
  }

  _updateNode(node, info) {
    const { height, blockId, magic, status, net, version } = info || {}
    const origin = Object.assign({}, node)
    const data = { status, height, blockId, magic, net, version, updateAt: Date.now() }
    let modifier = {}
    Object.keys(data).forEach(k => { if (data[k] !== undefined) modifier[k] = data[k] })
    Object.assign(node, modifier)

    this.emit('change', origin, modifier)
  }

  _makeId(peer) { return priv.getNodeIdentity(peer) }

  async _sleep( ms ) {
    return new Promise((resolve, reject) => {
      setTimeout( () => resolve(), ms)
    })
  }

  _httpGet(peer, path, cb) {
    const url = `http://${peer.host}:${peer.port - 1}/api/${path}`
    axios.get(url, {}, { timeout: priv.peerTimeout })
      .then ( response => {
        const data = response.data
        return data.success ? cb(undefined, data) : cb(data.error || 'Get from server failed')
      }).catch( err => cb(String(err)) )
  }

  _httpPost(peer, path, cb) {
    const url = `http://${peer.host}:${peer.port - 1}/peer/${path}`
    const options =  {
      timeout: priv.peerTimeout,
      headers: {
        magic: global.Config.magic,
        version: global.Config.version,
      }
    }
    axios.post(url, {}, options)
      .then ( response => {
        const data = response.data
        library.logger.debug(`post ${url}, `, response.data)
        return data ? cb(undefined, data, response.headers) : cb('request server failed')
      }).catch( err => {
        const headers = (err.response) ? err.response.headers : undefined
        library.logger.debug(`post ${url} error, `, String(err))
        cb(String(err), undefined, headers)
      })
  }

  async _getVersion(peer) {
    return new Promise((resolve, reject) => {
      this._httpGet(peer, 'peers/version', (err, ret)=>{
        if (err) return reject(err)
        resolve(ret)
      })
    })
  }

  async _getMagicAndHeight(peer) {
    return new Promise((resolve, reject) => {
      this._httpPost(peer, 'getHeight', (err, ret, headers) => {
        const magic = headers !== undefined ? headers.magic : undefined
        if (magic) { 
          let result = ret || {}
          result['magic'] = magic
          return resolve(result)
        } 
        reject(String(err) || `get magic and height failed`)
      })
    })
  }

  _shackhands (peer, cb) {
    library.logger.debug(`start shackhands with ${peer.host}:${peer.port}`)
    const self = this
    Promise.all([
      this._getVersion(peer), 
      this._getMagicAndHeight(peer)
    ])
    .then( results => {
      const [versionRet, lastBlockRet] = results
      library.logger.debug(`shack hands with ${peer.host}:${peer.port} result is `, versionRet, lastBlockRet)
      if (!versionRet.success) return cb(versionRet.error|| 'get version failed')

      const { net, version } = versionRet
      const { height, blockId, magic } = lastBlockRet

      let status = this.isCompatible(net, version, magic) ? NodeStatus.Unhealthy : NodeStatus.Incompatible
      if (status === NodeStatus.Incompatible) {
        return cb(undefined, { net, version, status })
      }

      status = this.isHealthy( height, blockId ) ? NodeStatus.Healthy : NodeStatus.Unhealthy
      return cb(undefined,{ net, version, status, magic, height, blockId }) 

    }).catch(err => {
      library.logger.debug(`shack hands error`, err)
      cb(err)
    }) 
  }

  _checkCompatibleNode(node) {
    if (Date.now() - (node.updateAt || 0) < CHECK_COMPATIBLE_NODES_INTERVAL) {
      return 
    }
    library.logger.debug(`Check compatible node ${node.host}:${node.port}`)
    this._getMagicAndHeight(node)
      .then(info => this.updateNodeHealthy(node, info.height, info.blockId))
      .catch(err => this._updateNode(node, { status : NodeStatus.Unhealthy }))
  }

  _checkIncompatibleNode(node) {
    if (Date.now() - (node.updateAt || 0) < CHECK_INCOMPATIBLE_NODES_INTERVAL) {
      return 
    }

    library.logger.debug(`Check incompatible node ${node.host}:${node.port}`)
    this._shackhands(node, (err, info) => {
      if (err && node.status === NodeStatus.Incompatible) {
        return
      }
      const updateInfo = info || { status: NodeStatus.Unknow }
      this._updateNode(node, updateInfo)
    })
  }
}

const priv = {
  handlers: {},
  dht: null,
  ready:false,
  nodeManager: new NodeManager(),
  getNodeIdentity: (node) => {
    const address = `${node.host}:${node.port}`
    return crypto.createHash('ripemd160').update(address).digest()
  },

  getSeedPeerNodes: seedPeers => seedPeers.map((peer) => {
    const node = { host: peer.ip, port: Number(peer.port) }
    node.id = priv.getNodeIdentity(node)
    return node
  }),

  initDHT: async (p2pOptions) => {
    p2pOptions = p2pOptions || {}

    let lastNodes = []
    if (p2pOptions.persistentPeers) {
      const peerNodesDbPath = path.join(p2pOptions.peersDbDir, 'peers.db')
      try {
        lastNodes = await promisify(priv.initNodesDb)(peerNodesDbPath)
        lastNodes = lastNodes || []
        library.logger.debug(`load last node peers success, ${JSON.stringify(lastNodes)}`)
      } catch (e) {
        library.logger.error('Last nodes not found', e)
      }
    }
    const bootstrapNodes = [...priv.getSeedPeerNodes(p2pOptions.seedPeers)]
    const [host, port] = [p2pOptions.publicIp, p2pOptions.peerPort]
    const dht = new DHT({
      timeBucketOutdated: CHECK_BUCKET_OUTDATE,
      timeout:DISCOVER_PEERS_TIMEOUT,
      bootstrap: bootstrapNodes,
      nodeId: priv.getNodeIdentity({ host, port }),
      peerPort:p2pOptions.peerPort,
      magic: p2pOptions.magic
    })
    priv.dht = dht
    priv.bootstrapNodes = bootstrapNodes

    priv.blackPeers = new Set();
    (p2pOptions.blackPeers || []).forEach(p => {
      if (!priv.blackPeers.has(p.ip)) priv.blackPeers.add(p.ip)
    })

    // bootstrapNodes.forEach(node => {
    //   priv.nodeManager.addPeer({ host: node.host, port: node.port, isSeed: true })
    // })
    priv.nodeManager.on('change', (node, modifier) => {
      library.logger.debug('node changed', node, modifier)
      if (modifier.status === NodeStatus.Incompatible ) {
        dht.ban(node.host)
      } else if (modifier.status === NodeStatus.Healthy || modifier.status === NodeStatus.Unhealthy) {
        dht.unban(node.host)
      }
    })

    
    dht.ban(...(p2pOptions.blackList || []).map(p=>p.id))

    dht.listen(port, () => library.logger.info(`p2p server listen on ${port}`))

    dht.on('node', (node) => {
      const nodeId = node.id.toString('hex')
     
      priv.updateNode(nodeId, node,(err, data)=>{
        if(err) return
        library.logger.info(`add node (${nodeId}) ${node.host}:${node.port}`)
      })
      priv.nodeManager.addPeer(node, nodeId)
    })

    dht.on('remove', (nodeId, reason) => {
      library.logger.info(`remove node (${nodeId}), reason: ${reason}`)
      priv.removeNode(nodeId)
      priv.nodeManager.removePeer(nodeId)
    })

    dht.on('error', (err) => {
      library.logger.warn('dht error message', err)
    })
    dht.on('banned_message', (peer, type, message) =>{
      library.logger.debug('banned hosts ', priv.dht.bannedIPs())
      library.logger.debug(`banned message from ${peer.host||peer.address}:${peer.port}, type: ${type}, ${message && message.topic} `)
    })
    dht.on('warning', (msg) => {
      library.logger.warn('dht warning message', msg)
    })

    if (p2pOptions.eventHandlers) {
      Object.keys(p2pOptions.eventHandlers).forEach(eventName =>
        dht.on(eventName, p2pOptions.eventHandlers[eventName]))
    }

    lastNodes.forEach(n => dht.addNode(n))

    setInterval(() => {
      const allNodes = dht.nodes.toArray()
      const isInDht = n => allNodes.some(dn => dn.host === n.host && dn.port === n.port)
      bootstrapNodes.filter(node => !isInDht(node))
        .filter(n => n.host !== host && n.port !== port)
        .forEach(n => {
          console.log('RECONNECT addNode:'+n.host +':'+ port)
          dht.addNode(n)
        })
    }, RECONNECT_SEED_INTERVAL)

    priv.nodeManager.startCheckNodes()
  },
  findAllNodesInDb: (callback) => {
    priv.nodesDb.find().sort({ seen: -1 }).exec(callback)
  },
  findSeenNodesInDb: (callback) => {
    priv.nodesDb.find({ /* seen: { $exists: true } */ })
     // .sort({ seen: -1 })
      .exec((err, nodes) => {
        if (err) return callback(err)
        nodes = nodes.filter(n => {
          const element = `${n.host}:${n.port}`
          const selfAddress = `${library.config.publicIp}:${library.config.peerPort}`
          return element != selfAddress
        })
        // filter duplicated nodes
        const nodesMap = new Map()
        nodes.forEach((n) => {
          const address = `${n.host}:${n.port}`
          if (!nodesMap.has(address)) nodesMap.set(address, n)
        })
        return callback(err, [...nodesMap.values()])
      })
  },

  initNodesDb: (peerNodesDbPath, cb) => {
    if (!priv.nodesDb) {
      const db = new Database({ filename: peerNodesDbPath, autoload: true })
      priv.nodesDb = db
      db.persistence.setAutocompactionInterval(SAVE_PEERS_INTERVAL)

      const errorHandler = err => err && library.logger.info('peer node index error', err)
      db.ensureIndex({ fieldName: 'id' }, errorHandler)
      db.ensureIndex({ fieldName: 'seen' }, errorHandler)
    }

    priv.findSeenNodesInDb(cb)
  },

  updateNode: (nodeId, node, callback) => {
    if (!nodeId || !node) return

    const upsertNode = Object.assign({}, node)
    upsertNode.id = nodeId
    priv.nodesDb.update({ id: nodeId }, upsertNode, { upsert: true }, (err, data) => {
      if (err) library.logger.warn(`faild to update node (${nodeId}) ${node.host}:${node.port}`)
      if (_.isFunction(callback)) callback(err, data)
    })
  },

  removeNode: (nodeId, callback) => {
    if (!nodeId) return

    priv.nodesDb.remove({ id: nodeId }, (err, numRemoved) => {
      if (err) library.logger.warn(`faild to remove node id (${nodeId})`)
      if (_.isFunction(callback)) callback(err, numRemoved)
    })
  },
  removeNodeByIp: (host,port,callback) => {
    priv.nodesDb.find( { $and: [{ host: host }, { port: port }]})
      .exec((err, nodes) => {
        if (err) return callback(err);
        //library.logger.warn(JSON.stringify(nodes));
      //  let nodeids = nodes.map(n=>n.id);//remove all host:port have seen  .filter(node => node.seen )
        async.eachSeries(nodes, function (node, cb) {
          if (!node.id) return
          priv.dht.removeNode( node.id , (err, numRemoved) => {
            library.logger.warn(` remove node  (${node.id})`);
            if (err) {
              library.logger.warn(`faild to remove node id (${numRemoved})`);
              return  cb(err, node.id);
            } 
            return cb(null, node.id);
          })
        }, function (err) {
          if (err) {
            if (_.isFunction(callback)) callback(err, nodes);
          } 
        });
      })
  },
  getHealthNodes: () => {
    if (!priv.dht) {
      library.logger.warn('dht network is not ready')
      return []
    }
    var peers  = priv.dht.nodes.toArray().filter(n => !priv.blackPeers.has(n.host))
   
    peers = peers.filter(n => {
      const element = `${n.host}:${n.port}`
      const selfAddress = `${library.config.publicIp}:${library.config.peerPort}`
      return element != selfAddress
    })
    const nodesMap = new Map()
    for(var i = 0 ;i<peers.length;i++){
      var n = peers[i]
      const address = `${n.host}:${n.port}`
      //if (priv.bootstrapSet.has(address)) {continue};
      if (!nodesMap.has(address)) nodesMap.set(address, n)
    }
    peers = [...nodesMap.values()] 
    return peers
  },
  getCompatibleNodes: () => {
    return priv.nodeManager.compatibleNodes
  },
  getRandomNode: ()=>{  
    let nodes = priv.getCompatibleNodes() //TODO    let nodes = priv.getCompatibleNodes() 
    nodes = nodes.length === 0 ? priv.bootstrapNodes : nodes
    const rnd = Math.floor(Math.random() * nodes.length)
    return nodes[rnd]     
  },
  getRandomPeers: (count, allNodes)=>{
    if (allNodes.length <= count) return allNodes

    const randomPeers = []
    while(count-- > 0 && allNodes.length > 0) {
      const rnd = Math.floor(Math.random() * allNodes.length)
      const peer = allNodes[rnd]
      allNodes.splice(rnd, 1)
      randomPeers.push(peer)
    }
    return randomPeers
  },
  broadcast: (message, peers) =>{
    // priv.findSeenNodesInDb((err,nodes)=>{
    //   if(err) return
    //   nodes = nodes.length === 0 ? priv.bootstrapNodes : nodes
    //   peers = priv.getRandomPeers(20, nodes)
    //   library.logger.debug(`findSeenNodesInDb  nodes`+ JSON.stringify(peers) )
    //   priv.dht.broadcast(message, peers)
    // })
    let nodes = priv.getCompatibleNodes() //TODO
    library.logger.debug(`getHealthNodes`+ JSON.stringify(nodes) )
    nodes = nodes.length === 0 ? priv.bootstrapNodes : nodes

    peers = priv.getRandomPeers(20, nodes)
    priv.dht.broadcast(message, peers)

    library.logger.debug(`broadcast `+JSON.stringify(message.topic)+`to  nodes`+ JSON.stringify(peers.map(n=>`${n.host}:${n.port}`)) )
  //   priv.dht.broadcast(message, peers)
  }
}

const shared = {}

// Constructor
function Peer(cb, scope) {
  library = scope
  self = this

  priv.attachApi()
  setImmediate(cb, null, self)
}

// priv methods
priv.attachApi = () => {
  const router = new Router()

  router.use((req, res, next) => {
    if (modules) return next()
    return es.status(500).send({ success: false, error: 'Blockchain is loading' })
  })

  router.map(shared, {
    'get /': 'getPeers',
    'get /version': 'version',
    'get /get': 'getPeer',
  })

  router.use((req, res) => {
    res.status(500).send({ success: false, error: 'API endpoint not found' })
  })

  library.network.app.use('/api/peers', router)
  library.network.app.use((err, req, res, next) => {
    if (!err) return next()
    library.logger.error(req.url, err.toString())
    return res.status(500).send({ success: false, error: err.toString() })
  })
}
Peer.prototype.listPeers = ( cb) => {
  let nodes = priv.getCompatibleNodes() 
  nodes = nodes.length === 0 ? priv.bootstrapNodes : nodes
  var peers =  priv.getRandomPeers(20, nodes)
  cb(null,  peers)
  // priv.findSeenNodesInDb((err,nodes)=>{
  //   if(!err){
  //     nodes = nodes.length === 0 ? priv.bootstrapNodes : nodes
  //     var peers = priv.getRandomPeers(20, nodes)
  //     cb(null,  peers)
  //   }
  // })

}

Peer.prototype.addPeer = ( host,port) => {
  let node ={host,  port }
  node.id = priv.getNodeIdentity(node)
  node.distance = 0
  node.seen = Date.now()
  priv.dht.addNode(node)

}

Peer.prototype.isReady = () => {return priv.ready}

Peer.prototype.getRandomNode = (cb) => {
  let nodes = priv.getCompatibleNodes() 
  library.logger.debug("in RandomNode---getHealthNodes=="+JSON.stringify(nodes)+JSON.stringify(nodes.length))
  nodes = nodes.length === 0 ? priv.bootstrapNodes : nodes
  var peers =  priv.getRandomPeers(1, nodes)
  //library.logger.debug("in RandomNode---getRandomPeers=="+JSON.stringify(peers))
  cb(null,  peers)
}
Peer.prototype.getbootstrapNode = (cb) => {
  let nodes = priv.bootstrapNodes
  let peers =  priv.getRandomPeers(1, nodes)
  cb(null,  peers)
}
Peer.prototype.list = (options, cb) => {
  // FIXME
  options.limit = options.limit || 100
  return cb(null, [])
}

Peer.prototype.remove = (pip, port, cb) => {
  const peers = library.config.peers.list
  const isFrozenList = peers.find(peer => peer.ip === ip.fromLong(pip) && peer.port === port)
  if (isFrozenList !== undefined) return cb && cb('Peer in white list')
  // FIXME
  return cb()
}

Peer.prototype.addChain = (config, cb) => {
  // FIXME
  cb()
}

Peer.prototype.getVersion = () => ({
  version: library.config.version,
  build: library.config.buildVersion,
  net: library.config.netVersion,
})

Peer.prototype.isCompatible = (version) => {
  const nums = version.split('.').map(Number)
  if (nums.length !== 3) {
    return true
  }
  let compatibleVersion = '0.0.0'
  if (library.config.netVersion === 'testnet') {
    compatibleVersion = '1.2.3'
  } else if (library.config.netVersion === 'mainnet') {
    compatibleVersion = '1.3.1'
  }
  const numsCompatible = compatibleVersion.split('.').map(Number)
  for (let i = 0; i < nums.length; ++i) {
    if (nums[i] < numsCompatible[i]) {
      return false
    } if (nums[i] > numsCompatible[i]) {
      return true
    }
  }
  return true
}

Peer.prototype.subscribe = (topic, handler) => {
  priv.handlers[topic] = handler
}

Peer.prototype.onpublish = (msg, peer) => {
  if (!msg || !msg.topic || !priv.handlers[msg.topic.toString()]) {
    library.logger.debug('Receive invalid publish message topic', msg)
    return
  }
  if (msg.magic && msg.magic.toString() !== library.config.magic) {
    library.logger.debug('Receive invalid publish message magic', msg)
    priv.nodeManager.setIncompatible(peer.host, msg.magic)
    return
  } //TODO
  priv.handlers[msg.topic](msg, peer)
}

Peer.prototype.publish = (topic, message, recursive = 1) => {
  if (!priv.dht) {
    library.logger.warn('dht network is not ready')
    return
  }
  message.topic = topic
  message.recursive = recursive
  // TODO: Optimize broadcasting efficiency
  // if (true) {
  //   priv.broadcast(message, priv.bootstrapNodes)
  // }
  priv.broadcast(message)
}
Peer.prototype.setNodeIncompatible = (ip, magic) => {
  if (!priv.dht) return 
  priv.nodeManager.setIncompatible(ip, magic)
}

Peer.prototype.request = (method, params, contact, cb) => {
  const address = `${contact.host}:${contact.port - 1}`
  const uri = `http://${address}/peer/${method}`
  library.logger.trace(`start to request ${uri}`)
  const options = {
    timeout: priv.peerTimeout,
    headers: {
      magic: global.Config.magic,
      version: global.Config.version,
    }
  }
  // request(reqOptions, (err, response, result) => {
  //   if (err) {
      
  //     library.logger.debug(`remote service timeout: ${err}`) 
  //     return cb(err)
  //   } else if (response.statusCode !== 200) {
  //     library.logger.debug('remote service error', result)
  //     return cb(`Invalid status code: ${response.statusCode}`)
  //   }
  //   return cb(null, result)
  // })
  axios.post(uri, params, options)
  .then( response => {
    const result = response.data
    if (response.status !== 200) {
      library.logger.debug('remote service error', result)
      return cb(`Invalid status code: ${response.status}`)
    }
    return cb(null, result)
  }).catch(err=> cb(err.toString()))
}

Peer.prototype.proposeRequest = (method, params, contact, cb) => {
  const address = `${contact.host}:${contact.port - 1}`
  const uri = `http://${address}/peer/${method}`
  library.logger.debug(`start to request ${uri}`)
  const reqOptions = {
    uri,
    method: 'POST',
    body: params,
    headers: {
      magic: global.Config.magic,
      version: global.Config.version,
    },
    json: true,
    timeout: library.config.peers.options.pingTimeout
  }
  request(reqOptions, (err, response, result) => {
    if (err) {
      return cb(`Failed to request remote peer: ${err}`)
    } else if (response.statusCode !== 200) {
      library.logger.debug('remote service error', result)
      return cb(`Invalid status code: ${response.statusCode}`)
    }
    return cb(null, result)
  })
}


Peer.prototype.randomRequest = (method, params, cb) => {
  const randomNode = priv.getRandomNode()
  if (!randomNode) return cb('No contact')
 // library.logger.debug('select random contract', randomNode)
  let isCallbacked = false
  setTimeout(() => {
    if (isCallbacked) return
    isCallbacked = true
    cb('Timeout', undefined, randomNode)
  }, 4000)
  return self.request(method, params, randomNode, (err, result) => {
    if (isCallbacked) return
    isCallbacked = true
    cb(err, result, randomNode)
  })
}

Peer.prototype.sandboxApi = (call, args, cb) => {
  sandboxHelper.callMethod(shared, call, args, cb)
}

// Events
Peer.prototype.onBind = (scope) => {
  modules = scope
}

Peer.prototype.onBlockchainReady = () => {
  priv.initDHT({
    publicIp: library.config.publicIp,
    peerPort: library.config.peerPort,
    magic: library.config.magic,
    seedPeers: library.config.peers.list,
    blackPeers: library.config.peers.blackList,
    persistentPeers: library.config.peers.persistent === false ? false : true,
    peersDbDir: global.Config.dataDir,
    eventHandlers: {
      broadcast: (msg, node) => self.onpublish(msg, node),
    },
  }).then(() => {
    priv.ready = true
    library.bus.message('peerReady')
  }).catch((err) => {
    library.logger.error('Failed to init dht', err)
  })
}

shared.getPeers = (req, cb) => {
  priv.findSeenNodesInDb((err, nodes) => {
    let peers = []
    if (err) {
      library.logger.error('Failed to find nodes in db', err)
    } else {
      peers = nodes
    }
    cb(null, { count: peers.length, peers })
  })
}

shared.getPeer = (req, cb) => {
  cb(null, {})
}

shared.version = (req, cb) => {
  cb(null, {
    version: library.config.version,
    build: library.config.buildVersion,
    net: library.config.netVersion,
  })
}

module.exports = Peer
