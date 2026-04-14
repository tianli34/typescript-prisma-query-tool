import { OutputLine } from '../lib/queryEngine';

interface Props {
  lines: OutputLine[];
}

export function TerminalOutput({ lines }: Props) {
  return (
    <div className="font-mono text-sm leading-relaxed">
      {lines.map((line, i) => {
        switch (line.kind) {
          case 'blank':
            return <div key={i} className="h-3" />;

          case 'heading':
            return (
              <div key={i} className="text-amber-300 font-bold mt-1 mb-0.5">
                {line.text}
              </div>
            );

          case 'comment':
            return (
              <div key={i} className="text-slate-500 italic">
                {line.text}
              </div>
            );

          case 'code':
            return (
              <div key={i} className="text-emerald-300 whitespace-pre">
                {line.text}
              </div>
            );

          case 'info':
            return (
              <div key={i} className="text-slate-300 whitespace-pre">
                {line.text}
              </div>
            );

          case 'error':
            return (
              <div key={i} className="text-red-400 font-semibold">
                ✖ {line.text}
              </div>
            );

          case 'success':
            return (
              <div key={i} className="text-green-400 font-semibold">
                ✔ {line.text}
              </div>
            );

          case 'row':
            return (
              <div key={i} className="flex gap-0 whitespace-pre">
                {line.cols.map((col, ci) => {
                  // First col: label (slate-400), rest: values
                  if (ci === 0) {
                    return (
                      <span key={ci} className="text-slate-400">
                        {col}
                      </span>
                    );
                  }
                  // Arrow / relation col
                  if (col.startsWith('→')) {
                    return (
                      <span key={ci} className="text-cyan-400">
                        {col}
                      </span>
                    );
                  }
                  // Attribute col (starts with @)
                  if (col.trim().startsWith('@')) {
                    return (
                      <span key={ci} className="text-purple-400">
                        {col}
                      </span>
                    );
                  }
                  // [Model] / [Field] / [Enum] tag
                  if (col.trim().startsWith('[')) {
                    return (
                      <span key={ci} className="text-sky-300">
                        {col}
                      </span>
                    );
                  }
                  // (N fields) tag
                  if (col.trim().startsWith('(')) {
                    return (
                      <span key={ci} className="text-slate-500">
                        {col}
                      </span>
                    );
                  }
                  return (
                    <span key={ci} className="text-slate-200">
                      {col}
                    </span>
                  );
                })}
              </div>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
