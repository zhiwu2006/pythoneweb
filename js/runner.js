// Pyodide Python 运行器封装
class PythonRunner {
    constructor() {
        this.pyodide = null;
        this.loading = false;
        this.ready = false;
    }

    async init(onProgress) {
        if (this.ready) return;
        if (this.loading) return;
        this.loading = true;

        try {
            if (onProgress) onProgress('正在加载 Python 引擎...');
            this.pyodide = await loadPyodide({
                indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
            });
            this.ready = true;
            this.loading = false;
            if (onProgress) onProgress('ready');
        } catch (err) {
            this.loading = false;
            throw new Error('Python 引擎加载失败：' + err.message);
        }
    }

    // 语法检查
    async checkSyntax(code) {
        if (!this.ready) return { ok: true, message: '' };

        try {
            await this.pyodide.runPythonAsync(`
import py_compile
import io
import sys

_code = ${JSON.stringify(code)}
try:
    compile(_code, '<input>', 'exec')
    _syntax_ok = True
    _syntax_err = ""
except SyntaxError as e:
    _syntax_ok = False
    _line = e.lineno if e.lineno else '?'
    _syntax_err = f"第 {_line} 行语法错误：{e.msg}"
`);
            const ok = this.pyodide.globals.get('_syntax_ok');
            const errMsg = this.pyodide.globals.get('_syntax_err');
            return { ok, message: errMsg };
        } catch (e) {
            return { ok: false, message: '检查失败：' + e.message };
        }
    }

    // 运行代码
    async run(code, onOutput) {
        if (!this.ready) {
            throw new Error('Python 引擎还没准备好，请稍等...');
        }

        // 设置 stdout/stderr 重定向
        this.pyodide.runPython(`
import sys
import io

class _OutputCapture:
    def __init__(self, callback_name):
        self._callback = callback_name
    def write(self, text):
        if text:
            from js import _pythonOutputCallback
            _pythonOutputCallback(text, self._callback)
    def flush(self):
        pass

sys.stdout = _OutputCapture('stdout')
sys.stderr = _OutputCapture('stderr')
`);

        // 注册 JS 回调供 Python 调用
        window._pythonOutputCallback = (text, stream) => {
            if (onOutput) onOutput(text, stream);
        };

        // 注入 input() 替换（使用 prompt 弹窗）
        this.pyodide.runPython(`
import builtins

def _custom_input(prompt=""):
    from js import _pythonInputCallback
    result = _pythonInputCallback(str(prompt))
    if result is None:
        raise KeyboardInterrupt("用户取消了输入")
    # 打印 prompt 和用户输入（模拟终端行为）
    from js import _pythonOutputCallback
    _pythonOutputCallback(str(prompt) + str(result) + "\\n", 'stdout')
    return str(result)

builtins.input = _custom_input
`);

        window._pythonInputCallback = (prompt) => {
            return window.prompt(prompt || '请输入：');
        };

        // 带超时保护的运行
        try {
            const timeout = 10000; // 10 秒超时
            const runPromise = this.pyodide.runPythonAsync(code);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('⏰ 代码运行超时（超过 10 秒），可能存在死循环！')), timeout);
            });
            await Promise.race([runPromise, timeoutPromise]);
        } catch (err) {
            const msg = err.message || String(err);
            // 过滤掉 Pyodide 内部的冗余错误信息，保留关键部分
            if (msg.includes('PythonError')) {
                const lines = msg.split('\n');
                const relevantLines = lines.filter(l =>
                    !l.includes('pyodide') && !l.includes('_OutputCapture')
                );
                throw new Error(relevantLines.join('\n') || msg);
            }
            throw err;
        } finally {
            // 恢复标准 IO
            this.pyodide.runPython(`
import sys
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
`);
        }
    }
}
