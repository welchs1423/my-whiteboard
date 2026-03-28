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
    origin: "http://localhost:5173", // 리액트 주소 허용
    methods: ["GET", "POST"]
  }
});

// 👈 1. 현재 접속 중인 유저 정보를 담을 객체 (Key: Socket ID, Value: User Name)
let users = {};

io.on('connection', (socket) => {
  // 👈 2. 새로운 유저가 들어오면, Socket ID로 기본 닉네임을 생성해서 저장
  console.log('🟢 누군가 화이트보드에 접속했습니다! ID:', socket.id);
  users[socket.id] = `User-${socket.id.substring(0, 4)}`; // ID 앞 4글자만 따서 User-xxxx 형태로 이름 지음

  // 👈 3. 저장된 전체 유저 목록을 모든 접속자에게 전송(방송)
  io.emit('user_list', Object.values(users));


  // 선 그리기 신호
  socket.on('draw_line', (data) => {
    socket.broadcast.emit('draw_line', data);
  });

  // 전체 지우기 신호
  socket.on('clear_all', () => {
    socket.broadcast.emit('clear_all');
  });


  // 👈 4. 유저가 나갔을 때
  socket.on('disconnect', () => {
    console.log('🔴 유저가 나갔습니다. ID:', socket.id);
    delete users[socket.id]; // 4-1. 유저 목록에서 제거
    io.emit('user_list', Object.values(users)); // 4-2. 최신 유저 목록을 다시 방송
  });
});

server.listen(3001, () => {
  console.log('🚀 소켓 서버가 3001번 포트에서 쌩쌩하게 돌아가는 중!');
});