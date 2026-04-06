require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '파일이 없습니다.' });
  const host = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3001}`;
  const imageUrl = `${host}/uploads/${req.file.filename}`;
  res.json({ url: imageUrl });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', methods: ['GET', 'POST'] }
});

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/whiteboard_db')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const BoardSchema = new mongoose.Schema({
  room: { type: String, required: true },
  elements: Array,
  updatedAt: { type: Date, default: Date.now }
});
const Board = mongoose.model('Board', BoardSchema);

let users = {};
let roomElements = {};
let saveTimeouts = {};
let roomHosts = {};       // { room: socketId }
let roomPermissions = {}; // { room: { socketId: 'edit' | 'view' } }
let roomTimelines = {};   // { room: TimelineEvent[] }
let voiceRooms = {};      // { room: Set<socketId> }

const debouncedSave = (room) => {
  if (saveTimeouts[room]) clearTimeout(saveTimeouts[room]);
  saveTimeouts[room] = setTimeout(async () => {
    try {
      await Board.findOneAndUpdate(
        { room }, { elements: roomElements[room] || [], updatedAt: Date.now() }, { upsert: true }
      );
    } catch (err) {
      console.error('DB save error:', err);
    }
  }, 2000);
};

io.on('connection', (socket) => {
  socket.on('join_room', async ({ nickname, room, isAnonymous }) => {
    try {
      socket.join(room);
      const displayName = isAnonymous ? `익명${nickname.slice(2)}` : nickname;
      users[socket.id] = { nickname: displayName, room, isAnonymous: !!isAnonymous };

      if (!roomElements[room]) {
        const savedData = await Board.findOne({ room });
        roomElements[room] = savedData ? savedData.elements : [];
      }

      // Assign host to first user in the room
      if (!roomHosts[room]) {
        roomHosts[room] = socket.id;
        if (!roomPermissions[room]) roomPermissions[room] = {};
      }
      if (!roomPermissions[room]) roomPermissions[room] = {};
      roomPermissions[room][socket.id] = 'edit';
      if (!roomTimelines[room]) roomTimelines[room] = [];

      socket.emit('draw_line', roomElements[room]);
      const roomUsers = Object.entries(users)
        .filter(([, u]) => u.room === room)
        .map(([id, u]) => ({ id, nickname: u.nickname }));
      io.to(room).emit('user_list', roomUsers);
      io.to(room).emit('room_host', roomHosts[room]);
      io.to(room).emit('room_permissions', roomPermissions[room]);
      socket.to(room).emit('user_joined', nickname);
    } catch (err) {
      console.error('join_room error:', err);
    }
  });

  socket.on('draw_line', (data) => {
    const user = users[socket.id];
    if (!user) return;
    if (roomPermissions[user.room]?.[socket.id] === 'view') return;
    socket.to(user.room).emit('draw_line', data);
    roomElements[user.room] = data;
    if (!roomTimelines[user.room]) roomTimelines[user.room] = [];
    roomTimelines[user.room].push({ timestamp: Date.now(), type: 'update', snapshot: [...data], nickname: user.nickname });
    if (roomTimelines[user.room].length > 500) roomTimelines[user.room] = roomTimelines[user.room].slice(-500);
    debouncedSave(user.room);
  });

  socket.on('update_element', (el) => {
    const user = users[socket.id];
    if (!user) return;
    if (roomPermissions[user.room]?.[socket.id] === 'view') return;
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
    if (roomPermissions[user.room]?.[socket.id] === 'view') return;
    socket.to(user.room).emit('clear_all');
    roomElements[user.room] = [];
    if (!roomTimelines[user.room]) roomTimelines[user.room] = [];
    roomTimelines[user.room].push({ timestamp: Date.now(), type: 'clear', snapshot: [] });
    debouncedSave(user.room);
  });

  // Permission management (host only)
  socket.on('set_permission', ({ targetId, permission }) => {
    const user = users[socket.id];
    if (!user || roomHosts[user.room] !== socket.id) return;
    if (!roomPermissions[user.room]) roomPermissions[user.room] = {};
    roomPermissions[user.room][targetId] = permission;
    io.to(user.room).emit('room_permissions', roomPermissions[user.room]);
  });

  socket.on('transfer_host', ({ targetId }) => {
    const user = users[socket.id];
    if (!user || roomHosts[user.room] !== socket.id) return;
    roomHosts[user.room] = targetId;
    io.to(user.room).emit('room_host', targetId);
  });

  socket.on('request_timeline', () => {
    const user = users[socket.id];
    if (!user) return;
    socket.emit('timeline_data', roomTimelines[user.room] || []);
  });

  // WebRTC voice signaling
  socket.on('voice_join', ({ room }) => {
    if (!voiceRooms[room]) voiceRooms[room] = new Set();
    const user = users[socket.id];
    if (!user) return;
    voiceRooms[room].forEach(peerId => {
      io.to(peerId).emit('voice_user_joined', { id: socket.id, nickname: user.nickname });
    });
    voiceRooms[room].add(socket.id);
  });

  socket.on('voice_leave', ({ room }) => {
    if (voiceRooms[room]) {
      voiceRooms[room].delete(socket.id);
      socket.to(room).emit('voice_user_left', { id: socket.id });
    }
  });

  socket.on('voice_offer', ({ to, offer }) => {
    const user = users[socket.id];
    if (!user) return;
    io.to(to).emit('voice_offer', { from: socket.id, offer, nickname: user.nickname });
  });

  socket.on('voice_answer', ({ to, answer }) => {
    io.to(to).emit('voice_answer', { from: socket.id, answer });
  });

  socket.on('voice_ice_candidate', ({ to, candidate }) => {
    io.to(to).emit('voice_ice_candidate', { from: socket.id, candidate });
  });

  socket.on('voice_mute', ({ room, muted }) => {
    socket.to(room).emit('voice_mute_update', { id: socket.id, muted });
  });

  // Laser pointer relay
  socket.on('laser_move', ({ x, y }) => {
    const user = users[socket.id];
    if (user) socket.to(user.room).emit('laser_move', { id: socket.id, x, y, nickname: user.nickname });
  });
  socket.on('laser_stop', () => {
    const user = users[socket.id];
    if (user) socket.to(user.room).emit('laser_stop', { id: socket.id });
  });

  // Presentation frame sync
  socket.on('presenting_frame', ({ frameId }) => {
    const user = users[socket.id];
    if (user) socket.to(user.room).emit('presenting_frame', { frameId, presenter: user.nickname });
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

  // Direct message (whisper)
  socket.on('dm_message', (data) => {
    const user = users[socket.id];
    if (!user) return;
    io.to(data.to).emit('receive_dm', { from: user.nickname, text: data.text, fromId: socket.id });
  });

  // Live editing indicator
  socket.on('element_editing', ({ elementId }) => {
    const user = users[socket.id];
    if (!user) return;
    socket.to(user.room).emit('element_editing', { elementId, nickname: user.nickname, color: '#f97316', userId: socket.id });
  });
  socket.on('element_edit_stop', ({ elementId }) => {
    const user = users[socket.id];
    if (!user) return;
    socket.to(user.room).emit('element_edit_stop', { elementId, userId: socket.id });
  });

  // Timer sync
  socket.on('timer_sync', (timerState) => {
    const user = users[socket.id];
    if (!user) return;
    socket.to(user.room).emit('timer_sync', timerState);
  });

  // WebRTC screen share signaling
  socket.on('screen_share_start', ({ room }) => {
    const user = users[socket.id];
    if (!user) return;
    socket.to(room).emit('screen_share_started', { id: socket.id, nickname: user.nickname });
  });
  socket.on('screen_share_stop', ({ room }) => {
    const user = users[socket.id];
    if (!user) return;
    socket.to(room).emit('screen_share_stopped', { id: socket.id });
  });
  socket.on('screen_offer', ({ to, offer }) => {
    const user = users[socket.id];
    if (!user) return;
    io.to(to).emit('screen_offer', { from: socket.id, offer, nickname: user.nickname });
  });
  socket.on('screen_answer', ({ to, answer }) => {
    io.to(to).emit('screen_answer', { from: socket.id, answer });
  });
  socket.on('screen_ice', ({ to, candidate }) => {
    io.to(to).emit('screen_ice', { from: socket.id, candidate });
  });

  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      // Clean up voice chat
      if (voiceRooms[user.room]) {
        voiceRooms[user.room].delete(socket.id);
        socket.to(user.room).emit('voice_user_left', { id: socket.id });
      }
      // Transfer host to next user if needed
      if (roomHosts[user.room] === socket.id) {
        const remaining = Object.entries(users).filter(([id, u]) => id !== socket.id && u.room === user.room);
        if (remaining.length > 0) {
          roomHosts[user.room] = remaining[0][0];
          io.to(user.room).emit('room_host', remaining[0][0]);
        } else {
          delete roomHosts[user.room];
        }
      }
      if (roomPermissions[user.room]) delete roomPermissions[user.room][socket.id];
      delete users[socket.id];
      const roomUsers = Object.entries(users)
        .filter(([, u]) => u.room === user.room)
        .map(([id, u]) => ({ id, nickname: u.nickname }));
      io.to(user.room).emit('user_list', roomUsers);
      io.to(user.room).emit('cursor_leave', socket.id);
      socket.to(user.room).emit('user_left', user.nickname);
      io.to(user.room).emit('room_permissions', roomPermissions[user.room] || {});
    }
  });
});

server.listen(process.env.PORT || 3001, () =>
  console.log(`Socket server running on port ${process.env.PORT || 3001}`)
);
