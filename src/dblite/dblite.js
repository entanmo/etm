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
const util = require('util');
const dbutil = require('./dbutil');
const LRU = require("lru-cache");
const SELECT = /^(?:select|SELECT|pragma|PRAGMA) /;
const ONLYSELECT = /^(?:select|SELECT) /;
const HAS_PARAMS = /(?:\?|(?:(?:\:|\@|\$)[a-zA-Z_0-9$]+))/;
const mp = new LRU(50000);
class dblite {
    constructor(str) {
     //TODO logmanager
     this.db = new Database(str)
     this.log = console.log.bind(console)
     this.cache =  new LRU(50000);
    }
    open(dbstr, cb) {
        let ret = {
            err: null,
            result: !0
        };
        try {
            this.db = new Database(dbstr), this.log.traceEnabled && this.log.trace(`SUCCESS open ( db = ${dbstr} )`)
        } catch (e) {
            if (ret = {
                    err: e,
                    result: !1
                }, this.log.errorEnaled && this.log.error(`FAILD open ( db = ${dbstr} )`, e), !cb)
                throw e
        }
        return cb && cb(ret.err, ret.result), ret.result //?? cb
    }
    get isConnected() {
        return this.db.open
    }
    async asynOpen(dbstr) {
        return util.promisify(this.open).call(this, dbstr)
    }
    close(cb) {
        let t = {
            err: null,
            result: !0
        };
        try {
            this.db && this.isConnected ? (this.db.close(), this.log.traceEnabled && this.log.trace("SUCCESS close")) : this.log.infoEnabled && this.log.info("closed already")
          //  console.log("==============================="+mp.itemCount)
            // mp.forEach(function (val, key, cache) {
            //     console.log("="+key)
            //     console.log("="+JSON.stringify(val))
            // })
        } catch (i) {
            if (t = {
                    err: i,
                    result: !1
                }, this.log.errorEnaled && this.log.error("FAILD close", i), !e) throw i
        }
        return cb && cb(t.err, t.result), t.result
    }
    asynClose() {
        return util.promisify(this.close).call(this)
    }
    execute(e, t, i) {
        let s = {
            err: null,
            result: {
                lastInsertRowId: "0",
                rowsEffected: 0
            }
        };
        try {
           // console.log(e);
          // var row = this.db.prepare('select sum(payloadLength) from blocks').all();
         //   console.log(row);
            const r = this.db.prepare(e).run(t || []);
            s.result = {
                lastInsertRowId: r.lastInsertROWID.toString(),
                rowsEffected: r.changes//this.log.traceEnabled && this.log.errorEnaled &&
            },  this.log.traceEnabled && this.log.trace(`SUCCESS execute sql = ${e} param = ${JSON.stringify(t)}, effected = ${s.result.rowsEffected}`)
        } catch (r) {
            if (s.err = r,  this.log.errorEnaled && this.log.error(`FAILD execute sql = ${e} param = ${JSON.stringify(t)}`, r), !i) throw r
        }
        return i && i(s.err, s.result), s.result
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
            cb = arguments[arguments.length-1];
        }
        let ret = {
            err: null,
            result: new Array
        };
        // for(var i=0;i<arguments.length-1;i++){
        //     console.log("arguments---"+JSON.stringify(arguments[i]))
        // }
        switch(arguments.length){
            case 1:
            case 2:
                // if(sql.toLowerCase().trim().startsWith('select')){
                //     let sta=  this.db.prepare(sql)
                //     ret.result = sta.all(params || [])
                //     console.log("alert---!!!!!!!!!!!!!!!--- select no fields======"+sql)
                // }else{
                //    // this.db.exec(sql)
                //   //  console.log("exec         ---sql---"+sql)

                // }
                let sta=  this.db.prepare(sql)
                if(sta.returnsData){
                   // console.log("exec         ---all---"+sql)
                    ret.result = sta.all(params || [])
                }else{
                    //console.log("exec         ---run---"+sql)
                    const r = sta.run(params || []);
                    ret.result = {
                        lastInsertRowId: r.lastInsertROWID.toString(),
                        rowsEffected: r.changes
                     }
                }
                cb && cb(ret.err, ret.result)//, ret.result
                return this
            case 3:
                if(HAS_PARAMS.test(sql)){
                    params = arguments[1];
                   // console.log("exec sql with ---params---"+sql + JSON.stringify(params))
                }else{
                    fields = arguments[1];
                   // console.log("exec sql with--- fields---"+sql + '---fields ---'+ JSON.stringify(fields))
                }
            break
            case 4:
                params = arguments[1];
                fields = arguments[2];
               // console.log("exec sql with--- all---"+sql + '--params --'+  JSON.stringify( params) +'---fields ---'+ JSON.stringify(fields))
            break;
        }
       // var agrs =  Array.prototype.slice.call(arguments,1);
		var p_callback  = cb;
		var query = sql
        var str =	query + JSON.stringify(params);
		// if(ONLYSELECT.test(query) && typeof p_callback == 'function'){
		// 		if(mp.has(str)){
        //             ret.result =  mp.get(str)
        //             return cb && cb(ret.err, ret.result), ret.result
		// 		}
		//  }
        try {
            let sta=  this.db.prepare(sql)
            if(sta.returnsData){
                ret.result = sta.all(params || [])
               // console.log(ret.result.map(this.row2string))
                ret.result= Array.isArray(fields) ?
                        ret.result.map(this.row2object, fields) :
                        ret.result.map(this.row2parsed, fields)    
                   
                // if(!mp.has(str)&& ret.result != null){
                //     mp.set(str,1)
                // }else{
                //     mp.set(str,mp.get(str)+1)
                // }
                // if(!mp.has(str)&& ret.result != null){
                //     mp.set(str,ret.result)
                // }
            }else{
                //console.log("exec         ---sql---"+sql)
                const r = sta.run(params || []);
                ret.result = {
                    lastInsertRowId: r.lastInsertROWID.toString(),
                    rowsEffected: r.changes
                 }
                // if(!mp.has(str)&& ret.result != null){
                //     mp.set(str,1)
                // }else{
                //     mp.set(str,mp.get(str)+1)
                // }
            }
            } catch (e) {
            if (ret.err = e, 
                console.log(sql+" sql error" + e)
                , !cb)
                    throw e
        }
         // console.log("result ---"+JSON.stringify(ret.result))
         cb && cb(ret.err, ret.result)
         return this //, ret.result
    }
    plain() {
        let sql = null,params = null,fields = null
        let cb= null;
        sql = arguments[0]
        if(arguments.length>=2){
            cb = arguments[arguments.length-1];
        }
        let ret = {
            err: null,
            result: new Array
        };
        switch(arguments.length){
            case 1:
            case 2:
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
    executeBatch(e, t, i) {
        let s, r = {
            err: null,
            result: new Array
        };
        try {
            e.forEach(e => {
                s = e;
                let i = this.execute(e.query, e.parameters);
                t && t(i, e), r.result.push(i)
            })
        } catch (e) {
            if (r.err = e, this.log.errorEnaled && this.log.error(`FAILD executeBatch, sql = ${s.query} param = ${JSON.stringify(s.parameters)}`, e), !i) throw e
        }
        return i && i(r.err, r.result), r.result
    }
    async asynExecute(e, t) {
        return s.promisify(this.execute).call(this, e, t)
    }
    async asynQuery(e, t) {
        return s.promisify(this.query).call(this, e, t)
    }
    asyncExecuteBatch(e, t) {
        return s.promisify(this.executeBatch).call(this, e, t)
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
        // console.log("row2object ===="+row)
         for (var
                  out = {},
                  length = this.length,
                  values = Object.values(row),
                  i = 0; i < length; i++
         ) {
             //var val = values[i][1];
             out[this[i]] = values[i];
         }
        // console.log("row2object out ===="+out)
         return out;
     }
      row2parsed(row) {
         var
                 out = {},
                 fields = Object.keys(this),
                 values = Object.values(row),
                 length = fields.length
          // console.log("row2parsed.fields.length  ===="+fields.length  +"row2parsed.values.length ===="+values.length);
          // console.log("row2parsed.fields ===="+JSON.stringify(fields))
         //  console.log("row2parsed.row.values ===="+JSON.stringify(values))
           for( var i = 0; i < length; i++) {
             var parsers =  this[fields[i]];
            // console.log("row2parsed.parsers ===="+parsers)
            // console.log("row2parsed.val ===="+JSON.stringify(values[i]))
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
                        out[fields[i]] = JSON.parse(JSON.stringify((val || "")));
                     }
                 } catch (e) {
                     out[fields[i]] = val;
                 }
             } else {
                 out[fields[i]] = parsers(val);
             }
         }
        // console.log("row2parsed out ===="+JSON.stringify(out))
         return out;
     }
}

module.exports = dblite