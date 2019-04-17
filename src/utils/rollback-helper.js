"use strict";

const assert = require("assert");
const _ = require("lodash");

const MAX_BACKUP_ROUND = 10;

/**
 * db
 * name round data status
 */

class RollbackHelper {
    constructor(name, options) {
        assert(_.isString(name) && name !== "", "name must be a no-empty string.");
        options = options || {};
        this.name = name;
    }

    async applyRound(round, data) {
        return new Promise((resolve, reject) => {
            /// TODO: save to db
            library.dbLite.query("SELECT round FROM mem_rollbackbackup WHERE name=$name AND round=$round AND data=$data", {
                name: this.name,
                round,
                data: JSON.stringify(data)
            }, { round: Number }, (err, rows) => {
                if (err) {
                    return reject(err);
                }

                if (rows.length > 0) {
                    // 已存在
                    library.dbLite.query("UPDATE mem_rollbackbackup SET state=1 WHERE name=$name AND round=$round AND data=$data", {
                        name: this.name,
                        round,
                        data: JSON.stringify(data)
                    }, err => err ? reject(err) : resolve());
                } else {
                    // 不存在
                    library.dbLite.query("INSERT OR REPLACE INTO mem_rollbackbackup(name, round, data, state) VALUES($name, $round, $data, 1)", {
                        name: this.name,
                        round,
                        data: JSON.stringify(data)
                    }, err => {
                        // return err ? reject(err) : resolve();
                        if (err) {
                            return reject(err)
                        }

                        library.dbLite.query("DELETE FROM mem_rollbackbackup WHERE name=$name AND round<$round", {
                            name: this.name,
                            round: round - MAX_BACKUP_ROUND
                        }, err => err ? reject(err) : resolve());
                    });
                }
            });
        });
    }

    async unapplyRound(round, dropped = false) {
        return new Promise((resolve, reject) => {
            /// TODO: save to db
            library.dbLite.query("SELECT round, data FROM mem_rollbackbackup WHERE name=$name AND round=$round AND state=1", {
                name: this.name,
                round,
            }, { round: Number, data: String }, (err, rows) => {
                if (err) {
                    return reject(err);
                }

                if (rows.length !== 1) {
                    return reject(new Error(`${this.name}-${round} not found.`));
                }

                const jsdata = JSON.parse(rows[0].data);
                if (dropped) {
                    /// TODO: save to db
                    return library.dbLite.query("UPDATE mem_rollbackbackup SET state=0 WHERE name=$name AND round=$round AND data=$data", {
                        name: this.name,
                        round,
                        data: rows[0].data
                    }, err => {
                        err ? reject(err) : resolve(jsdata);
                    });
                }
                return resolve(jsdata);
            });
        });
    }
}

module.exports = RollbackHelper;