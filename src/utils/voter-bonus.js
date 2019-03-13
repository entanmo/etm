"use strict";

const crypto = require("crypto");
const chaos = require("./chaos");
const slots = require("./slots");

class VoterBonus {
    constructor() {
        this.roundCaches = {};

        // setInterval(() => {
        //     console.log("VoterBonus Caches:", JSON.stringify(this.roundCaches, null, 2));
        // }, 5000);
    }

    async _asyncGetAccounts(filter, fields) {
        return new Promise((resolve, reject) => {
            modules.accounts.getAccounts(filter, fields, (err, allDelegates) => {
                if (err) {
                    return reject(err);
                }

                return resolve(allDelegates);
            });
        });
    }

    async _asyncGenerateDelegateList(height) {
        return new Promise((resolve, reject) => {
            modules.delegates.generateDelegateList(height, (err, roundDelegates) => {
                if (err) {
                    return reject(err);
                }

                return resolve(roundDelegates);
            });
        });
    }

    async _asyncGetDelegateVoters(publicKey) {
        return new Promise((resolve, reject) => {
            modules.delegates.getDelegateVoters(publicKey, (err, voters) => {
                if (err) {
                    return reject(err);
                }
                return resolve(voters);
            })
        })
    }

    async _asyncListLockVote(query) {
        return new Promise((resolve, reject) => {
            modules.lockvote.listLockVotes(query, (err, results) => {
                if (err) {
                    return reject(err);
                }

                return resolve(results);
            });
        });
    }

    async _getVoterVote(address) {
        const results = await this._asyncListLockVote({
            address,
            state: 1
        });
        let totalVotes = 0;
        for (let el of results.trs) {
            totalVotes += el.asset.vote;
        }
        return totalVotes;
    }

    async _saveToDB(value) {
        return new Promise((resolve, reject) => {
            // console.log("++++++++++++++++++++++ saveToDB:", JSON.stringify(value, null, 2));
            const base64Voters = Buffer.from(value.voters, "utf8").toString("base64");
            library.dbLite.query("INSERT INTO mem_roundrewards(round, isTop, delegatePublicKey, voters)" +
                "VALUES($round, $isTop, $delegatePublicKey, $voters);", {
                    round: value.round,
                    delegatePublicKey: Buffer.from(value.delegatePublicKey, "hex"),
                    isTop: value.isTop ? 1 : 0,
                    voters: base64Voters
                }, err => {
                    if (err) {
                        return reject(err);
                    }

                    return resolve();
                });
        });
    }

    async _readFromDB() {
        return new Promise((resolve, reject) => {
            library.dbLite.query("SELECT round, isTop, delegatePublicKey, voters FROM mem_roundrewards;",
                {},
                [
                    "round", "isTop", "delegatePublicKey", "voters"
                ],
                (err, rows) => {
                    if (err) {
                        return reject(err);
                    }

                    // console.log("-----------------------------:", rows);
                    return resolve(rows);
                });
        });
    }

    async _freshDB() {
        return new Promise((resolve, reject) => {
            library.dbLite.query("DELETE FROM mem_roundrewards;", {}, err => {
                if (err) {
                    return reject(err);
                }

                return resolve();
            });
        });
    }

    async _getDelegateVotersVotes(publicKey) {
        const votes = {};
        const voters = await this._asyncGetDelegateVoters(publicKey);
        for (let account of voters.accounts) {
            const vote = await this._getVoterVote(account.address);
            votes[account.address] = votes[account.address] || 0;
            votes[account.address] += vote;
        }

        return votes;
    }

    async _bonusAction(address, amount, block) {
        return new Promise((resolve, reject) => {
            modules.accounts.mergeAccountAndGet({
                address,
                balance: amount,
                u_balance: amount,
                blockId: block.id,
                round: modules.round.calc(block.height)
            }, err => {
                if (err) {
                    return reject(err);
                }

                return resolve();
            });
        });
    }

    async _allDelegatesVoters() {
        const allDelegates = await this._asyncGetAccounts({
            isDelegate: 1,
            sort: {
                vote: -1,
                publicKey: -1
            }
        }, ["publicKey", "address"]);
        const allVoters = {};
        for (let delegate of allDelegates) {
            const votes = await this._getDelegateVotersVotes(delegate.publicKey);
            allVoters[delegate.publicKey] = votes;
        }
        return allVoters;
    }

    async beginBonus(round, block) {
        // console.log("begin bonus:", round, block.height);
        this.roundCaches[round] = this.roundCaches[round] || {};
        this.roundCaches[round].allDelegateVoters = await this._allDelegatesVoters();
        this.roundCaches[round].delegates = await this._asyncGenerateDelegateList(block.height);

        // TODO Cache
        const { allDelegateVoters, delegates } = this.roundCaches[round];
        const cache = [];
        Object.keys(allDelegateVoters).forEach(el => {
            let isTop = false;
            if (delegates.includes(el)) {
                isTop = true;
            }
            cache.push({
                round: round,
                delegatePublicKey: el,
                isTop,
                voters: JSON.stringify(allDelegateVoters[el])
            });
        });
        // save to db
        // console.log("___________________ cache: ", JSON.stringify(cache, null, 2));
        for (let i = 0; i < cache.length; i++) {
            await this._saveToDB(cache[i]);
        }

        // console.log("begin bonus:", JSON.stringify(this.roundCaches[round], null, 2));
    }

    async commitBonus(round, bonusAmount, block) {
        // console.log("commit bonus:", round, bonusAmount, block.height);
        if (this.roundCaches[round] == null) {
            return;
        }

        const allVotersBonusAmount = Math.floor(bonusAmount / 4);
        const roundVotersBonusAmount = Math.floor(bonusAmount / 4);
        const chaosVoterBonusAmount = bonusAmount - allVotersBonusAmount - roundVotersBonusAmount;
        const { allDelegateVoters, delegates } = this.roundCaches[round];
        this.roundCaches[round].bonusAmount = bonusAmount;
        this.roundCaches[round].block = block;
        // console.log("commit bonus:", JSON.stringify(this.roundCaches[round], null, 2));


        // calc total votes
        // total voters
        // delegate voters
        let totalVotes = 0;
        const allVoters = {};
        const topDelegateVoters = {};
        const roundDelegateVoters = [];
        Object.keys(allDelegateVoters).forEach(delegatePublicKey => {
            const voters = allDelegateVoters[delegatePublicKey];
            let isTop = delegates.includes(delegatePublicKey);
            if (isTop) {
                topDelegateVoters[delegatePublicKey] = voters;
            }
            Object.keys(voters).forEach(voterAddress => {
                const vote = voters[voterAddress];
                totalVotes += vote;
                allVoters[voterAddress] = allVoters[voterAddress] || 0;
                allVoters[voterAddress] += vote;
                if (isTop && !roundDelegateVoters.includes(voterAddress)) {
                    roundDelegateVoters.push(voterAddress);
                }
            });
        });

        // all voters bonus
        const allVoterKeys = Object.keys(allVoters);
        for (let i = 0; i < allVoterKeys.length; i++) {
            const el = allVoterKeys[i];
            const amount = Math.floor(allVoters[el] / totalVotes * allVotersBonusAmount);
            await this._bonusAction(el, amount, block);
        }

        // round voters
        const singleDelegateVoterBonusAmount = Math.floor(roundVotersBonusAmount / slots.delegates);
        const delegateKeys = Object.keys(topDelegateVoters);
        for (let i = 0; i < delegateKeys.length; i++) {
            const voters = topDelegateVoters[delegateKeys[i]];

            const voterKeys = Object.keys(voters);
            let delegateTotalVotes = 0;
            voterKeys.forEach(el => {
                delegateTotalVotes += voters[el];
            });
            for (let i = 0; i < voterKeys.length; i++) {
                const address = voterKeys[i];
                const voterVote = voters[address];
                const amount = Math.floor(voterVote / delegateTotalVotes * singleDelegateVoterBonusAmount);
                await this._bonusAction(address, amount, block);
            }
        }

        // chaos voter
        const hash = crypto.createHash("sha256").update(block.id).digest("hex");
        const chaosIndex = chaos(hash, block.height, roundDelegateVoters.length);
        // FIXEDME: 保证不同版本，不同实现下的数据顺序一致
        roundDelegateVoters.sort((a, b) => {
            if (a > b) {
                return 1;
            }
            if (a < b) {
                return -1;
            }

            return 0;
        });

        await this._bonusAction(roundDelegateVoters[chaosIndex], chaosVoterBonusAmount, block);
        await this._freshDB();
    }

    async recovery() {
        const data = await this._readFromDB();

        // TODO
        let cacheRound = null;
        let allDelegateVoters = {};
        let delegates = [];
        for (let i = 0; i < data.length; i++) {
            let { round, isTop, delegatePublicKey, voters } = data[i];
            cacheRound = round;
            delegatePublicKey = delegatePublicKey.toString("hex");
            voters = JSON.parse(Buffer.from(voters, "base64").toString());
            if (isTop) {
                delegates.push(delegatePublicKey);
            }
            allDelegateVoters[delegatePublicKey] = voters;
        }

        this.roundCaches[cacheRound] = this.roundCaches[cacheRound] || {};
        this.roundCaches[cacheRound].allDelegateVoters = allDelegateVoters;
        this.roundCaches[cacheRound].delegates = delegates;

        // console.log("==========================:", JSON.stringify(this.roundCaches[cacheRound], null, 2));
    }
}

module.exports = VoterBonus;