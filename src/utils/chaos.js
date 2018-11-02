const hex = {
    0: [0, 0, 0, 0],
    1: [0, 0, 0, 1],
    2: [0, 0, 1, 0],
    3: [0, 0, 1, 1],
    4: [0, 1, 0, 0],
    5: [0, 1, 0, 1],
    6: [0, 1, 1, 0],
    7: [0, 1, 1, 1],
    8: [1, 0, 0, 0],
    9: [1, 0, 0, 1],
    a: [1, 0, 1, 0],
    b: [1, 0, 1, 1],
    c: [1, 1, 0, 0],
    d: [1, 1, 0, 1],
    e: [1, 1, 1, 0],
    f: [1, 1, 1, 1],
  }

/*
 *  @Param hash256 256 比特数组
 *  @Param height  当前高度 
 *  @Param limit   代理数目
 */
function chaos(hash, height, limit) {
    var hash256 = [];
    for (var j = 0; j < hash.length; j++) {
      let str = hash[j];
      hash256 = hash256.concat(hex[str]);
    }

    var rand = new Random(height);
    var iMin = 3;
    var iMax = 13;
    var N_sat = Math.floor(rand.seededRandom() * (iMax + 1 - iMin)) + iMin; // 3 ~ 13 都可能
    var x0_sat = [rand.seededRandom(), rand.seededRandom(), rand.seededRandom()];

    // N_sat = 10;
    // x0_sat = [0.6522, 0.8270, 0.3081];

    var x_re_sat = myNewChaosMap(x0_sat, N_sat, 1);
    while (true) {
        if (x_re_sat != 'e') {
            break;
        }
        x0_sat = [Math.random(), Math.random(), Math.random()];
        x_re_sat = myNewChaosMap(x0_sat, N_sat, 1);
    }


    for (var i = 0; i < x_re_sat.length; i++) {
        x_re_sat[i] = x_re_sat[i] * 10000;

    }

    var val_sat = sum(x_re_sat);
    var flag_sat = getResVal(val_sat, 3);


    var idx_slt = [1, 2, 3];
    //idx_slt(flag_sat) = [];
    idx_slt.splice(flag_sat - 1, 1)

    var chnl_val = flag_sat;
    idx_slt;

    var Mx_flag = [];
    var idx_par = idx_slt[0];
    var val_par = x_re_sat[idx_par - 1];
    var flag_par = getResVal(val_par, 12);
    //return flag_par;
    Mx_flag[0] = flag_par;

    var idx_ite = idx_slt[1];
    var val_ite = x_re_sat[idx_ite - 1];
    var flag_ite = getResVal(val_ite, 12);
    Mx_flag[1] = flag_ite;


    var flag_ini = 32 - (flag_par + flag_ite);
    Mx_flag[2] = flag_ini;
    //return Mx_flag;

    var resArr = getParmAlg(hash256, Mx_flag);
    val_par_scale = resArr[0];
    var val_N = resArr[1];
    var val_ini = resArr[2];

    var x0_mid = [val_ini, val_ini, val_ini];
    var x_final = myNewChaosMap(x0_mid, val_N, val_par_scale);
    //return x_final;  // [ 1.097500836391649, -0.32308709608401553, 0.3652666548082051 ]

    while (true) {
        if (x_final != 'e') {
            break;
        }
        x0_mid = x0_mid + [0.001, 0.001, 0.001];
        x_final = myNewChaosMap(x0_mid, val_N, val_par_scale);
    }
    var x_chnl_out = x_final[chnl_val - 1];
    x_chnl_out = x_chnl_out * 10000;
    val_out = getResVal(x_chnl_out, limit);
    return val_out - 1;
}

/* myNewChaosMap */
function myNewChaosMap(x0, N, par_scale) {
    var a = 1.65 * (1 + par_scale * 0.01);
    var b = 1.5;
    var c = -1.2;
    var d = 0.2;
    var e = 1.5;
    var x = [];
    var y = [];
    var z = [];
    x[0] = x0[0] / 10;
    y[0] = x0[1] / 10;
    z[0] = x0[2] / 10;

    for (var n = 0; n < N; n++) {
        x[n + 1] = a * y[n] + b * y[n] * y[n];
        y[n + 1] = c * x[n] + d * y[n] + d * x[n] * z[n];
        z[n + 1] = x[n] * x[n] + e * y[n] * x[n];
    }

    var flag_ln = x.length;

    var re = [];
    if (flag_ln == N + 1) {
        re[0] = x[N - 1];
        re[1] = y[N - 1];
        re[2] = z[N - 1];
    } else if (flag_ln == 0) {
        re = 'e';
    }
    return re;
}

/* getResVal */
function getResVal(x, gap) {
    y = Math.floor(Math.abs(x));
    z = y % gap + 1;
    return z;
}

/* getParmAlg */
function getParmAlg(x256, Mx_flag) {
    const Mx_idx = [];
    for (var i = 0; i < 32; i++) {
        Mx_idx[i] = [];
        for (var j = 0; j < 8; j++) {
            Mx_idx[i][j] = i * 8 + j + 1;
        }
    }

    var flag_par = Mx_flag[0];
    var flag_ite = Mx_flag[1];
    var flag_ini = Mx_flag[2];

    var idx_par_ben = 1;
    var idx_par_end = flag_par;

    var idx_ite_ben = idx_par_end + 1;
    var idx_ite_end = idx_ite_ben + flag_ite - 1;

    var idx_ini_ben = idx_ite_end + 1;
    var idx_ini_end = idx_ini_ben + flag_ini - 1;

    Mx_idx_par = Mx_idx.slice(idx_par_ben - 1, idx_par_end);
    Mx_idx_ite = Mx_idx.slice(idx_ite_ben - 1, idx_ite_end);
    Mx_idx_ini = Mx_idx.slice(idx_ini_ben - 1, idx_ini_end);

    var val_par = getModelPar(x256, Mx_idx_par);
    var val_N = getModelIte(x256, Mx_idx_ite);
    var val_ini = getModelIni(x256, Mx_idx_ini);

    return [val_par, val_N, val_ini];
}

function getModelIte(x256, Mx_idx_ite) {

    var vals = [];
    var num_seg = Mx_idx_ite.length;
    for (k = 1; k <= num_seg; k++) {
        var idx_tmp = Mx_idx_ite[k - 1];
        //var val_bin_tmp = x256.slice(idx_tmp);
        //val_dec_tmp = bin2dec(val_bin_tmp);
        vals[k - 1] = toDec(x256, idx_tmp);
    }
    val = Math.floor(mean(vals));
    if (val == 0) {
        val = val + 1;
    }
    return val;
}

function getModelPar(x256, Mx_idx_par) {
    var val = getModelIte(x256, Mx_idx_par);
    var max_val = Math.pow(2, 8);
    var val_nor = val / max_val;
    return val_nor;
}

function getModelIni(x256, Mx_idx_ini) {

    var beg = (32 - Mx_idx_ini.length) * 8
    var end = beg + 53
    var ln = 52
    if (end >= 256) {
        end = 256
        ln = end - beg
    }
    var val_bin = x256.slice(beg, end);
    var val_dec = bin2dec(val_bin);
    var val_max = Math.pow(2, 53);
    var val_nor = val_dec / val_max;
    return val_nor;
}

/* math util */
function mean(arr) {
    var sum = 0;
    for (var key in arr) {
        sum += arr[key];
    }
    return sum / arr.length;
}

function toDec(x256, posArr) {
    var val = 0;
    for (var idx in posArr) {
        val = val * 2;
        val += x256[posArr[idx] - 1];
    }
    return val;
}

function bin2dec(bits) {
    var val = 0;
    for (var idx in bits) {
        val = val * 2;
        val += bits[idx];
    }
    return val;
}

function sum(arr) {
    var total = 0;
    for (var i = 0; i < arr.length; i++) {
        total += arr[i]
    }
    return total
}

// 将  m * n  的矩阵  转换 成  n * m 的 矩阵 
// function vert(arr) {
//     var rows = arr.length
//     var height = arr[0].length

//     var ret = []
//     for (var i = 0; i < height; i++) {
//         ret[i] = [];
//         for (var j = 0; j < rows; j++) {
//             ret[i][j] = arr[j][i]
//         }
//     }
//     return ret;
// }

// function double2Single(arr) {
//     var rows = arr.length
//     var height = arr[0].length

//     var ret = [];
//     for (var i = 0; i < rows; i++) {
//         for (var j = 0; j < height; j++) {
//             ret[i * height + j] = arr[j][i];
//         }
//     }
// }

// function range(beg, end) {
//     var ret = []
//     for (var i = beg; i <= end; i++) {
//         ret[i - beg] = i;
//     }
//     return ret;
// }

// function str2Bits(x256) {
//     var arr = x256.split('')
//     for (var i = 0; i < arr.length; i++) {
//         arr[i] = parseInt(arr[i])
//     }
//     return arr
// }

/* random */
class Random {
    constructor(seed) {
        this.seed = seed;
    }

    seededRandom(max, min) {
        max = max || 1;
        min = min || 0;
        this.seed = (this.seed * 9301 + 49297) % 233280;
        var rnd = this.seed / 233280.0;
        return min + rnd * (max - min);
    };
}

module.exports = chaos;