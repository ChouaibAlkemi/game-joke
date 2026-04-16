import { useState, useEffect, useRef, useCallback } from 'react';
import mqtt from 'mqtt';

const BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';
const ROOM_TOPIC_PREFIX = 'gamejoke/rooms/';
const ICONS = ['🦊', '🐶', '🐱', '🐭', '🐹', '🐰', '🐯', '🦁'];

export interface Player {
  id: string;
  name: string;
  icon: string;
  score: number;
  isHost: boolean;
  isFinished: boolean;
  finishTime?: number;
  lastSeen?: number; // timestamp for heartbeat
}

interface GameState {
  type: 'IDENTITY' | 'PLAYER_UPDATE' | 'BOARD_SYNC' | 'RESTART' | 'KEEPALIVE';
  player?: Player;
  board?: any[];
  allPlayers?: Player[];
}

export const useMultiplayer = (
  roomCode?: string,
  playerName?: string,
  onReceiveBoard?: (board: any[]) => void,
  enabled: boolean = false
) => {
  const [playerList, setPlayerList] = useState<Player[]>([]);
  const [isHost, setIsHost] = useState(!roomCode);
  const [status, setStatus] = useState<'IDLE' | 'CONNECTING' | 'CONNECTED' | 'ERROR'>('IDLE');
  const [detailedStatus, setDetailedStatus] = useState('بانتظار البدء...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState(roomCode || '');
  
  // PERSISTENT ID
  const [myId] = useState(() => {
    let id = localStorage.getItem('gamejoke_player_id');
    if (!id) {
      id = Math.random().toString(36).substring(2, 10);
      localStorage.setItem('gamejoke_player_id', id);
    }
    return id;
  });
  
  const clientRef = useRef<mqtt.MqttClient | null>(null);
  const myIconRef = useRef(ICONS[Math.floor(Math.random() * ICONS.length)]);
  const playerStateRef = useRef<Player | null>(null);

  const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const publish = useCallback((data: GameState) => {
    if (clientRef.current && clientRef.current.connected && (roomCode || generatedCode)) {
      const topic = `${ROOM_TOPIC_PREFIX}${roomCode || generatedCode}`;
      clientRef.current.publish(topic, JSON.stringify(data), { qos: 1 });
    }
  }, [roomCode, generatedCode]);

  useEffect(() => {
    if (!enabled || !playerName) {
      if (clientRef.current) {
        clientRef.current.end();
        clientRef.current = null;
      }
      setStatus('IDLE');
      setPlayerList([]);
      return;
    }

    setStatus('CONNECTING');
    
    const code = roomCode ? roomCode.trim().toUpperCase() : generateCode();
    setGeneratedCode(code);
    const host = !roomCode;
    setIsHost(host);

    const client = mqtt.connect(BROKER_URL, {
      clientId: `gamejoke_${myId}`,
      clean: true,
      connectTimeout: 4000,
      reconnectPeriod: 2000,
    });

    clientRef.current = client;

    const me: Player = {
      id: myId,
      name: playerName,
      icon: myIconRef.current,
      score: 0,
      isHost: host,
      isFinished: false,
      lastSeen: Date.now()
    };
    playerStateRef.current = me;
    setPlayerList([me]);

    client.on('connect', () => {
      setStatus('CONNECTED');
      setDetailedStatus('متصل (4G Ready)');
      const topic = `${ROOM_TOPIC_PREFIX}${code}`;
      client.subscribe(topic, (err) => {
        if (!err) {
          client.publish(topic, JSON.stringify({ type: 'IDENTITY', player: me }), { qos: 1 });
        }
      });
    });

    // HEARTBEAT SYSTEM
    const heartbeatInterval = setInterval(() => {
      if (client.connected) {
        publish({ type: 'KEEPALIVE', player: { ...playerStateRef.current!, lastSeen: Date.now() } });
      }
    }, 5000);

    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setPlayerList(prev => prev.filter(p => p.id === myId || (p.lastSeen && now - p.lastSeen < 15000)));
    }, 10000);

    client.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString()) as GameState;
        if (data.player?.id === myId && data.type !== 'KEEPALIVE') return;

        const updatedPlayer = data.player ? { ...data.player, lastSeen: Date.now() } : null;

        if ((data.type === 'IDENTITY' || data.type === 'KEEPALIVE') && updatedPlayer) {
          setPlayerList(prev => {
            const exists = prev.find(p => p.id === updatedPlayer.id);
            if (exists) {
              return prev.map(p => p.id === updatedPlayer.id ? { ...p, ...updatedPlayer } : p);
            }
            const updated = [...prev, updatedPlayer];
            if (host && data.type === 'IDENTITY') {
               client.publish(topic, JSON.stringify({ type: 'IDENTITY', player: playerStateRef.current! }), { qos: 1 });
            }
            return updated;
          });
        } 
        else if (data.type === 'PLAYER_UPDATE' && updatedPlayer) {
          setPlayerList(prev => prev.map(p => p.id === updatedPlayer.id ? updatedPlayer : p));
        }
        else if (data.type === 'BOARD_SYNC' && data.board && !host) {
          if (onReceiveBoard) onReceiveBoard(data.board);
        }
        else if (data.type === 'RESTART') {
           window.dispatchEvent(new CustomEvent('gamejoke_restart'));
        }
      } catch (e) {
        console.error('MQTT Parse Error', e);
      }
    });

    client.on('error', (err) => {
      console.error('MQTT Error', err);
      setStatus('ERROR');
      setErrorMsg('فشل المزامنة.');
    });

    return () => {
      client.end();
      clientRef.current = null;
      clearInterval(heartbeatInterval);
      clearInterval(cleanupInterval);
    };
  }, [enabled, playerName, roomCode, myId, publish]);

  const updateMyState = useCallback((updates: Partial<Player>) => {
    if (!playerStateRef.current) return;
    const newState = { ...playerStateRef.current, ...updates, lastSeen: Date.now() };
    playerStateRef.current = newState;
    setPlayerList(prev => prev.map(p => p.id === myId ? newState : p));
    publish({ type: 'PLAYER_UPDATE', player: newState });
  }, [myId, publish]);

  const broadcastBoard = useCallback((board: any[]) => {
    publish({ type: 'BOARD_SYNC', board });
  }, [publish]);

  const broadcastRestart = useCallback(() => {
    publish({ type: 'RESTART' });
  }, [publish]);

  return {
    playerList,
    isHost,
    status,
    detailedStatus,
    errorMsg,
    generatedCode,
    myId,
    updateMyState,
    broadcastBoard,
    broadcastRestart
  };
};
