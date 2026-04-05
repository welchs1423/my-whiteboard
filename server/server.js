const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "http://localhost:5173", methods: ["GET", "POST"] }
});

mongoose.connect('mongodb://localhost:27017/whiteboard_db')
  .then(() => console.log('MongoDB Connected!'))
  .catch(err => console.error('DB Connection Error:', err));

const BoardSchema = new mongoose.Schema({
  room: { type: String, required: true },
  elements: Array,
  updatedAt: { type: Date, default: Date.now }
});
const Board = mongoose.model('Board', BoardSchema);

let users = {};
let roomElements = {};
let saveTimeouts = {};

const debouncedSave = (room) => {
  if (saveTimeouts[room]) clearTimeout(saveTimeouts[room]);
  saveTimeouts[room] = setTimeout(async () => {
    try {
      await Board.findOneAndUpdate(
        { room },
        { elements: roomElements[room] || [], updatedAt: Date.now() },
        { upsert: true }
      );
    } catch (err) { console.error('DB Save Error:', err); }
  }, 2000);
};

io.on('connection', (socket) => {
  // 방 접속 처리
  socket.on('join_room', async ({ nickname, room }) => {
    socket.join(room);
    users[socket.id] = { nickname, room };

    if (!roomElements[room]) {
      const savedData = await Board.findOne({ room });
      roomElements[room] = savedData ? savedData.elements : [];
    }
    
    socket.emit('draw_line', roomElements[room]);

    const roomUsers = Object.entries(users)
      .filter(([_, u]) => u.room === room)
      .map(([id, u]) => ({ id, nickname: u.nickname }));
      
    io.to(room).emit('user_list', roomUsers);
    socket.to(room).emit('user_joined', nickname);
  });

  socket.on('draw_line', (data) => {
    const user = users[socket.id];
    if (!user) return;
    socket.to(user.room).emit('draw_line', data);
    roomElements[user.room] = data;
    debouncedSave(user.room);
  });

  socket.on('update_element', (el) => {
    const user = users[socket.id];
    if (!user) return;
    socket.to(user.room).emit('update_element', el);
    
    if (!roomElements[user.room]) roomElements[user.room] = [];
    const idx = roomElements[user.room].findIndex(e => e.id === el.id);
    if (idx !== -1) roomElements[user.room][idx] = el;
    else roomElements[user.room].push(el);
    
    debouncedSave(user.room);
  });

  socket.on('clear_all', () => {
    const user = users[socket.id];
    if (!user) return;
    socket.to(user.room).emit('clear_all');
    roomElements[user.room] = [];
    debouncedSave(user.room);
  });

  socket.on('cursor_move', (pos) => {
    const user = users[socket.id];
    if (user) socket.to(user.room).emit('cursor_move', { id: socket.id, x: pos.x, y: pos.y, nickname: user.nickname });
  });

  socket.on('typing', (nickname) => {
    const user = users[socket.id];
    if (user) socket.to(user.room).emit('typing', nickname);
  });

  socket.on('stop_typing', (nickname) => {
    const user = users[socket.id];
    if (user) socket.to(user.room).emit('stop_typing', nickname);
  });

  socket.on('send_message', (messageData) => {
    const user = users[socket.id];
    if (user) io.to(user.room).emit('receive_message', messageData);
  });

  socket.on('viewport_update', (data) => {
    const user = users[socket.id];
    if (user) socket.to(user.room).emit('viewport_update', { id: socket.id, nickname: user.nickname, scale: data.scale, x: data.x, y: data.y });
  });

  socket.on('emoji_reaction', (data) => {
    const user = users[socket.id];
    if (user) io.to(user.room).emit('emoji_reaction', { id: data.id, x: data.x, y: data.y, emoji: data.emoji, nickname: user.nickname });
  });

  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      delete users[socket.id];
      const roomUsers = Object.entries(users)
        .filter(([_, u]) => u.room === user.room)
        .map(([id, u]) => ({ id, nickname: u.nickname }));
        
      io.to(user.room).emit('user_list', roomUsers);
      io.to(user.room).emit('cursor_leave', socket.id);
      socket.to(user.room).emit('user_left', user.nickname);
    }
  });
});

server.listen(3001, () => {
  console.log('Socket server is running on port 3001');
});