// ─────────────────────────────────────────────────────────────────────────────
// Prisma Schema Parser — Pure TypeScript, zero dependencies
// ─────────────────────────────────────────────────────────────────────────────

export interface PrismaField {
  name: string;
  type: string;
  isArray: boolean;
  isOptional: boolean;
  attributes: PrismaAttribute[];
  rawLine: string;
}

export interface PrismaAttribute {
  name: string; // e.g. "id", "unique", "default", "relation"
  args: string; // raw args string, e.g. 'fields: [authorId], references: [id]'
  raw: string;  // full raw e.g. "@id", "@default(autoincrement())"
}

export interface PrismaModel {
  name: string;
  fields: PrismaField[];
  blockAttributes: string[]; // e.g. @@index([...])
}

export interface PrismaEnum {
  name: string;
  values: string[];
}

export interface PrismaSchema {
  models: PrismaModel[];
  enums: PrismaEnum[];
}

// ─── Attribute parser ────────────────────────────────────────────────────────

function parseAttributes(raw: string): PrismaAttribute[] {
  const attrs: PrismaAttribute[] = [];
  // Match @attr or @attr(...) or @@attr or @@attr(...)
  // We use a manual scan to handle nested parens (e.g. @default(autoincrement()))
  let i = 0;
  while (i < raw.length) {
    const atIdx = raw.indexOf('@', i);
    if (atIdx === -1) break;

    // collect attr name (letters, underscores, dots)
    let j = atIdx + 1;
    // handle @@
    if (raw[j] === '@') j++;
    const nameStart = j;
    while (j < raw.length && /[\w.]/.test(raw[j])) j++;
    const attrName = raw.slice(nameStart, j);
    if (!attrName) { i = j + 1; continue; }

    let args = '';
    let rawFull = raw.slice(atIdx, j);

    if (raw[j] === '(') {
      // scan to matching closing paren (depth-aware)
      let depth = 0;
      const argsStart = j + 1;
      while (j < raw.length) {
        if (raw[j] === '(') depth++;
        else if (raw[j] === ')') {
          depth--;
          if (depth === 0) { j++; break; }
        }
        j++;
      }
      args = raw.slice(argsStart, j - 1).trim();
      rawFull = raw.slice(atIdx, j);
    }

    attrs.push({ name: attrName, args, raw: rawFull });
    i = j;
  }
  return attrs;
}

// ─── Field parser ────────────────────────────────────────────────────────────

function parseField(line: string): PrismaField | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) return null;

  // Split: name  type  rest
  // name is the first token, type is the second, rest is everything after
  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 2) return null;

  const name = tokens[0];
  let typeRaw = tokens[1];

  // Skip block-level keywords
  if (['model', 'enum', 'datasource', 'generator', '}', '{'].includes(name)) return null;

  let isArray = false;
  let isOptional = false;

  if (typeRaw.endsWith('[]')) {
    isArray = true;
    typeRaw = typeRaw.slice(0, -2);
  } else if (typeRaw.endsWith('[]?')) {
    isArray = true;
    isOptional = true;
    typeRaw = typeRaw.slice(0, -3);
  }

  if (typeRaw.endsWith('?')) {
    isOptional = true;
    typeRaw = typeRaw.slice(0, -1);
  }

  // Everything after the type token = attribute string
  const restStart = trimmed.indexOf(typeRaw, name.length) + typeRaw.length;
  const rest = trimmed.slice(restStart);
  const attributes = parseAttributes(rest);

  return {
    name,
    type: typeRaw,
    isArray,
    isOptional,
    attributes,
    rawLine: trimmed,
  };
}

// ─── Schema parser ───────────────────────────────────────────────────────────

export function parsePrismaSchema(source: string): PrismaSchema {
  const models: PrismaModel[] = [];
  const enums: PrismaEnum[] = [];

  const lines = source.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // ── model block ──
    const modelMatch = line.match(/^model\s+(\w+)\s*\{/);
    if (modelMatch) {
      const name = modelMatch[1];
      const fields: PrismaField[] = [];
      const blockAttributes: string[] = [];
      i++;
      while (i < lines.length) {
        const fl = lines[i].trim();
        if (fl === '}') { i++; break; }
        if (fl.startsWith('@@')) {
          blockAttributes.push(fl);
        } else {
          const field = parseField(fl);
          if (field) fields.push(field);
        }
        i++;
      }
      models.push({ name, fields, blockAttributes });
      continue;
    }

    // ── enum block ──
    const enumMatch = line.match(/^enum\s+(\w+)\s*\{/);
    if (enumMatch) {
      const name = enumMatch[1];
      const values: string[] = [];
      i++;
      while (i < lines.length) {
        const el = lines[i].trim();
        if (el === '}') { i++; break; }
        if (el && !el.startsWith('//')) values.push(el.split(/\s+/)[0]);
        i++;
      }
      enums.push({ name, values });
      continue;
    }

    i++;
  }

  return { models, enums };
}

// ─── Relation detection ──────────────────────────────────────────────────────

/** Return the model names that `model` directly relates to */
export function getRelatedModelNames(model: PrismaModel, schema: PrismaSchema): string[] {
  const modelNames = new Set(schema.models.map(m => m.name));
  const related = new Set<string>();

  for (const f of model.fields) {
    if (modelNames.has(f.type)) {
      related.add(f.type);
    }
  }
  return [...related];
}

// ─── Schema formatter (Prisma-style output) ─────────────────────────────────

export function formatModel(model: PrismaModel): string {
  // Calculate column widths for alignment
  const fieldLines = model.fields.map(f => {
    const typeStr = f.type + (f.isArray ? '[]' : '') + (f.isOptional ? '?' : '');
    const attrStr = f.attributes.map(a => a.raw).join(' ');
    return { name: f.name, typeStr, attrStr };
  });

  const maxName = Math.max(...fieldLines.map(fl => fl.name.length), 0);
  const maxType = Math.max(...fieldLines.map(fl => fl.typeStr.length), 0);

  const bodyLines = fieldLines.map(fl => {
    const namePad = fl.name.padEnd(maxName + 2);
    const typePad = fl.typeStr.padEnd(maxType + 2);
    return `  ${namePad}${typePad}${fl.attrStr}`.trimEnd();
  });

  // Append block attributes
  for (const ba of model.blockAttributes) {
    bodyLines.push(`  ${ba}`);
  }

  return `model ${model.name} {\n${bodyLines.join('\n')}\n}`;
}
