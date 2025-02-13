---
title: 
aliases: 
tags:
  - 技术
draft: false
---

# 规划

NAS 上配备了 4 块 HDD，每块的容量为 `7.3 TB`。

我们可以简单的将 NAS 中存储的数据根据**重要性**归类为：

- 重要数据 `data`，如代码、实验数据、照片等；
- 不重要数据 `resource`，如电影等可重下载资源；

这两种数据的特征为：

- 重要数据：必须要备份；主要是随机访问；对容量要求、读写速度要求不高；
- 不重要数据：不必备份；主要是顺序访问；对容量要求、读写速度要求高；

此外，**该 NAS 将会被多个用户使用**：

- 每个用户需要有自己的私有目录，同时能够访问到公共目录；
- 用户存储空间的公平性不太重要（你多存一点我少存一点都无所谓，反正空间大）；
- 但可扩展性比较重要（未来可能加入新用户）；

所以比较合理的设计为：

1. 将四块硬盘中的一块分配给重要数据，将剩下三块全部分配给不重要数据； ^design-1
2. 定期将重要数据增量备份到不重要数据的硬盘中； ^design-2
3. 三块硬盘并行写入，增加数据写入速度； ^design-3
4. 不去为每个 NAS 用户预先分配固定的空间，而是让每个用户都认为自己独占所有存储空间（类似于虚拟内存）； ^design-4
5. 通过文件共享系统的权限系统实现权限管理； ^design-5

我们将在接下来的步骤中依次实现这些设计。

# 创建物理硬盘

首先 `lsblk` 看看现有的硬盘：

```bash
lsblk

# sda      8:0    0   7.3T  0 disk 
# sdb      8:16   0   7.3T  0 disk 
# sdc      8:32   0   7.3T  0 disk 
# sdd      8:48   0   7.3T  0 disk
```

可以看到四块硬盘分别名为 `sd{a,b,c,d}`，对应的路径自然也就为 `/dev/sd{a,b,c,d}`。

 将硬盘上现有的 ` signature ` 全部擦除掉（当然，重要数据先备份）：

```bash
wipefs --all /dev/sd{a,b,c,d}

# /dev/sda：8 个字节已擦除，位置偏移为 ...
```

随后就可以创建物理磁盘了：

```bash
pvcreate /dev/sd{a,b,c,d}

#   Physical volume "/dev/sda" successfully created...
```

通过 `pvs`（或者更详细的 `pvdisplay`）查看创建情况：

```bash
pvs

# PV         VG       Fmt  Attr PSize  PFree 
# /dev/sda   data     lvm2 a--  <7.28t <3.27t
# /dev/sdb   resource lvm2 a--  <7.28t <3.94t
# /dev/sdc   resource lvm2 a--  <7.28t  3.94t
# /dev/sdd   resource lvm2 a--  <7.28t <3.94t
```

# 挂载点设计

 我们可以在根目录下创建一个专门的目录 `/samba` 作为挂载点：

```bash
mkdir /samba
```

我们期望的目录结构为：

```
/samba
├── public
├── .backup
|	├── backup.sh
|	└── <USER1>
└── <USER1>
|	├── public -> /samba/public
|	└── resource
└── <USER2>
	├── ...
```

其中：

- `/samba/public`：公用目录，属于 `resource`；
	- 该目录会被符号链接到每个用户目录的 `public` 上；
- `/samba/.backup`：备份目录，用于当 `data` 中数据损坏时恢复数据，属于 ` resource `；
- `/samba/<USERNAME>`：用户私有目录；
	- **该文件夹下的内容默认为重要数据**，属于 `data`， 会进行备份；
	- `resource`：用户私有不重要数据，属于 `resource`， 这些数据不会被备份；
	- `public`：用户公用不重要数据，属于 `resource`；

# 数据盘管理

接下来我们开始使用 LVM 创建相应的磁盘。

我们知道 LVM 分为物理磁盘 PV，磁盘组 VG 和逻辑磁盘 LV 三个抽象层次（详见 [LVM 介绍](https://ubuntu.com/server/docs/about-logical-volume-management-lvm)）。LV 必须依附于某个 VG，为此需要首先为 `data` 和 `resource` 分别创建 VG。

使用 `vgcreate` 创建名为 ` data ` 的 VG （[[#^design-1|设计1]]）：

```
vgcreate data /dev/sda
```

随后在其上创建 [thin pool](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/6/html/logical_volume_manager_administration/thinly_provisioned_volume_creation) （[[#^design-4|设计4]]）：

```bash
lvcreate -c 64K -L 4T -T data/pool
```

- `-c 64K` 将分块大小设置为相对较小的 `64KB`，否则会提示 `Pool zeroing and 512,00 KiB large chunk size slows down thin provisioning.`；
- `-T data/pool` 指明该 pool 创建在 `data` 上，名为 `pool`；

# 资源盘管理

创建名为 `resource` 的 VG Group：

```
vgcreate resource /dev/sd{b,c,d}
```

创建 thin pool：

```bash
lvcreate --stripes 3 --stripesize 128 -c 128K -L 10T -T resource/pool
```

其中：

- `--stripes 3 --stripesize 128` 指定使用 3 个条带设备读写，条带大小 `128 KB`（[[#^design-3|设计3]]）；
-  `-L 10T` 指定了初始大小为 ` 10 TB`。Thin pool 是在物理空间中创建的，所以必须指定一个大小；但由于 thin pool 有[[#Thin Pool 自动扩容|自动扩容机制]]，所以初始大小无所谓；

随后即可在对应的 `pool` 上创建任意容量大小的 LV。先创建名为 `public` LV 作为公共空间：

```bash
lvcreate -V 21T -T resource/pool -n public
```

其中：

- `-V 21T` 指定虚拟大小为 `21TB`，远大于所在 `pool` 的容量；

然后在磁盘上创建文件系统，使用 `ext4` 即可：

```bash
mkfs.ext4 /dev/resource/public
```

最后将磁盘挂载到指定挂载点：

```bash
mount /dev/resource/public /samba/public
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

也即将所有非 `resource` 的数据增量同步到 `.backup` 中（[[#^design-2|设计2]]）。

# 共享文件夹权限管理

由于 `public` 文件夹是所有用户的公共文件夹，因此需要做一些特殊的权限处理，期望能够做到：

- 所有用户均能够向其中写入数据并读取其中的数据；
- 用户只能删除自己写入的数据，而不能操作其他数据；

这可以使用 [Sticky Bit 权限位](https://en.wikipedia.org/wiki/Sticky_bit)实现。当某个目录的Sticky Bit 被设置后，其中的文件对所有用户可读（当然，前提是你正确设置了其他权限位），但只能够被目录所有者、文件所有者和 root 用户修改和删除。

通过如下命令设置用户可对 `public` 目录完全管理，同时带有 Sticky Bit：

```bash
chmod 1777 /samba/public

# 777代表读、写和执行权限，前面的1代表 Sticky Bit

# 也可以通过 chmod +t /samba/public 单独添加 Sticky Bit
```

同时为了防止非 root 用户持有 `public` 目录，将所有权转交给 root：

```bash
chown root /samba/public
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
mkdir /etc/samba/conf.d
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

每个用户对应的配置文件形如：

```conf
[<USERNAME>]
path = /samba/<USERNAME>
```

这完成了[[#^design-5|设计5]]。

# 添加新用户

我们当然不希望每添加一个新用户就重复一遍上述流程，所以可以通过[[#`/usr/local/bin/samba-user.sh`|脚本]]实现上述流程。

# 持久化挂载



# 附录 1：Samba 硬盘挂载

## Ubuntu 玩家

先安装必要的软件：

```bash
apt-get install cifs-utils smbclient
```

随后创建挂载点，一般可以挂载到 `/mnt/<USERNAME>` 上：

```bash
mkdir /mnt/<USERNAME>
```

然后就可以挂载了，把文件系统类型指定为 `cifs`：

```bash
mount \
	-t cifs \
	//<NAS_IP>/<USERNAME> \
	/mnt/<USERNAME> \
	-o username=<USERNAME>,password=<USER_PASSWD>
```

将如上的 `NAS_IP`，`USERNAME` 和 `USER_PASSWD` 根据实际情况进行替换。

注意 samba url 前面需要以两个斜杠 `//` 开头，形如 `//192.168.0.1`。

挂载完成后就可以像本地文件一样访问到 samba 目录了。

## Windows 玩家

打开文件管理器，在侧边栏选择“网络”，然后（如果必要）点击“启用网络发现和文件共享”-“否，使已连接到的网络成为专用网络”：

![[2024-12-24-09.14.02.png|600]]

然后在路径栏中输入 `\\<NAS_IP>\<USERNAME>`，不出意外的话会要求输出凭据：

![[2024-12-24-09.19.24.png|600]]

输入完成后即可连接。

为了方便，可以将连接后的图标拖到上面去，方便再次访问：

![[2024-12-24-09.20.43.png|200]]

## MacOS 玩家

访达-前往-连接服务器，输入 `smb://<USERNAME>@<NAS_IP>/`，选择自己的宗卷进行挂载：

![[2024-12-24-09.26.06.png|600]]

值得多提一句的是，这个残废的系统不会给你自动保存网络设备，所以每次重启之后你就会发现之前挂载的 samba 设备不见了，又得重新进行一遍上述步骤😡。

参考 [`v2ex`](https://v2ex.com/t/882747)，有人说可以**把宗卷拖拽到设置-启动项里面**，从而开机自动挂载😅：

![[2024-12-24-09.24.11.png|600]]

- 你的家族有精神病史吗？
- 我有个叔叔买了MacBook。

# 附录 2：脚本

## `/usr/local/bin/samba-user.sh`

```bash
#!/bin/bash
set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <username>"
    exit 1
fi

USERNAME=$1
INITIAL_PASSWORD=$(openssl rand -base64 12)

if [[ ! "$USERNAME" =~ ^[a-zA-Z0-9_]+$ || $USERNAME == "public" ]]; then
    echo "Invalid username. Only alphanumeric characters and underscores (exclude 'public') are allowed."
    exit 1
fi

echo "Validating username: $USERNAME - OK"

if id "$USERNAME" &>/dev/null; then
    echo "User $USERNAME already exists, skipping creation."
else
    echo "User $USERNAME does not exist - Proceeding to create user."
    useradd -M "$USERNAME"
    echo "$USERNAME:$INITIAL_PASSWORD" | chpasswd
fi

create_logical_volumes() {
    local VG_NAME=$1
    local MOUNT_POINT=$2

    LV_NAME=$USERNAME
    LV_PATH=/dev/$VG_NAME/$LV_NAME

    POOLNAME=$VG_NAME/pool

    if [ -e "/dev/mapper/$VG_NAME-$LV_NAME" ]; then
        echo "Logical volume $LV_NAME already exists, skipping creation."
        return
    fi

    lvcreate -V 20T -T $POOLNAME -n $LV_NAME
    mkfs.ext4 $LV_PATH
    mkdir -p "$MOUNT_POINT" && mount $LV_PATH "$MOUNT_POINT"
    echo "$MOUNT_POINT initialized."
}

SAMBA_DIR=/samba
USER_DIR=$SAMBA_DIR/$USERNAME
RESOURCE_DIR=$USER_DIR/resource

create_logical_volumes "data" "$USER_DIR"
create_logical_volumes "resource" "$RESOURCE_DIR"


if [ ! -e $USER_DIR/public ]; then
    ln -s /samba/public $USER_DIR/public
fi

echo "Setting ownership and permissions for $USER_DIR..."
chown -R "$USERNAME:$USERNAME" "$USER_DIR"
chmod -R 700 "$USER_DIR"

echo "Creating Samba configuration..."

SMB_DIR=/etc/samba
SMB_CONF_DIR=$SMB_DIR/conf.d
USER_CONF=$SMB_CONF_DIR/${USERNAME}.conf

if [ -f $USER_CONF ]; then
    echo "Samba configuration for $USERNAME already exists. Skipping."
else
    (echo "$INITIAL_PASSWORD"; echo "$INITIAL_PASSWORD") | smbpasswd -a "$USERNAME"
    echo "Initial Password: $INITIAL_PASSWORD" > $USER_DIR/hello.txt
    cat $USER_DIR/hello.txt

    cat <<EOL > $USER_CONF
[$USERNAME]
path = $USER_DIR
available = yes
browseable = yes
writable = yes
valid users = $USERNAME
EOL

    INCLUDES_CONF=$SMB_DIR/includes.conf
    echo "Updating $INCLUDES_CONF to include user configuration..."
    ls $SMB_CONF_DIR/* | sed -e 's/^/include = /' > $INCLUDES_CONF

    SMB_CONF=$SMB_DIR/smb.conf
    testparm $SMB_CONF
    systemctl restart smbd

    echo "Samba configuration for $USERNAME created successfully."
fi

echo "User $USERNAME created successfully."
```

- 请根据实际情况替换 `SAMBA_DIR` 对应的路径；

> [!解释（by Deepseek）]-
> 1. **脚本初始化和参数检查**：
>     - `set -e`：设置脚本在遇到错误时立即退出。
>     - 检查是否提供了用户名参数 `$1`，如果没有，输出使用说明并退出。
> 2. **用户名验证**：
>     - 检查用户名是否只包含字母、数字和下划线，并且不能是 `public`。如果不符合要求，输出错误信息并退出。
> 3. **用户创建**：
>     - 生成一个随机的初始密码。
>     - 检查用户是否已存在，如果存在则跳过创建，否则创建用户并设置初始密码。
> 4. **创建逻辑卷**：
>     - 定义一个函数 `create_logical_volumes`，用于创建逻辑卷并挂载到指定目录。
>     - 检查逻辑卷是否已存在，如果不存在则创建并挂载。
> 5. **配置用户目录**：
>     - 创建用户的主目录和资源目录，并调用 `create_logical_volumes` 函数为其创建逻辑卷。
>     - 创建一个符号链接，将 `/samba/public` 链接到用户目录下的 `public`。
> 6. **设置权限**：
>     - 设置用户目录的所有者和权限。
> 7. **配置Samba共享**：
>     - 检查Samba配置文件是否已存在，如果不存在则创建。
>     - 使用 `smbpasswd` 为新用户设置Samba密码。
>     - 生成Samba配置文件，并更新Samba的主配置文件以包含用户配置。
>     - 重启Samba服务以应用配置。
> 8. **完成提示**：
>     - 输出用户创建成功的提示信息。

## `/usr/local/bin/sync-fstab.sh`

```python
#!/usr/bin/env python3
import argparse
import os
import re
import shutil
import subprocess as sp
from pathlib import Path

BLKID_RE = re.compile(r'(/dev/mapper/\S+):\s+UUID="([^"]+)"')
FSTAB_PATH = Path('/etc/fstab')


def check_root():
    if os.geteuid() != 0:
        print("This script must be run as root")
        exit(1)


def get_disk_to_mount_mapping():
    # 执行df命令获取磁盘挂载信息
    df_output = sp.check_output(["df", "--output=source,target"], text=True)

    # 过滤/dev/mapper设备并创建映射
    disk_to_mount = {}
    for line in df_output.splitlines():
        if "/dev/mapper" in line:
            source, target = line.strip().split()
            disk_to_mount[source] = target

    return disk_to_mount


def get_disk_to_uuid_mapping():
    # 执行blkid命令获取UUID信息
    blkid_output = sp.check_output(["blkid", "-s", "UUID"], text=True)

    # 解析blkid输出并创建映射
    disk_to_uuid = {}
    for line in blkid_output.splitlines():
        if "/dev/mapper" in line:
            # 使用正则表达式提取设备路径和UUID
            match = re.match(BLKID_RE, line)
            if match:
                device, uuid = match.groups()
                disk_to_uuid[device] = uuid

    return disk_to_uuid


def read_fstab():
    """读取fstab文件并删除标记的行"""
    lines = FSTAB_PATH.read_text().splitlines()
    cleaned_lines = []

    i = 0
    while i < len(lines):
        line = lines[i]
        if line.strip().startswith("#sync"):
            i += 2  # 跳过注释行和其下一行
        else:
            cleaned_lines.append(line)
            i += 1

    return "\n".join(cleaned_lines)


def sync_fstab(disk_to_mount, disk_to_uuid):
    """生成新的fstab条目"""
    entries = []
    for disk, mount in disk_to_mount.items():
        if disk in disk_to_uuid:
            uuid = disk_to_uuid[disk]
            entries.extend(
                (
                    "#sync - auto generated for {}\n".format(disk),
                    "UUID={} {} ext4 defaults 0 0\n".format(uuid, mount),
                )
            )
    return "".join(entries)


def write_fstab(content):
    """写入新的fstab内容"""
    shutil.copy(FSTAB_PATH, FSTAB_PATH.with_suffix(".backup"))
    FSTAB_PATH.write_text("".join(content))


def recover_fstab():
    """从备份文件恢复fstab"""
    backup_path = FSTAB_PATH.with_suffix(".backup")
    if not backup_path.exists():
        print("No backup file found")
        exit(1)
    shutil.copy(backup_path, FSTAB_PATH)
    print("Recovered fstab from backup successfully")


def main():
    check_root()
    parser = argparse.ArgumentParser(description="Sync or clear fstab entries")
    parser.add_argument(
        "-c",
        "--clear",
        action="store_true",
        help="Only clear sync entries without generating new ones",
    )
    parser.add_argument(
        "-r",
        "--recover",
        action="store_true",
        help="Recover fstab from backup file",
    )
    args = parser.parse_args()

    if args.recover:
        recover_fstab()
        return

    content = read_fstab()

    if not args.clear:
        disk_to_mount = get_disk_to_mount_mapping()
        disk_to_uuid = get_disk_to_uuid_mapping()
        sync_content = sync_fstab(disk_to_mount, disk_to_uuid)
        content += f"\n{sync_content}"
        print("Updated /etc/fstab successfully")

    write_fstab(fstab)
    print("Backup saved as /etc/fstab.backup")


if __name__ == "__main__":
    main()
```

## `/samba/.backup/backup.sh`

```bash
#!/bin/bash

SMB_DIR=/samba
BACKUP_DIR=$SMB_DIR/.backup

rsync -av \
	--exclude '.*' \
	--exclude 'public' \
	--exclude '*/resource' \
	$SMB_DIR $BACKUP_DIR
```

- 请根据实际情况替换 `SMB_DIR` 和 `BACKUP_DIR` 的值；


# 附录 3：如何删除逻辑磁盘

首先卸载位于 `/dev/mapper` 的磁盘：

```bash
umount /dev/mapper/<VG_NAME>-<LV_NAME>

# 比如 resource/public对应的路径为 /dev/mapper/resource-public
```

若执行后报错“设备忙”等，说明有进程在使用该磁盘挂载点中包含的文件，可以通过 `lsof` 找出这些进程并合适的解决掉它们：

```bash
lsof +D <MOUNT_POINT>
```

然后即可删除逻辑磁盘：

```bash
lvremove <VG_NAME>/<LV_NAME> -y
```

如有必要，删除该逻辑磁盘的挂载点（不删除的话则该挂载点中的数据将默认迁移到其父目录所用磁盘中）：

```bash
rm -rf <MOUNT_POINT>
```

## 附录 4：出现错误： `Activation of logical volume is prohibited`

重启 NAS 后发现有逻辑磁盘没有挂载，运行如下命令检查挂载情况：

```sh
lvscan

# INACTIVE '/dev/<VG_NAME>/pool'
# ...
```

发现这些磁盘当前的状态是 `inactive`。

尝试将这些磁盘的状态变更为 ` active `，遇到如下报错：

```bash
sudo vgchange -ay data

# Activation of logical volume data/pool is prohibited while logical volume data/pool_tmeta is active.
# ...
```

参考 [PVE论坛](https://forum.proxmox.com/threads/local-lvm-not-available-after-kernel-update-on-pve-7.97406/post-430860)，可能是由于 `thin_check` 占用时间太长导致的（不是很懂什么意思🤣），解决方法为：

将 thin pool 的 `tmeta` 和 `tdata` 禁用：

```bash
lvchange -an <VG_NAME>/<TP_NAME>_tmeta
lvchange -an <VG_NAME>/<TP_NAME>_tdata
```

随后重新激活相应的 VG：

```bash
lvchange -ay <VG_NAME>
```

最后重新挂载磁盘：

```bash
mount -a
```

# 参考文档

- [RedHat文档](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/6/html/logical_volume_manager_administration/thinly_provisioned_volume_creation)

# 相关文章

