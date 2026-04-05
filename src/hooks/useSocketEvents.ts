import { useEffect, type MutableRefObject } from 'react';
import type { Socket } from 'socket.io-client';
import type { DrawElement } from '../utils/elementHelpers';

interface CursorData { x: number; y: number; nickname: string; }
interface ChatMessage { text: string; sender: string; time: string; }
interface Toast { id: string; message: string; type: 'join' | 'leave' | 'info'; }
interface UserInfo { id: string; nickname: string; }
interface EmojiReaction { id: string; x: number; y: number; emoji: string; nickname: string; }
interface UserViewport { scale: number; x: number; y: number; nickname: string; }

interface UseSocketEventsParams {
  socket: Socket;
  setElements: React.Dispatch<React.SetStateAction<DrawElement[]>>;
  setSelectedIndices: React.Dispatch<React.SetStateAction<Set<number>>>;
  setUsers: React.Dispatch<React.SetStateAction<UserInfo[]>>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setCursors: React.Dispatch<React.SetStateAction<Record<string, CursorData>>>;
  setUserViewports: React.Dispatch<React.SetStateAction<Record<string, UserViewport>>>;
  setFollowingUserId: React.Dispatch<React.SetStateAction<string | null>>;
  setTypingUsers: React.Dispatch<React.SetStateAction<string[]>>;
  setStageScale: React.Dispatch<React.SetStateAction<number>>;
  setStagePos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  setEmojiReactions: React.Dispatch<React.SetStateAction<EmojiReaction[]>>;
  showToast: (message: string, type?: Toast['type']) => void;
  followingUserRef: MutableRefObject<string | null>;
  historyRef: MutableRefObject<DrawElement[][]>;
  historyStepRef: MutableRefObject<number>;
}

export function useSocketEvents({
  socket,
  setElements, setSelectedIndices,
  setUsers, setMessages, setCursors,
  setUserViewports, setFollowingUserId,
  setTypingUsers, setStageScale, setStagePos,
  setEmojiReactions, showToast,
  followingUserRef, historyRef, historyStepRef,
}: UseSocketEventsParams) {
  useEffect(() => {
    socket.on('draw_line', (data: DrawElement[]) => setElements(data));
    socket.on('clear_all', () => {
      setElements([]); setSelectedIndices(new Set());
      historyRef.current = [[]]; historyStepRef.current = 0;
    });
    socket.on('user_list', (list: UserInfo[]) => setUsers(list));
    socket.on('receive_message', (msg: ChatMessage) => setMessages((p) => [...p, msg]));
    socket.on('cursor_move', (data: CursorData & { id: string }) => {
      setCursors((p) => ({ ...p, [data.id]: { x: data.x, y: data.y, nickname: data.nickname } }));
    });
    socket.on('cursor_leave', (id: string) => {
      setCursors((p) => { const n = { ...p }; delete n[id]; return n; });
      setUserViewports((p) => { const n = { ...p }; delete n[id]; return n; });
      setFollowingUserId((prev) => prev === id ? null : prev);
    });
    socket.on('typing', (name: string) => setTypingUsers((p) => p.includes(name) ? p : [...p, name]));
    socket.on('stop_typing', (name: string) => setTypingUsers((p) => p.filter((n) => n !== name)));
    socket.on('user_joined', (name: string) => showToast(`${name}님이 입장했습니다`, 'join'));
    socket.on('user_left', (name: string) => showToast(`${name}님이 퇴장했습니다`, 'leave'));
    socket.on('viewport_update', (data: UserViewport & { id: string }) => {
      setUserViewports((p) => ({ ...p, [data.id]: { scale: data.scale, x: data.x, y: data.y, nickname: data.nickname } }));
      if (followingUserRef.current === data.id) {
        setStageScale(data.scale);
        setStagePos({ x: data.x, y: data.y });
      }
    });
    socket.on('emoji_reaction', (data: EmojiReaction) => {
      setEmojiReactions((p) => [...p, data]);
      setTimeout(() => setEmojiReactions((p) => p.filter((r) => r.id !== data.id)), 1800);
    });
    return () => {
      ['draw_line', 'clear_all', 'user_list', 'receive_message', 'cursor_move', 'cursor_leave',
        'typing', 'stop_typing', 'user_joined', 'user_left', 'viewport_update', 'emoji_reaction']
        .forEach((ev) => socket.off(ev));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
