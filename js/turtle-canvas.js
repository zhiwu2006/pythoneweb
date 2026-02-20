// Canvas Turtle 引擎 — 供 Python 通过 Pyodide 的 js bridge 调用
class CanvasTurtle {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.reset();
        this._playNext = this._playNext.bind(this);
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
        this.visible = true;

        // 动画队列
        this.queue = [];
        this.isPlaying = false;
        this.animX = this.x;
        this.animY = this.y;
        this.animAngle = this.angle;

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

    _addCommand(cmd) {
        this.queue.push(cmd);
        if (!this.isPlaying) {
            this.isPlaying = true;
            requestAnimationFrame(this._playNext);
        }
    }

    _playNext() {
        if (this.queue.length === 0) {
            this.isPlaying = false;
            return;
        }

        const cmd = this.queue.shift();

        if (cmd.type === 'line' || cmd.type === 'move') {
            this._animateLine(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.color, cmd.width, cmd.type === 'line', () => {
                this.animX = cmd.x2;
                this.animY = cmd.y2;
                requestAnimationFrame(this._playNext);
            });
        } else if (cmd.type === 'fill') {
            if (cmd.path.length > 2) {
                this.ctx.beginPath();
                this.ctx.moveTo(cmd.path[0].x, cmd.path[0].y);
                for (let i = 1; i < cmd.path.length; i++) {
                    this.ctx.lineTo(cmd.path[i].x, cmd.path[i].y);
                }
                this.ctx.closePath();
                this.ctx.fillStyle = cmd.color;
                this.ctx.globalAlpha = 0.35;
                this.ctx.fill();
                this.ctx.globalAlpha = 1.0;
            }
            requestAnimationFrame(this._playNext);
        } else if (cmd.type === 'turn') {
            this._animateTurn(cmd.startAngle, cmd.endAngle, () => {
                this.animAngle = cmd.endAngle;
                requestAnimationFrame(this._playNext);
            });
        }
    }

    _animateLine(x1, y1, x2, y2, color, width, isDraw, onComplete) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.hypot(dx, dy);
        if (dist === 0) return onComplete();

        let progress = 0;
        // 每帧移动速度（像素）
        const speed = Math.max(6, dist / 20);

        const step = () => {
            progress += speed;
            if (progress >= dist) progress = dist;

            const currentX = x1 + (dx * progress / dist);
            const currentY = y1 + (dy * progress / dist);

            if (isDraw) {
                this.ctx.beginPath();
                this.ctx.strokeStyle = color;
                this.ctx.lineWidth = width;
                this.ctx.lineCap = 'round';
                this.ctx.lineJoin = 'round';
                this.ctx.moveTo(this.animX, this.animY);
                this.ctx.lineTo(currentX, currentY);
                this.ctx.stroke();
            }

            this.animX = currentX;
            this.animY = currentY;

            if (progress < dist) {
                requestAnimationFrame(step);
            } else {
                onComplete();
            }
        };
        requestAnimationFrame(step);
    }

    _animateTurn(startAngle, endAngle, onComplete) {
        let diff = endAngle - startAngle;
        if (diff === 0) return onComplete();

        let progress = 0;
        const totalSteps = 10; // 转向的帧数
        const stepAngle = diff / totalSteps;

        const step = () => {
            progress++;
            this.animAngle = startAngle + stepAngle * progress;
            if (progress < totalSteps) {
                requestAnimationFrame(step);
            } else {
                onComplete();
            }
        }
        requestAnimationFrame(step);
    }

    forward(distance) {
        const rad = (this.angle * Math.PI) / 180;
        const newX = this.x + distance * Math.cos(rad);
        const newY = this.y + distance * Math.sin(rad);

        if (this.penDown) {
            this._addCommand({ type: 'line', x1: this.x, y1: this.y, x2: newX, y2: newY, color: this.penColor, width: this.penWidth });
        } else {
            this._addCommand({ type: 'move', x1: this.x, y1: this.y, x2: newX, y2: newY });
        }

        if (this.filling) {
            this.fillPath.push({ x: newX, y: newY });
        }

        this.x = newX;
        this.y = newY;
    }

    backward(distance) {
        this.forward(-distance);
    }

    right(angle) {
        const newAngle = this.angle + angle;
        this._addCommand({ type: 'turn', startAngle: this.angle, endAngle: newAngle });
        this.angle = newAngle % 360;
    }

    left(angle) {
        const newAngle = this.angle - angle;
        this._addCommand({ type: 'turn', startAngle: this.angle, endAngle: newAngle });
        this.angle = newAngle % 360;
    }

    goto(x, y) {
        const canvasX = this.canvas.width / 2 + x;
        const canvasY = this.canvas.height / 2 - y;

        if (this.penDown) {
            this._addCommand({ type: 'line', x1: this.x, y1: this.y, x2: canvasX, y2: canvasY, color: this.penColor, width: this.penWidth });
        } else {
            this._addCommand({ type: 'move', x1: this.x, y1: this.y, x2: canvasX, y2: canvasY });
        }

        if (this.filling) {
            this.fillPath.push({ x: canvasX, y: canvasY });
        }

        this.x = canvasX;
        this.y = canvasY;
    }

    setheading(angle) {
        const newAngle = 90 - angle;
        this._addCommand({ type: 'turn', startAngle: this.angle, endAngle: newAngle });
        this.angle = newAngle % 360;
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
        this._addCommand({ type: 'fill', path: [...this.fillPath], color: this.fillColor || this.penColor });
        this.filling = false;
        this.fillPath = [];
    }

    circle(radius, extent = 360) {
        const steps = Math.max(Math.abs(Math.round(extent / 4)), 15);
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
