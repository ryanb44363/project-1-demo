document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("grid");
  const ctx = canvas.getContext("2d");
  const size = canvas.width;

  // Center, scale, zoom
  let centerX = size / 2, centerY = size / 2;
  let baseScale = 20, zoom = 1;

  // Rotation constants for 135° Clockwise
  const theta = -3 * Math.PI / 4; // 135° CW
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);

  // State
  const status = document.getElementById("status");
  const demoLog = document.getElementById("demoLog");
  let dots = [], wsDots = [], parabolaDots = [], parabolas = [];
  let coefficients = [1, 0, 0];
  let isParabolaMode = false, parabolaPoints = [];
  let rotatedSamplePoints = []; // {x, y, color}

  // Coordinate transforms
  const scale = () => baseScale * zoom;
  const toCanvas = (x, y) => [centerX + x * scale(), centerY - y * scale()];
  const toMath = (cx, cy) => {
    const dx = cx - centerX, dy = cy - centerY;
    return [dx / scale(), -dy / scale()];
  };

  // Draw grid & axes
  function drawGrid() {
    ctx.strokeStyle = "#eee"; ctx.lineWidth = 1;
    const s = scale();
    const left = -centerX / s, right = (size - centerX) / s;
    const top = centerY / s, bottom = -(size - centerY) / s;
    for (let i = Math.floor(left); i <= right; i++) {
      const x = centerX + i * s;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
    }
    for (let i = Math.floor(bottom); i <= top; i++) {
      const y = centerY - i * s;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
    }
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(centerX, 0); ctx.lineTo(centerX, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, centerY); ctx.lineTo(size, centerY); ctx.stroke();
  }

  // Apply 135° CW rotation and mirror over the Y-axis (display transform)
  function rotatePoint(x, y) {
    const rx = cosTheta * x - sinTheta * y;
    const ry = sinTheta * x + cosTheta * y;
    return [-rx, ry];
  }

  // Inverse of rotatePoint: undo mirror, then rotate back by -theta (math <- display)
  function invRotatePoint(X, Y) {
    const rx = -X; // undo mirror on X
    const ry =  Y;
    const x =  cosTheta * rx + sinTheta * ry;
    const y = -sinTheta * rx + cosTheta * ry;
    return [x, y];
  }

  // Draw continuous rotated parabola
  function drawParabola(a, b, c, color = "green") {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const step = 0.1 / zoom;
    const xmin = -centerX / scale(), xmax = (size - centerX) / scale();
    let started = false;
    for (let x = xmin; x <= xmax; x += step) {
      const y = a * x * x + b * x + c; // math frame
      const [rx, ry] = rotatePoint(x, y); // to display frame
      const [cx, cy] = toCanvas(rx, ry);
      if (!started) {
        ctx.moveTo(cx, cy);
        started = true;
      } else {
        ctx.lineTo(cx, cy);
      }
    }
    ctx.stroke();
  }

  // Fit parabola to 3 points (math frame)
  function fitParabola(pts) {
    const [[x1, y1], [x2, y2], [x3, y3]] = pts;
    const denom = (x1 - x2) * (x1 - x3) * (x2 - x3);
    if (!denom) return null;
    const a = (x3 * (y2 - y1) + x2 * (y1 - y3) + x1 * (y3 - y2)) / denom;
    const b = (x3 ** 2 * (y1 - y2) + x2 ** 2 * (y3 - y1) + x1 ** 2 * (y2 - y3)) / denom;
    const c = (
      x2 * x3 * (x2 - x3) * y1 +
      x3 * x1 * (x3 - x1) * y2 +
      x1 * x2 * (x1 - x2) * y3
    ) / denom;
    return [a, b, c];
  }

  // Draw a labeled dot (expects display-frame coordinates)
  function drawDot(x, y, color = "red") {
    const [cx, cy] = toCanvas(x, y);
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = "black";
    ctx.font = "12px monospace";
    ctx.fillText(`(${x.toFixed(2)},${y.toFixed(2)})`, cx + 5, cy - 5);
  }

  // Full redraw
  function redraw() {
    ctx.clearRect(0, 0, size, size);
    drawGrid();
    drawParabola(...coefficients, "blue");
    parabolas.forEach(p => drawParabola(...p, "purple"));
    dots.forEach(d => drawDot(d.x, d.y));
    wsDots.forEach(d => drawDot(d.x, d.y, "green"));
    parabolaDots.forEach(d => drawDot(d.x, d.y, "purple"));
    rotatedSamplePoints.forEach(d => drawDot(d.x, d.y, d.color));
  }

  // Canvas click handler — convert display->math for computation, then back to display for drawing
  canvas.addEventListener("click", e => {
    const rect = canvas.getBoundingClientRect();

    // Coordinates in display frame from the canvas pixels
    const [dispX, dispY] = toMath(e.clientX - rect.left, e.clientY - rect.top);

    // Convert click to math frame used by coefficients/parabola fitting
    const [mx, my] = invRotatePoint(dispX, dispY);

    if (isParabolaMode) {
      // Use math-frame points for the fit, but show dots where the user clicked (display frame)
      parabolaPoints.push([mx, my]);
      parabolaDots.push({ x: dispX, y: dispY });
      if (parabolaPoints.length === 3) {
        const fit = fitParabola(parabolaPoints);
        if (fit) parabolas.push(fit); // drawParabola rotates for display
        parabolaPoints = [];
      }
    } else {
      // Snap to current parabola: compute y in math frame at clicked math x, then rotate to display for drawing
      const yv = coefficients[0] * mx * mx + coefficients[1] * mx + coefficients[2];
      const [dx, dy] = rotatePoint(mx, yv);
      dots.push({ x: dx, y: dy });
    }
    redraw();
  });

  // Controls
  document.getElementById("parabolaModeBtn")
    .addEventListener("click", () => {
      isParabolaMode = !isParabolaMode;
      parabolaPoints = [];
      document.getElementById("parabolaModeBtn")
        .textContent = `Parabola Mode: ${isParabolaMode ? "ON" : "OFF"}`;
    });

  // Trial & Plot demo (135° CW)
  document.getElementById("trialPlotBtn")
    .addEventListener("click", () => {
      const btn = document.getElementById("trialPlotBtn");
      btn.disabled = true;
      rotatedSamplePoints = [];
      demoLog.innerHTML = "";
      redraw();

      const log = msg => {
        const div = document.createElement("div");
        div.textContent = msg;
        demoLog.appendChild(div);
        demoLog.scrollTop = demoLog.scrollHeight;
      };

      log("Demo started: sampling x=0…5 and rotating each point by 135° CW…");

      [0, 1, 2, 3, 4, 5].forEach((x, i) => {
        setTimeout(() => {
          const y = x * x;
          const [rx, ry] = rotatePoint(x, y);
          rotatedSamplePoints.push({ x: rx, y: ry, color: "orange" });
          redraw();
          log(`Step ${i + 1}: (x,y)=(${x},${y}) → rotated→ (${rx.toFixed(3)}, ${ry.toFixed(3)})`);

          if (i === 5) {
            setTimeout(() => {
              const x0 = 5, y0 = 25;
              const [rx0, ry0] = rotatePoint(x0, y0);
              rotatedSamplePoints.push({ x: rx0, y: ry0, color: "red" });
              redraw();
              log(`Test vector: [5,25] → rotated→ (${rx0.toFixed(3)}, ${ry0.toFixed(3)})`);
              log("Demo complete.");
              btn.disabled = false;
            }, 1000);
          }
        }, i * 1000);
      });
    });

  // Quick-plot boxes
  document.querySelectorAll('.plot-box').forEach(box => {
    box.addEventListener("click", () => {
      const a = parseFloat(box.dataset.a),
        b = parseFloat(box.dataset.b),
        c = parseFloat(box.dataset.c);
      parabolas.push([a, b, c]);
      redraw();
    });
  });

  // Custom plot form
  document.getElementById("plotCustomBtn")
    .addEventListener("click", () => {
      const a = parseFloat(document.getElementById("aInput").value),
        b = parseFloat(document.getElementById("bInput").value),
        c = parseFloat(document.getElementById("cInput").value);
      if (!isNaN(a) && !isNaN(b) && !isNaN(c)) {
        parabolas.push([a, b, c]);
        redraw();
      }
    });

  // WebSocket calculation
  document.getElementById("calculateBtn")
    .addEventListener("click", () => {
      const number = parseFloat(document.getElementById("numberInput").value);
      const involutions = parseInt(document.getElementById("involutionsInput").value);
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        status.textContent = "Status: WebSocket not connected";
        return;
      }
      if (isNaN(number) || isNaN(involutions)) {
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
    ws.onmessage = msg => {
      const data = JSON.parse(msg.data);
      if (data.message_type === "equation") {
        coefficients = data.coefficients;
        dots = []; wsDots = []; redraw();
      } else if (data.message_type === "new_dot") {
        // server sends math-frame points; rotate to display frame before drawing
        const x = Math.round(data.x), y = Math.round(data.y);
        const [dx, dy] = rotatePoint(x, y);
        wsDots.push({ x: dx, y: dy });
        redraw();
      }
    };
  }

  // Zoom on wheel
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    const factor = 1.1;
    zoom *= e.deltaY < 0 ? factor : 1 / factor;
    zoom = Math.max(0.1, Math.min(zoom, 10));
    redraw();
  });

  setupWebSocket();
  redraw();
});
