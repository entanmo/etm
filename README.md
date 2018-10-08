English | [简体中文](./README.zh-CN.md)

<h1 align="center">En-Tan-Mo</h1>
<div align="center">

[![License](https://img.shields.io/badge/license-MIT-yellow.svg?style=flat)]()
[![Platform](https://img.shields.io/badge/platform-Ubuntu-orange.svg?style=flat)](http://www.entanmo.com/download/entanmo-ubuntu.tar.gz)
[![Platform](https://img.shields.io/badge/platform-Windows-blue.svg?style=flat)](http://www.entanmo.com/download/entanmo-windows.zip)

</div>   

En-Tan-Mo is a next-generation blockchain based on Nash equilibrium and the idea of value transfer. 

Its name emerged from Entente, Transaction and Mobius. The core En-Tan-Mo team consists of a remarkable consortium of scholars, including **Prof. Thomas Sargent**, the leader of the rational expectation revolution and winner of the 2011 Nobel Prize in Economics; **Prof. Sheldon Lee Glashow**, the Nobel-winning theoretical physicist who proposed the first grand unified theory; as well as scholars from California Institute of Technology, the University of Maryland and the institut Henri Poincare who achieved SHD completeness by innovatively incorporating game theory in blockchain development. En-Tan-Mo is a place where SCV miners and Pareto mining pools support and motivate each other under Kantorovich consensus, a platform that accommodates various applications and communities in different blockchains and non-blockchain systems, and a decentralized world where people longing for equality, democracy and genuine freedom are entitled to their fair share of stake. En-Tan-Mo goes beyond a blockchain-based platform. It is a community that carries the widest variety of applications and hosts the most extensive participants and the one that is built upon solid mathematical framework and guided by profound economic and philosophical thoughts. This white-book, therefore, is not sufficient to account for the significance and complexity of En-TanMo, and merely serves as a brief introduction of the project. En-Tan-Mo development team is working on producing more papers with respect to En-Tan-Mo world, philosophy, mathematics, economics, calculation and ecology so as to shed more light on the project for interested readers.

- Home Page: https://www.entanmo.com

## Install En-Tan-Mo Main-net on Ubuntu

1. Download installation package

   Download and unzip the package and go to the appropriate directory

```
wget http://www.entanmo.com/download/entanmo-ubuntu.tar.gz
tar zxvf entanmo-ubuntu.tar.gz
cd entanmo
```

2. Start the node

   execute `./entanmod [command]`

> **Command Introduction**  
`configure`: Initialize SQLite3  
`start`: Start the node system in the foreground, the console (terminal) will be monopolized by process  
`start_daemon`: Start the node system in the background, the console (terminal) will not be monopolized by process  
`stop`: Stop the node system running in the background  
`restart`: Restart node system  
`restart_daemon`: Background restart node system  
`status`: Check if the node system is started  

Run for the first time, please execute `./entanmod configure`，than`./entanmod start`

## Install En-Tan-Mo Mainnet on Windows

1. Download installation package

   Download installation package: http://www.entanmo.com/download/entanmo-windows.zip

   Unzip the package and go to the appropriate directory

2. Start the node

   execute `entanmod.bat [command]`

> **Command Introduction**  
`start`: Start the node system in the foreground, the console (terminal) will be monopolized by process  
`start_daemon`: Start the node system in the background, the console (terminal) will not be monopolized by process  
`stop`: Stop the node system running in the background  
`restart`: Restart node system  
`restart_daemon`: Background restart node system  
`status`: Check if the node system is started  

## Configuration

After the system is deployed, you need to modify the related configuration to ensure that the system runs normally. Find the `config.json` file in the `entanmo\config` directory and change the `secret` field to the us-specific dedicated `secret`.

```JSON
{
  "port": 4096,
  "address": "0.0.0.0",
  "publicIp": "",
  "logLevel": "debug",
  "magic": "e81b8a0c",
  "api": {
    "access": {
      "whiteList": []
    }
  },
  "peers": {
    "list": [
      {
        "ip": "52.187.232.98", 
        "port":4096
      }
    ],
    "blackList": [],
    "options": {
      "timeout": 4000,
      "pingTimeout":500
    }
  },
  "forging": {
    "secret": [ ""// Fill in the personal secret in double quotes
    ],
    "access": {
      "whiteList": [
        "127.0.0.1"
      ]
    }
  },
  "loading": {
    "verifyOnLoading": false,
    "loadPerIteration": 5000
  },
  "ssl": {
    "enabled": false,
    "options": {
      "port": 443,
      "address": "0.0.0.0",
      "key": "./ssl/server.key",
      "cert": "./ssl/server.crt"
    }
  },
  "dapp": {
    "masterpassword": "ytfACAMegjrK",
    "params": {}
  }
}
```

## View mine revenue

You can use the online wallet to view your personal earnings: go to http://wallet.entanmo.com and log in to your wallet using the previous beta `secret` to see the mine revenue.
