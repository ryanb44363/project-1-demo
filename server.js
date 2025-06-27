// Import the WebSocket and File System modules
const WebSocket = require("ws");
const fs = require("fs");

// Create a WebSocket server that listens on port 4000
const server = new WebSocket.Server({ port: 4000 });
console.log("WebSocket server running on ws://localhost:4000");

// Event: When a new client connects to the server
server.on("connection", (ws) => {
  console.log("Client connected");

  // Event: When the server receives a message from the client
  ws.on("message", (message) => {
    try {
      // Parse the incoming JSON message
      const data = JSON.parse(message);

      // Handle "calculate" message type from the client
      if (data.message_type === "calculate") {
        // Parse the input number and involution count
        const number = parseFloat(data.number);
        const involutions = parseInt(data.involutions);

        // Validate the parsed values
        if (isNaN(number) || isNaN(involutions)) {
          ws.send(JSON.stringify({ message_type: "error", message: "Invalid input" }));
          return;
        }

        // Define coefficients for a quadratic equation: y = ax² + bx + c
        const a = 1;
        const b = -number;
        const c = number / 2;

        // Send the equation coefficients back to the client
        const equation = [a, b, c];
        ws.send(JSON.stringify({ message_type: "equation", coefficients: equation }));

        // Generate "involutions" number of dots along the curve
        const dots = [];
        for (let i = 0; i < involutions; i++) {
          const x = i - Math.floor(involutions / 2); // Center the dots around x=0
          const y = a * x * x + b * x + c;           // Evaluate y using the quadratic formula
          dots.push({ x, y, label: `Dot ${i + 1}` }); // Create labeled dot
        }

        // Send each generated dot to the client
        dots.forEach(dot => {
          ws.send(JSON.stringify({
            message_type: "new_dot",
            x: dot.x,
            y: dot.y,
            label: dot.label
          }));
        });

      // Handle selection messages from the client
      } else if (data.message_type === "selection") {
        console.log("Selected dots:", data.selected); // Log the selected dot coordinates
      }

    } catch (e) {
      // If parsing or processing fails, log the error and notify the client
      console.error("Error parsing message:", e);
      ws.send(JSON.stringify({ message_type: "error", message: "Internal server error" }));
    }
  });

  // Event: When a client disconnects from the server
  ws.on("close", () => {
    console.log("Client disconnected");
  });
});