---
title: 
aliases: 
tags: 
draft: false
---

# 背景

提供 GPU 资源的云服务供应商通常只会为用户提供一个端口，用于 ssh 连接到服务器。一般来说这就已经能够满足需求了，但在某些场景下也会带来一些麻烦，如：你希望在云服务器上部署一个模型，并通过 HTTP 请求对其进行访问；但由于只有一个端口可用，你无法将这个模型部署在额外的端口上。

因此我们需要在这唯一可用的端口上做点文章，使其能够处理多种多样的请求。

![[mermaid-diagram-1740217281692.svg]]

思路为：

1. **流量入口**：用户请求通过云服务商提供的端口进入云服务器。
2. **流量分流**：通过 `sslh` 将流量分为 SSH 和 HTTP 两类。
3. **SSH 流量**：计划通过 `frp` 服务端和客户端实现内网穿透，将流量分发到不同的内网主机（尚未实现，用虚线表示）。
4. **HTTP 流量**：通过 Caddy 服务器根据子域名将请求转发到对应的服务端口（已实现）。

**核心思路**：通过流量分流和反向代理，将外部请求高效、安全地分发到内网的不同服务。

# SSH 与 HTTP (s) 流量分流

首先安装 `sslh`：

```bash
sudo apt install sslh
```

然后让它来接管那唯一的珍贵端口。这就涉及到如何处置这端口原先的老主人 `sshd`：

1. 让它挪地方：修改 `/etc/ssh/sshd.config`，将监听端口改为其他端口，然后让 `sslh` 在默认的 22 端口上运行；
2. 让它待在原地：不修改 ` sshd ` 的配置，而是想办法让 22 端口上的流量转发到 `sslh` 监听的端口上；

第二种方式的侵入性看起来更小一些，所以最好采用这种方案。

首先我们修改 `sslh` 默认配置：

```bash
# /etc/default/sslh

# Default options for sslh initscript
# sourced by /etc/init.d/sslh

DAEMON=/usr/sbin/sslh
ORIGINAL_PORT=22
FORWARD_PORT=2222
DAEMON_OPTS="--user sslh --listen 0.0.0.0:2222 --ssh 127.0.0.1:22 --http 127.0.0.1:80 --pidfile /var/run/sslh/sslh.pid"
```

我们在原先配置的基础上新增了 `ORIGINAL_PORT=22` 和 `FORWARD_PORT=2222` 两个环境变量，待会进行流量转发的时候将会用到。在 `DAEMON_OPTS` 中，我们设置 `ssh` 流量转发到 22 端口上，http 流量转发到 80 端口上；而 `sslh` 本体则在 2222 端口上监听。

接下来考虑如何将 22 端口上的流量转发到 2222 上。我们需要借助 `iptables` 的力量，首先安装（可能已经自带了）：

```bash
sudo apt install iptables
```

然后可以先测试一下它的转发功能。注意**下面这条指令将会让你的云服务器无法接受新的 ssh 连接**（但已经建立的连接倒是不会终止，很神奇），所以小心行事：

```bash
iptables -t nat -A PREROUTING -p tcp --dport 22 -j REDIRECT --to-port 2222
```

这条指令修改了 `nat` 表，将 22 端口的 tcp 流量全部转发到 2222 端口上。如果想要恢复，则只需将上述指令中的 `-A` 改成 `-D` 即可：

```bash
iptables -t nat -D PREROUTING -p tcp --dport 22 -j REDIRECT --to-port 2222
```

这看起来很完美，但也有点麻烦，每次都要：先设置 `iptables` 规则，然后启动 `sslh`；关闭时则需要先关闭 `sslh`，再取消 `iptables` 规则。

为了省事，我们将二者编写为一个统一的 `systemd` 服务：

```ini
# /lib/systemd/system/sslh.service

[Unit]
Description=SSL/SSH multiplexer
After=network.target
Documentation=man:sslh(8)

[Service]
EnvironmentFile=/etc/default/sslh
ExecStart=/usr/sbin/sslh --foreground $DAEMON_OPTS
ExecStartPost=/usr/sbin/iptables -t nat -A PREROUTING -p tcp --dport $ORIGINAL_PORT -j REDIRECT --to-port $FORWARD_PORT
ExecStopPost=/usr/sbin/iptables -t nat -D PREROUTING -p tcp --dport $ORIGINAL_PORT -j REDIRECT --to-port $FORWARD_PORT
KillMode=process

[Install]
WantedBy=multi-user.target
```

其中添加了 `ExecStartPost` 和 `ExecStopPost` 设置，用于在服务启动和关闭时相应的修改 `iptables` 设置。其中用到了我们之前设置的环境变量。

# HTTP (s) 流量分流，或者叫作反向代理

现在所有的 HTTP 流量都将转发到 80 端口上，但我们很可能需要不止一个 HTTP 服务，比如同时部署一个生成模型和一个嵌入模型，用于搭建 RAG 应用。

好在分流 HTTP 流量的需求比较常规，本质上就是反向代理，早就被各大 HTTP 服务器如 Nginx支持。我们在此不妨使用 Nginx 的现代替代者 `Caddy`。

首先[安装 `Caddy`](https://caddyserver.com/docs/install)（不得不说 Golang 在这种重 IO 轻计算的软件领域上简直是称王称霸）。然后在 `/etc/caddy/Caddyfile` 中配置反向代理：

```caddyfile
:80 {
    handle {
        reverse_proxy localhost:30000
    }

    handle_path /embedding-model/* {
        reverse_proxy localhost:30001
    }
}
```

就这么简单。所有不加 URL 路径的流量将被转发到 30000 上，而带了 `/embedding-model/` 路径的流量则将转发到 30001 上。

可以测试一下：

```bash
curl <SERVER_HOST>:<SERVER_PORT>/v1/models
curl <SERVER_HOST>:<SERVER_PORT>/embedding-model/v1/models
```

# 相关文章

