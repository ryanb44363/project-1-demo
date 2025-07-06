document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("grid");
  const ctx = canvas.getContext("2d");
  const size = canvas.width;

  let centerX = size / 2;
  let centerY = size / 2;
  let baseScale = 20;
  let zoom = 1;

  const status = document.getElementById("status");
  let dots = [];
  let wsDots = [];
  let parabolaDots = [];
  let parabolas = [];

  let coefficients = [1, 0, 0];
  let isParabolaMode = false;
  let parabolaPoints = [];
  let ws;

  const scale = () => baseScale * zoom;
  const toCanvas = (x, y) => [centerX + x * scale(), centerY - y * scale()];
  const toMath = (cx, cy) => [(cx - centerX) / scale(), (centerY - cy) / scale()];

  function drawGrid() {
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = "#eee";
    ctx.lineWidth = 1;
    const spacing = scale();
    const left = -centerX / spacing;
    const right = (size - centerX) / spacing;
    const top = centerY / spacing;
    const bottom = -(size - centerY) / spacing;

    for (let i = Math.floor(left); i <= right; i++) {
      const x = centerX + i * spacing;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }

    for (let i = Math.floor(bottom); i <= top; i++) {
      const y = centerY - i * spacing;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(size, centerY);
    ctx.stroke();
  }

  function drawParabola(a, b, c, color = "green") {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const step = 0.1 / zoom;
    let started = false;

    for (let x = -centerX / scale(); x <= (size - centerX) / scale(); x += step) {
      const y = a * x * x + b * x + c;
      const [cx, cy] = toCanvas(x, y);
      if (!started) {
        ctx.moveTo(cx, cy);
        started = true;
      } else {
        ctx.lineTo(cx, cy);
      }
    }
    ctx.stroke();
  }

  function fitParabola(points) {
    const [[x1, y1], [x2, y2], [x3, y3]] = points;
    const denom = (x1 - x2) * (x1 - x3) * (x2 - x3);
    if (denom === 0) return null;

    const a = (x3 * (y2 - y1) + x2 * (y1 - y3) + x1 * (y3 - y2)) / denom;
    const b = (x3 ** 2 * (y1 - y2) + x2 ** 2 * (y3 - y1) + x1 ** 2 * (y2 - y3)) / denom;
    const c = (x2 * x3 * (x2 - x3) * y1 +
               x3 * x1 * (x3 - x1) * y2 +
               x1 * x2 * (x1 - x2) * y3) / denom;
    return [a, b, c];
  }

  function drawDot(x, y, color = "red") {
    const [cx, cy] = toCanvas(x, y);
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = "black";
    ctx.font = "12px monospace";
    ctx.fillText(`(${x.toFixed(2)}, ${y.toFixed(2)})`, cx + 5, cy - 5);
  }

  function redraw() {
    drawGrid();
    drawParabola(...coefficients, "blue");
    parabolas.forEach(params => drawParabola(...params, "purple"));
    dots.forEach(dot => drawDot(dot.x, dot.y));
    wsDots.forEach(dot => drawDot(dot.x, dot.y, "green"));
    parabolaDots.forEach(dot => drawDot(dot.x, dot.y, "purple"));
  }

  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const [x, y] = toMath(e.clientX - rect.left, e.clientY - rect.top);

    if (isParabolaMode) {
      parabolaPoints.push([x, y]);
      parabolaDots.push({ x, y });
      if (parabolaPoints.length === 3) {
        const fit = fitParabola(parabolaPoints);
        if (fit) {
          parabolas.push(fit);
        }
        parabolaPoints = [];
      }
      redraw();
      return;
    }

    const yVal = coefficients[0] * x * x + coefficients[1] * x + coefficients[2];
    dots.push({ x, y: yVal });
    redraw();
  });

  document.getElementById("parabolaModeBtn").addEventListener("click", () => {
    isParabolaMode = !isParabolaMode;
    parabolaPoints = [];
    document.getElementById("parabolaModeBtn").textContent = `Parabola Mode: ${isParabolaMode ? "ON" : "OFF"}`;
  });

  document.getElementById("calculateBtn").addEventListener("click", () => {
    const number = parseFloat(document.getElementById("numberInput").value);
    const involutions = parseInt(document.getElementById("involutionsInput").value);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      status.textContent = "Status: WebSocket not connected";
      return;
    }
    if (!number || !involutions) {
      status.textContent = "Status: Missing input values";
      return;
    }
    ws.send(JSON.stringify({ message_type: "calculate", number, involutions }));
    status.textContent = "Status: Calculating...";
  });

  function setupWebSocket() {
    ws = new WebSocket("ws://localhost:4000/");
    ws.onopen = () => status.textContent = "Status: Connected";
    ws.onclose = () => status.textContent = "Status: Disconnected";
    ws.onerror = () => status.textContent = "Status: Error";
    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.message_type === "equation") {
        coefficients = data.coefficients;
        dots = [];
        wsDots = [];
        redraw();
      } else if (data.message_type === "new_dot") {
        const x = Math.round(data.x);
        const y = Math.round(data.y);
        wsDots.push({ x, y });
        redraw();
      }
    };
  }

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    zoom *= e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
    zoom = Math.max(0.1, Math.min(zoom, 10));
    redraw();
  });

  setupWebSocket();
  redraw();
});
