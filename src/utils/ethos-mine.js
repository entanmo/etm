'use strict';

const child_process = require("child_process");

var cmd_start = "minestart", cmd_disallow = "disallow", cmd_stop = "minestop";

function execCmd(cmd)
{
	child_process.exec(cmd, function(err, stdout, stderr) {
        if (err) {
            console.log(error.stack);
            console.log('Error code: ' + error.code);
            console.log('Signal received: ' + error.signal);
            return -1;
        }
	    console.log('data : ' + stdout);
	    //process data in stdout
    }).on('exit', function (code) {
        console.log('子进程已退出, 退出码 ' + code);
    });
}

function start(){
    execCmd(cmd_start);
}

function disallow(){
    execCmd(cmd_disallow);
}

function stop(){
    disallow();
    execCmd(cmd_stop);
}

module.exports = {
    start,
    stop
  }