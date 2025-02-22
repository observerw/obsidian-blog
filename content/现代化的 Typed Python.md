---
title: 
aliases: 
tags: 
draft: true
---

- Type inspect 用法
- Typed Python 生态

# 前言

致所有认为 Python 是动态类型语言就不应该有类型标注的人：我是一个喜欢在 IDE 里面写代码有类型提示和类型检查的现代程序员真是抱歉啊.jpg😅

# 简单的类型标注

在早期的 Python 版本，你需要通过在 `typing` 模块中引入相应的类型才能够进行标注：

```python
from typing import List, Dict

lst: List[int] = [1, 1, 4, 5, 1, 4]
dct: Dict[str, str] = { "1919": "810" }
```

但新版的 Python 已经不需要额外导入了：

```python
lst: list[int] = []
dct: dict[str, int] = {}
```

# 迭代器类型

# 围绕类型标注建立的生态

## 数据类型检查： `Pydantic`



## HTTP 服务器：`fastapi`



## 命令行工具：`Typer` 



# 相关文章

