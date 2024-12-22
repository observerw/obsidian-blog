---
title: 
aliases: 
tags: 
draft: true
---

# 规划

NAS 上配备了 4 块 HDD，每块的容量为 `7.3TB`。

我们可以简单的认为将 NAS 中存储的数据根据重要性归类为：

- 重要数据 `data`（代码、实验数据、照片等）；
- 不重要数据 `resource`（电影等可重下载资源）；

数据的特征为：

- 重要数据：必须要备份；主要是随机访问；对容量要求、读写速度要求不高；
- 不重要数据：不必备份；主要是顺序访问；对容量要求、读写速度要求高；

所以比较合理的设计为：

- 将四块硬盘中的一块分配给重要数据，将剩下三块全部分配给不重要数据；
- 定期将重要数据增量备份到不重要数据的硬盘中；
- 三块硬盘并行写入，增加不重要数据写入速度；

# 创建物理硬盘

首先 `lsblk` 看看现有的硬盘：

```
sda      8:0    0   7.3T  0 disk 
sdb      8:16   0   7.3T  0 disk 
sdc      8:32   0   7.3T  0 disk 
sdd      8:48   0   7.3T  0 disk
```

可以看到四块硬盘分别名为 `sd{a,b,c,d}`，对应的路径自然也就为 `/dev/sd{a,b,c,d}`。

 将现有的 ` signature ` 全部擦除掉：

```bash
sudo wipefs --all /dev/sd{a,b,c,d}

# /dev/sda：8 个字节已擦除，位置偏移为 ...
```

随后就可以创建物理磁盘了：

```bash
sud pvcreate /dev/sd{a,b,c,d}

#   Physical volume "/dev/sda" successfully created...
```

通过 `pvs`（或者更详细的 `pvdisplay`）查看创建情况：

```
PV         VG       Fmt  Attr PSize  PFree 
/dev/sda   data     lvm2 a--  <7.28t <3.27t
/dev/sdb   resource lvm2 a--  <7.28t <3.94t
/dev/sdc   resource lvm2 a--  <7.28t  3.94t
/dev/sdd   resource lvm2 a--  <7.28t <3.94t
```

# 数据盘管理

创建名为 `data` 的 VG Group：

```
sudo vgcreate data /dev/sda
```

创建 thin pool：

```bash
sudo lvcreate -c 64K -L 4T -T data/pool
```

- `-c 64K` 将分块大小设置为相对较小的 `64KB`，否则会提示 `Pool zeroing and 512,00 KiB large chunk size slows down thin provisioning.`；
- `-T data/pool` 指明该 pool 创建在 `data` 上，名为 `pool`；

# 资源盘管理

创建名为 `resource` 的 VG Group：

```
sudo vgcreate resource /dev/sd{b,c,d}
```

创建 thin pool：

```bash
sudo lvcreate --stripes 3 --stripesize 128 -c 128K -L 10T -T resource/pool
```

其中：

- `--stripes 3 --stripesize 128` 指定使用 3 个条带设备读写，条带大小 `128 KB`；
-  `-L 10T` 指定了初始大小为 ` 10 TB`。Thin pool 是在物理空间中创建的，所以必须指定一个大小；但由于 thin pool 有[[#Thin Pool 自动扩容|自动扩容机制]]，所以初始大小无所谓；

随后即可在对应的 `pool` 上创建任意容量大小的 LV。先创建名为 `public` LV 作为公共空间：

```bash
sudo lvcreate -V 21T -T resource/pool -n public
```

其中：

- `-V 21T` 指定虚拟大小为 `21TB`，远大于所在 `pool` 的容量；

然后在磁盘上创建文件系统，使用 `ext4` 即可：

```bash
sudo mkfs.ext4 /dev/resource/public
```

最后将磁盘挂载到指定挂载点：

```bash
sudo mount /dev/resource/public /samba/public
```

大功告成。此时 `/samba/public` 目录就已经准备就绪了。创建 `backup` 或其他磁盘同理。

# Thin Pool 自动扩容

Thin pool 容量被占满通常不是什么好事，所以在 `/etc/lvm/lvm.conf` 中，确保如下两项没有被注释掉：

```conf
thin_pool_autoextend_threshold = 80
thin_pool_autoextend_percent = 20
```

该两项设置代表了当 thin pool 的容量占用达到了 80%时，将自动扩容 20%。

即便如此，物理硬盘的空间仍然是有限的，所以还是需要定期检查存储空间剩余容量。

# 删除逻辑磁盘

首先卸载位于 `/dev/mapper` 的磁盘：

```bash
sudo umount /dev/mapper/<VG_NAME>-<LV_NAME>

# 比如 resource/public对应的路径为 /dev/mapper/resource-public
```

若执行后报错“设备忙”等，说明有进程在使用该磁盘挂载点中包含的文件，可以通过 `lsof` 找出这些进程并合适的解决掉它们：

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

切换到 root 账户，通过：

```bash
contab -e
```

打开 crontab 的编辑界面，添加如下任务：

```contab
0 0 */1 * * /samba/.backup/backup.sh
```

即每天执行一次 `/samba/.backup/backup.sh` 脚本，脚本内容为：

```bash
#!/bin/bash

# backup.sh
  
SMB_DIR=/samba
BACKUP_DIR=$SMB_DIR/.backup

rsync -av \
	--exclude '.*' \
	--exclude 'public' \
	--exclude '*/resource' \
	$SMB_DIR $BACKUP_DIR
```

也即将所有非 `resource` 的数据增量同步到 `.backup` 中。

# 共享文件夹权限管理

由于 `public` 文件夹是所有用户的公共文件夹，因此需要做一些特殊的权限处理，期望能够做到：

- 所有用户均能够向其中写入数据并读取其中的数据；
- 用户只能删除自己写入的数据，而不能操作其他数据；

这可以使用 [Sticky Bit 权限位](https://en.wikipedia.org/wiki/Sticky_bit)实现。当某个目录的Sticky Bit 被设置后，其中的文件智能够被目录所有者、文件所有者和 root 用户删除。

通过如下命令设置用户可对 `public` 目录完全管理，同时带有 Sticky Bit：

```bash
sudo chmod 1777 /samba/public

# 777代表读、写和执行权限，前面的1代表 Sticky Bit

# 也可以通过 sudo chmod +t /samba/public 单独添加 Sticky Bit
```

同时为了防止非 root 用户持有 `public` 目录，将所有权转交给 root：

```bash
sudo chown root /samba/public
```

设置完目录后，在 `/etc/samba/conf.d/` 中新增 `public.conf`：

```conf
# public.conf

[public]
path = /samba/public # 挂载路径
available = yes
browseable = yes
writable = yes
delete readonly = yes
create mask = 0666
directory mask = 1777 # 新建目录权限为1777
force user = nobody # 强制匿名访问，避免使用特定用户的权限问题
```

# Samba 用户管理

很莫名其妙的，`smb.conf` 并不支持以通配符来包含外部配置，因此采用[动态生成](https://gist.github.com/meetnick/fb5587d25d4174d7adbc8a1ded642d3c) 的方式来创建一个 `includes.conf` 文件，然后将这个文件包含到 `smb.conf` 中。

首先新建一个配置文件夹：

```bash
sudo mkdir /etc/samba/conf.d
```

用于存储额外的配置文件，如 `public` 目录对应的配置文件就可以是 `/etc/samba/conf.d/public.conf`。

假设该目录现在非空了，在 `/etc/samba`下执行如下命令生成 `includes.conf`：

```bash
ls conf.d/* | sed -e 's/^/include = /' > includes.conf
```

生成出来的文件内容应该类似于：

```conf
# includes.conf

include = /etc/samba/conf.d/public.conf
// ...
```

然后修改 `smb.conf`，在 `[global]` 下新增：

```conf
# smb.conf

[global]
include = /etc/samba/includes.conf
```

最后通过 `testparm` 检查，看看 `conf.d` 中的内容是否确实被包含了进去：

```bash
testparm -s

# 应该能够在打印出的内容中找到 conf.d 中包含的内容
```

# 参考文档

- [RedHat文档](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/6/html/logical_volume_manager_administration/thinly_provisioned_volume_creation)

# 相关文章

