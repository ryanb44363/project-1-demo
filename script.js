document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("grid");
  const ctx = canvas.getContext("2d");
  const size = canvas.width;

  // Center, scaling, zoom, rotation
  let centerX = size / 2;
  let centerY = size / 2;
  let baseScale = 20;
  let zoom = 1;
  let rotationAngle = 0;

  // Drawing state
  const status = document.getElementById("status");
  let dots = [];
  let wsDots = [];
  let parabolaDots = [];
  let parabolas = [];
  let coefficients = [1, 0, 0];
  let isParabolaMode = false;
  let parabolaPoints = [];
  let ws;

  // Coordinate transforms
  const scale = () => baseScale * zoom;
  const toCanvas = (x, y) => [
    centerX + x * scale(),
    centerY - y * scale()
  ];
  const toMath = (cx, cy) => {
    // undo rotation about center
    const dx = cx - centerX;
    const dy = cy - centerY;
    const cos = Math.cos(-rotationAngle);
    const sin = Math.sin(-rotationAngle);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    const mx = centerX + rx;
    const my = centerY + ry;
    return [
      (mx - centerX) / scale(),
      (centerY - my) / scale()
    ];
  };

  // Draw grid and axes
  function drawGrid() {
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

  // Draw a parabola curve y = a*x^2 + b*x + c
  function drawParabola(a, b, c, color = "green") {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const step = 0.1 / zoom;
    const xmin = -centerX / scale();
    const xmax = (size - centerX) / scale();
    let started = false;
    for (let x = xmin; x <= xmax; x += step) {
      const y = a*x*x + b*x + c;
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

  // Fit a parabola to three points
  function fitParabola(points) {
    const [[x1,y1],[x2,y2],[x3,y3]] = points;
    const denom = (x1-x2)*(x1-x3)*(x2-x3);
    if (denom === 0) return null;
    const a = (x3*(y2-y1) + x2*(y1-y3) + x1*(y3-y2)) / denom;
    const b = (x3**2*(y1-y2) + x2**2*(y3-y1) + x1**2*(y2-y3)) / denom;
    const c = (
      x2*x3*(x2-x3)*y1 +
      x3*x1*(x3-x1)*y2 +
      x1*x2*(x1-x2)*y3
    ) / denom;
    return [a,b,c];
  }

  // Draw a dot with coordinates label
  function drawDot(x, y, color = "red") {
    const [cx, cy] = toCanvas(x, y);
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, 2*Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = "black";
    ctx.font = "12px monospace";
    ctx.fillText(`(${x.toFixed(2)}, ${y.toFixed(2)})`, cx+5, cy-5);
  }

  // Redraw entire canvas with rotation
  function redraw() {
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotationAngle);
    ctx.translate(-centerX, -centerY);

    drawGrid();
    drawParabola(...coefficients, "blue");
    parabolas.forEach(p => drawParabola(...p, "purple"));
    dots.forEach(d => drawDot(d.x, d.y));
    wsDots.forEach(d => drawDot(d.x, d.y, "green"));
    parabolaDots.forEach(d => drawDot(d.x, d.y, "purple"));

    ctx.restore();
  }

  // Handle canvas clicks for plot or fit
  canvas.addEventListener("click", e => {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const [x,y] = toMath(cx, cy);

    if (isParabolaMode) {
      parabolaPoints.push([x,y]);
      parabolaDots.push({x,y});
      if (parabolaPoints.length === 3) {
        const fit = fitParabola(parabolaPoints);
        if (fit) parabolas.push(fit);
        parabolaPoints = [];
      }
    } else {
      const yv = coefficients[0]*x*x + coefficients[1]*x + coefficients[2];
      dots.push({x,y:yv});
    }
    redraw();
  });

  // Toggle parabola-fitting mode
  document.getElementById("parabolaModeBtn").addEventListener("click", () => {
    isParabolaMode = !isParabolaMode;
    parabolaPoints = [];
    document.getElementById("parabolaModeBtn").textContent =
      `Parabola Mode: ${isParabolaMode?"ON":"OFF"}`;
  });

  // Rotate 135° CCW on button click
  document.getElementById("rotateBtn").addEventListener("click", () => {
    rotationAngle = (rotationAngle + 3*Math.PI/4) % (2*Math.PI);
    redraw();
  });

  // Quick-plot example boxes
  document.querySelectorAll('.plot-box').forEach(box => {
    box.addEventListener('click', () => {
      const a = parseFloat(box.dataset.a);
      const b = parseFloat(box.dataset.b);
      const c = parseFloat(box.dataset.c);
      parabolas.push([a,b,c]);
      redraw();
    });
  });

  // Custom parabola form
  document.getElementById("plotCustomBtn").addEventListener("click", () => {
    const a = parseFloat(document.getElementById("aInput").value);
    const b = parseFloat(document.getElementById("bInput").value);
    const c = parseFloat(document.getElementById("cInput").value);
    if (!isNaN(a)&&!isNaN(b)&&!isNaN(c)) {
      parabolas.push([a,b,c]);
      redraw();
    }
  });

  // WebSocket and calculate
  document.getElementById("calculateBtn").addEventListener("click", () => {
    const number = parseFloat(document.getElementById("numberInput").value);
    const involutions = parseInt(document.getElementById("involutionsInput").value);
    if (!ws || ws.readyState!==WebSocket.OPEN) {
      status.textContent="Status: WebSocket not connected";
      return;
    }
    if (!number||!involutions) {
      status.textContent="Status: Missing input values";
      return;
    }
    ws.send(JSON.stringify({message_type:"calculate",number,involutions}));
    status.textContent="Status: Calculating...";
  });

  function setupWebSocket() {
    ws=new WebSocket("ws://localhost:4000/");
    ws.onopen=()=>status.textContent="Status: Connected";
    ws.onclose=()=>status.textContent="Status: Disconnected";
    ws.onerror=()=>status.textContent="Status: Error";
    ws.onmessage=msg=>{
      const data=JSON.parse(msg.data);
      if (data.message_type==="equation") {
        coefficients=data.coefficients;
        dots=[];
        wsDots=[];
        redraw();
      } else if (data.message_type==="new_dot") {
        const x=Math.round(data.x);
        const y=Math.round(data.y);
        wsDots.push({x,y});
        redraw();
      }
    };
  }

  // Zoom on wheel
  canvas.addEventListener("wheel", e=>{
    e.preventDefault();
    const factor=1.1;
    zoom *= e.deltaY<0?factor:1/factor;
    zoom=Math.max(0.1,Math.min(zoom,10));
    redraw();
  });

  setupWebSocket();
  redraw();
});
