// server/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors()); 

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", 
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('🟢 누군가 화이트보드에 접속했습니다! ID:', socket.id);

  // 선 그리기 신호
  socket.on('draw_line', (data) => {
    socket.broadcast.emit('draw_line', data);
  });

  // 👈 추가된 부분: 전체 지우기 신호를 받으면 다른 사람들에게도 전달
  socket.on('clear_all', () => {
    socket.broadcast.emit('clear_all');
  });

  socket.on('disconnect', () => {
    console.log('🔴 유저가 나갔습니다. ID:', socket.id);
  });
});

server.listen(3001, () => {
  console.log('🚀 소켓 서버가 3001번 포트에서 쌩쌩하게 돌아가는 중!');
});