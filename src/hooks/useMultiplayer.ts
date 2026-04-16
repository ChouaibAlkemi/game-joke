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
  onReceiveBoard?: (board: any[]) => void
) => {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [playerList, setPlayerList] = useState<Player[]>([]);
  const [isHost, setIsHost] = useState(!roomCode);
  const [status, setStatus] = useState<'IDLE' | 'CONNECTING' | 'CONNECTED' | 'ERROR'>('IDLE');
  const [detailedStatus, setDetailedStatus] = useState<string>('بانتظار البدء...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>(roomCode || '');
  const [logs, setLogs] = useState<string[]>([]);

  const connectionsRef = useRef<{ [peerId: string]: DataConnection }>({});
  const myIconRef = useRef(ICONS[Math.floor(Math.random() * ICONS.length)]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

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
    if (!playerName) return;

    let finalCode = roomCode ? roomCode.trim().toUpperCase() : generateCode();
    setGeneratedCode(finalCode);
    const host = !roomCode;
    setIsHost(host);

    addLog(host ? `بدء إنشاء غرفة جديدة: ${finalCode}` : `بدء محاولة الانضمام للغرفة: ${finalCode}`);
    setDetailedStatus(host ? 'جاري الاتصال بخادم الألعاب...' : 'جاري البحث عن الغرفة...');

    const peerId = host ? ROOM_PREFIX + finalCode : undefined;
    
    const newPeer = new Peer(peerId, {
      debug: 2,
      config: {
        'iceServers': [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      }
    });
    
    newPeer.on('open', (id) => {
      addLog(`تم الاتصال بالخادم. هويتك: ${id}`);
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
        setDetailedStatus('بانتظار انضمام لاعب آخر...');
      }
    });

    newPeer.on('connection', (connection) => {
      addLog(`لاعب جديد يحاول الاتصال: ${connection.peer}`);
      setupConnection(connection);
    });

    newPeer.on('error', (err) => {
      addLog(`!! خطأ في الخادم: ${err.type}`);
      if (err.type === 'peer-unavailable') {
        if (!host && retryCountRef.current < 2) {
          retryCountRef.current++;
          addLog(`الغرفة لم تستجب، محاولة إعادة الاتصال (${retryCountRef.current})...`);
          setTimeout(() => {
            if (peer) connectToHost(ROOM_PREFIX + (roomCode || '').trim().toUpperCase(), peer);
          }, 2000);
        } else {
          setErrorMsg('الغرفة غير موجودة. تأكد من أن "المضيف" قد بدأ اللعبة فعلاً.');
          setDetailedStatus('فشل في العثور على الغرفة');
          setStatus('ERROR');
        }
      } else if (err.type === 'unavailable-id' && host) {
        addLog('هذا الكود مستخدم بالفعل، جاري تجديد الكود...');
        const retryCode = generateCode();
        setGeneratedCode(retryCode);
      } else {
        setErrorMsg(`خطأ: ${err.type}`);
        setStatus('ERROR');
      }
    });

    return () => {
      newPeer.destroy();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [roomCode, playerName]);

  const connectToHost = (targetId: string, peerInstance: Peer) => {
    setStatus('CONNECTING');
    setDetailedStatus('جاري الربط مع المضيف...');
    addLog(`جاري محاولة الربط الهاتفي (Handshake) مع: ${targetId}`);
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (status !== 'CONNECTED' && status !== 'ERROR') {
        addLog('!! انتهت مهلة الانتظار');
        setErrorMsg('فشل في الربط مع المضيف. قد يكون بسبب شبكة إنترنت ضعيفة أو جدار حماية.');
        setStatus('ERROR');
      }
    }, 10000);

    const connection = peerInstance.connect(targetId, {
      reliable: true
    });
    setupConnection(connection);
  };

  const setupConnection = (connection: DataConnection) => {
    connection.on('open', () => {
      addLog(`✅ نجاح الربط مع: ${connection.peer}`);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      connectionsRef.current[connection.peer] = connection;
      setStatus('CONNECTED');
      setDetailedStatus('تم الاتصال! جاري تبادل البيانات...');
      setErrorMsg(null);
      retryCountRef.current = 0;
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
        addLog(`تم التعرف على لاعب: ${syncData.name}`);
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
        addLog('تم تحديث قائمة اللاعبين من المضيف');
        setPlayerList(syncData.players || []);
        setStatus('CONNECTED');
        setDetailedStatus('أنت الآن متصل باللعبة!');
      } else if (syncData.type === 'SCORE_UPDATE') {
        setPlayerList(prev => prev.map(p => 
          p.peerId === connection.peer ? { ...p, score: syncData.pairsMatched || 0 } : p
        ));
      } else if (syncData.type === 'INITIAL_BOARD' && syncData.board) {
        addLog('تم استلام لوحة اللعب');
        if (onReceiveBoard) onReceiveBoard(syncData.board);
      }
    });

    connection.on('close', () => {
      addLog('!! انقطع الاتصال بأحد اللاعبين');
      delete connectionsRef.current[connection.peer];
      setPlayerList(prev => prev.filter(p => p.peerId !== connection.peer));
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
