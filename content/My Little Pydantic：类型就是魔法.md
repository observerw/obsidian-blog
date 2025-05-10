---
title: 
aliases: 
tags: 
draft: true
---

Pydantic 作为 Typed Python 中的明星项目，使用了不少类型相关的黑魔法😅。

# 将魔法据为己有

你可能会说：我已经知道了所谓的类型魔法不过是使用 `__class_getitem__` 而已，我已经迫不及待要手搓轮子了！

但我们内心深处其实都认同不要重复造轮子原则，所以最简单的方法还是等待 Pydantic 创建完 concrete model 后，将 model 中的 `annotation` 字段提取出来：

```python
class TypeWrapper[T](RootModel[T]):
    root: T

    @classmethod
    def type(cls) -> type[T]:
        assert (anno := cls.model_fields["root"].annotation)
        return anno
```

# 有没有更通用的方法？

有的兄弟，有的。让我们来设计一个支持任意层类继承的 TypeVar 解析方法。

首先审视一下上述的 `TypeWrapper` 方法有何问题。假设你创建了一个包含多个 Type Parameters 的基类 `Base`，当衍生类 `Derived` 继承它时，可能只会指定其中的某些参数，而将其他参数留到最终类 `Final` 来指定。

当我们出于某些原因想要在基类逻辑中就获取到最终类逻辑的类型信息时，我们也许很快就会想到这种做法：

```python
class Base[A, B, C](BaseModel, ABC):
	# ❌ 错误的实现，获取不到 type
    a_type: ClassVar[type] = TypeWrapper[A].type()

class Derived[A, C](Base[A, int, C]): ...

@final
class Final(Derived[str, float]): ...

assert Final.a_type is str
```


# 相关文章

