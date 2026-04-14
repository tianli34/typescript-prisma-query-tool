// ─────────────────────────────────────────────────────────────────────────────
// Query Engine — implements the 5 core prisma-query commands
// ─────────────────────────────────────────────────────────────────────────────

import {
  PrismaSchema,
  PrismaModel,
  formatModel,
  getRelatedModelNames,
} from './prismaParser';

export interface QueryResult {
  lines: OutputLine[];
}

export type OutputLine =
  | { kind: 'comment';  text: string }
  | { kind: 'code';     text: string }
  | { kind: 'heading';  text: string }
  | { kind: 'info';     text: string }
  | { kind: 'error';    text: string }
  | { kind: 'success';  text: string }
  | { kind: 'row';      cols: string[] }
  | { kind: 'blank' };

function blank(): OutputLine { return { kind: 'blank' }; }
function comment(text: string): OutputLine { return { kind: 'comment', text }; }
function code(text: string): OutputLine { return { kind: 'code', text }; }
function heading(text: string): OutputLine { return { kind: 'heading', text }; }
function info(text: string): OutputLine { return { kind: 'info', text }; }
function error(text: string): OutputLine { return { kind: 'error', text }; }
function row(cols: string[]): OutputLine { return { kind: 'row', cols }; }

function modelCodeLines(model: PrismaModel): OutputLine[] {
  return formatModel(model)
    .split('\n')
    .map(l => code(l));
}

// ─────────────────────────────────────────────────────────────────────────────
// #1 — prisma-query model <Name...>
// ─────────────────────────────────────────────────────────────────────────────
export function cmdModel(schema: PrismaSchema, names: string[]): QueryResult {
  if (names.length === 0) {
    return { lines: [error('Usage: model <ModelName> [ModelName2 ...]')] };
  }

  const lines: OutputLine[] = [];
  let first = true;

  for (const name of names) {
    const model = schema.models.find(m => m.name.toLowerCase() === name.toLowerCase());
    if (!model) {
      lines.push(error(`Model "${name}" not found`));
      continue;
    }
    if (!first) lines.push(blank());
    first = false;
    modelCodeLines(model).forEach(l => lines.push(l));
  }

  return { lines };
}

// ─────────────────────────────────────────────────────────────────────────────
// #2 — prisma-query context <Model> --depth <n>
// ─────────────────────────────────────────────────────────────────────────────
export function cmdContext(schema: PrismaSchema, name: string, depth: number): QueryResult {
  const root = schema.models.find(m => m.name.toLowerCase() === name.toLowerCase());
  if (!root) {
    return { lines: [error(`Model "${name}" not found`)] };
  }

  const visited = new Set<string>();
  const queue: Array<{ model: PrismaModel; d: number }> = [{ model: root, d: 0 }];
  const ordered: Array<{ model: PrismaModel; isRoot: boolean }> = [];

  while (queue.length) {
    const { model, d } = queue.shift()!;
    if (visited.has(model.name)) continue;
    visited.add(model.name);
    ordered.push({ model, isRoot: model.name === root.name });

    if (d < depth) {
      const related = getRelatedModelNames(model, schema);
      for (const rName of related) {
        if (!visited.has(rName)) {
          const rModel = schema.models.find(m => m.name === rName);
          if (rModel) queue.push({ model: rModel, d: d + 1 });
        }
      }
    }
  }

  const lines: OutputLine[] = [];
  let first = true;

  for (const { model, isRoot } of ordered) {
    if (!first) lines.push(blank());
    first = false;
    lines.push(comment(isRoot ? `// [主体] ${model.name}` : `// [关联] ${model.name}`));
    modelCodeLines(model).forEach(l => lines.push(l));
  }

  return { lines };
}

// ─────────────────────────────────────────────────────────────────────────────
// #3 — prisma-query field <Model> <Field>  |  --attr <@attr>
// ─────────────────────────────────────────────────────────────────────────────
export function cmdField(
  schema: PrismaSchema,
  modelName: string | null,
  fieldName: string | null,
  attrFilter: string | null,
): QueryResult {
  const lines: OutputLine[] = [];

  // ── mode A: by model + field name
  if (modelName && fieldName) {
    const model = schema.models.find(m => m.name.toLowerCase() === modelName.toLowerCase());
    if (!model) return { lines: [error(`Model "${modelName}" not found`)] };

    const field = model.fields.find(f => f.name.toLowerCase() === fieldName.toLowerCase());
    if (!field) return { lines: [error(`Field "${fieldName}" not found in model "${model.name}"`)] };

    const typeStr = field.type + (field.isArray ? '[]' : '') + (field.isOptional ? '?' : '');
    const attrStr = field.attributes.map(a => a.raw).join('  ') || '(none)';

    lines.push(heading(`${model.name}.${field.name}`));
    lines.push(row(['  type     :', typeStr]));
    lines.push(row(['  required :', field.isOptional ? 'false' : 'true']));
    lines.push(row(['  array    :', field.isArray ? 'true' : 'false']));
    lines.push(row(['  attrs    :', attrStr]));
    return { lines };
  }

  // ── mode B: filter by attribute
  if (attrFilter) {
    const needle = attrFilter.replace(/^@+/, '').toLowerCase();
    let found = 0;

    lines.push(heading(`🔍 含 ${attrFilter} 属性的字段：`));
    lines.push(blank());

    for (const model of schema.models) {
      for (const field of model.fields) {
        const hasAttr = field.attributes.some(a => a.name.toLowerCase() === needle);
        if (hasAttr) {
          found++;
          const typeStr = field.type + (field.isArray ? '[]' : '') + (field.isOptional ? '?' : '');
          const matchAttr = field.attributes.find(a => a.name.toLowerCase() === needle);
          const attrRaw = matchAttr ? matchAttr.raw : attrFilter;
          lines.push(row([
            `[Field] ${model.name}.${field.name}`.padEnd(36),
            `→ ${typeStr.padEnd(16)}`,
            attrRaw,
          ]));
        }
      }
    }

    if (found === 0) {
      lines.push(info(`没有找到含 ${attrFilter} 属性的字段`));
    } else {
      lines.push(blank());
      lines.push(info(`共找到 ${found} 个字段`));
    }
    return { lines };
  }

  return { lines: [error('Usage: field <Model> <Field>  或  field --attr <@attribute>')] };
}

// ─────────────────────────────────────────────────────────────────────────────
// #4 — prisma-query search <keyword>
// ─────────────────────────────────────────────────────────────────────────────
export function cmdSearch(schema: PrismaSchema, keyword: string): QueryResult {
  if (!keyword) return { lines: [error('Usage: search <keyword>')] };

  const lines: OutputLine[] = [];
  const kw = keyword.toLowerCase();
  let found = 0;

  lines.push(heading(`🔍 搜索 "${keyword}" 结果：`));
  lines.push(blank());

  // Search model names
  for (const model of schema.models) {
    if (model.name.toLowerCase().includes(kw)) {
      found++;
      lines.push(row([
        `[Model] ${model.name}`.padEnd(36),
        `→ ${model.fields.length} fields`,
      ]));
    }
  }

  // Search field names & types
  for (const model of schema.models) {
    for (const field of model.fields) {
      const nameMatch = field.name.toLowerCase().includes(kw);
      const typeMatch = field.type.toLowerCase().includes(kw);

      if (nameMatch || typeMatch) {
        found++;
        const typeStr = field.type + (field.isArray ? '[]' : '') + (field.isOptional ? '?' : '');
        const hasRelation = field.attributes.some(a => a.name === 'relation');
        const attrTag = hasRelation ? '@relation' : field.attributes.map(a => a.raw).join(' ') || '';

        lines.push(row([
          `[Field] ${model.name}.${field.name}`.padEnd(36),
          `→ ${typeStr.padEnd(16)}`,
          attrTag,
        ]));
      }
    }
  }

  // Search enum names and values
  for (const en of schema.enums) {
    if (en.name.toLowerCase().includes(kw)) {
      found++;
      lines.push(row([
        `[Enum]  ${en.name}`.padEnd(36),
        `→ ${en.values.join(' | ')}`,
      ]));
    }
    for (const v of en.values) {
      if (v.toLowerCase().includes(kw)) {
        found++;
        lines.push(row([
          `[EnumVal] ${en.name}.${v}`.padEnd(36),
          '',
        ]));
      }
    }
  }

  if (found === 0) {
    lines.push(info(`没有找到匹配 "${keyword}" 的结果`));
  } else {
    lines.push(blank());
    lines.push(info(`共找到 ${found} 个结果`));
  }

  return { lines };
}

// ─────────────────────────────────────────────────────────────────────────────
// #5 — prisma-query models --list
// ─────────────────────────────────────────────────────────────────────────────
export function cmdModelsList(schema: PrismaSchema, detail: boolean = false): QueryResult {
  const lines: OutputLine[] = [];
  const total = schema.models.length;

  lines.push(heading(`📦 共 ${total} 个 Model：`));
  lines.push(blank());

  if (total === 0) {
    lines.push(info('Schema 中没有找到 Model'));
    return { lines };
  }

  const maxName = Math.max(...schema.models.map(m => m.name.length), 0);

  for (const model of schema.models) {
    if (detail) {
      const related = getRelatedModelNames(model, schema);
      const relStr = related.length > 0 ? `→ ${related.join(', ')}` : '';
      const fieldTag = `(${model.fields.length} fields)`;

      lines.push(row([
        model.name.padEnd(maxName + 2),
        fieldTag.padEnd(14),
        relStr,
      ]));
    } else {
      lines.push(row([model.name]));
    }
  }

  if (detail && schema.enums.length > 0) {
    lines.push(blank());
    lines.push(heading(`🏷  共 ${schema.enums.length} 个 Enum：`));
    lines.push(blank());
    for (const en of schema.enums) {
      lines.push(row([
        en.name.padEnd(maxName + 2),
        `(${en.values.length} values)`.padEnd(14),
        en.values.slice(0, 5).join(' | ') + (en.values.length > 5 ? ' ...' : ''),
      ]));
    }
  }

  return { lines };
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Dispatcher
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedCommand {
  cmd: string;
  args: string[];
  flags: Record<string, string | boolean>;
}

export function parseCommand(input: string): ParsedCommand {
  const parts = input.trim().split(/\s+/);
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};

  let i = 0;
  // skip leading "prisma-query" if user typed it
  if (parts[0] === 'prisma-query') i = 1;

  const cmd = parts[i++] ?? '';

  while (i < parts.length) {
    if (parts[i].startsWith('--')) {
      const key = parts[i].slice(2);
      if (i + 1 < parts.length && !parts[i + 1].startsWith('--')) {
        flags[key] = parts[i + 1];
        i += 2;
      } else {
        flags[key] = true;
        i++;
      }
    } else {
      args.push(parts[i]);
      i++;
    }
  }

  return { cmd, args, flags };
}

export function dispatch(schema: PrismaSchema, input: string): QueryResult {
  const { cmd, args, flags } = parseCommand(input);

  switch (cmd.toLowerCase()) {
    case 'model':
      return cmdModel(schema, args);

    case 'context': {
      const depth = flags['depth'] ? parseInt(String(flags['depth']), 10) : 1;
      return cmdContext(schema, args[0] ?? '', isNaN(depth) ? 1 : depth);
    }

    case 'field': {
      if (flags['attr']) {
        return cmdField(schema, null, null, String(flags['attr']));
      }
      return cmdField(schema, args[0] ?? null, args[1] ?? null, null);
    }

    case 'search':
      return cmdSearch(schema, args[0] ?? '');

    case 'models': {
      const detail = flags['detail'] === true;
      return cmdModelsList(schema, detail);
    }

    case 'help':
    case '':
      return helpResult();

    default:
      return {
        lines: [
          error(`未知命令: "${cmd}"`),
          { kind: 'blank' },
          ...helpResult().lines,
        ],
      };
  }
}

export function welcomeResult(modelCount: number, enumCount: number): QueryResult {
  return {
    lines: [
      { kind: 'comment', text: '╔═══════════════════════════════════════════════════════════╗' },
      { kind: 'comment', text: '║          prisma-query — Interactive Schema Explorer       ║' },
      { kind: 'comment', text: '╚═══════════════════════════════════════════════════════════╝' },
      blank(),
      { kind: 'success', text: `Schema 已加载 — ${modelCount} 个 Model，${enumCount} 个 Enum` },
      blank(),
      ...helpResult().lines,
    ],
  };
}

export function helpResult(): QueryResult {
  return {
    lines: [
      heading('📖 prisma-query 命令帮助'),
      blank(),
      { kind: 'info', text: '  model   <Name...>               查看单个或多个 Model 定义' },
      { kind: 'info', text: '  context <Name> [--depth <n>]    查看 Model 及其关联上下文' },
      { kind: 'info', text: '  field   <Model> <Field>         查看字段详细信息' },
      { kind: 'info', text: '  field   --attr <@attribute>     查找所有含指定属性的字段' },
      { kind: 'info', text: '  search  <keyword>               全局搜索 Model/字段/类型' },
      { kind: 'info', text: '  models  --list [--detail]       列出所有 Model 概览（--detail 显示字段数/关联/Enum）' },
      { kind: 'info', text: '  cls / clear                     清空终端屏幕' },
      blank(),
      { kind: 'comment', text: '// 示例：' },
      { kind: 'code',    text: '  model User' },
      { kind: 'code',    text: '  model User Post Comment' },
      { kind: 'code',    text: '  context Post --depth 2' },
      { kind: 'code',    text: '  field User email' },
      { kind: 'code',    text: '  field --attr @unique' },
      { kind: 'code',    text: '  field --attr @relation' },
      { kind: 'code',    text: '  search userId' },
      { kind: 'code',    text: '  models --list' },
      { kind: 'code',    text: '  models --list --detail' },
    ],
  };
}
