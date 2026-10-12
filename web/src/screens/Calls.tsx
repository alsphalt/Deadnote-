// DARKNOTE — Calls: history + WebRTC voice/video (best-effort mesh)

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../store';
import { useSocket } from '../socket';
import { api } from '../api';
import { Avatar, Modal } from '../components/ui';
import type { CallRecord, PublicUser } from '../types';

interface ActiveCall {
  callId: string;
  peerId: string;
  kind: 'voice' | 'video';
  state: 'calling' | 'ringing' | 'ongoing' | 'ended';
  peerName: string;
  peerAvatar?: string;
}

export function Calls() {
  const { user } = useApp();
  const { socket, emit } = useSocket();
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [people, setPeople] = useState<PublicUser[]>([]);
  const [dialOpen, setDialOpen] = useState(false);
  const [active, setActive] = useState<ActiveCall | null>(null);
  const [incoming, setIncoming] = useState<any>(null);
  const [muted, setMuted] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callIdRef = useRef('');

  const load = useCallback(() => {
    api.calls().then((r) => setCalls(r.calls)).catch(() => {});
  }, []);

  useEffect(load, [load]);

  // wire up incoming call + signaling
  useEffect(() => {
    if (!socket) return;
    const onIncoming = (p: any) => setIncoming(p);
    const onAccepted = (p: { callId: string }) => {
      setActive((a) => (a ? { ...a, state: 'ongoing' } : a));
    };
    const onRejected = (p: { callId: string }) => {
      setActive(null);
      load();
    };
    const onEnded = (p: { callId: string }) => {
      endCallLocal();
      load();
    };
    const onSignal = async (p: { from: string; signal: any }) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        if (p.signal?.type === 'offer') {
          await pc.setRemoteDescription(p.signal);
          const stream = await getMedia();
          attachLocal(stream);
          for (const t of stream.getTracks()) pc.addTrack(t, stream);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          emit('rtc:signal', { to: p.from, signal: pc.localDescription });
        } else if (p.signal?.type === 'answer') {
          await pc.setRemoteDescription(p.signal);
        } else if (p.signal?.candidate) {
          await pc.addIceCandidate(p.signal.candidate);
        }
      } catch (e) {
        console.warn('rtc signal error', e);
      }
    };
    socket.on('call:incoming', onIncoming);
    socket.on('call:accepted', onAccepted);
    socket.on('call:rejected', onRejected);
    socket.on('call:ended', onEnded);
    socket.on('rtc:signal', onSignal);
    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:accepted', onAccepted);
      socket.off('call:rejected', onRejected);
      socket.off('call:ended', onEnded);
      socket.off('rtc:signal', onSignal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  const attachLocal = (stream: MediaStream) => {
    setLocalStream(stream);
    setTimeout(() => {
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }
    }, 50);
  };

  const getMedia = async (video = false): Promise<MediaStream> => {
    return navigator.mediaDevices.getUserMedia({ audio: true, video: video ? { width: 640 } : false });
  };

  const setupPeer = async (peerId: string, kind: 'voice' | 'video') => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcRef.current = pc;
    pc.onicecandidate = (e) => {
      if (e.candidate) emit('rtc:signal', { to: peerId, signal: { candidate: e.candidate } });
    };
    pc.ontrack = (e) => {
      setRemoteStream(e.streams[0]);
      setTimeout(() => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = e.streams[0];
          remoteVideoRef.current.play().catch(() => {});
        }
      }, 50);
    };
    const stream = await getMedia(kind === 'video');
    attachLocal(stream);
    for (const t of stream.getTracks()) pc.addTrack(t, stream);
    return pc;
  };

  const startCall = async (p: PublicUser, kind: 'voice' | 'video') => {
    setDialOpen(false);
    const callId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    callIdRef.current = callId;
    setActive({ callId, peerId: p.id, kind, state: 'calling', peerName: `@${p.username}`, peerAvatar: p.avatarEmoji });
    emit('call:invite', { to: p.id, kind });
    try {
      const pc = await setupPeer(p.id, kind);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      emit('rtc:signal', { to: p.id, signal: pc.localDescription });
    } catch (e) {
      console.warn('call setup failed', e);
    }
  };

  const acceptIncoming = async () => {
    if (!incoming) return;
    const { callId, from, kind } = incoming;
    callIdRef.current = callId;
    setIncoming(null);
    setActive({ callId, peerId: from.id, kind, state: 'ongoing', peerName: `@${from.username}`, peerAvatar: from.avatarEmoji });
    emit('call:accept', { callId });
    try {
      await setupPeer(from.id, kind);
    } catch (e) {
      console.warn(e);
    }
  };

  const declineIncoming = () => {
    if (incoming) emit('call:reject', { callId: incoming.callId });
    setIncoming(null);
  };

  const endCallLocal = () => {
    pcRef.current?.close();
    pcRef.current = null;
    localStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    setRemoteStream(null);
    setActive(null);
  };

  const endCall = () => {
    if (callIdRef.current) emit('call:end', { callId: callIdRef.current });
    endCallLocal();
    load();
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    localStream?.getAudioTracks().forEach((t) => (t.enabled = !next));
  };

  const toggleCam = async () => {
    const next = !camOn;
    setCamOn(next);
    if (next && !localStream?.getVideoTracks().length) {
      try {
        const stream = await getMedia(true);
        for (const t of stream.getVideoTracks()) pcRef.current?.addTrack(t, stream);
        setLocalStream(stream);
        setTimeout(() => {
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.play().catch(() => {});
          }
        }, 50);
      } catch { /* camera denied */ }
    } else {
      localStream?.getVideoTracks().forEach((t) => (t.enabled = next));
    }
  };

  return (
    <div className="screen">
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Calls</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 13 }}>Voice & video over WebRTC</p>

      <button className="btn primary block" style={{ marginBottom: 16 }} onClick={() => setDialOpen(true)}>＋ New call</button>

      <div className="section-title">History</div>
      {calls.length === 0 && <p className="empty">No calls yet. Start one — calls need two browsers open.</p>}
      {calls.map((c) => (
        <div className="row" key={c.id}>
          <Avatar emoji={c.other?.avatarEmoji || '👤'} />
          <div className="body">
            <div className="name">{c.other?.displayName || 'Contact'}</div>
            <div className="sub">
              {c.direction === 'outgoing' ? '📞 Outgoing' : c.state === 'missed' ? '☎ Missed' : '📲 Incoming'} · {c.kind} · {new Date(c.startedAt).toLocaleString()}
            </div>
          </div>
          <button className="icon-btn" onClick={() => c.other && startCall(c.other, c.kind)}>☎</button>
        </div>
      ))}

      {dialOpen && (
        <Modal title="New call" onClose={() => setDialOpen(false)}>
          <input className="input" placeholder="Search by username…" onChange={(e) => api.people(e.target.value).then((r) => setPeople(r.people)).catch(() => {})} style={{ marginBottom: 12 }} />
          {people.map((p) => (
            <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0' }}>
              <Avatar emoji={p.avatarEmoji} />
              <div style={{ flex: 1 }}><strong>@{p.username}</strong></div>
              <button className="icon-btn" onClick={() => startCall(p, 'voice')} title="Voice">☎</button>
              <button className="icon-btn" onClick={() => startCall(p, 'video')} title="Video">📹</button>
            </div>
          ))}
        </Modal>
      )}

      {incoming && (
        <Modal title="Incoming call" onClose={() => setIncoming(null)}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <Avatar emoji={incoming.from?.avatarEmoji} size="lg" />
            <h3 style={{ marginTop: 8 }}>@{incoming.from?.username}</h3>
            <p style={{ color: 'var(--text-secondary)' }}>{incoming.kind === 'video' ? '📹 Video call' : '☎ Voice call'}</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn danger" style={{ flex: 1 }} onClick={declineIncoming}>Decline</button>
            <button className="btn primary" style={{ flex: 1 }} onClick={acceptIncoming}>Accept</button>
          </div>
        </Modal>
      )}

      {active && (
        <div className="modal">
          <div className="backdrop" />
          <div style={{ position: 'relative', width: '100%', maxWidth: 520, minHeight: 460, borderRadius: 24, overflow: 'hidden', background: '#000' }}>
            {active.kind === 'video' && remoteStream ? (
              <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: 460, objectFit: 'cover' }} />
            ) : (
              <div style={{ height: 460, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <Avatar emoji={active.peerAvatar} size="xl" />
                <h2 style={{ color: '#fff' }}>{active.peerName}</h2>
                <p style={{ color: 'var(--text-secondary)' }}>
                  {active.state === 'calling' ? 'Calling…' : active.state === 'ongoing' ? 'Ongoing' : '…'}
                </p>
              </div>
            )}
            {active.kind === 'video' && (
              <video ref={localVideoRef} muted autoPlay playsInline style={{ position: 'absolute', right: 12, top: 12, width: 110, borderRadius: 12, border: '2px solid rgba(255,255,255,0.3)', background: '#000' }} />
            )}
            <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 14 }}>
              <button className="icon-btn" style={{ background: muted ? 'var(--accent-grad)' : 'rgba(255,255,255,0.15)' }} onClick={toggleMute}>{muted ? '🔇' : '🎤'}</button>
              {active.kind === 'video' && (
                <button className="icon-btn" style={{ background: 'rgba(255,255,255,0.15)' }} onClick={toggleCam}>{camOn ? '📹' : '🚫'}</button>
              )}
              <button className="icon-btn" style={{ background: 'rgba(255,255,255,0.15)' }}>🔊</button>
              <button className="icon-btn" style={{ background: 'var(--danger)' }} onClick={endCall}>📞</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
