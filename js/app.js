// 主应用逻辑 — 适配新左右分栏 UI
(async function () {
    const editorContainer = document.getElementById('editor-container');
    const runBtn = document.getElementById('run-btn');
    const clearBtn = document.getElementById('clear-btn');
    const clearOutputBtn = document.getElementById('clear-output-btn');
    const exampleBtn = document.getElementById('example-btn');
    const exampleMenu = document.getElementById('example-menu');
    const outputContent = document.getElementById('output-content');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const syntaxBadge = document.getElementById('syntax-badge');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');

    const editor = new PythonEditor(editorContainer);
    const runner = new PythonRunner();

    let isRunning = false;

    // --- 初始化 Pyodide ---
    try {
        await runner.init((msg) => {
            if (msg === 'ready') {
                statusDot.className = 'status-dot ready';
                statusText.textContent = 'Python 引擎已就绪';
                loadingOverlay.classList.add('hidden');
                setTimeout(() => { loadingOverlay.style.display = 'none'; }, 400);
            } else {
                loadingText.textContent = msg;
            }
        });
    } catch (err) {
        statusDot.className = 'status-dot error';
        statusText.textContent = err.message;
        loadingOverlay.classList.add('hidden');
    }

    // --- 运行按钮 ---
    runBtn.addEventListener('click', async () => {
        if (isRunning || !runner.ready) return;
        if (!editor.isReady()) return;

        isRunning = true;
        runBtn.classList.add('running');
        runBtn.querySelector('.btn-text').textContent = '运行中';
        clearOutput();

        const code = editor.getCode();
        if (!code.trim()) {
            appendOutput('请先写一些代码再运行哦~', 'error');
            resetRunBtn();
            return;
        }

        // 语法检查
        updateBadge('checking', '检查中');
        const syntaxResult = await runner.checkSyntax(code);
        if (!syntaxResult.ok) {
            appendOutput(syntaxResult.message, 'error');
            updateBadge('error', '语法错误');
            resetRunBtn();
            return;
        }

        // 运行
        updateBadge('checking', '运行中');
        try {
            await runner.run(code, (text, stream) => {
                appendOutput(text, stream === 'stderr' ? 'error' : 'success');
            });
            updateBadge('ready', '运行完成');
        } catch (err) {
            appendOutput('\n运行出错：\n' + err.message, 'error');
            updateBadge('error', '运行出错');
        }

        resetRunBtn();
    });

    function resetRunBtn() {
        isRunning = false;
        runBtn.classList.remove('running');
        runBtn.querySelector('.btn-text').textContent = '运行';
    }

    // --- 清空按钮 ---
    clearBtn.addEventListener('click', () => {
        if (editor.isReady()) {
            editor.setCode('');
            localStorage.removeItem('pythonweb_code');
        }
        clearOutput();
        updateBadge('ready', '就绪');
    });

    // --- 清空输出按钮 ---
    clearOutputBtn.addEventListener('click', () => {
        clearOutput();
    });

    // --- 示例菜单 ---
    exampleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exampleMenu.classList.toggle('show');
    });

    document.addEventListener('click', () => {
        exampleMenu.classList.remove('show');
    });

    EXAMPLES.forEach((example) => {
        const item = document.createElement('div');
        item.className = 'example-item';
        item.innerHTML = `
      <div class="example-name">${example.name}</div>
      <div class="example-desc">${example.desc}</div>
    `;
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            if (editor.isReady()) {
                editor.setCode(example.code);
            }
            exampleMenu.classList.remove('show');
            clearOutput();
        });
        exampleMenu.appendChild(item);
    });

    // --- 工具函数 ---
    function clearOutput() {
        // 隐藏 turtle wrapper
        const turtleWrapper = document.getElementById('turtle-wrapper');
        if (turtleWrapper) turtleWrapper.style.display = 'none';

        outputContent.innerHTML = `
      <div class="output-placeholder">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="placeholder-icon">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
        </svg>
        <p>运行代码后，结果会显示在这里</p>
        <p class="hint">快捷键 Ctrl + Enter 运行</p>
      </div>
    `;
    }

    function appendOutput(text, type = 'success') {
        const placeholder = outputContent.querySelector('.output-placeholder');
        if (placeholder) outputContent.innerHTML = '';

        const span = document.createElement('span');
        span.className = type === 'error' ? 'output-error' : 'output-success';
        span.textContent = text;
        outputContent.appendChild(span);
        outputContent.scrollTop = outputContent.scrollHeight;
    }

    function updateBadge(type, text) {
        syntaxBadge.className = 'panel-badge ' + (type === 'ready' ? '' : type);
        const iconName = type === 'error' ? 'x-circle' : type === 'checking' ? 'loader' : 'check-circle';
        syntaxBadge.innerHTML = `<i data-lucide="${iconName}" class="icon icon-sm"></i><span>${text}</span>`;
        if (window.lucide) lucide.createIcons();
    }

    // --- 快捷键 ---
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            runBtn.click();
        }
    });
})();
