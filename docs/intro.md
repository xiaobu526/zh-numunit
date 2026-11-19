# 项目简介（中英双语）

按用途分四档，可直接复制。仓库地址：`github.com/xiaobu526/zh-numunit`。

---

## 一、GitHub About（一句话，仓库右侧简介栏）

**中文**
> 按国标检查中文文档里的数字与单位：阿拉伯还是汉字、单位符号大小写、百分点与百分比。11 条规则，一半可自动修。

**English**
> A rule-based linter for Chinese numbers and units. Number form, unit case, percentage points — 11 rules per GB/T 15835-2011.

---

## 二、短介绍（约 80 字 / 50 words）

**中文**
> 中文写作里最隐蔽的错误不在措辞，而在数字。`1.2 万` 和 `12000` 混用、`增长了 3 倍`、`5%个百分点`——读者未必发现，但严谨性已经打折。zh-numunit 把 GB/T 15835 的规则翻译成 11 条可执行检查，机械问题自动修，语义问题留给你判断。

**English**
> Most Chinese writing errors aren't in the wording — they're in the numbers. Mixed `1.2万` and `12000`, `增长了 3 倍`, `5%个百分点`. Readers may not notice, but credibility drops. zh-numunit turns GB/T 15835 into 11 executable rules: auto-fix what's mechanical, leave the judgment calls to you.

---

## 三、完整介绍（约 200 字 / 120 words）

**中文**
> 已有的中文写作工具都在管排版——中英文之间加不加空格、全角还是半角。但真正影响专业度的问题在另一层：这个数字该用阿拉伯数字还是汉字数字？`kW` 写成 `KW` 算不算错？`Mbps` 和 `MBps` 差多少？比率提高了 5% 还是 5 个百分点？
>
> zh-numunit 依据 GB/T 15835-2011《出版物上数字用法》和 GB 3100《量和单位》，把国家标准翻译成 11 条可执行规则，覆盖数字形式、单位符号、数量级、百分点与倍数。每条报告都带国标条款号，可自动修复的问题一次修完，需要判断的（千分位选哪种写法、倍数如何改写）只标位置不擅自改。零依赖，可用作命令行工具或 CI 卡口。

**English**
> Existing Chinese writing tools focus on typography — spacing between CJK and Latin, full-width vs half-width punctuation. But the problems that actually hurt credibility sit one layer down: should this number be Arabic or Chinese numerals? Is `KW` wrong for `kW`? How far apart are `Mbps` and `MBps`? Did the ratio rise by 5% or 5 percentage points?
>
> zh-numunit encodes GB/T 15835-2011 and GB 3100 into 11 executable rules covering number form, unit symbols, magnitude, percentage points, and multipliers. Every finding cites its standard clause. Mechanical issues are fixed in one pass; judgment calls are flagged, never silently rewritten. Zero dependencies. Works as a CLI or a CI gate.

---

## 四、社交平台文案

**中文（微博 / 即刻 / 小红书）**
> 写周报的时候被同事指出「提高了 5%」应该是「提高了 5 个百分点」，才发现这类错误到处都是。
>
> 做了个小工具 `zh-numunit`：按国标检查中文文档里的数字和单位。11 条规则，全角数字、单位大小写、百分点混淆、范围用连字符这些能自动修，千分位和倍数这种需要判断的只提示不擅自改。
>
> 零依赖，一行命令跑起来。和 pangu 那类排版工具是互补的——它们管空格，这个管数字的含义。

**English（X / Twitter）**
> Built a linter for Chinese numbers and units.
>
> `5000KW` → `5000 kW`. `5%个百分点` → `5 个百分点`. `增长了3倍` → flagged, because it's ambiguous.
>
> 11 rules from GB/T 15835-2011. Zero deps. Complementary to pangu — that handles spacing, this handles meaning.

---

## 五、一句话记忆点

- 中文：**pangu 管空格，zh-numunit 管数字的含义。**
- English: **pangu handles spacing. zh-numunit handles what the numbers mean.**
