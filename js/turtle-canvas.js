// Canvas Turtle 引擎 — 供 Python 通过 Pyodide 的 js bridge 调用
class CanvasTurtle {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.reset();
    }

    reset() {
        this.x = this.canvas.width / 2;
        this.y = this.canvas.height / 2;
        this.angle = 0; // 0 = facing right (east)
        this.penDown = true;
        this.penColor = '#22C55E';
        this.penWidth = 2;
        this.fillColor = '';
        this.filling = false;
        this.fillPath = [];
        this.speed = 0;
        this.visible = true;

        // 清除画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 绘制网格背景
        this._drawGrid();
    }

    _drawGrid() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 20) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = 0; y < h; y += 20) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
    }

    forward(distance) {
        const rad = (this.angle * Math.PI) / 180;
        const newX = this.x + distance * Math.cos(rad);
        const newY = this.y + distance * Math.sin(rad);

        if (this.penDown) {
            this.ctx.beginPath();
            this.ctx.strokeStyle = this.penColor;
            this.ctx.lineWidth = this.penWidth;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.moveTo(this.x, this.y);
            this.ctx.lineTo(newX, newY);
            this.ctx.stroke();
        }

        if (this.filling) {
            this.fillPath.push({ x: newX, y: newY });
        }

        this.x = newX;
        this.y = newY;
        this._drawTurtle();
    }

    backward(distance) {
        this.forward(-distance);
    }

    right(angle) {
        this.angle = (this.angle + angle) % 360;
        this._drawTurtle();
    }

    left(angle) {
        this.angle = (this.angle - angle) % 360;
        this._drawTurtle();
    }

    goto(x, y) {
        // turtle 坐标系: 中心为原点, y轴向上
        const canvasX = this.canvas.width / 2 + x;
        const canvasY = this.canvas.height / 2 - y;

        if (this.penDown) {
            this.ctx.beginPath();
            this.ctx.strokeStyle = this.penColor;
            this.ctx.lineWidth = this.penWidth;
            this.ctx.lineCap = 'round';
            this.ctx.moveTo(this.x, this.y);
            this.ctx.lineTo(canvasX, canvasY);
            this.ctx.stroke();
        }

        if (this.filling) {
            this.fillPath.push({ x: canvasX, y: canvasY });
        }

        this.x = canvasX;
        this.y = canvasY;
        this._drawTurtle();
    }

    setheading(angle) {
        // turtle 标准: 0=north, 90=east
        // canvas: 0=east, 顺时针增
        this.angle = 90 - angle;
        this._drawTurtle();
    }

    penup() {
        this.penDown = false;
    }

    pendown_fn() {
        this.penDown = true;
    }

    color(c) {
        this.penColor = c;
    }

    pensize(w) {
        this.penWidth = w;
    }

    setFillColor(c) {
        this.fillColor = c;
    }

    beginFill() {
        this.filling = true;
        this.fillPath = [{ x: this.x, y: this.y }];
    }

    endFill() {
        if (this.fillPath.length > 2) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.fillPath[0].x, this.fillPath[0].y);
            for (let i = 1; i < this.fillPath.length; i++) {
                this.ctx.lineTo(this.fillPath[i].x, this.fillPath[i].y);
            }
            this.ctx.closePath();
            this.ctx.fillStyle = this.fillColor || this.penColor;
            this.ctx.globalAlpha = 0.35;
            this.ctx.fill();
            this.ctx.globalAlpha = 1.0;
        }
        this.filling = false;
        this.fillPath = [];
    }

    circle(radius, extent = 360) {
        const steps = Math.max(Math.abs(Math.round(extent / 3)), 12);
        const stepAngle = extent / steps;
        const stepLen = (2 * Math.PI * Math.abs(radius) * Math.abs(extent)) / (360 * steps);

        for (let i = 0; i < steps; i++) {
            this.forward(stepLen);
            if (radius > 0) {
                this.left(stepAngle);
            } else {
                this.right(stepAngle);
            }
        }
    }

    hideturtle() {
        this.visible = false;
    }

    showturtle() {
        this.visible = true;
        this._drawTurtle();
    }

    _drawTurtle() {
        // 海龟画完后不画海龟指针（避免残影），如果需要可以开启
    }
}

// --- 全局实例和暴露给 Python 的桥接函数 ---
window._canvasTurtle = null;

window._turtleInit = function () {
    const canvas = document.getElementById('turtle-canvas');
    if (!canvas) return;
    canvas.style.display = 'block';
    // 设置高分辨率
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = Math.max(rect.width - 32, 300);
    const h = 360;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.getContext('2d').scale(dpr, dpr);
    // 重新设定 canvas 内部尺寸（用于绘图计算）
    canvas._logicalWidth = w;
    canvas._logicalHeight = h;

    window._canvasTurtle = new CanvasTurtle({
        width: w,
        height: h,
        getContext: () => canvas.getContext('2d'),
    });
    // 重新绑定实际画布
    window._canvasTurtle.canvas = { width: w, height: h };
    window._canvasTurtle.ctx = canvas.getContext('2d');
    window._canvasTurtle.x = w / 2;
    window._canvasTurtle.y = h / 2;
    window._canvasTurtle._drawGrid();
};

window._turtleForward = (d) => window._canvasTurtle?.forward(d);
window._turtleBackward = (d) => window._canvasTurtle?.backward(d);
window._turtleRight = (a) => window._canvasTurtle?.right(a);
window._turtleLeft = (a) => window._canvasTurtle?.left(a);
window._turtlePenUp = () => window._canvasTurtle?.penup();
window._turtlePenDown = () => window._canvasTurtle?.pendown_fn();
window._turtleColor = (c) => window._canvasTurtle?.color(c);
window._turtlePenSize = (w) => window._canvasTurtle?.pensize(w);
window._turtleGoto = (x, y) => window._canvasTurtle?.goto(x, y);
window._turtleSetheading = (a) => window._canvasTurtle?.setheading(a);
window._turtleCircle = (r, e) => window._canvasTurtle?.circle(r, e);
window._turtleBeginFill = () => window._canvasTurtle?.beginFill();
window._turtleEndFill = () => window._canvasTurtle?.endFill();
window._turtleFillColor = (c) => window._canvasTurtle?.setFillColor(c);
window._turtleHide = () => window._canvasTurtle?.hideturtle();
window._turtleShow = () => window._canvasTurtle?.showturtle();
