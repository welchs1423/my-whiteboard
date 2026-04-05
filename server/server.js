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
  io.emit('user_list', Object.entries(users).map(([id, nickname]) => ({ id, nickname })));

  // 닉네임 설정
  socket.on('set_nickname', (nickname) => {
    users[socket.id] = nickname;
    io.emit('user_list', Object.entries(users).map(([id, n]) => ({ id, nickname: n })));
    socket.broadcast.emit('user_joined', nickname);
  });

  // 드로잉
  socket.on('draw_line', (data) => {
    socket.broadcast.emit('draw_line', data);
  });

  socket.on('clear_all', () => {
    socket.broadcast.emit('clear_all');
  });

  // 실시간 커서 위치 공유
  socket.on('cursor_move', (pos) => {
    socket.broadcast.emit('cursor_move', {
      id: socket.id,
      x: pos.x,
      y: pos.y,
      nickname: users[socket.id],
    });
  });

  // 채팅 입력 중 표시
  socket.on('typing', (nickname) => {
    socket.broadcast.emit('typing', nickname);
  });

  socket.on('stop_typing', (nickname) => {
    socket.broadcast.emit('stop_typing', nickname);
  });

  // 채팅 메시지
  socket.on('send_message', (messageData) => {
    io.emit('receive_message', messageData);
  });

  // 연결 해제
  // 뷰포트 공유 (Follow Me)
  socket.on('viewport_update', (data) => {
    socket.broadcast.emit('viewport_update', {
      id: socket.id,
      nickname: users[socket.id],
      scale: data.scale,
      x: data.x,
      y: data.y,
    });
  });

  // 이모지 반응 (Cursor Chat)
  socket.on('emoji_reaction', (data) => {
    io.emit('emoji_reaction', {
      id: data.id,
      x: data.x,
      y: data.y,
      emoji: data.emoji,
      nickname: users[socket.id],
    });
  });

  socket.on('disconnect', () => {
    const leftNickname = users[socket.id];
    delete users[socket.id];
    io.emit('user_list', Object.entries(users).map(([id, n]) => ({ id, nickname: n })));
    io.emit('cursor_leave', socket.id); // 커서 제거 알림
    if (leftNickname) socket.broadcast.emit('user_left', leftNickname);
  });
});

server.listen(3001, () => {
  console.log('Socket server is running on port 3001');
});
