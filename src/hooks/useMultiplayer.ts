import { useState, useEffect, useRef, useCallback } from 'react';
import mqtt from 'mqtt';

const BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';
const ROOM_TOPIC_PREFIX = 'akahow/rooms/';
const ICONS = ['🦊', '🐶', '🐱', '🐭', '🐹', '🐰', '🐯', '🦁'];

export interface Player {
  id: string;
  name: string;
  icon: string;
  score: number;
  isHost: boolean;
  isFinished: boolean;
  matchCountRequired: number;
  finishTime?: number;
  lastSeen?: number;
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
  
  // Stabilize generatedCode - only changes when roomCode prop changes
  const [generatedCode, setGeneratedCode] = useState(() => {
    if (roomCode) return roomCode.trim().toUpperCase();
    return '';
  });
  
  // Refs to avoid infinite loops in callbacks
  const clientRef = useRef<mqtt.MqttClient | null>(null);
  const playerStateRef = useRef<Player | null>(null);
  const currentCodeRef = useRef(generatedCode);
  const myIconRef = useRef(ICONS[Math.floor(Math.random() * ICONS.length)]);

  useEffect(() => {
    currentCodeRef.current = generatedCode;
  }, [generatedCode]);

  const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  // PERSISTENT ID
  const [myId] = useState(() => {
    let id = localStorage.getItem('akahow_player_id');
    if (!id) {
      id = Math.random().toString(36).substring(2, 10);
      localStorage.setItem('akahow_player_id', id);
    }
    return id;
  });

  const publish = useCallback((data: GameState) => {
    const codeToUse = roomCode?.trim().toUpperCase() || currentCodeRef.current;
    if (clientRef.current && clientRef.current.connected && codeToUse) {
      const topic = `${ROOM_TOPIC_PREFIX}${codeToUse}`;
      clientRef.current.publish(topic, JSON.stringify(data), { qos: 1 });
    }
  }, [roomCode]);

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
    
    // Only generate new code if we don't have one and we are host
    let activeCode = roomCode?.trim().toUpperCase();
    if (!activeCode) {
      if (!currentCodeRef.current) {
        activeCode = generateCode();
        setGeneratedCode(activeCode);
      } else {
        activeCode = currentCodeRef.current;
      }
    } else {
      setGeneratedCode(activeCode);
    }

    const host = !roomCode;
    setIsHost(host);

    const client = mqtt.connect(BROKER_URL, {
      clientId: `akahow_${myId}`,
      clean: true,
      connectTimeout: 5000,
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
      matchCountRequired: 2,
      lastSeen: Date.now()
    };
    playerStateRef.current = me;
    setPlayerList([me]);

    client.on('connect', () => {
      setStatus('CONNECTED');
      setDetailedStatus('متصل (4G Ready)');
      const topic = `${ROOM_TOPIC_PREFIX}${activeCode}`;
      client.subscribe(topic, (err) => {
        if (!err) {
          client.publish(topic, JSON.stringify({ type: 'IDENTITY', player: me }), { qos: 1 });
        }
      });
    });

    const heartbeatInterval = setInterval(() => {
      if (client.connected) {
        const payload: GameState = { type: 'KEEPALIVE', player: { ...playerStateRef.current!, lastSeen: Date.now() } };
        const topic = `${ROOM_TOPIC_PREFIX}${activeCode}`;
        client.publish(topic, JSON.stringify(payload), { qos: 0 });
      }
    }, 5000);

    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setPlayerList(prev => prev.filter(p => p.id === myId || (p.lastSeen && now - p.lastSeen < 20000)));
    }, 10000);

    client.on('message', (_topic, message) => {
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
               const identityPayload = JSON.stringify({ type: 'IDENTITY', player: playerStateRef.current! });
               client.publish(`${ROOM_TOPIC_PREFIX}${activeCode}`, identityPayload, { qos: 1 });
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
           window.dispatchEvent(new CustomEvent('akahow_restart'));
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
  }, [enabled, playerName, roomCode, myId]); // Removed publish from deps to break loop

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
