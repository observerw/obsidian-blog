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
sudo lvcreate -c 64K -L 4T -T data/pool
sudo lvcreate --stripes 3 --stripesize 128 -c 128K -L 10T -T resource/pool
```

其中：

- `--stripes 3` 指定使用 3 个条带设备读写；
-  `-c 64K` 指定了分块大小为 `64KB`，否则会显示 `Pool zeroing and 512,00 KiB large chunk size slows down thin provisioning.`；
-  `-L 1024G` 指定了初始大小为 `1T`。Thin pool 是在物理空间中创建的，所以必须指定一个大小；但由于 thin pool 有[[#Thin Pool 自动扩容|自动扩容机制]]，所以初始大小无所谓；
- `-T data/pool` 指定了在 `data` VG group 下创建名为 `pool` 的逻辑磁盘，也即 thin pool；

随后即可在对应的 `pool` 上创建任意容量大小的 LV。先创建 `public` 磁盘：

```bash
sudo lvcreate -V 21T -T resource/pool -n public
```

其中：

- `-V 21T` 指定虚拟大小为 `21TB`，远大于所在 `pool` 的容量；
- 创建 `backup` 或其他磁盘同理；

然后在磁盘上创建文件系统：

```bash
sudo mkfs.ext4 /dev/resource/public
```

最后将磁盘挂载到指定挂载点：

```bash
sudo mount /dev/resource/public /samba/public
```

# 数据盘管理



# 资源盘管理



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

切换到 root 账户，通过：

```bash
contab -e
```

打开 crontab 的编辑界面，添加如下任务：

```contab
0 0 */1 * * /samba/.backup/backup.sh
```

即每天执行一次 `/samba/.backup/backup.sh` 脚本，脚本内容为：

```sh
#!/bin/bash
  
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

这可以使用 Sticky Bit 权限位实现。

# 参考文档

- [RedHat文档](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/6/html/logical_volume_manager_administration/thinly_provisioned_volume_creation)

# 相关文章

