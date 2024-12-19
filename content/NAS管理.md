---
title: 
aliases: 
tags: 
draft: true
---
# 硬盘初始化

首先 `lsblk` 看看现有的硬盘：

```
sda      8:0    0   7.3T  0 disk 
sdb      8:16   0   7.3T  0 disk 
sdc      8:32   0   7.3T  0 disk 
sdd      8:48   0   7.3T  0 disk
```

将现有的 `signature` 全部擦除掉：

```bash
sudo wipefs --all /dev/sd{a,b,c,d}

# /dev/sda：8 个字节已擦除，位置偏移为 ...
```

随后就可以创建物理磁盘了：

```bash
sud pvcreate /dev/sd{a,b,c,d}

#   Physical volume "/dev/sda" successfully created...
```

创建名为 `data` 和 `resource` 的 VG Group：

```
sudo vgcreate data /dev/sda
sudo vgcreate resource /dev/sd{b,c,d}
```

随后在每个 VG Group 上创建相应的 thin pool：

```bash
sudo lvcreate -c 64K -L 1024G -T data/pool
sudo lvcreate -c 64K -L 1024G -T resource/pool
```

其中：

-  `-c 64K` 指定了分块大小为 `64KB`，否则会显示 `Pool zeroing and 512,00 KiB large chunk size slows down thin provisioning.`；
-  `-L 1024G` 指定了初始大小为 `1T`。Thin pool 是在物理空间中创建的，所以必须指定一个大小；但由于 thin pool 有[[#Thin Pool 自动扩容|自动扩容机制]]，所以初始大小无所谓；
- `-T data/pool` 指定了在 `data` VG group 下创建名为 `pool` 的逻辑磁盘，也即 thin pool；

# Thin Pool 自动扩容

在 `/etc/lvm/lvm.conf` 中，确保如下两项没有被注释掉：

```conf
thin_pool_autoextend_threshold = 80
thin_pool_autoextend_percent = 20
```

该两项设置代表了当 thin pool 的容量占用达到了 80%时，将自动扩容 20%。

# 删除逻辑磁盘

首先卸载位于 `/dev/mapper` 的磁盘：

```bash
sudo umount /dev/mapper/<VG_NAME>-<LV_NAME>
```

若执行后报错“设备忙”等，说明有进程在使用该磁盘挂载点中包含的文件。可以通过 `lsof` 找出这些进程并合适的解决掉它们：

```bash
sudo lsof +D <MOUNT_POINT>
```

然后即可删除逻辑磁盘：

```bash
sudo lvremove <VG_NAME>/<LV_NAME> -y
```

如有必要，删除该逻辑磁盘的挂载点（不删除的话则该挂载点中的数据将默认迁移到其父目录所用磁盘中）：

```bash
sudo rm -rf <MOUNT_POINT>
```

# 数据备份



# 相关文章

