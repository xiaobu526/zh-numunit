#!/usr/bin/env node
/**
 * numunit — 中文数字与单位规范化工具
 * 规则依据：GB/T 15835-2011《出版物上数字用法》、GB 3100~3102《量和单位》
 *
 * 用法：
 *   node numunit.mjs check <file...>        检查并报告
 *   node numunit.mjs fix <file...> --write  自动修复可修项
 *   node numunit.mjs cn2an "一百二十三"      中文数字 → 阿拉伯
 *   node numunit.mjs an2cn 12345 [low|up|rmb] 阿拉伯 → 中文数字
 *   node numunit.mjs --text "文本"           直接检查一段文本
 */
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ───────────────────────────── 基础表 ─────────────────────────────

const CN_DIGIT = {
  零: 0, 〇: 0, 一: 1, 壹: 1, 二: 2, 贰: 2, 两: 2, 三: 3, 叁: 3,
  四: 4, 肆: 4, 五: 5, 伍: 5, 六: 6, 陆: 6, 七: 7, 柒: 7,
  八: 8, 捌: 8, 九: 9, 玖: 9,
};
const CN_SMALL_UNIT = { 十: 10, 拾: 10, 百: 100, 佰: 100, 千: 1000, 仟: 1000 };
const CN_BIG_UNIT = { 万: 1e4, 亿: 1e8, 兆: 1e12 };

const NUM_LOW = '零一二三四五六七八九';
const NUM_UP = '零壹贰叁肆伍陆柒捌玖';
const UNIT_LOW = ['', '十', '百', '千'];
const UNIT_UP = ['', '拾', '佰', '仟'];
const SEC_LOW = ['', '万', '亿', '万亿'];
const SEC_UP = ['', '万', '亿', '万亿'];

// 单位符号大小写纠正表：错误写法 → 正确写法
const UNIT_CASE_FIX = new Map(Object.entries({
  KW: 'kW', kw: 'kW', Kw: 'kW', kwatt: 'kW',
  KWH: 'kWh', kwh: 'kWh', Kwh: 'kWh', KWHr: 'kWh',
  HZ: 'Hz', hz: 'Hz', KHZ: 'kHz', khz: 'kHz', MHZ: 'MHz', mhz: 'MHz', GHZ: 'GHz', ghz: 'GHz',
  KM: 'km', Km: 'km', KMH: 'km/h', 'KM/H': 'km/h', kmh: 'km/h', 'Mp/h': 'km/h',
  KG: 'kg', Kg: 'kg', KGm: 'kg',
  MA: 'mA', Ma: 'mA', MV: 'mV', Mv: 'mV', KV: 'kV', Kv: 'kV',
  mb: 'MB', Mb: 'MB', gb: 'GB', Gb: 'GB', tb: 'TB', Tb: 'TB', kb: 'KB', Kb: 'KB',
  MBPS: 'Mbps', mbps: 'Mbps', MBps: 'Mbps', Gbps: 'Gbps', GBPS: 'Gbps', Gpbs: 'Gbps',
  Kbps: 'kbps', KBPS: 'kbps',
  M2: 'm²', m2: 'm²', M3: 'm³', m3: 'm³', CM2: 'cm²', cm2: 'cm²',
  KPA: 'kPa', kpa: 'kPa', MPA: 'MPa', mpa: 'MPa', PA: 'Pa',
  Nm: 'N·m', 'N.M': 'N·m',
  L: 'L', ML: 'mL', ml: 'mL', MLT: 'mL',
  DPI: 'dpi', PPI: 'ppi',
}));

// 符号型单位（与数字之间应有空格）
const SYMBOL_UNITS = new Set([
  'kW', 'kWh', 'W', 'Hz', 'kHz', 'MHz', 'GHz', 'km', 'm', 'cm', 'mm', 'kg', 'g', 't',
  'mA', 'A', 'mV', 'V', 'kV', 'Ω', 'kΩ', 'MΩ', 'MB', 'GB', 'TB', 'KB', 'B', 'Mbps',
  'Gbps', 'kbps', 'mL', 'L', 'Pa', 'kPa', 'MPa', 'N·m', 'm²', 'cm²', 'm³', 'nm',
  'rpm', 'dpi', 'ppi', 'km/h', 'min', 'ms', 's', 'h',
]);

// 中文单位（与数字之间不加空格）
const ZH_UNITS = new Set([
  '元', '万元', '亿元', '台', '万台', '套', '个', '只', '件', '辆', '台次',
  '人', '人次', '户', '家', '条', '张', '份', '次', '天', '年', '月', '日',
  '小时', '分钟', '秒', '倍', '度', '吨', '平方米', '立方米', '公里', '米', '公里每小时',
  '倍', '个百分点', '层', '层楼', '间', '亩', '公顷',
]);

// 不需要在数字与单位之间加空格的符号
const NO_SPACE_SYMBOLS = new Set(['%', '‰', '°', '℃', '°C']);

// 排版层判断中需要排除的上下文词
const NUM_CN_FALSE_POSITIVE = /^(年|月|日|号|页|章|节|条|款|项|届|版|期|次方|维|G|K|D|P|nm|G网络)$/;

// ───────────────────────── 中文数字 ↔ 阿拉伯 ─────────────────────────

export function cn2an(input) {
  let s = String(input).trim().replace(/[,，\s]/g, '');
  let neg = false;
  if (s.startsWith('负')) { neg = true; s = s.slice(1); }
  if (!s) throw new Error('空字符串');

  const [intRaw, decRaw] = s.split('点');

  // 无单位符的纯数字串按逐位拼接：年份「二〇二六」→ 2026，编号「一二三」→ 123
  if (intRaw.length > 1 && !/[十拾百佰千仟万亿兆]/.test(intRaw)) {
    const digits = [...intRaw].map((c) => {
      const d = CN_DIGIT[c];
      if (d === undefined) throw new Error(`无法识别的字符：${c}`);
      return d;
    });
    let out = Number(digits.join(''));
    if (decRaw !== undefined) {
      const dd = [...decRaw].map((c) => {
        const d = CN_DIGIT[c];
        if (d === undefined) throw new Error(`无法识别的小数位：${c}`);
        return d;
      }).join('');
      out = parseFloat(`${out}.${dd}`);
    }
    return neg ? -out : out;
  }

  let total = 0, section = 0, number = 0;

  for (const ch of intRaw) {
    if (ch in CN_DIGIT) {
      number = CN_DIGIT[ch];
    } else if (ch in CN_SMALL_UNIT) {
      if (number === 0) number = 1;
      section += number * CN_SMALL_UNIT[ch];
      number = 0;
    } else if (ch in CN_BIG_UNIT) {
      section = (section + number) * CN_BIG_UNIT[ch];
      total += section;
      section = 0;
      number = 0;
    } else if (ch === '零' || ch === '〇') {
      number = 0;
    } else {
      throw new Error(`无法识别的字符：${ch}`);
    }
  }
  total += section + number;

  let out = total;
  if (decRaw !== undefined) {
    const digits = [...decRaw].map((c) => {
      const d = CN_DIGIT[c];
      if (d === undefined) throw new Error(`无法识别的小数位：${c}`);
      return d;
    });
    out = parseFloat(String(total) + '.' + digits.join(''));
  }
  return neg ? -out : out;
}

function fourToCn(n, up) {
  const D = up ? NUM_UP : NUM_LOW;
  const U = up ? UNIT_UP : UNIT_LOW;
  const d = String(n).padStart(4, '0');
  let s = '', pendingZero = false;
  for (let i = 0; i < 4; i++) {
    const digit = Number(d[i]);
    if (digit === 0) { pendingZero = true; continue; }
    if (pendingZero && s) s += D[0];
    pendingZero = false;
    s += D[digit] + U[3 - i];
  }
  return s;
}

export function an2cn(input, mode = 'low') {
  const num = typeof input === 'number' ? input : parseFloat(String(input).replace(/,/g, ''));
  if (!isFinite(num)) throw new Error('非数字');
  const up = mode === 'up' || mode === 'rmb';
  const D = up ? NUM_UP : NUM_LOW;

  let neg = num < 0;
  let abs = Math.abs(num);
  const intPart = Math.floor(abs);
  const decPart = abs - intPart;

  let intStr;
  if (intPart === 0) {
    intStr = D[0];
  } else {
    const groups = [];
    let x = intPart;
    while (x > 0) { groups.push(x % 10000); x = Math.floor(x / 10000); }
    const SEC = up ? SEC_UP : SEC_LOW;
    let out = '';
    for (let i = groups.length - 1; i >= 0; i--) {
      const g = groups[i];
      if (g === 0) {
        if (out && !out.endsWith(D[0]) && groups.slice(0, i).some((v) => v > 0)) out += D[0];
        continue;
      }
      if (out && g < 1000 && !out.endsWith(D[0])) out += D[0];
      out += fourToCn(g, up) + SEC[i];
    }
    intStr = out;
    if (!up) intStr = intStr.replace(/^一十/, '十');
  }

  if (mode === 'rmb') {
    const jiao = Math.floor((decPart * 100 + 1e-6) / 10) % 10;
    const fen = Math.round(decPart * 100 + 1e-6) % 10;
    let s = intStr === NUM_UP[0] && decPart > 0 ? '' : intStr + '元';
    if (jiao === 0 && fen === 0) return (neg ? '负' : '') + (s || '零元') + '整';
    if (jiao > 0) s += NUM_UP[jiao] + '角';
    else if (fen > 0 && s) s += '零';
    if (fen > 0) s += NUM_UP[fen] + '分';
    return (neg ? '负' : '') + s;
  }

  if (decPart > 0 || String(abs).includes('.')) {
    const decStr = String(abs.toFixed(10)).split('.')[1].replace(/0+$/, '');
    if (decStr) {
      return (neg ? '负' : '') + intStr + '点' + decStr.split('').map((c) => D[Number(c)]).join('');
    }
  }
  return (neg ? '负' : '') + intStr;
}

// ───────────────────────────── 预处理 ─────────────────────────────

function maskProtected(text) {
  const keep = (m) => m.replace(/[^\n]/g, ' ');
  return text
    .replace(/```[\s\S]*?```/g, keep)
    .replace(/~~~[\s\S]*?~~~/g, keep)
    .replace(/`[^`\n]*`/g, keep)
    .replace(/https?:\/\/[^\s)>\]"'，。；]+/g, keep)
    .replace(/\$\$[\s\S]*?\$\$/g, keep)
    .replace(/<[a-zA-Z/][^>\n]*>/g, keep);
}

function lineIndex(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  return (idx) => {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= idx) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  };
}

function excerpt(text, start, end) {
  const a = Math.max(0, start - 12), b = Math.min(text.length, end + 12);
  return text.slice(a, b).replace(/\n/g, '⏎');
}

// ───────────────────────────── 规则集 ─────────────────────────────

const RULES = [
  {
    id: 'NUM-001',
    level: 'error',
    title: '全角数字',
    basis: 'GB/T 15835-2011 4.1.1；数字应使用半角字符',
    fixable: true,
    scan: (m) => {
      const out = [];
      const re = /[０-９]+/g;
      let x;
      while ((x = re.exec(m))) {
        const fixed = x[0].replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
        out.push({ start: x.index, end: x.index + x[0].length, text: x[0], replacement: fixed, msg: `全角数字「${x[0]}」应改为半角「${fixed}」` });
      }
      return out;
    },
  },
  {
    id: 'NUM-002',
    level: 'warning',
    title: '大数缺千分位',
    basis: 'GB/T 15835-2011 3.2；5 位以上数值宜用千分位分节',
    fixable: false,
    scan: (m) => {
      const out = [];
      const re = /(?<![\d.,第\-/年])(\d{5,})(?![\d.年月日章号页届条号％%])/g;
      let x;
      while ((x = re.exec(m))) {
        const n = Number(x[1]);
        if (n >= 20200 && n <= 21000 && x[1].length === 5) continue;
        const formatted = Number(x[1]).toLocaleString('en-US');
        out.push({ start: x.index, end: x.index + x[1].length, text: x[1], replacement: formatted, msg: `「${x[1]}」位数较多，建议写作 ${formatted}（或改用「${(Number(x[1]) / 10000).toFixed(1)} 万」统一量级）` });
      }
      return out;
    },
  },
  {
    id: 'NUM-003',
    level: 'warning',
    title: '数量级表达混用',
    basis: 'GB/T 15835-2011 前言：局部体例一致原则',
    fixable: false,
    scan: (m, full) => {
      const withWan = [...m.matchAll(/\d+(?:\.\d+)?\s*(万|亿)/g)].map((x) => x.index);
      const plainBig = [...m.matchAll(/(?<![\d.,])\d{5,}(?![\d.])/g)].map((x) => x.index);
      if (withWan.length && plainBig.length) {
        const idx = plainBig[0];
        return [{
          start: idx, end: idx + 5, text: m.slice(idx, idx + 5), replacement: null,
          msg: `同一文档内既有「万/亿」量级写法（${withWan.length} 处），又有原始大数（${plainBig.length} 处）。建议全文统一为一种量级表达`,
        }];
      }
      return [];
    },
  },
  {
    id: 'NUM-004',
    level: 'error',
    title: '数值范围应使用浪纹线',
    basis: 'GB/T 15835-2011 5.1.4；数值范围用「～」或「—」',
    fixable: true,
    scan: (m) => {
      const out = [];
      const re = /(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/g;
      let x;
      while ((x = re.exec(m))) {
        const before = m.slice(Math.max(0, x.index - 1), x.index);
        const after = m.slice(x.index + x[0].length, x.index + x[0].length + 2);
        if (/[\d]/.test(before)) continue;
        if (/^[月日]|-/.test(after)) continue;
        if (/^[-]\d/.test(after)) continue;
        if (!/[\u4e00-\u9fa5]/.test(before + after)) continue;
        out.push({
          start: x.index, end: x.index + x[0].length, text: x[0],
          replacement: `${x[1]}～${x[2]}`,
          msg: `数值范围「${x[0]}」应使用浪纹线「～」（如 ${x[1]}～${x[2]}），连字符易与减号混淆`,
        });
      }
      return out;
    },
  },
  {
    id: 'NUM-005',
    level: 'error',
    title: '单位符号大小写错误',
    basis: 'GB 3100-1993；单位符号的大小写是强制性的（1 Mb ≠ 1 MB）',
    fixable: true,
    scan: (m) => {
      const out = [];
      const re = /(\d[\d.,]*)\s*([A-Za-zΩμ][A-Za-zΩμ/·²³]{0,5})(?![A-Za-z])/g;
      let x;
      while ((x = re.exec(m))) {
        const raw = x[2];
        const ctx = m.slice(Math.max(0, x.index - 12), x.index + 12);
        let fixed = UNIT_CASE_FIX.get(raw);
        if (!fixed || fixed === raw) continue;

        if (raw === 'mb' && /(网速|带宽|速率|下载|上传|宽带)/.test(ctx)) fixed = 'Mbps';

        out.push({
          start: x.index + x[1].length, end: x.index + x[1].length + raw.length,
          text: raw, replacement: fixed,
          msg: `单位符号「${raw}」大小写错误，应为「${fixed}」（${explainUnit(fixed)}）`,
        });
      }
      return out;
    },
  },
  {
    id: 'NUM-006',
    level: 'warning',
    title: '数字与符号单位之间缺空格',
    basis: 'GB 3100-1993 6.1；数值与单位符号之间应留空隙',
    fixable: true,
    scan: (m) => {
      const out = [];
      const re = /(\d[\d.,]*)(\s*)([A-Za-zΩμ][A-Za-zΩμ/·²³]{0,5})(?![A-Za-z])/g;
      let x;
      while ((x = re.exec(m))) {
        const unit = x[3];
        if (x[2]) continue;
        if (NO_SPACE_SYMBOLS.has(unit)) continue;
        if (!SYMBOL_UNITS.has(unit)) continue;
        const idx = x.index + x[1].length;
        out.push({
          start: idx, end: idx + unit.length, text: unit, replacement: ' ' + unit,
          msg: `符号单位「${unit}」与数值之间应加一个半角空格（${x[1]} ${unit}）`,
        });
      }
      return out;
    },
  },
  {
    id: 'NUM-007',
    level: 'error',
    title: '单位重复使用',
    basis: 'GB 3100-1993；同一量的中文名称与符号不宜叠用',
    fixable: true,
    scan: (m) => {
      const out = [];
      const pairs = [
        [/摄氏度\s*(℃|°C)/g, '℃'], [/平方米\s*(㎡|m²)/g, '㎡'],
        [/立方米\s*(m³)/g, 'm³'], [/千瓦时\s*(kWh)/g, 'kWh'],
        [/(℃|°C)\s*摄氏度/g, '℃'], [/(㎡|m²)\s*平方米/g, '㎡'],
      ];
      for (const [re, rep] of pairs) {
        let x;
        while ((x = re.exec(m))) {
          out.push({
            start: x.index, end: x.index + x[0].length, text: x[0], replacement: rep,
            msg: `「${x[0]}」单位重复（中文名称与符号叠用），保留其一即可，推荐「${rep}」`,
          });
        }
      }
      return out;
    },
  },
  {
    id: 'NUM-008',
    level: 'warning',
    title: '约数表达冗余',
    basis: '现代汉语规范；约数只能标记一次',
    fixable: true,
    scan: (m) => {
      const out = [];
      const re = /(大约|约|大概|近|将近|差不多)([^\n。；，]{0,14}?)(左右|上下|前后|余|来)/g;
      let x;
      while ((x = re.exec(m))) {
        if (/^(左右|上下|前后)/.test(x[3]) === false) continue;
        out.push({
          start: x.index, end: x.index + x[0].length, text: x[0], replacement: x[1] + x[2],
          msg: `「${x[0]}」约数标记重复，去掉「${x[3]}」即可（${x[1]}${x[2]}）`,
        });
      }
      return out;
    },
  },
  {
    id: 'NUM-009',
    level: 'warning',
    title: '倍数误用于增长和下降',
    basis: '科技文献规范；增长/下降用百分比，倍数仅用于「是…的 N 倍」',
    fixable: false,
    scan: (m) => {
      const out = [];
      const re = /(增长|增加|提高|上升|扩大|下降|减少|降低|缩小)了?\s*(\d+(?:\.\d+)?)\s*倍/g;
      let x;
      while ((x = re.exec(m))) {
        out.push({
          start: x.index, end: x.index + x[0].length, text: x[0], replacement: null,
          msg: `「${x[0]}」表述有歧义：增长类不宜用倍数。建议改为「增长 ${(Number(x[2]) * 100).toFixed(0)}%」，或改写为「达到原来的 ${Number(x[2]) + 1} 倍」`,
        });
      }
      return out;
    },
  },
  {
    id: 'NUM-010',
    level: 'error',
    title: '百分点与百分比混淆',
    basis: '统计规范；比率的变化量用「百分点」，不用「%」',
    fixable: true,
    scan: (m) => {
      const out = [];
      const re = /(\d+(?:\.\d+)?)\s*%\s*(个百分点|个点|百分点)/g;
      let x;
      while ((x = re.exec(m))) {
        const rep = `${x[1]} 个百分点`;
        out.push({
          start: x.index, end: x.index + x[0].length, text: x[0], replacement: rep,
          msg: `「${x[0]}」重复标记：百分率变化量直接写「${rep}」，不要再加 %`,
        });
      }
      return out;
    },
  },
  {
    id: 'NUM-011',
    level: 'warning',
    title: '中文年份用字不规范',
    basis: 'GB/T 15835-2011 5.2.2；年份汉字数字须逐位标注，零写作「〇」',
    fixable: true,
    scan: (m) => {
      const out = [];
      const re = /([一二三四五六七八九零〇]{4})年/g;
      let x;
      while ((x = re.exec(m))) {
        if (!/[零〇]/.test(x[1])) continue;
        if (!/^[一二三四五六七八九零〇]{4}$/.test(x[1])) continue;
        const fixed = x[1].replace(/零/g, '〇');
        if (fixed === x[1]) continue;
        out.push({
          start: x.index, end: x.index + x[0].length, text: x[0], replacement: fixed + '年',
          msg: `年份「${x[0]}」应为「${fixed}年」（年份中的零写作「〇」）`,
        });
      }
      return out;
    },
  },
];

function explainUnit(u) {
  const map = {
    kW: '千瓦', kWh: '千瓦时', Hz: '赫兹', km: '千米', kg: '千克',
    MB: '兆字节', GB: '吉字节', Mbps: '兆比特每秒', mA: '毫安', V: '伏特',
    Pa: '帕斯卡', mL: '毫升', 'm²': '平方米', 'km/h': '千米每小时',
  };
  return map[u] ? `${u} = ${map[u]}` : '单位符号大小写有语义区别';
}

// ───────────────────────────── 执行 ─────────────────────────────

export function checkText(source, label) {
  const masked = maskProtected(source);
  const toLine = lineIndex(source);
  const findings = [];

  for (const rule of RULES) {
    let hits = [];
    try {
      hits = rule.scan(masked, masked) || [];
    } catch (e) {
      continue;
    }
    for (const h of hits) {
      findings.push({
        rule: rule.id, level: rule.level, title: rule.title, basis: rule.basis,
        fixable: rule.fixable, line: toLine(h.start), col: h.start - (source.lastIndexOf('\n', h.start - 1) + 1) + 1,
        text: h.text, replacement: h.replacement, msg: h.msg,
        excerpt: excerpt(source, h.start, h.end), start: h.start, end: h.end,
      });
    }
  }
  findings.sort((a, b) => a.start - b.start || a.rule.localeCompare(b.rule));
  return { label, findings };
}

function applyFixes(source, findings) {
  const fixable = findings.filter((f) => f.fixable && f.replacement !== null && f.replacement !== f.text)
    .sort((a, b) => b.start - a.start || b.end - a.end);
  let out = source;
  let n = 0;
  let lastBegin = Infinity;
  for (const f of fixable) {
    if (f.end > lastBegin) continue;
    out = out.slice(0, f.start) + f.replacement + out.slice(f.end);
    lastBegin = f.start;
    n++;
  }
  return { out, n };
}

export function fixUntilStable(source, maxRounds = 4) {
  let cur = source;
  let total = 0;
  const applied = [];
  for (let round = 0; round < maxRounds; round++) {
    const res = checkText(cur, '');
    const { out, n } = applyFixes(cur, res.findings);
    if (n === 0) break;
    cur = out;
    total += n;
    applied.push(...res.findings.filter((f) => f.fixable));
    if (cur === source) break;
  }
  return { out: cur, n: total };
}

function render(result, { showFix = false } = {}) {
  const { label, findings } = result;
  const errors = findings.filter((f) => f.level === 'error');
  const warnings = findings.filter((f) => f.level === 'warning');
  const lines = [];

  lines.push('');
  lines.push(`  ${label}`);
  lines.push('  ' + '─'.repeat(56));

  if (!findings.length) {
    lines.push('  通过：未发现数字或单位规范问题');
    return lines.join('\n');
  }

  for (const f of findings) {
    const tag = f.level === 'error' ? 'E' : 'W';
    const fixMark = f.fixable ? ' [可自动修复]' : '';
    lines.push(`  ${tag} ${f.rule}  ${f.title}${fixMark}`);
    lines.push(`     行 ${f.line}:${f.col}  …${f.excerpt}…`);
    lines.push(`     ${f.msg}`);
    if (showFix && f.fixable && f.replacement) {
      lines.push(`     改为：${f.replacement}`);
    }
    lines.push(`     依据：${f.basis}`);
    lines.push('');
  }

  lines.push('  ' + '─'.repeat(56));
  lines.push(`  合计 ${findings.length} 项：错误 ${errors.length}，警告 ${warnings.length}，可自动修复 ${findings.filter((f) => f.fixable).length}`);
  return lines.join('\n');
}

// ───────────────────────────── CLI ─────────────────────────────

function main(argv) {
  const args = argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === '-h' || cmd === '--help') {
    process.stdout.write(`
numunit — 中文数字与单位规范化

  check <文件...>              检查（支持 .md .txt；- 表示标准输入）
  fix <文件...> [--write]      自动修复；不加 --write 只预览
  cn2an <中文数字>             中文数字 → 阿拉伯数字
  an2cn <数字> [low|up|rmb]    阿拉伯数字 → 中文数字
  --text "文本" [--fix]        直接处理一段文本

示例
  node numunit.mjs check report.md
  node numunit.mjs fix report.md --write
  node numunit.mjs an2cn 1234567 rmb
  node numunit.mjs cn2an 一亿二千万
`);
    return 0;
  }

  if (cmd === 'cn2an') {
    process.stdout.write(String(cn2an(args[1] ?? '')) + '\n');
    return 0;
  }

  if (cmd === 'an2cn') {
    process.stdout.write(an2cn(args[1], args[2] || 'low') + '\n');
    return 0;
  }

  if (cmd === '--text' || cmd === 'text') {
    const text = cmd === 'text' ? args[1] : args[1];
    const res = checkText(text, '(inline)');
    process.stdout.write(render(res, { showFix: args.includes('--fix') }) + '\n');
    if (args.includes('--fix')) {
      const { out } = fixUntilStable(text);
      process.stdout.write('\n  ---- 修复后 ----\n' + out + '\n');
    }
    return res.findings.some((f) => f.level === 'error') ? 1 : 0;
  }

  const targets = args.slice(1).filter((a) => !a.startsWith('--'));
  const doWrite = args.includes('--write');
  if (!targets.length) {
    process.stderr.write('请指定文件路径\n');
    return 2;
  }

  let totalErrors = 0;
  for (const file of targets) {
    let src;
    try {
      src = file === '-' ? readFileSync(0, 'utf8') : readFileSync(file, 'utf8');
    } catch (e) {
      process.stderr.write(`无法读取 ${file}：${e.message}\n`);
      totalErrors++;
      continue;
    }
    const res = checkText(src, file);
    totalErrors += res.findings.filter((f) => f.level === 'error').length;
    process.stdout.write(render(res, { showFix: cmd === 'fix' }) + '\n');

    if (cmd === 'fix') {
      const { out, n } = fixUntilStable(src);
      if (doWrite && n > 0) {
        writeFileSync(file, out, 'utf8');
        process.stdout.write(`  已写入 ${file}（${n} 处修复）\n\n`);
      } else if (n > 0) {
        process.stdout.write(`  预览：将修复 ${n} 处，加 --write 才会写入文件\n\n`);
      }
    }
  }
  return totalErrors ? 1 : 0;
}

const isDirectRun = (() => {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (isDirectRun) process.exitCode = main(process.argv);
