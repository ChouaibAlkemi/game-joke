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
  type: 'IDENTITY' | 'SCORE_UPDATE' | 'GAME_RESET' | 'START_GAME' | 'INITIAL_BOARD' | 'PLAYER_LIST';
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>(roomCode || '');

  const connectionsRef = useRef<{ [peerId: string]: DataConnection }>({});
  const myIconRef = useRef(ICONS[Math.floor(Math.random() * ICONS.length)]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  useEffect(() => {
    if (!playerName) return;

    let finalCode = roomCode;
    if (!roomCode) {
      finalCode = generateCode();
      setGeneratedCode(finalCode);
      setIsHost(true);
    }

    const peerId = !roomCode ? ROOM_PREFIX + finalCode : undefined;
    const newPeer = peerId ? new Peer(peerId) : new Peer();
    
    newPeer.on('open', (id) => {
      setPeer(newPeer);
      
      // Add self to player list
      const self: Player = {
        peerId: id,
        name: playerName,
        icon: myIconRef.current,
        score: 0,
        isHost: !roomCode
      };
      setPlayerList([self]);

      if (roomCode) {
        connectToHost(ROOM_PREFIX + roomCode, newPeer);
      } else {
        setStatus('IDLE');
      }
    });

    newPeer.on('connection', (connection) => {
      setupConnection(connection);
    });

    newPeer.on('error', (err) => {
      console.error('Peer error:', err.type);
      if (err.type === 'peer-unavailable') {
        setErrorMsg('لم يتم العثور على الغرفة. تأكد من الكود.');
        setStatus('ERROR');
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      } else if (err.type === 'unavailable-id' && !roomCode) {
        const retryCode = generateCode();
        setGeneratedCode(retryCode);
      } else {
        setErrorMsg('حدث خطأ في الاتصال.');
        setStatus('ERROR');
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      }
    });

    return () => {
      newPeer.destroy();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [roomCode, playerName]);

  const connectToHost = (targetId: string, peerInstance: Peer) => {
    setStatus('CONNECTING');
    setErrorMsg(null);
    
    // Set a timeout for the connection attempt
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (status !== 'CONNECTED') {
        setErrorMsg('الجلسة غير متوفرة أو أن الكود غير صحيح.');
        setStatus('ERROR');
      }
    }, 5000); // 5 second timeout

    const connection = peerInstance.connect(targetId);
    setupConnection(connection);
  };

  const setupConnection = (connection: DataConnection) => {
    connection.on('open', () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      connectionsRef.current[connection.peer] = connection;
      setStatus('CONNECTED');
      setErrorMsg(null);
      
      connection.send({ 
        type: 'IDENTITY', 
        name: playerName, 
        icon: myIconRef.current 
      });
    });

    connection.on('data', (data: any) => {
      const syncData = data as SyncData;
      
      if (syncData.type === 'IDENTITY') {
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
      } else if (syncData.type === 'PLAYER_LIST' && syncData.players) {
        setPlayerList(syncData.players);
        setStatus('CONNECTED');
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      } else if (syncData.type === 'SCORE_UPDATE') {
        setPlayerList(prev => prev.map(p => 
          p.peerId === connection.peer ? { ...p, score: syncData.pairsMatched || 0 } : p
        ));
      } else if (syncData.type === 'INITIAL_BOARD' && syncData.board) {
        if (onReceiveBoard) onReceiveBoard(syncData.board);
      }
    });

    connection.on('close', () => {
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
    errorMsg,
    generatedCode,
    syncScore,
    sendBoard,
    myPeerId: peer?.id,
    myIcon: myIconRef.current
  };
};
