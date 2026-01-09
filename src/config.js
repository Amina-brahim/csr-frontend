// config.js
const config = {
  production: {
    apiUrl: "https://csr-serveur-backend.onrender.com",
    socketUrl: "https://csr-serveur-backend.onrender.com", // IMPORTANT: https:// pas wss://
    enableSockets: true,
    socketOptions: {
      transports: ['polling', 'websocket'],
      timeout: 30000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    }
  },
  development: {
    apiUrl: "http://localhost:4600",
    socketUrl: "http://localhost:4600",
    enableSockets: true,
    socketOptions: {
      transports: ['polling', 'websocket'],
      timeout: 30000,
      reconnection: true
    }
  }
};

const environment = process.env.NODE_ENV || 'production';
export default config[environment];
