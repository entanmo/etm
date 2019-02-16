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
const Database = require('better-sqlite3');
const LRU = require("lru-cache");
const dbutil = require("./dbutil.js");
const HAS_PARAMS = /(?:\?|(?:(?:\:|\@|\$)[a-zA-Z_0-9$]+))/;
const mp = new LRU(50000);
class dblite {
    constructor(str) {
     //TODO logmanager
     this.db = new Database(str)
     this.log = console.log.bind(console)
     this.cache =  new LRU(50000);
    }
    close(cb) {
        let t = {
            err: null,
            result: !0
        };
        try {
           if( this.db ){this.db.close()}
        //    console.log("==============================="+mp.itemCount)
        //     mp.forEach(function (val, key, cache) {
        //         console.log("="+key)
        //         console.log("="+JSON.stringify(val))
        //     })
        } catch (i) {
            if (t = {
                    err: i,
                    result: !1
                }) throw i
        }
        return cb && cb(t.err, t.result), t.result
    }

    /**@param sql 
     * @param params 
     * @param fields 
     * @param cb 
     * @returns  
    **/
    query() {//TODO throw error when arguments error
        let sql = null,params = null,fields = null
        let cb= null;
        sql = arguments[0]
        if(arguments.length>=2){
            if(typeof arguments[arguments.length-1] == 'function'){
                cb = arguments[arguments.length-1];
            }
        }
        let ret = {
            err: null,
            result: new Array
        };
        switch(arguments.length){
            case 1:
            case 2:
                if(HAS_PARAMS.test(sql)){
                    params = arguments[1];
                }
                try {
                    let sta=  this.db.prepare(sql)
                    if(sta.returnsData){
                        ret.result = sta.all(params || [])
                    }else{
                        const r = sta.run(params || []);
                        ret.result = {
                            lastInsertRowId: r.lastInsertROWID.toString(),
                            rowsEffected: r.changes
                        }
                    }
                } catch (e) {
                    if (ret.err = e, 
                        console.log(sql+" sql error" + e)
                        , !cb)
                            throw e
                }
                cb && cb(ret.err, ret.result)
                return this
            case 3:
                if(HAS_PARAMS.test(sql)){
                    params = arguments[1];
                }else{
                    fields = arguments[1];
                }
            break
            case 4:
                params = arguments[1];
                fields = arguments[2];
            break;
        }
        var query = sql
        var p_callback  = cb;
        var str =	query + JSON.stringify(params);

        try {
            let sta=  this.db.prepare(sql)
            if(sta.returnsData){
                ret.result = sta.all(params || [])
                if(fields){
                ret.result= Array.isArray(fields) ?
                        ret.result.map(this.row2object, fields) :
                        ret.result.map(this.row2parsed, fields)    
                }
             
            }else{
                const r = sta.run(params || []);
                ret.result = {
                    lastInsertRowId: r.lastInsertROWID.toString(),
                    rowsEffected: r.changes
                 }
             //    var tables=dbutil.getModifyTable(str)
            //  if(str.startsWith("update")){
                  
            //      if(!mp.has(str)&& ret.result != null){
            //         mp.set(str,1)
            //     }else{
            //         mp.set(str,mp.get(str)+1)
            //     }
            // }
             }
            } catch (e) {
            if (ret.err = e, 
                console.log(sql+" sql error" + e)
                , !cb)
                    throw e
        }
         cb && cb(ret.err, ret.result)
         return this 
    }
    plain() {
        let sql = null,params = null,fields = null
        let cb= null;
        sql = arguments[0]
        if(arguments.length>=2){
            if(typeof arguments[arguments.length-1] == 'function'){
                cb = arguments[arguments.length-1];
            }
        }
        let ret = {
            err: null,
            result: new Array
        };
        switch(arguments.length){
            case 1:
            case 2:
                if(HAS_PARAMS.test(sql)){
                    params = arguments[1];
                }
                try {
                    let sta=  this.db.prepare(sql)
                    if(sta.returnsData){
                        ret.result = sta.all(params || [])
                    }else{
                        const r = sta.run(params || []);
                        ret.result = {
                            lastInsertRowId: r.lastInsertROWID.toString(),
                            rowsEffected: r.changes
                        }
                    }
                } catch (e) {
                    if (ret.err = e, 
                        console.log(sql+" sql error" + e)
                        , !cb)
                            throw e
                }
                cb && cb(ret.err, ret.result)
                return this
            case 3:
                if(HAS_PARAMS.test(sql)){
                    params = arguments[1];
                }else{
                    fields = arguments[1];
                }
            break
            case 4:
                params = arguments[1];
                fields = arguments[2];
            break;
        }

        try {
            let sta=  this.db.prepare(sql)
            if(sta.returnsData){
                ret.result = sta.all(params || [])
                ret.result.map(this.row2string)
                // ret.result= Array.isArray(fields) ?
                //         ret.result.map(this.row2object, fields) :
                //         ret.result.map(this.row2parsed, fields)    
            }else{
                const r = sta.run(params || []);
                ret.result = {
                    lastInsertRowId: r.lastInsertROWID.toString(),
                    rowsEffected: r.changes
                 }
            }
            } catch (e) {
            if (ret.err = e, 
                console.log(sql+" sql error" + e)
                , !cb)
                    throw e
        }
         cb && cb(ret.err, ret.result)
         return this 
    }
   
    row2string(row) {
         for (var
                  out = [],
                  values = Object.values(row),
                  length = values.length,
                  i = 0; i < length; i++
         ) {
             out[i] = values[i];
         }
         return out;
     }
    row2object(row) {
         for (var
                  out = {},
                  length = this.length,
                  values = Object.values(row),
                  i = 0; i < length; i++
         ) {
             out[this[i]] = values[i];
         }
         return out;
     }
      row2parsed(row) {
         var
                 out = {},
                 fields = Object.keys(this),
                 values = Object.values(row),
                 length = fields.length
           for( var i = 0; i < length; i++) {
             var parsers =  this[fields[i]];

             var val = values[i]
             if (parsers === Buffer) {
                 out[fields[i]] = parsers(val, 'hex');
             } else if (parsers === Array) {
                 out[fields[i]] = val ? val.split(",") : []
             } else if (parsers === String) {
                 try {
                     if(val === 0){
                        out[fields[i]] = JSON.parse(JSON.stringify(( "0")));
                     }else{
                        out[fields[i]] =util.isNumber(val)?JSON.stringify(val):JSON.parse(JSON.stringify((val || "")));
                     }
                 } catch (e) {
                     out[fields[i]] = val;
                 }
             } else {
                 out[fields[i]] = parsers(val);
             }
         }
         return out;
     }
}

module.exports = dblite