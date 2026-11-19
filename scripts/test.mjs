#!/usr/bin/env node
/**
 * numunit 测试套件
 * 运行：node scripts/test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cn2an, an2cn, checkText, fixUntilStable } from './numunit.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

let pass = 0;
const failures = [];

function eq(actual, expected, label) {
  if (String(actual) === String(expected)) {
    pass++;
  } else {
    failures.push(`${label}\n      期望: ${expected}\n      实际: ${actual}`);
  }
}

function ok(cond, label) {
  if (cond) pass++;
  else failures.push(label);
}

// ─── 中文数字 → 阿拉伯数字 ───
const cn2anCases = [
  ['一百二十三', 123],
  ['一亿二千万', 120000000],
  ['一千零一', 1001],
  ['二十三万四千五百', 234500],
  ['十', 10],
  ['十二', 12],
  ['负一百', -100],
  ['三点一四', 3.14],
  ['一万零一', 10001],
  ['两万', 20000],
  ['二〇二六', 2026],
  ['一九九七', 1997],
  ['三百零五', 305],
  ['一亿零一', 100000001],
];
for (const [input, expected] of cn2anCases) {
  try {
    eq(cn2an(input), expected, `cn2an("${input}")`);
  } catch (e) {
    failures.push(`cn2an("${input}") 抛错: ${e.message}`);
  }
}

// ─── 阿拉伯数字 → 中文数字 ───
const an2cnCases = [
  [0, '零'],
  [10, '十'],
  [12, '十二'],
  [105, '一百零五'],
  [1001, '一千零一'],
  [10001, '一万零一'],
  [12000, '一万二千'],
  [100000000, '一亿'],
  [100000001, '一亿零一'],
  [1234567, '一百二十三万四千五百六十七'],
];
for (const [input, expected] of an2cnCases) {
  eq(an2cn(input), expected, `an2cn(${input})`);
}

// ─── 大写模式 ───
eq(an2cn(123, 'up'), '壹佰贰拾叁', "an2cn(123, 'up')");
eq(an2cn(10, 'up'), '壹拾', "an2cn(10, 'up')");

// ─── 人民币金额 ───
const rmbCases = [
  [0, '零元整'],
  [0.5, '伍角'],
  [1.05, '壹元零伍分'],
  [123, '壹佰贰拾叁元整'],
  [1234.56, '壹仟贰佰叁拾肆元伍角陆分'],
  [1000.05, '壹仟元零伍分'],
];
for (const [input, expected] of rmbCases) {
  eq(an2cn(input, 'rmb'), expected, `an2cn(${input}, 'rmb')`);
}

// ─── 规范样例应零报错 ───
const good = read('examples/good.md');
const goodRes = checkText(good, 'good');
ok(
  goodRes.findings.filter((f) => f.level === 'error').length === 0,
  `examples/good.md 不应有 error，实际: ${goodRes.findings.filter((f) => f.level === 'error').map((f) => f.rule).join(',')}`
);

// ─── 错误样例应被检出 ───
const bad = read('examples/bad.md');
const badRes = checkText(bad, 'bad');
const badRules = new Set(badRes.findings.map((f) => f.rule));
for (const rule of ['NUM-001', 'NUM-004', 'NUM-005', 'NUM-007', 'NUM-010']) {
  ok(badRules.has(rule), `examples/bad.md 应检出 ${rule}`);
}

// ─── 自动修复应幂等且消除全部 error ───
const fixed = fixUntilStable(bad);
const fixedRes = checkText(fixed.out, 'fixed');
const remainErrors = fixedRes.findings.filter((f) => f.level === 'error');
ok(remainErrors.length === 0, `修复后不应残留 error，实际: ${remainErrors.map((f) => f.rule).join(',')}`);

const fixedAgain = fixUntilStable(fixed.out);
ok(fixedAgain.out === fixed.out, 'fixUntilStable 应幂等（二次修复无变化）');

// ─── 输出 ───
const total = pass + failures.length;
if (failures.length === 0) {
  console.log(`\n  全部通过：${pass} 项断言\n`);
  process.exit(0);
} else {
  console.log(`\n  失败 ${failures.length} / ${total} 项\n`);
  for (const f of failures) console.log(`  ✗ ${f}\n`);
  process.exit(1);
}
