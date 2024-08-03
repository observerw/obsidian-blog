---
title: 
aliases: 
tags: 
draft: true
---
# TLDR

把 CapsLock 键改成多功能键：

| 按键                     | 映射                            |
| ------------------------ | ------------------------------- |
| ⇪CapsLock                | ⎋Escape                         |
| ⇪CapsLock + key          | ⌘Command + key                  |
| ⇪CapsLock + ⇧Shift + key | ⌃Control + key                  |

配置文件：

```json
{
    "description": "Capslock as Command and Escape and Control😆",
    "manipulators": [
        {
            "description": "CapsLock + Left Shift to Left Control",
            "from": {
                "key_code": "caps_lock",
                "modifiers": {
                    "mandatory": [
                        "left_shift"
                    ]
                }
            },
            "to": [
                {
                    "key_code": "left_control"
                }
            ],
            "type": "basic"
        },
        {
            "description": "Capslock as Left Command and Escape",
            "from": {
                "key_code": "caps_lock",
                "modifiers": {
                    "optional": [
                        "any"
                    ]
                }
            },
            "to": [
                {
                    "key_code": "left_command"
                }
            ],
            "to_if_alone": [
                {
                    "key_code": "escape"
                }
            ],
            "type": "basic"
        }
    ]
}
```

辅助功能：

| 按键              | 映射                       |     |
| --------------- | ------------------------ | --- |
| ⌃Control + hjkl | ↑↓←→                     |     |
| ⇧Shift + ␣Space | ⌃Control + ␣Space（切换输入法） |     |

配置文件：

```json
{
    "description": "Left ctrl + hjkl to arrow keys Vim",
    "manipulators": [
        {
            "from": {
                "key_code": "h",
                "modifiers": {
                    "mandatory": [
                        "left_control"
                    ],
                    "optional": [
                        "any"
                    ]
                }
            },
            "to": [
                {
                    "key_code": "left_arrow"
                }
            ],
            "type": "basic"
        },
        {
            "from": {
                "key_code": "j",
                "modifiers": {
                    "mandatory": [
                        "left_control"
                    ],
                    "optional": [
                        "any"
                    ]
                }
            },
            "to": [
                {
                    "key_code": "down_arrow"
                }
            ],
            "type": "basic"
        },
        {
            "from": {
                "key_code": "k",
                "modifiers": {
                    "mandatory": [
                        "left_control"
                    ],
                    "optional": [
                        "any"
                    ]
                }
            },
            "to": [
                {
                    "key_code": "up_arrow"
                }
            ],
            "type": "basic"
        },
        {
            "from": {
                "key_code": "l",
                "modifiers": {
                    "mandatory": [
                        "left_control"
                    ],
                    "optional": [
                        "any"
                    ]
                }
            },
            "to": [
                {
                    "key_code": "right_arrow"
                }
            ],
            "type": "basic"
        }
    ]
}
```

```json
{
    "description": "Change input source with Shift + Space",
    "manipulators": [
        {
            "from": {
                "key_code": "spacebar",
                "modifiers": {
                    "mandatory": [
                        "left_shift"
                    ]
                }
            },
            "to": [
                {
                    "key_code": "spacebar",
                    "modifiers": "left_control"
                }
            ],
            "type": "basic"
        }
    ]
}
```
# 相关文章

