// ─────────────────────────────────────────────────────────────────────────────
// CLI Entry — prisma-query command-line interface
// Usage: npx tsx src/cli.ts <command> [args...] [--flags]
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parsePrismaSchema } from './lib/prismaParser.js';
import {
  dispatch,
  welcomeResult,
  helpResult,
  type QueryResult,
  type OutputLine,
} from './lib/queryEngine.js';

// ── ANSI color codes ────────────────────────────────────────────────────────

const ANSI = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  italic:  '\x1b[3m',
  // Foreground
  gray:    '\x1b[90m',
  green:   '\x1b[32m',
  cyan:    '\x1b[36m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  magenta: '\x1b[35m',
} as const;

// ── Formatter: convert OutputLine → colored terminal string ─────────────────

function formatLine(line: OutputLine): string {
  switch (line.kind) {
    case 'comment':
      return `${ANSI.dim}${ANSI.gray}${line.text}${ANSI.reset}`;
    case 'code':
      return `${ANSI.cyan}${line.text}${ANSI.reset}`;
    case 'heading':
      return `${ANSI.bold}${ANSI.magenta}${line.text}${ANSI.reset}`;
    case 'info':
      return `${ANSI.yellow}${line.text}${ANSI.reset}`;
    case 'error':
      return `${ANSI.bold}${ANSI.red}${line.text}${ANSI.reset}`;
    case 'success':
      return `${ANSI.green}${line.text}${ANSI.reset}`;
    case 'row':
      return line.cols.join(' ');
    case 'blank':
      return '';
    default:
      return '';
  }
}

function printResult(result: QueryResult): void {
  for (const line of result.lines) {
    console.log(formatLine(line));
  }
}

// ── Schema loading ──────────────────────────────────────────────────────────

function loadSchema(schemaPath?: string): string {
  const resolvedPath = schemaPath
    ? resolve(schemaPath)
    : resolve('E:/alttext-magic/prisma/schema.prisma');

  if (!resolvedPath.endsWith('.prisma') && !resolvedPath.endsWith('.ts')) {
    // Try reading as .prisma file directly
    try {
      return readFileSync(resolvedPath, 'utf-8');
    } catch {
      console.error(`${ANSI.bold}${ANSI.red}✗ 无法读取 schema 文件: ${resolvedPath}${ANSI.reset}`);
      process.exit(1);
    }
  }

  try {
    const raw = readFileSync(resolvedPath, 'utf-8');

    // If reading a .ts file that exports a string constant, extract the template literal content
    if (resolvedPath.endsWith('.ts')) {
      const templateMatch = raw.match(/(?:export\s+const\s+\w+\s*=\s*`)([\s\S]*?)(?:`;?\s*$)/m);
      if (templateMatch) {
        return templateMatch[1];
      }
    }

    return raw;
  } catch {
    console.error(`${ANSI.bold}${ANSI.red}✗ 无法读取 schema 文件: ${resolvedPath}${ANSI.reset}`);
    process.exit(1);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  const argv = process.argv.slice(2);
  // Debug: uncomment to see raw args
  // console.error('DEBUG argv:', JSON.stringify(argv));

  // No arguments → show welcome + help
  if (argv.length === 0) {
    const schemaSource = loadSchema();
    const schema = parsePrismaSchema(schemaSource);
    const welcome = welcomeResult(schema.models.length, schema.enums.length);
    printResult(welcome);
    return;
  }

  // Handle --schema flag to customize schema file path
  let schemaPath: string | undefined;
  const schemaFlagIdx = argv.indexOf('--schema');
  if (schemaFlagIdx !== -1 && schemaFlagIdx + 1 < argv.length) {
    schemaPath = argv[schemaFlagIdx + 1];
    // Remove --schema <path> from args
    argv.splice(schemaFlagIdx, 2);
  }

  // Handle --help / -h
  if (argv[0] === '--help' || argv[0] === '-h') {
    printResult(helpResult());
    return;
  }

  // Build command string from remaining argv
  // Detect PowerShell splatting issue: --attr @unique → PowerShell swallows @unique
  // Result: argv ends with --attr as the last element (no value after it)
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--attr' && (i + 1 >= argv.length || argv[i + 1].startsWith('--'))) {
      console.error(
        `${ANSI.bold}${ANSI.red}✗ 参数 --attr 缺少值${ANSI.reset}\n` +
        `${ANSI.yellow}  提示: 在 PowerShell 中 @ 是特殊字符 (splatting 运算符)${ANSI.reset}\n` +
        `${ANSI.yellow}  请用引号包裹属性名，例如:${ANSI.reset}\n` +
        `${ANSI.cyan}    npx tsx src/cli.ts field --attr "@unique"${ANSI.reset}\n` +
        `${ANSI.cyan}    npx tsx src/cli.ts field --attr "@relation"${ANSI.reset}\n`
      );
      process.exit(1);
    }
  }
  const commandStr = argv.join(' ');

  // Load schema and dispatch
  const schemaSource = loadSchema(schemaPath);
  const schema = parsePrismaSchema(schemaSource);
  const result = dispatch(schema, commandStr);
  printResult(result);
}

main();
