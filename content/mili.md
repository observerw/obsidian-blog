---
title: 
aliases: 
tags: 
draft: true
---

# Ga1ahad and Scientific Witchery

巅峰之作，当之无愧的 top 1；

小提琴简直是完美的，夺命的，尖锐的锋芒抵着你的喉咙。

网上的 reaction 提到了很有价值的一点就是整个曲子遵循多利亚调式，因此营造出一种中世纪的氛围；但同时

![[Pasted image 20250204205913.png|300]]

这段写的基本都是数电相关的知识：

>  Truth or false, it's the logic that dictates it all  

Truth or false 在这里指的自然不是事情的真相与否，而是布尔逻辑中的真值和假值。在数字电路中，只有冰冷的逻辑运算主宰着一切（如果我们忽略外部环境因素对电路造成的影响的话）。

> Rising edge ticks the clock, stimulates your flip flop  

在**时序电路**中电路的状态根据**时钟**进行驱动，**触发器**通常在时钟的**上升沿**（也即 rising edge）被触发，比如在 Verilog 中，一个最常见的 D 触发器可以表示为：

```verilog
module d_flip_flop (
    input wire clk,
    input wire rst,
    input wire d,
    output reg q
);

    always @(posedge clk or posedge rst) begin
        if (rst) begin
            q <= 1'b0;
        end else begin
            q <= d;
        end
    end

endmodule
```

其中的 `always @(postedge clk)` 即代表着在检测到时钟上升沿时触发逻辑。

> Generate, oscillate, let your blood fill the gates  

谈到了 oscillate，这是我们在上面提到的时序电路所依靠的时钟的来源。时钟信号通常来自于**时钟发生器**，这种器件将会（尽可能地）稳定持续的发出高低电平交错的电信号，从而可以被用来当作时钟。这种器件的核心是一个**晶体谐振器**（Crystal oscillator），这种器件通过向一块石英晶体施加适当的电场让该晶体发生稳定的机械振动，从而形成频率稳定的电信号。

> Multiplex, process, registration

出现了三个名词：

Multiplex 代表着**多路复用**，即：从多个输入信号中选择某一个指定信号作为输出。多路复用器通常具有多个输入信号，一个选择信号，一个输出信号；其中选择信号的位宽足够用于编码所有输入信号（如对于 4 个输入信号，需要 2 位选择信号用于编码所有选项）；当选择信号被设置为某一编码时，对应编码位置的输入信号将被输出。

Process 代表处理，没什么特别的含义，指的就是数字电路的信号处理，可能是用来凑数的罢。

Registration 虽然采用的是名词形式，但可能想表达的是 register也即**寄存器**。常见的数码寄存器就是把好几个上面提到过的触发器连接在一起，利用触发器的记忆特性来在时钟拍之间存储数据，也即将数据“寄存”起来。

如果要说一点批评的话，那我认为

# Grown-Up's Paradise

![[Pasted image 20250204020915.png|300]]

TBD

%% - 整体节奏是比较少见的三拍子，间或穿插了四拍子的段落；可以很明显的听出行进过程中的“变速”；
- 2 分 10 秒处，背景和声稍作歇息 %%

# Classroom Dreamer

![[Pasted image 20250204020819.png|300]]

Mili 已经是明星乐队了，都能被拜年祭邀请出场了（❎）Mili 还是家道中落了，只能赶拜年祭这种小场子了（✅）😆



- 总体来说是很成熟的 mili 曲，融合了常用的各类手法；从该曲入手可以见微知著，所以值得分析一下；
- 前奏开始就引人入胜：用一种持续稳定的低频电子噪音形成了一种迷幻的氛围，为全曲赋予了一种“质感”（也即通常歌曲中贝斯所起的作用）；此外也为 Dreamer 的故事首先营造出了基础的梦幻感；在噪音上游动的马林巴琴（还是木琴）的叮叮咚咚的声音，圆润、清澈，呈现出一种“水下”的氛围感；充当了此刻的主旋律线，为故事的展开引入了一丝灵动；不可忽视的还有一小截小提琴旋律线作为陪衬，但采取了 Glitch 的处理（突然截断、短暂机械的重复等），在听感上颇具趣味；
- 主歌部分开始，引入第二种重低音形式的电子噪音，在第一拍上发出重重的敲击，带来了稳定强劲的节奏；伴随而来的还有钟琴发出的如风铃般清脆的声音，更加重型与更加轻型的声音形成了平衡的听感；随后重拍消失（注意此时电子噪音其实仍未消失，从而保留了质感，不至显得空洞），引入了更加紧密流畅的钟琴演奏，同时引入了钟表的滴答声，借此体现出时间正在流逝的感觉，与 PV 内容对应；
- 过渡段开始，重新引回了第一种电子噪音，并且将马林巴换成了嘀嘀嘟嘟的电子音，将曲子重新拉回至舒缓的情绪；此时钟表滴答声仍未停止；
- 副歌前的最后一次情绪推进，引入了“未曾料想”的小提琴旋律线
- 轻轻一推，推入了全曲的高潮部分；听起来很像主歌 1，但引入了一条独立的电子音旋律线，同时配合人声的“Can you make it my reality”，复合形成了更加美妙的氛围；
- 接下来是独门绝活，mili 式高潮部分：以电子音和马林巴作为基底，**momo 情绪高昂的人声**提供了主旋律线，同时自己为自己提供**人声和声**，和声承接了副歌上半部分的旋律，维持了情绪递进的连续性；与**独立的小提琴旋律线**共同织成复调织体，丰富而梦幻，让人由衷的产生“真好听”的想法；
- 副歌结束，其他声部退位，将舞台留给了刚才还未能充分表现的小提琴，人声反而成为了可爱的 TaTa 乐器，以悠扬的旋律作为故事的余韵，将全曲导向结尾；电视关闭时的刺啦声想起，Classroom Dreamer 醒来，听众也随之如梦初醒。

总结而言：

- Momo 的声音是已臻化境的完美乐器，无须再强调其伟大；对人声和声感兴趣的话请尝试 [[#Sacramentum : Unaccompanied Hymn for Torino]]；
- 电子与古典风格的交融向来是 hamo 为这个世界带来的礼物；典型作品有 [[#Sl0t]]，[[Imagined Flight]]，还有无需多言的 [[#Ga1ahad and Scientific Witchery]]
- 在编曲结构上也基本继承了奇迹牛奶时代的遗风，没有采用常见的主副主副重复的结构，而是采用了类似于 [[#Ga1ahad and Scientific Witchery]] 类似的“级进”式结构，没有重复段，每一段都或承接或对比的在上一段的基础上进行发展，形成了丰富的聆听体验。


# 相关文章

