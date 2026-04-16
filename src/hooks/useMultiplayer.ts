import { useState, useEffect, useRef, useCallback } from 'react';
import mqtt from 'mqtt';

const BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';
const ROOM_TOPIC_PREFIX = 'gamejoke/rooms/';
const ICONS = ['🦊', '🐶', '🐱', '🐭', '🐹', '🐰', '🐯', '🦁'];

export interface Player {
  id: string; // Using mqtt client id or random id
  name: string;
  icon: string;
  score: number;
  isHost: boolean;
  isFinished: boolean;
  finishTime?: number; // timestamp
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
  const [myId] = useState(() => Math.random().toString(36).substring(2, 10));
  
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
    setDetailedStatus('جاري الاتصال بخادم المزامنة اللاسلكي...');
    
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
      isFinished: false
    };
    playerStateRef.current = me;
    setPlayerList([me]);

    client.on('connect', () => {
      setStatus('CONNECTED');
      setDetailedStatus('متصل بنجاح (4G Ready)');
      const topic = `${ROOM_TOPIC_PREFIX}${code}`;
      client.subscribe(topic, (err) => {
        if (!err) {
          // Announce presence
          client.publish(topic, JSON.stringify({ type: 'IDENTITY', player: me }), { qos: 1 });
        }
      });
    });

    client.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString()) as GameState;
        
        if (data.player?.id === myId && data.type !== 'KEEPALIVE') return;

        if (data.type === 'IDENTITY' && data.player) {
          setPlayerList(prev => {
            const exists = prev.find(p => p.id === data.player?.id);
            if (exists) return prev;
            const updated = [...prev, data.player!];
            // If I am host, reply with my sequence
            if (host) {
               client.publish(topic, JSON.stringify({ type: 'IDENTITY', player: me }), { qos: 1 });
            }
            return updated;
          });
        } 
        else if (data.type === 'PLAYER_UPDATE' && data.player) {
          setPlayerList(prev => prev.map(p => p.id === data.player?.id ? data.player! : p));
        }
        else if (data.type === 'BOARD_SYNC' && data.board && !host) {
          if (onReceiveBoard) onReceiveBoard(data.board);
        }
        else if (data.type === 'RESTART') {
           // This will be handled in App.tsx by observing resets
           window.dispatchEvent(new CustomEvent('gamejoke_restart'));
        }
      } catch (e) {
        console.error('MQTT Parse Error', e);
      }
    });

    client.on('error', (err) => {
      console.error('MQTT Error', err);
      setStatus('ERROR');
      setErrorMsg('فشل الاتصال بخادم المزامنة. تأكد من الإنترنت.');
    });

    return () => {
      client.end();
      clientRef.current = null;
    };
  }, [enabled, playerName, roomCode, myId]);

  const updateMyState = useCallback((updates: Partial<Player>) => {
    if (!playerStateRef.current) return;
    
    const newState = { ...playerStateRef.current, ...updates };
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
