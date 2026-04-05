import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, PhoneOff, Volume2 } from 'lucide-react';
import type { Socket } from 'socket.io-client';

interface Theme {
  panel: string; border: string; text: string;
  textMuted: string; shadow: string;
}

interface VoiceChatProps {
  socket: Socket;
  nickname: string;
  roomId: string;
  theme: Theme;
}

interface Peer {
  id: string;
  nickname: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
  isMuted?: boolean;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function VoiceChat({ socket, nickname, roomId, theme }: VoiceChatProps) {
  const [isJoined, setIsJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerMapRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  const createPeerConnection = useCallback((peerId: string, peerNickname: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection(RTC_CONFIG);

    // 로컬 트랙 추가
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // ICE candidate
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit('voice_ice_candidate', { to: peerId, candidate });
      }
    };

    // 원격 스트림 수신
    pc.ontrack = (event) => {
      const audio = document.getElementById(`voice-${peerId}`) as HTMLAudioElement;
      if (audio) audio.srcObject = event.streams[0];
      setPeers(prev => {
        const next = new Map(prev);
        const peer = next.get(peerId);
        if (peer) next.set(peerId, { ...peer, stream: event.streams[0] });
        return next;
      });
    };

    peerMapRef.current.set(peerId, pc);
    setPeers(prev => {
      const next = new Map(prev);
      next.set(peerId, { id: peerId, nickname: peerNickname, connection: pc });
      return next;
    });
    return pc;
  }, [socket]);

  const joinVoice = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      setIsJoined(true);
      socket.emit('voice_join', { room: roomId, nickname });
    } catch (err) {
      console.error('마이크 접근 실패:', err);
      alert('마이크 접근 권한이 필요합니다.');
    }
  }, [socket, roomId, nickname]);

  const leaveVoice = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    peerMapRef.current.forEach(pc => pc.close());
    peerMapRef.current.clear();
    setPeers(new Map());
    setIsJoined(false);
    socket.emit('voice_leave', { room: roomId });
  }, [socket, roomId]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
      socket.emit('voice_mute', { room: roomId, muted: !audioTrack.enabled });
    }
  }, [socket, roomId]);

  useEffect(() => {
    // 새 참여자가 voice에 참가 → offer 생성
    socket.on('voice_user_joined', async ({ id, nickname: peerNickname }: { id: string; nickname: string }) => {
      if (!localStreamRef.current) return;
      const pc = createPeerConnection(id, peerNickname);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('voice_offer', { to: id, offer });
    });

    // offer 수신 → answer 생성
    socket.on('voice_offer', async ({ from, offer, nickname: peerNickname }: { from: string; offer: RTCSessionDescriptionInit; nickname: string }) => {
      if (!localStreamRef.current) return;
      const pc = createPeerConnection(from, peerNickname);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('voice_answer', { to: from, answer });
    });

    // answer 수신
    socket.on('voice_answer', async ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
      const pc = peerMapRef.current.get(from);
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

    // ICE candidate 수신
    socket.on('voice_ice_candidate', async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      const pc = peerMapRef.current.get(from);
      if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    // 참여자 퇴장
    socket.on('voice_user_left', ({ id }: { id: string }) => {
      peerMapRef.current.get(id)?.close();
      peerMapRef.current.delete(id);
      setPeers(prev => { const next = new Map(prev); next.delete(id); return next; });
    });

    // 음소거 상태 수신
    socket.on('voice_mute_update', ({ id, muted }: { id: string; muted: boolean }) => {
      setPeers(prev => {
        const next = new Map(prev);
        const peer = next.get(id);
        if (peer) next.set(id, { ...peer, isMuted: muted });
        return next;
      });
    });

    return () => {
      ['voice_user_joined', 'voice_offer', 'voice_answer', 'voice_ice_candidate', 'voice_user_left', 'voice_mute_update']
        .forEach(ev => socket.off(ev));
    };
  }, [socket, createPeerConnection]);

  // 컴포넌트 언마운트 시 정리
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (isJoined) leaveVoice(); }, []);

  const peerArray = [...peers.values()];

  return (
    <div style={{
      position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 10, backgroundColor: theme.panel,
      borderRadius: '20px', boxShadow: theme.shadow,
      border: `1px solid ${theme.border}`,
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '6px 14px',
    }}>
      {/* 숨겨진 오디오 엘리먼트들 */}
      {peerArray.map(peer => (
        <audio key={peer.id} id={`voice-${peer.id}`} autoPlay playsInline style={{ display: 'none' }} />
      ))}

      {!isJoined ? (
        <button
          onClick={joinVoice}
          title="음성 채팅 참여"
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: theme.textMuted, fontSize: '13px', padding: '2px 4px' }}
        >
          <Mic size={16} /> 음성 참여
        </button>
      ) : (
        <>
          <button
            onClick={toggleMute}
            title={isMuted ? '마이크 켜기' : '마이크 끄기'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px', color: isMuted ? '#ef4444' : '#22c55e' }}
          >
            {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
          </button>

          {/* 참여 중인 유저들 */}
          {peerArray.map(peer => (
            <div key={peer.id} style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: theme.textMuted }}>
              {peer.isMuted ? <MicOff size={11} style={{ color: '#ef4444' }} /> : <Volume2 size={11} style={{ color: '#22c55e' }} />}
              <span>{peer.nickname}</span>
            </div>
          ))}

          <span style={{ fontSize: '11px', color: '#22c55e', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
            {nickname}
          </span>

          <button
            onClick={leaveVoice}
            title="음성 채팅 나가기"
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px', color: '#ef4444' }}
          >
            <PhoneOff size={16} />
          </button>
        </>
      )}
    </div>
  );
}
