---
title: 
aliases: 
tags: 
draft: true
---

Pydantic 作为 Typed Python 中的明星项目，使用了不少类型相关的黑魔法😅。

# 能不能将魔法据为己有？

可以的兄弟，可以的。

```python
class Model[A, B](BaseModel):
    @classmethod
    def typevars_map(cls):
        return get_model_typevars_map(cls)

    @classmethod
    def a_type(cls) -> type[A]:
        return cls.typevars_map()[A]


assert Model[int, str].a_type() is int
```

然而非常悲伤的是，这种方法并不是完美的，考虑如下场景：

```python
class Model[A, B](BaseModel): ... # 与之前相同

class SubModel[A](Model[A, str]): ...

assert SubModel[int].a_type() is int
```

在子类中，我们

根本原因就是 `get_model_typevars_map` 这一方法只能解析当前类的泛型参数。

让我们直接看一看类定义后的 `typevars_map`：

```python
print(Model[int, str].typevars_map()) 
# {A: <class 'int'>, B: <class 'str'>}

print(SubModel[int].typevars_map())
# {T: <class 'int'>}
```

这种方法也并非毫无用途。对于大多数场景，只需要简单地将 `Model` 类标记为不可继承就完事了：

```python
from typing import final

@final # 使用 final 装饰器阻止继承
class Model[A, B](BaseModel): ...
```

# 那有没有通用的方法？

有的兄弟，有的。让我们来设计一个支持任意层类继承的 TypeVar 解析方法。

```python

```


# 相关文章

