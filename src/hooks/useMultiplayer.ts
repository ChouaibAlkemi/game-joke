import { useState, useEffect, useRef, useCallback } from 'react';
import { Peer } from 'peerjs';
import type { DataConnection } from 'peerjs';

const ROOM_PREFIX = 'GAMEJOKE-';
const ICONS = ['🦊', '🐶', '🐱', '🐭', '🐹', '🐰', '🐯', '🦁'];

interface Player {
  peerId: string;
  name: string;
  icon: string;
  score: number;
  isHost?: boolean;
}

interface SyncData {
  type: 'IDENTITY' | 'SCORE_UPDATE' | 'GAME_RESET' | 'START_GAME' | 'INITIAL_BOARD' | 'PLAYER_LIST' | 'PING';
  name?: string;
  icon?: string;
  pairsMatched?: number;
  board?: any[];
  players?: Player[];
}

export const useMultiplayer = (
  roomCode?: string, 
  playerName?: string,
  onReceiveBoard?: (board: any[]) => void,
  enabled: boolean = false
) => {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [playerList, setPlayerList] = useState<Player[]>([]);
  const [isHost, setIsHost] = useState(!roomCode);
  const [status, setStatus] = useState<'IDLE' | 'CONNECTING' | 'CONNECTED' | 'ERROR'>('IDLE');
  const [detailedStatus, setDetailedStatus] = useState<string>('بانتظار البدء...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>(roomCode || '');
  const [logs, setLogs] = useState<string[]>([]);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const connectionsRef = useRef<{ [peerId: string]: DataConnection }>({});
  const myIconRef = useRef(ICONS[Math.floor(Math.random() * ICONS.length)]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const collisionCountRef = useRef(0);

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
    console.log(`[GameLog] ${msg}`);
  }, []);

  const generateCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const broadcastPlayerList = useCallback((currentPlayers: Player[]) => {
    Object.values(connectionsRef.current).forEach(conn => {
      if (conn.open) {
        conn.send({ type: 'PLAYER_LIST', players: currentPlayers });
      }
    });
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(() => {
      Object.values(connectionsRef.current).forEach(conn => {
        if (conn.open) {
          conn.send({ type: 'PING' });
        }
      });
    }, 10000);
  }, []);

  useEffect(() => {
    if (!enabled || !playerName) {
      // Cleanup if disabled
      if (peer) {
        addLog('إغلاق الاتصال وتنظيف الذاكرة...');
        peer.destroy();
        setPeer(null);
      }
      setStatus('IDLE');
      setPlayerList([]);
      connectionsRef.current = {};
      return;
    }

    setErrorMsg(null);
    setStatus('CONNECTING');

    const host = !roomCode;
    setIsHost(host);
    
    let finalCode = roomCode ? roomCode.trim().toUpperCase() : generateCode();
    setGeneratedCode(finalCode);

    addLog(host ? `جاري فتح غرفة: ${finalCode}` : `جاري الانضمام للغرفة: ${finalCode}`);
    setDetailedStatus(host ? 'جاري الاتصال بالخادم...' : 'جاري البحث عن الغرفة...');

    const peerId = (host && collisionCountRef.current < 2) ? ROOM_PREFIX + finalCode : undefined;

    const peerOptions = {
      debug: 2,
      secure: true,
      config: {
        'iceServers': [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' },
          { urls: 'stun:stun.services.mozilla.com' }
        ],
        'iceCandidatePoolSize': 10
      }
    };

    const newPeer = peerId ? new Peer(peerId, peerOptions) : new Peer(peerOptions);
    let isDestroyed = false;
    
    newPeer.on('open', (id) => {
      if (isDestroyed) return;
      addLog(`✅ متصل. هويتك: ${id}`);
      setPeer(newPeer);
      
      const self: Player = {
        peerId: id,
        name: playerName,
        icon: myIconRef.current,
        score: 0,
        isHost: host
      };
      setPlayerList([self]);

      if (roomCode) {
        connectToHost(ROOM_PREFIX + roomCode.trim().toUpperCase(), newPeer);
      } else {
        setStatus('IDLE');
        setDetailedStatus('الغرفة جاهزة! بانتظار الخصم...');
      }
    });

    newPeer.on('error', (err) => {
      if (isDestroyed) return;
      const errorDetail = err.message || err.type || JSON.stringify(err);
      addLog(`!! خطأ: ${errorDetail}`);

      if (err.type === 'peer-unavailable') {
        setErrorMsg('الغرفة غير موجودة.');
        setStatus('ERROR');
      } else if (err.type === 'unavailable-id' && host) {
        collisionCountRef.current++;
        setTimeout(() => setRetryTrigger(prev => prev + 1), 1000);
      } else {
        setErrorMsg(`خطأ: ${err.type}`);
        setStatus('ERROR');
      }
    });

    newPeer.on('connection', (connection) => {
      if (isDestroyed) return;
      setupConnection(connection);
    });

    return () => {
      isDestroyed = true;
      newPeer.destroy();
      setPeer(null);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [roomCode, playerName, retryTrigger, enabled]);

  const connectToHost = (targetId: string, peerInstance: Peer) => {
    if (!peerInstance || peerInstance.destroyed) return;
    
    setStatus('CONNECTING');
    setDetailedStatus('جاري الربط...');
    addLog(`طلب ربط مع: ${targetId}`);
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (status !== 'CONNECTED' && status !== 'ERROR') {
        addLog('!! انتهت مهلة الربط');
        setErrorMsg('فشل الربط التقني.');
        setStatus('ERROR');
      }
    }, 25000);

    const connection = peerInstance.connect(targetId, { reliable: true });
    setupConnection(connection);
  };

  const setupConnection = (connection: DataConnection) => {
    connection.on('open', () => {
      addLog(`✅ متصل مع: ${connection.peer}`);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      connectionsRef.current[connection.peer] = connection;
      setStatus('CONNECTED');
      setDetailedStatus('تم الاتصال!');
      setErrorMsg(null);
      startHeartbeat();
      
      connection.send({ 
        type: 'IDENTITY', 
        name: playerName, 
        icon: myIconRef.current 
      });
    });

    connection.on('data', (data: any) => {
      const syncData = data as SyncData;
      if (syncData.type === 'IDENTITY') {
        addLog(`لاعب انضم: ${syncData.name}`);
        if (isHost) {
          setPlayerList(prev => {
            const newList = [...prev, { 
              peerId: connection.peer, 
              name: syncData.name || 'مجهول', 
              icon: syncData.icon || '👤',
              score: 0 
            }];
            setTimeout(() => broadcastPlayerList(newList), 500);
            return newList;
          });
        }
      } else if (syncData.type === 'PLAYER_LIST') {
        const otherPlayers = syncData.players || [];
        setPlayerList(otherPlayers);
        setStatus('CONNECTED');
      } else if (syncData.type === 'SCORE_UPDATE') {
        setPlayerList(prev => prev.map(p => 
          p.peerId === connection.peer ? { ...p, score: syncData.pairsMatched || 0 } : p
        ));
      } else if (syncData.type === 'INITIAL_BOARD' && syncData.board) {
        if (onReceiveBoard) onReceiveBoard(syncData.board);
      }
    });

    connection.on('close', () => {
      addLog('!! قطع الاتصال');
      delete connectionsRef.current[connection.peer];
      setPlayerList(prev => prev.filter(p => p.peerId !== connection.peer));
    });

    connection.on('error', (err) => {
      addLog(`!! خطأ في القناة: ${err}`);
      setStatus('ERROR');
    });
  };

  const syncScore = useCallback((pairsMatched: number) => {
    Object.values(connectionsRef.current).forEach(conn => {
      if (conn.open) {
        conn.send({ type: 'SCORE_UPDATE', pairsMatched });
      }
    });
  }, []);

  const sendBoard = useCallback((board: any[]) => {
    Object.values(connectionsRef.current).forEach(conn => {
      if (conn.open) {
        conn.send({ type: 'INITIAL_BOARD', board });
      }
    });
  }, []);

  return {
    peer,
    playerList,
    isHost,
    status,
    detailedStatus,
    errorMsg,
    generatedCode,
    logs,
    syncScore,
    sendBoard,
    myPeerId: peer?.id,
    myIcon: myIconRef.current
  };
};
