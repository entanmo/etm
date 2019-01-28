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
const util = require('util')
const async = require('async')
const TASK_TIMEOUT_MS = 10 * 1000

function tick(task, cb) {
  let isCallbacked = false
  const done = (err, res) => {
    if (isCallbacked) {
      return
    }
    isCallbacked = true
    if (task.done) {
      setImmediate(task.done, err, res)
    }
    setImmediate(cb)
  }
  setTimeout(() => {
    if (!isCallbacked) {
      done('Worker task timeout')
    }
  }, TASK_TIMEOUT_MS)
  let args = [done]
  if (task.args) {
    args = args.concat(task.args)
  }
  try {
    task.worker.apply(task.worker, args)
  } catch (e) {
    library.logger.error('Worker task failed:', e)
    done(e.toString())
  }
}

class Sequence {
  constructor(config) {
    this.counter = 1
    this.name = config.name
    this.defaultPriority = 5
    this.queue = async.priorityQueue(tick, 1)
  }

  add(worker, args, cb) {
    let done
    if (!cb && args && typeof args === 'function') {
      done = args
    } else {
      done = cb
    }
    if (worker && typeof worker === 'function') {
      const task = { worker, done }
      if (util.isArray(args)) {
        task.args = args
      }
      if (util.isObject(args)) {
        task.counter = this.counter++
        this.queue.push(task,args.priority,tmpLog(worker.name,args.priority))
        return 
      }
      task.counter = this.counter++
      this.queue.push(task,this.defaultPriority,tmpLog(worker.name,this.defaultPriority))
    }
  }

  count() {
    return this.sequence.length
  }

}
function tmpLog(name,priority) {
  //console.log('done priority work: name '+ (name?name:'null') + ' priority '+priority)
}
module.exports = Sequence
