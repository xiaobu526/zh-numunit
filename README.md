# zh-numunit

[![CI](https://github.com/xiaobu526/zh-numunit/actions/workflows/ci.yml/badge.svg)](https://github.com/xiaobu526/zh-numunit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)

> 中文数字与单位规范化 —— 按国家标准检查你的文档
>
> A linter for Chinese numbers and units, following GB/T 15835-2011.

很多中文写作工具在管「中英文之间要不要加空格」，但没人管更要命的事：**这个数字该写阿拉伯还是汉字、单位符号大小写对不对、`1.2 万` 和 `12000` 有没有混用。**

`zh-numunit` 依据 **GB/T 15835-2011《出版物上数字用法》** 和 **GB 3100~3102-1993《量和单位》**，把国家标准的规则翻译成 11 条可执行检查，并区分「能机械修复的」和「必须人来判断的」。

## 30 秒看效果

输入：

```
本季度销售额达到 12000 台，同比增长了 3 倍。
空调销量 １０００ 台，均价 3200-4500 元。
功率 5000KW，存储 20TB，网速 100mb，温度 25摄氏度℃。
市场份额提高了 5%个百分点。
```

运行 `check`：

```
E NUM-001  全角数字                  行 2:10
   全角数字「１０００」应改为半角「1000」

E NUM-005  单位符号大小写错误         行 3:26
   单位符号「KW」大小写错误，应为「kW」（kW = 千瓦）

W NUM-009  倍数误用于增长和下降       行 1:33
   「增长了 3 倍」表述有歧义：增长类不宜用倍数。
   建议改为「增长 300%」，或改写为「达到原来的 4 倍」
```

运行 `fix --write` 后：

```
本季度销售额达到 12000 台，同比增长了 3 倍。
空调销量 1000 台，均价 3200～4500 元。
功率 5000 kW，存储 20 TB，网速 100 Mbps，温度 25℃。
市场份额提高了 5 个百分点。
```

机械问题一次修完，剩下的语义问题（倍数、千分位）留给你判断。

## 安装

需要 Node.js 18+，无第三方依赖。

```bash
npx skills add xiaobu526/zh-numunit -g
```

或直接克隆使用：

```bash
git clone https://github.com/xiaobu526/zh-numunit.git ~/.claude/skills/zh-numunit
```

也可以不装 skill，直接当命令行工具用：

```bash
node scripts/numunit.mjs check report.md
```

## 为什么不直接用 pangu / autocorrect

因为它们解决的是另一个问题。

| | pangu / autocorrect / 排版指北 | zh-numunit |
|---|---|---|
| 层级 | 排版（字符间距、全半角） | 语义（数字形式、单位含义） |
| 例子 | `在LeanCloud上` → `在 LeanCloud 上` | `5000KW` → `5000 kW` |
| 依据 | 社区共识 | 国家标准 |
| 能不能一刀切 | 能，纯机械 | 不能，需要判断 |

`Mbps` 写成 `MBps`，pangu 完全不会报，因为排版没问题——但数值错了 8 倍。这是我们补的洞。

两者应该配合使用：**排版交给 pangu，数字和单位交给 zh-numunit。**

## 11 条规则

| 编号 | 规则 | 级别 | 自动修 |
|---|---|---|---|
| NUM-001 | 全角数字 | 错误 | ✓ |
| NUM-002 | 大数缺千分位 | 警告 | — |
| NUM-003 | 数量级表达混用（`1.2 万` vs `12000`） | 警告 | — |
| NUM-004 | 数值范围应用浪纹线 `～` | 错误 | ✓ |
| NUM-005 | 单位符号大小写错误 | 错误 | ✓ |
| NUM-006 | 数值与符号单位之间缺空格 | 警告 | ✓ |
| NUM-007 | 中文名称与单位符号叠用（`25摄氏度℃`） | 错误 | ✓ |
| NUM-008 | 约数标记重复（`大约 500 人左右`） | 警告 | ✓ |
| NUM-009 | 倍数误用于增长或下降（`增长了 3 倍`） | 警告 | — |
| NUM-010 | 百分点与百分比混淆 | 错误 | ✓ |
| NUM-011 | 年份中的零应写作「〇」 | 警告 | ✓ |

带 ✓ 的可以 `fix --write` 自动修复，脚本会迭代到收敛。不带 ✓ 的需要语义判断，脚本只报告位置。

## 数字互转

```bash
node scripts/numunit.mjs cn2an 一亿二千万        # 120000000
node scripts/numunit.mjs an2cn 1234567          # 一百二十三万四千五百六十七
node scripts/numunit.mjs an2cn 1234567 up       # 壹佰贰拾叁万肆仟伍佰陆拾柒
node scripts/numunit.mjs an2cn 1234.56 rmb      # 壹仟贰佰叁拾肆元伍角陆分
```

## 用作 CI 卡口

有 error 级问题时退出码为 `1`：

```yaml
- name: 检查中文数字规范
  run: node scripts/numunit.mjs check docs/*.md
```

代码块、行内代码、URL、HTML 标签内的内容会被跳过，不会误报。

## 已知边界

- **不做中英文加空格**。已有成熟方案，不重复造轮子。
- **不判断术语对错**，只判断数字与单位的形式。
- **不改数值本身**，只调整写法。
- 型号、编号里的字母数字组合可能被误判为单位，需要人工过一遍。
- `m²` 与 `㎡` 视为等价，不强制统一——这是体例选择，交给你定。

## 依据

- GB/T 15835-2011《出版物上数字用法》
- GB 3100~3102-1993《量和单位》
- 参考：[中文文案排版指北](https://github.com/sparanoid/chinese-copywriting-guidelines)（本 skill 与其互补，不重叠）

## License

MIT
