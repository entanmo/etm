[English](./README.md) | 简体中文

<h1 align="center">En-Tan-Mo</h1>
<div align="center">

[![License](https://img.shields.io/badge/license-MIT-yellow.svg?style=flat)]()
[![Platform](https://img.shields.io/badge/platform-Ubuntu-orange.svg?style=flat)](http://www.entanmo.com/download/entanmo-ubuntu.tar.gz)
[![Platform](https://img.shields.io/badge/platform-Windows-blue.svg?style=flat)](http://www.entanmo.com/download/entanmo-windows.zip)

</div>   

En-Tan-Mo， 灵感来源于 Entente（联盟）、Transaction（交易）和 Mobius（莫比乌斯），是基于纳什均衡和价值传递理论的新一代区块链项目。

诺贝尔经济学奖得主、理性预期学派领袖**托马斯·萨金特**教授，诺贝尔物理学奖得主、大一统理论奠基人**谢尔顿·格拉肖**教授以及来自于美国加州理工大学、美国马里兰大学、法国庞加莱研究所的各领域学者们，将博弈论的研究成果革命性融入区块链中，共同创造了具有 SHD 完备性的 En-TanMo。在 En-Tan-Mo 世界中，SCV 矿工和 Pareto 矿池，在 Kantorovich 共识机制下相互支撑、相互激励，包容各种区块链与非区块链的应用和社区，帮助所有渴望公平、民主、自由的人们，在区块链带来的去中心化思潮中，均衡的获得属于每个个体的最高权益。En-Tan-Mo，不仅仅是一个纳什均衡的区块链底层平台，还包含了最丰富的应用和最广泛的社区，甚至包含了严谨的数学论证和丰富的经济学内涵，从而形成了完整的哲学思想和系统。因此，“技术白皮书”的形式难以体现出 En-Tan-Mo 的真正优势，研发团队以资料汇编的形式从世界、哲学、数学、经济、计算、生态等多维度向每一个关注 En-Tan-Mo 的人进行阐述。

- 官网: https://www.entanmo.com

## 在 Ubuntu 上安装 En-Tan-Mo Mainnet 节点

1. 下载安装包

   下载并解压安装包，进入相应目录。

```
wget http://www.entanmo.com/download/entanmo-ubuntu.tar.gz
tar zxvf entanmo-ubuntu.tar.gz
cd entanmo
```

2. 启动节点

   执行命令 `./entanmod [command]`

> **命令介绍**  
`configure`: 初始化配置 SQLite3  
`start`: 在前台启动节点系统，此时控制台(终端)会被节点系统进程独占  
`start_daemon`: 在后台启动节点系统，此时控制台(终端)不会被节点系统独占  
`stop`: 停止后台运行的节点系统  
`restart`: 前台重启节点系统  
`restart_daemon`: 后台重启节点系统  
`status`: 查看节点系统是否启动  

首次运行请执行 `./entanmod configure`，而后执行`./entanmod start`


## 在 Windows 上安装 En-Tan-Mo Mainnet 节点

1. 下载安装包

   下载安装包: http://www.entanmo.com/download/entanmo-windows.zip

   解压安装包并进入相应目录。

2. 启动节点

   执行 `entanmod.bat [command]`

> **命令介绍**  
`start`: 在前台启动节点系统，此时控制台(终端)会被节点系统进程独占  
`start_daemon`: 在后台启动节点系统，此时控制台(终端)不会被节点系统独占  
`stop`: 停止后台运行的节点系统  
`restart`: 前台重启节点系统  
`restart_daemon`: 后台重启节点系统  
`status`: 查看节点系统是否启动  

## 进一步配置

部署好系统后，需要修改相关配置，以保证系统正常运行。在 `entanmo\config` 目录下找到 `config.json` 文件，将 `secret` 字段，修改为我们提供的内测专用 `secret`。

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
    "secret": [ ""// 双引号内填入个人 secret
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

## 查看矿机收益

你可以使用在线钱包查看个人收益：进入 http://wallet.entanmo.com ，使用先前的内测 `secret` 登录钱包，即可以查看矿机收益。
