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

    async getAccountsAsync(filter, fields) {
        return new Promise((resolve, reject) => {
            modules.accounts.getAccounts(filter, fields, (err, accounts) => {
                if (err) {
                    return reject(err);
                }

                return resolve(accounts);
            });
        });
    }

    async genDelegatesAsync(height) {
        return new Promise((resolve, reject) => {
            modules.delegates.generateDelegateList(height, (err, delegates) => {
                if (err) {
                    return reject(err);
                }

                return resolve(delegates);
            });
        });
    }

    async getVotersAsync(publicKey) {
        return new Promise((resolve, reject) => {
            modules.delegates.getDelegateVoters(publicKey, (err, voters) => {
                if (err) {
                    return reject(err);
                }

                return resolve(voters);
            });
        });
    }


    async listLockvotesAsync(query) {
        return new Promise((resolve, reject) => {
            modules.lockvote.listLockVotes(query, (err, results) => {
                if (err) {
                    return reject(err);
                }
                return resolve(results);
            });
        });
    }

    async getVoterVoteAsync(address) {
        const results = await this.listLockvotesAsync({ address, state: 1 });
        let totalvotes = 0;
        for (let el of results.trs) {
            totalvotes += el.asset.vote;
        }
        return totalvotes;
    }

    async save(value) {
        return new Promise((resolve, reject) => {
            // console.log("++++++++++++++++++++++ saveToDB:", JSON.stringify(value, null, 2));
            const base64Voters = Buffer.from(value.voters, "utf8").toString("base64");
            library.dbLite.query("INSERT INTO mem_roundrewards(round, delegatePublicKey, voters)" +
                "VALUES($round, $delegatePublicKey, $voters);", {
                    round: value.round,
                    delegatePublicKey: Buffer.from(value.delegatePublicKey, "hex"),
                    voters: base64Voters
                }, err => {
                    if (err) {
                        return reject(err);
                    }

                    return resolve();
                });
        });
    }

    async load() {
        return new Promise((resolve, reject) => {
            library.dbLite.query("SELECT round, delegatePublicKey, voters FROM mem_roundrewards",
                {},
                [
                    "round", "delegatePublicKey", "voters"
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

    async flush() {
        return new Promise((resolve, reject) => {
            library.dbLite.query("DELETE FROM mem_roundrewards;", {}, err => {
                if (err) {
                    return reject(err);
                }

                return resolve();
            });
        });
    }

    async applyBonus(address, amount, block) {
        return new Promise((resolve, reject) => {
            modules.accounts.mergeAccountAndGet({
                address,
                balance: amount,
                u_balance: amount,
                blockId: block.id,
                round: modules.round.calc(block.height),
                bonus: amount
            }, err => {
                if (err) {
                    return reject(err);
                }

                return resolve();
            });
        });
    }

    async rollbackBeginBonus(round, caches) {
        this.roundCaches[round] = caches;
        const { voters } = caches;
        const newCaches = [];
        Object.keys(voters).forEach(el => {
            newCaches.push({
                round: round,
                delegatePublicKey: el,
                voters: JSON.stringify(voters[el])
            });
        });
        for (let c of newCaches) {
            await this.save(c);
        }

        return this.roundCaches[round];
    }

    async beginBonus(round, block) {
        // console.log("begin bonus:", round, block.height);
        const delegates = await this.genDelegatesAsync(block.height);
        const voters = {};
        for (let delegate of delegates) {
            const vs = await this.getVotersAsync(delegate);
            const vvs = {};
            for (let account of vs.accounts) {
                const vote = await this.getVoterVoteAsync(account.address);
                vvs[account.address] = vvs[account.address] || 0;
                vvs[account.address] += vote; // Math.floor(Math.pow(vote, 0.75));
            }
            for (let account of vs.accounts) {
                if (vvs[account.address]) {
                    const vote = vvs[account.address];
                    vvs[account.address] = Math.floor(Math.pow(vote, 0.75));
                }
            }
            voters[delegate] = vvs;
        }

        this.roundCaches[round] = this.roundCaches[round] || {};
        this.roundCaches[round].delegates = delegates;
        this.roundCaches[round].voters = voters;

        const caches = [];
        Object.keys(voters).forEach(el => {
            caches.push({
                round: round,
                delegatePublicKey: el,
                isTop: true,
                voters: JSON.stringify(voters[el])
            });
        });
        for (let c of caches) {
            await this.save(c);
        }

        return this.roundCaches[round];
    }

    async commitBonus(round, bonusAmount, block) {
        // console.log("commit bonus:", round, bonusAmount, block.height);
        if (this.roundCaches[round] == null) {
            console.log("commitBonus null commit");
            return;
        }
        this.roundCaches[round].bonusAmount = bonusAmount;
        this.roundCaches[round].block = { id: block.id, height: block.height };

        const voterBonusAmount = Math.floor(bonusAmount / 2);
        const chaosBonusAmount = bonusAmount - voterBonusAmount;
        const { delegates, voters } = this.roundCaches[round];

        const results = [];
        // delegate bonus
        const dba = Math.floor(voterBonusAmount / slots.delegates);
        for (let delegate of delegates) {
            const vs = voters[delegate];
            if (vs == null) continue;
            const addresses = Object.keys(vs);
            let totalvotes = 0;
            addresses.forEach(el => {
                totalvotes += vs[el];
            });

            for (let i = 0; i < addresses.length; i++) {
                const el = addresses[i];
                const v = vs[el];
                const amount = Math.floor(v / totalvotes * dba);
                if (amount > 0) {
                    await this.applyBonus(el, amount, block);
                    /// TODO
                    results.push({ address: el, amount, block: { height: block.height, id: block.id } });
                }
            }
        }
        // delegae chaos
        const hash = crypto.createHash("sha256").update(block.id).digest("hex");
        const chaosIndex = chaos(hash, block.height, delegates.length);
        const sortedDelegates = [].concat(...delegates);
        sortedDelegates.sort((a, b) => {
            if (a > b) {
                return 1;
            }
            if (a < b) {
                return -1;
            }

            return 0;
        });
        const chaosDelegate = sortedDelegates[chaosIndex];
        const vs = voters[chaosDelegate];
        if (vs) {
            const addresses = Object.keys(vs);
            let totalvotes = 0;
            addresses.forEach(el => {
                totalvotes += vs[el];
            });
            for (let i = 0; i < addresses.length; i++) {
                const el = addresses[i];
                const v = vs[el];
                const amount = Math.floor(v / totalvotes * chaosBonusAmount);
                if (amount > 0) {
                    await this.applyBonus(el, amount, block);
                    /// TODO
                    results.push({ address: el, amount, block: { height: block.height, id: block.id } });
                }
            }
        }
        await this.flush();

        return results;
    }

    async recovery() {
        const data = await this.load();

        let cacheRound = null;
        let voters = {};
        let delegates = [];
        for (let i = 0; i < data.length; i++) {
            let { round, delegatePublicKey, voters: delegateVoters } = data[i];
            cacheRound = round;
            delegatePublicKey = delegatePublicKey.toString("hex");
            delegates.push(delegatePublicKey);
            let vs = JSON.parse(Buffer.from(delegateVoters, "base64").toString());
            voters[delegatePublicKey] = vs;
        }

        this.roundCaches[cacheRound] = this.roundCaches[cacheRound] || {};
        this.roundCaches[cacheRound].delegates = delegates;
        this.roundCaches[cacheRound].voters = voters;
    }
}

module.exports = VoterBonus;