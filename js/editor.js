// CodeMirror 5 编辑器封装 — Dracula 主题
class PythonEditor {
    constructor(container) {
        this.container = container;
        this.instance = null;
        this._init();
    }

    _init() {
        const savedCode = localStorage.getItem('pythonweb_code') || EXAMPLES[0].code;

        this.instance = CodeMirror(this.container, {
            value: savedCode,
            mode: 'python',
            theme: 'dracula',
            lineNumbers: true,
            lineWrapping: true,
            styleActiveLine: true,
            matchBrackets: true,
            autoCloseBrackets: true,
            indentUnit: 4,
            tabSize: 4,
            indentWithTabs: false,
            extraKeys: {
                "Tab": function (cm) {
                    if (cm.somethingSelected()) {
                        cm.indentSelection("add");
                    } else {
                        cm.replaceSelection("    ", "end", "+input");
                    }
                }
            }
        });

        this.instance.on('change', () => {
            localStorage.setItem('pythonweb_code', this.getCode());
        });

        window.dispatchEvent(new Event('editor-ready'));
    }

    getCode() {
        if (!this.instance) return '';
        return this.instance.getValue();
    }

    setCode(code) {
        if (!this.instance) return;
        this.instance.setValue(code);
    }

    isReady() {
        return this.instance !== null;
    }
}
