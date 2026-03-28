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

let users = {};

io.on('connection', (socket) => {
  users[socket.id] = `User-${socket.id.substring(0, 4)}`;
  io.emit('user_list', Object.values(users));

  // 닉네임 설정 이벤트 처리
  socket.on('set_nickname', (nickname) => {
    users[socket.id] = nickname;
    io.emit('user_list', Object.values(users));
  });

  socket.on('draw_line', (data) => {
    socket.broadcast.emit('draw_line', data);
  });

  socket.on('clear_all', () => {
    socket.broadcast.emit('clear_all');
  });

  socket.on('disconnect', () => {
    delete users[socket.id];
    io.emit('user_list', Object.values(users));
  });

   socket.on('send_message', (messageData) => {
  // messageData 예시: { text: "안녕하세요", sender: "User-abcd", time: "21:05" }
  // 본인을 포함한 모두에게 메시지를 전달합니다.
  io.emit('receive_message', messageData);
});
});

server.listen(3001, () => {
  console.log('Socket server is running on port 3001');
});