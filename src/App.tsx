import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { parsePrismaSchema } from './lib/prismaParser';
import { dispatch, welcomeResult, QueryResult } from './lib/queryEngine';
import { SAMPLE_SCHEMA } from './lib/sampleSchema';
import { TerminalOutput } from './components/TerminalOutput';

// ─── Types ───────────────────────────────────────────────────────────────────

interface HistoryEntry {
  id: number;
  command: string;
  result: QueryResult;
}

// ─── Quick command chips ──────────────────────────────────────────────────────

const QUICK_COMMANDS = [
  { label: 'models --list',        cmd: 'models --list' },
  { label: 'model User',           cmd: 'model User' },
  { label: 'model User Post',      cmd: 'model User Post' },
  { label: 'context Post --depth 1', cmd: 'context Post --depth 1' },
  { label: 'context Post --depth 2', cmd: 'context Post --depth 2' },
  { label: 'field User email',     cmd: 'field User email' },
  { label: 'field --attr @unique', cmd: 'field --attr @unique' },
  { label: 'field --attr @relation', cmd: 'field --attr @relation' },
  { label: 'search userId',        cmd: 'search userId' },
  { label: 'search Role',          cmd: 'search Role' },
  { label: 'cls',                  cmd: 'cls' },
  { label: 'help',                 cmd: 'help' },
];

// ─── App ─────────────────────────────────────────────────────────────────────

let _id = 0;
const nextId = () => ++_id;

export default function App() {
  const [schemaText, setSchemaText] = useState(SAMPLE_SCHEMA);
  const [schemaInput, setSchemaInput] = useState(SAMPLE_SCHEMA);
  const [cmdInput, setCmdInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyCursor, setHistoryCursor] = useState(-1);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'terminal' | 'schema'>('terminal');
  const [schemaStatus, setSchemaStatus] = useState<'ok' | 'error' | 'idle'>('ok');
  const [modelCount, setModelCount] = useState(0);

  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse schema on mount
  useEffect(() => {
    const parsed = parsePrismaSchema(schemaText);
    setModelCount(parsed.models.length);
    // Show welcome on start
    setEntries([{ id: nextId(), command: '', result: welcomeResult(parsed.models.length, parsed.enums.length) }]);
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [entries]);

  const runCommand = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;

      // Handle clear-screen commands
      if (trimmed.toLowerCase() === 'cls' || trimmed.toLowerCase() === 'clear') {
        setEntries([]);
        setCmdHistory(prev => {
          const filtered = prev.filter(c => c !== trimmed);
          return [trimmed, ...filtered].slice(0, 100);
        });
        setHistoryCursor(-1);
        setCmdInput('');
        return;
      }

      const schema = parsePrismaSchema(schemaText);
      const result = dispatch(schema, trimmed);

      setEntries(prev => [...prev, { id: nextId(), command: trimmed, result }]);
      setCmdHistory(prev => {
        const filtered = prev.filter(c => c !== trimmed);
        return [trimmed, ...filtered].slice(0, 100);
      });
      setHistoryCursor(-1);
      setCmdInput('');
    },
    [schemaText],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      runCommand(cmdInput);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = historyCursor + 1;
      if (next < cmdHistory.length) {
        setHistoryCursor(next);
        setCmdInput(cmdHistory[next]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = historyCursor - 1;
      if (next >= 0) {
        setHistoryCursor(next);
        setCmdInput(cmdHistory[next]);
      } else {
        setHistoryCursor(-1);
        setCmdInput('');
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setEntries([]);
    }
  };

  const applySchema = () => {
    try {
      const parsed = parsePrismaSchema(schemaInput);
      setSchemaText(schemaInput);
      setModelCount(parsed.models.length);
      setSchemaStatus('ok');
      setEntries([
        {
          id: nextId(),
          command: '',
          result: {
            lines: [
              { kind: 'success', text: `Schema 已更新 — 解析到 ${parsed.models.length} 个 Model，${parsed.enums.length} 个 Enum` },
            ],
          },
        },
      ]);
      setActiveTab('terminal');
    } catch {
      setSchemaStatus('error');
    }
  };

  const loadSample = () => {
    setSchemaInput(SAMPLE_SCHEMA);
    setSchemaStatus('idle');
  };

  return (
    <div className="flex flex-col h-screen bg-[#0d1117] text-slate-100 overflow-hidden">
      {/* ── Top Bar ── */}
      <header className="flex items-center gap-3 px-5 py-3 bg-[#161b22] border-b border-[#30363d] shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-tight">prisma-query</div>
            <div className="text-[10px] text-slate-500 leading-none">Interactive Schema Explorer</div>
          </div>
        </div>

        <div className="h-6 w-px bg-[#30363d] mx-1" />

        {/* Tab switcher */}
        <div className="flex gap-1 bg-[#0d1117] rounded-lg p-0.5">
          <button
            onClick={() => setActiveTab('terminal')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'terminal'
                ? 'bg-[#161b22] text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ⌨ 终端
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'schema'
                ? 'bg-[#161b22] text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📄 Schema
          </button>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{modelCount} Models</span>
          </div>
          <div className="text-xs text-slate-600">cls / Ctrl+L 清屏</div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* ── Left: Quick Commands ── */}
        <aside className="w-52 bg-[#0d1117] border-r border-[#21262d] flex flex-col shrink-0">
          <div className="px-3 pt-3 pb-2">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-2">
              快速命令
            </div>
            <div className="flex flex-col gap-0.5">
              {QUICK_COMMANDS.map(({ label, cmd }) => (
                <button
                  key={cmd}
                  onClick={() => {
                    setCmdInput(cmd);
                    inputRef.current?.focus();
                  }}
                  onDoubleClick={() => runCommand(cmd)}
                  className="text-left px-2.5 py-1.5 rounded-md text-xs font-mono text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors truncate"
                  title={`单击填充，双击执行: ${cmd}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto px-3 pb-3 border-t border-[#21262d] pt-3">
            <div className="text-[10px] text-slate-600 leading-relaxed">
              💡 单击填充命令<br />
              🚀 双击直接执行<br />
              ↑↓ 历史记录
            </div>
          </div>
        </aside>

        {/* ── Main Panel ── */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Terminal Tab */}
          {activeTab === 'terminal' && (
            <>
              {/* Output area */}
              <div
                ref={terminalRef}
                className="flex-1 overflow-y-auto p-5 space-y-4"
                onClick={() => inputRef.current?.focus()}
              >
                {entries.map((entry, ei) => (
                  <div key={entry.id} className="space-y-1">
                    {entry.command && (
                      <div className="flex items-center gap-2 text-xs font-mono mb-1">
                        <span className="text-violet-400 select-none">❯</span>
                        <span className="text-white font-semibold">{entry.command}</span>
                        {ei < entries.length - 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setCmdInput(entry.command); inputRef.current?.focus(); }}
                            className="ml-auto text-slate-600 hover:text-slate-400 text-[10px] transition-colors"
                            title="重新使用此命令"
                          >
                            ↩ 重用
                          </button>
                        )}
                      </div>
                    )}
                    <TerminalOutput lines={entry.result.lines} />
                  </div>
                ))}

                {entries.length === 0 && (
                  <div className="flex items-center justify-center h-full text-slate-700 text-sm font-mono">
                    输入命令开始探索 Schema...
                  </div>
                )}
              </div>

              {/* Input bar */}
              <div className="shrink-0 border-t border-[#21262d] bg-[#0d1117] px-4 py-3">
                <div className="flex items-center gap-3 bg-[#161b22] rounded-lg px-4 py-2.5 border border-[#30363d] focus-within:border-violet-500 transition-colors">
                  <span className="text-violet-400 font-mono text-sm select-none">❯</span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={cmdInput}
                    onChange={e => setCmdInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="输入命令，如: model User  /  search email  /  help"
                    className="flex-1 bg-transparent text-white font-mono text-sm outline-none placeholder:text-slate-700"
                    autoFocus
                    spellCheck={false}
                    autoComplete="off"
                    autoCorrect="off"
                  />
                  <button
                    onClick={() => runCommand(cmdInput)}
                    className="text-slate-600 hover:text-violet-400 transition-colors"
                    title="执行 (Enter)"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Schema Tab */}
          {activeTab === 'schema' && (
            <div className="flex-1 flex flex-col min-h-0 p-4 gap-3">
              <div className="flex items-center gap-3">
                <div className="text-sm font-medium text-slate-300">
                  Prisma Schema 编辑器
                </div>
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={loadSample}
                    className="px-3 py-1.5 text-xs rounded-md bg-[#21262d] text-slate-400 hover:text-white hover:bg-[#30363d] transition-colors"
                  >
                    重置示例
                  </button>
                  <button
                    onClick={applySchema}
                    className="px-3 py-1.5 text-xs rounded-md bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors"
                  >
                    应用 Schema ↩
                  </button>
                </div>
              </div>

              {schemaStatus === 'error' && (
                <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
                  ✖ Schema 解析失败，请检查格式后重试
                </div>
              )}

              <div className="flex-1 min-h-0 rounded-xl overflow-hidden border border-[#30363d]">
                <div className="flex items-center gap-2 px-4 py-2 bg-[#161b22] border-b border-[#30363d] text-xs text-slate-500">
                  <span className="text-slate-400 font-mono">schema.prisma</span>
                  <span className="ml-auto">
                    {schemaInput.split('\n').length} lines
                  </span>
                </div>
                <textarea
                  value={schemaInput}
                  onChange={e => { setSchemaInput(e.target.value); setSchemaStatus('idle'); }}
                  className="w-full h-[calc(100%-36px)] bg-[#0d1117] text-emerald-300 font-mono text-xs p-4 outline-none resize-none leading-relaxed"
                  spellCheck={false}
                  placeholder="在此粘贴您的 Prisma Schema..."
                />
              </div>
            </div>
          )}
        </main>

        {/* ── Right: Command Reference ── */}
        <aside className="w-64 bg-[#0d1117] border-l border-[#21262d] overflow-y-auto shrink-0 hidden lg:block">
          <div className="p-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-3">
              命令参考
            </div>

            {[
              {
                icon: '🥇',
                title: 'Model 定义',
                color: 'text-yellow-400',
                cmds: [
                  { cmd: 'model User', desc: '查看单个 Model' },
                  { cmd: 'model User Post', desc: '查看多个 Model' },
                ],
              },
              {
                icon: '🥈',
                title: '关联上下文',
                color: 'text-slate-300',
                cmds: [
                  { cmd: 'context Post', desc: '默认 depth=1' },
                  { cmd: 'context Post --depth 2', desc: '两层关联' },
                ],
              },
              {
                icon: '🥉',
                title: '字段查询',
                color: 'text-amber-600',
                cmds: [
                  { cmd: 'field User email', desc: '字段详情' },
                  { cmd: 'field --attr @unique', desc: '按属性筛选' },
                  { cmd: 'field --attr @relation', desc: '所有外键' },
                  { cmd: 'field --attr @id', desc: '所有主键' },
                ],
              },
              {
                icon: '🏅',
                title: '全局搜索',
                color: 'text-slate-400',
                cmds: [
                  { cmd: 'search userId', desc: '搜索字段名' },
                  { cmd: 'search Role', desc: '搜索类型名' },
                  { cmd: 'search email', desc: '搜索关键词' },
                ],
              },
              {
                icon: '📦',
                title: 'Model 列表',
                color: 'text-slate-400',
                cmds: [
                  { cmd: 'models --list', desc: '全局概览' },
                ],
              },
            ].map(section => (
              <div key={section.title} className="mb-4">
                <div className={`text-xs font-semibold mb-1.5 flex items-center gap-1.5 ${section.color}`}>
                  <span>{section.icon}</span>
                  <span>{section.title}</span>
                </div>
                {section.cmds.map(({ cmd, desc }) => (
                  <div key={cmd} className="mb-1">
                    <button
                      onClick={() => { setCmdInput(cmd); inputRef.current?.focus(); setActiveTab('terminal'); }}
                      className="block w-full text-left"
                    >
                      <span className="block font-mono text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors truncate">
                        {cmd}
                      </span>
                      <span className="text-[10px] text-slate-600">{desc}</span>
                    </button>
                  </div>
                ))}
              </div>
            ))}

            <div className="border-t border-[#21262d] pt-3 mt-2">
              <div className="text-[10px] text-slate-600 leading-relaxed space-y-1">
                <div>🔵 <span className="text-slate-500">蓝色</span> = 标识符/标签</div>
                <div>🟢 <span className="text-emerald-500">绿色</span> = Schema 代码</div>
                <div>🟣 <span className="text-purple-500">紫色</span> = 属性装饰器</div>
                <div>🟡 <span className="text-amber-500">黄色</span> = 标题/统计</div>
                <div>⚪ <span className="text-slate-400">灰色</span> = 注释说明</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
