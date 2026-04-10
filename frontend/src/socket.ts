import { io } from "socket.io-client";

console.log("Connecting to WebSocket server at " + import.meta.env.VITE_API_URL);

export const socket = io(import.meta.env.VITE_API_URL, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  transports: ["websocket", "polling"]
});

socket.on("connect", () => {
  console.log("WebSocket connected:", socket.id);
});

socket.on("connect_error", (error) => {
  console.error("WebSocket connection error:", error);
});

socket.on("disconnect", () => {
  console.log("WebSocket disconnected");
});
