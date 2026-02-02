const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { connectToWhatsApp } = require('./src/server/whatsapp');
const { registerHandlers } = require('./src/server/socket');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'dist')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  maxHttpBufferSize: 1e8
});

// Start WhatsApp connection
connectToWhatsApp(io);

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    registerHandlers(io, socket);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;

// Catch-all to serve index.html for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

server.listen(PORT, () => {
    console.log(`Unified Server running on port ${PORT}`);
    console.log(`Access the app at http://localhost:${PORT}`);
});
