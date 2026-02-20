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

        // 检测是否使用了 turtle，如果是则初始化 Canvas 并注入 Python shim
        if (code.includes('import turtle') || code.includes('from turtle')) {
            if (window._turtleInit) window._turtleInit();

            this.pyodide.runPython(`
import sys
import types

# 创建一个虚拟的 turtle 模块
_turtle_mod = types.ModuleType('turtle')

class _CanvasTurtle:
    def __init__(self):
        from js import _turtleInit
    def forward(self, d):
        from js import _turtleForward
        _turtleForward(d)
    fd = forward
    def backward(self, d):
        from js import _turtleBackward
        _turtleBackward(d)
    bk = backward
    def right(self, a):
        from js import _turtleRight
        _turtleRight(a)
    rt = right
    def left(self, a):
        from js import _turtleLeft
        _turtleLeft(a)
    lt = left
    def penup(self):
        from js import _turtlePenUp
        _turtlePenUp()
    up = penup
    pu = penup
    def pendown(self):
        from js import _turtlePenDown
        _turtlePenDown()
    down = pendown
    pd = pendown
    def color(self, *args):
        from js import _turtleColor
        if len(args) >= 1:
            _turtleColor(str(args[0]))
        if len(args) >= 2:
            from js import _turtleFillColor
            _turtleFillColor(str(args[1]))
    def pencolor(self, c):
        from js import _turtleColor
        _turtleColor(str(c))
    def fillcolor(self, c):
        from js import _turtleFillColor
        _turtleFillColor(str(c))
    def pensize(self, w=None):
        if w is not None:
            from js import _turtlePenSize
            _turtlePenSize(w)
    width = pensize
    def goto(self, x, y=None):
        from js import _turtleGoto
        if y is None:
            _turtleGoto(x[0], x[1])
        else:
            _turtleGoto(x, y)
    setpos = goto
    setposition = goto
    def setheading(self, a):
        from js import _turtleSetheading
        _turtleSetheading(a)
    seth = setheading
    def circle(self, radius, extent=360):
        from js import _turtleCircle
        _turtleCircle(radius, extent)
    def begin_fill(self):
        from js import _turtleBeginFill
        _turtleBeginFill()
    def end_fill(self):
        from js import _turtleEndFill
        _turtleEndFill()
    def hideturtle(self):
        from js import _turtleHide
        _turtleHide()
    ht = hideturtle
    def showturtle(self):
        from js import _turtleShow
        _turtleShow()
    st = showturtle
    def speed(self, s=None):
        pass
    def done(self):
        pass
    def shape(self, s=None):
        pass
    def bgcolor(self, c=None):
        pass

def _turtle_Turtle():
    return _CanvasTurtle()

_turtle_mod.Turtle = _turtle_Turtle
_turtle_mod.forward = lambda d: _CanvasTurtle().forward(d)
_turtle_mod.fd = _turtle_mod.forward
_turtle_mod.done = lambda: None
_turtle_mod.speed = lambda s=None: None
_turtle_mod.bgcolor = lambda c=None: None
_turtle_mod.Screen = lambda: type('Screen', (), {'bgcolor': lambda self, c=None: None, 'title': lambda self, t='': None, 'exitonclick': lambda self: None, 'mainloop': lambda self: None})()

sys.modules['turtle'] = _turtle_mod
`);
        }

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
