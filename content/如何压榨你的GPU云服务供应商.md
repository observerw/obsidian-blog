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

1. **流量入口**：用户请求通过云服务商提供的端口进入云服务器。
2. **流量分流**：通过 `iptables` 和 `sslh` 将流量分为 SSH 和 HTTP 两类。
3. **SSH 流量**：计划通过 `frp` 服务端和客户端实现内网穿透，将流量分发到不同的内网主机（尚未实现，用虚线表示）。
4. **HTTP 流量**：通过 Caddy 服务器根据子域名将请求转发到对应的服务端口（已实现）。

**核心思路**：通过流量分流和反向代理，将外部请求高效、安全地分发到内网的不同服务。

# SSH 与 HTTP (s) 流量分流

安装 `sslh`：

```bash
sudo apt install sslh
```

有两种方式来处理现在的 `sshd` 服务：

1. 修改 `/etc/ssh/sshd.config`，将监听端口改为其他端口，然后让 `sslh` 在默认的 22 端口上运行；
2. 不修改 `sshd` 的配置，而是想办法让 22 端口上的流量转发到 `sslh` 监听的端口上；

第二种方式的侵入性看起来更小一些，所以最好采用这种方案。

修改 `sslh` 默认配置：

```bash
# /etc/default/sslh

# Default options for sslh initscript
# sourced by /etc/init.d/sslh

DAEMON=/usr/sbin/sslh
ORIGINAL_PORT=22
FORWARD_PORT=2222
DAEMON_OPTS="--user sslh --listen 0.0.0.0:2222 --ssh 127.0.0.1:22 --http 127.0.0.1:80 --pidfile /var/run/sslh/sslh.pid"
```

编写 `systemd` 服务：

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

其中添加了 `ExecStartPost` 和 `ExecStopPost` 设置，用于在服务启动和关闭时相应的修改 `iptables` 设置。

# HTTP (s) 流量分流，或者叫作反向代理

首先[安装 `Caddy`](https://caddyserver.com/docs/install)（不得不说 Golang 在这种重 IO 轻计算的软件领域上简直是称王称霸）。

然后在 `/etc/caddy/Caddyfile` 中配置反向代理：

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

就这么简单。

可以测试一下：

```bash
curl <SERVER_HOST>:<SERVER_PORT>/v1/models
curl <SERVER_HOST>:<SERVER_PORT>/embedding-model/v1/models
```

# 相关文章

