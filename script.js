// Get canvas and 2D rendering context
const canvas = document.getElementById("grid");
const ctx = canvas.getContext("2d");
const size = canvas.width;

// Center of canvas and zoom-related variables
let centerX = size / 2;
let centerY = size / 2;
let baseScale = 20; // Base scaling factor (20 pixels per unit)
let zoom = 1;       // Initial zoom level

// UI and state variables
const status = document.getElementById("status");
let dots = [];                // Stores plotted dots
let coefficients = [1, 0, 0]; // Default quadratic: y = x²
let isSelecting = false;     // Selection mode toggle
let selectStart = null;      // Starting point of selection box
let mouseX = 0, mouseY = 0;   // Mouse position
let ws;                      // WebSocket connection

// Get the current scale factor with zoom
const scale = () => baseScale * zoom;

// Convert math (x, y) coordinates to canvas (pixel) coordinates
const toCanvas = (x, y) => [
  centerX + x * scale(),
  centerY - y * scale()
];

// Convert canvas (pixel) coordinates to math (x, y) coordinates
const toMath = (cx, cy) => [
  (cx - centerX) / scale(),
  (centerY - cy) / scale()
];

// Draw grid with axes
const drawGrid = () => {
  ctx.clearRect(0, 0, size, size); // Clear entire canvas
  ctx.strokeStyle = "#eee";       // Light grid lines
  ctx.lineWidth = 1;

  const spacing = scale();
  const left = -centerX / spacing;
  const right = (size - centerX) / spacing;
  const top = centerY / spacing;
  const bottom = - (size - centerY) / spacing;

  // Vertical lines
  for (let i = Math.floor(left); i <= right; i++) {
    const x = centerX + i * spacing;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }

  // Horizontal lines
  for (let i = Math.floor(bottom); i <= top; i++) {
    const y = centerY - i * spacing;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  // Draw X and Y axes in bold
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1.5;

  ctx.beginPath(); // Y-axis
  ctx.moveTo(centerX, 0);
  ctx.lineTo(centerX, size);
  ctx.stroke();

  ctx.beginPath(); // X-axis
  ctx.moveTo(0, centerY);
  ctx.lineTo(size, centerY);
  ctx.stroke();
};

// Plot the quadratic curve based on current coefficients
const drawEquation = () => {
  const [a, b, c] = coefficients;
  ctx.strokeStyle = "#00f";
  ctx.lineWidth = 2;
  ctx.beginPath();

  const start = toMath(0, 0)[0];
  const end = toMath(size, 0)[0];

  for (let i = start; i <= end; i += 0.1 / zoom) {
    const x = i;
    const y = a * x * x + b * x + c;
    const [cx, cy] = toCanvas(x, y);
    if (i === start) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  }

  ctx.stroke();
};

// Draw a single dot
const drawDot = (x, y, label = "", isSelected = false) => {
  const [cx, cy] = toCanvas(x, y);
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
  ctx.fillStyle = isSelected ? "lime" : "red";
  ctx.fill();

  if (label) {
    ctx.fillStyle = "#000";
    ctx.font = "14px sans-serif";
    ctx.fillText(label, cx + 8, cy - 8);
  }
};

// Draw all dots from the array
const drawAllDots = () => {
  for (let dot of dots) {
    drawDot(dot.x, dot.y, dot.label, dot.selected);
  }
};

// Draw a green dashed selection box
const drawSelectionBox = () => {
  if (!isSelecting || !selectStart) return;
  const [x1, y1] = selectStart;
  const [x2, y2] = [mouseX, mouseY];
  ctx.strokeStyle = "green";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 2]);
  ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  ctx.setLineDash([]);
};

// Redraw everything
const redraw = () => {
  drawGrid();
  drawEquation();
  drawAllDots();
  drawSelectionBox();
};

// Begin selection on mouse down
canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  selectStart = [e.clientX - rect.left, e.clientY - rect.top];
  isSelecting = true;
});

// Track mouse position and update selection box
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
  if (isSelecting) redraw();
});

// Complete selection on mouse up
canvas.addEventListener("mouseup", (e) => {
  if (isSelecting) {
    const rect = canvas.getBoundingClientRect();
    const [x1, y1] = selectStart;
    const [x2, y2] = [e.clientX - rect.left, e.clientY - rect.top];
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    const selected = [];
    for (let dot of dots) {
      const [cx, cy] = toCanvas(dot.x, dot.y);
      if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
        dot.selected = true;
        selected.push(dot.label);
      } else {
        dot.selected = false;
      }
    }

    if (ws && selected.length > 0) {
      ws.send(JSON.stringify({ message_type: "selection", selected }));
    }

    isSelecting = false;
    selectStart = null;
    redraw();
  }
});

// Add a dot to the curve on canvas click
canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const canvasX = e.clientX - rect.left;
  const canvasY = e.clientY - rect.top;

  const [rawMathX, _] = toMath(canvasX, canvasY);
  const mathX = Math.round(rawMathX);
  const y = coefficients[0] * mathX * mathX + coefficients[1] * mathX + coefficients[2];

  dots.push({
    x: mathX,
    y: y,
    label: `(${mathX}, ${y.toFixed(2)})`,
    selected: false
  });

  redraw();
});

// Zoom in/out on mouse wheel
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const zoomFactor = 1.1;
  const prevZoom = zoom;
  zoom *= e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
  zoom = Math.max(0.1, Math.min(zoom, 10));

  // Keep zoom centered at cursor
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const [mathX, mathY] = toMath(mouseX, mouseY);

  centerX = mouseX - mathX * scale();
  centerY = mouseY + mathY * scale();

  redraw();
});

// Set up WebSocket communication with server
const setupWebSocket = () => {
  ws = new WebSocket("ws://localhost:4000/");
  ws.onopen = () => status.textContent = "Status: Connected";
  ws.onclose = () => status.textContent = "Status: Disconnected";
  ws.onerror = () => status.textContent = "Status: Error";

  // Handle incoming WebSocket messages
  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.message_type === "equation") {
      coefficients = data.coefficients;
      dots = [];
      redraw();
    } else if (data.message_type === "new_dot") {
      const x = Math.round(data.x);
      const y = Math.round(data.y);
      dots.push({ x, y, label: `(${x}, ${y})`, selected: false });
      redraw();
    }
  };
};

// Handle click on "Calculate" button
document.getElementById("calculateBtn").addEventListener("click", () => {
  const number = parseFloat(document.getElementById("numberInput").value);
  const involutions = parseInt(document.getElementById("involutionsInput").value);

  if (ws && number && involutions) {
    ws.send(JSON.stringify({
      message_type: "calculate",
      number,
      involutions
    }));
    status.textContent = "Status: Calculating...";
  }
});

// Utility menu actions
window.deleteSelected = function () {
  dots = dots.filter(dot => !dot.selected);
  redraw();
};

window.highlightSelected = function () {
  for (let dot of dots) {
    if (dot.selected) dot.label += " ★";
  }
  redraw();
};

window.deselectAll = function () {
  for (let dot of dots) {
    dot.selected = false;
  }
  redraw();
};

window.logSelected = function () {
  const selected = dots.filter(dot => dot.selected);
  console.log("Selected Dots:", selected);
};

// Initial draw
drawGrid();
drawEquation();
setupWebSocket();