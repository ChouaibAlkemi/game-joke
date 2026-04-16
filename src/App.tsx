import { useState, useEffect, useCallback, useMemo } from 'react';
import Stats from './components/Stats';
import Card from './components/Card';
import Lobby from './components/Lobby';
import PlayerList from './components/PlayerList';
import { useMultiplayer } from './hooks/useMultiplayer';

// Character images from the public/cards folder
const CARD_IMAGES = [
  '/cards/C1.png',
  '/cards/C2.png',
  '/cards/C3.png',
  '/cards/C4.png',
  '/cards/C5.png',
];

const TOTAL_PAIRS = CARD_IMAGES.length;

interface CardType {
  id: number;
  content: string;
  isFlipped: boolean;
  isMatched: boolean;
}

function App() {
  const [gameMode, setGameMode] = useState<'lobby' | 'solo' | 'multiplayer'>('lobby');
  const [playerName, setPlayerName] = useState<string>(() => localStorage.getItem('gamejoke_player_name') || '');
  const [selectedRoom, setSelectedRoom] = useState<string | undefined>(undefined);
  const [isConnectionActive, setIsConnectionActive] = useState(false);
  
  const [cards, setCards] = useState<CardType[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [pairsMatched, setPairsMatched] = useState(0);
  const [lockBoard, setLockBoard] = useState(false);
  const [showWinner, setShowWinner] = useState(false);

  const { 
    playerList, 
    status, 
    detailedStatus, 
    errorMsg, 
    generatedCode, 
    myId,
    updateMyState,
    broadcastBoard,
    broadcastRestart
  } = useMultiplayer(
    selectedRoom, 
    playerName,
    (remoteBoard) => {
      setCards(remoteBoard);
    },
    isConnectionActive
  );

  const isAllFinished = useMemo(() => {
    return playerList.length > 0 && playerList.every(p => p.isFinished);
  }, [playerList]);

  const leaderId = useMemo(() => {
    if (playerList.length === 0) return null;
    return [...playerList].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Tie breaker: who finished first?
      if (a.isFinished && b.isFinished) return (a.finishTime || 0) - (b.finishTime || 0);
      return 0;
    })[0].id;
  }, [playerList]);

  const initializeGame = useCallback(() => {
    const cardPool = [...CARD_IMAGES, ...CARD_IMAGES]
      .sort(() => Math.random() - 0.5)
      .map((content, index) => ({
        id: index,
        content,
        isFlipped: false,
        isMatched: false,
      }));
    
    setCards(cardPool);
    setFlippedCards([]);
    setMoves(0);
    setPairsMatched(0);
    setLockBoard(false);
    setShowWinner(false);

    if (gameMode === 'multiplayer' && !selectedRoom) {
      broadcastBoard(cardPool);
    }
  }, [gameMode, selectedRoom, broadcastBoard]);

  const handleRestart = () => {
    if (gameMode === 'multiplayer') {
      broadcastRestart();
    }
    initializeGame();
  };

  useEffect(() => {
    const onRemoteRestart = () => {
      initializeGame();
    };
    window.addEventListener('gamejoke_restart', onRemoteRestart);
    return () => window.removeEventListener('gamejoke_restart', onRemoteRestart);
  }, [initializeGame]);

  const handleExit = () => {
    setGameMode('lobby');
    setSelectedRoom(undefined);
    setIsConnectionActive(false);
    setCards([]);
    setPairsMatched(0);
    setMoves(0);
  };

  useEffect(() => {
    if (!isConnectionActive || gameMode !== 'lobby') return;
    if (status === 'CONNECTED') {
      const timer = setTimeout(() => {
        setGameMode('multiplayer');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [status, gameMode, isConnectionActive]);

  useEffect(() => {
    if (gameMode !== 'lobby') {
      initializeGame();
    }
  }, [gameMode, initializeGame]);

  useEffect(() => {
    if (gameMode === 'multiplayer') {
      const amIFinished = pairsMatched === TOTAL_PAIRS && TOTAL_PAIRS > 0;
      updateMyState({ 
        score: pairsMatched, 
        isFinished: amIFinished,
        finishTime: amIFinished ? Date.now() : undefined
      });
    }
    
    if (pairsMatched === TOTAL_PAIRS && TOTAL_PAIRS > 0) {
      setShowWinner(true);
    }
  }, [pairsMatched, gameMode, updateMyState]);

  const handleCardClick = (id: number) => {
    // Basic guards
    if (lockBoard || flippedCards.includes(id)) return;
    
    // Check if player is already finished in multiplayer
    const me = playerList.find(p => p.id === myId);
    if (gameMode === 'multiplayer' && me?.isFinished) return;

    const newFlippedCards = [...flippedCards, id];
    setFlippedCards(newFlippedCards);

    setCards(prev => prev.map(card => 
      card.id === id ? { ...card, isFlipped: true } : card
    ));

    if (newFlippedCards.length === 2) {
      setMoves(prev => prev + 1);
      setLockBoard(true); // LOCK IMMEDIATELY
      checkForMatch(newFlippedCards);
    }
  };

  const checkForMatch = (currentFlipped: number[]) => {
    const [id1, id2] = currentFlipped;
    const card1 = cards.find(c => c.id === id1);
    const card2 = cards.find(c => c.id === id2);

    if (card1?.content === card2?.content) {
      setTimeout(() => {
        setCards(prev => prev.map(card => 
          currentFlipped.includes(card.id) ? { ...card, isMatched: true } : card
        ));
        setPairsMatched(prev => prev + 1);
        setFlippedCards([]);
        setLockBoard(false); // UNLOCK
      }, 600);
    } else {
      setTimeout(() => {
        setCards(prev => prev.map(card => 
          currentFlipped.includes(card.id) ? { ...card, isFlipped: false } : card
        ));
        setFlippedCards([]);
        setLockBoard(false); // UNLOCK
      }, 1000);
    }
  };

  const handleSelectMode = (mode: 'solo' | 'multiplayer', name: string, roomCode?: string) => {
    setPlayerName(name);
    if (mode === 'solo') {
      setGameMode('solo');
      setIsConnectionActive(false);
    } else {
      setSelectedRoom(roomCode);
      setIsConnectionActive(true);
    }
  };

  if (gameMode === 'lobby') {
    return (
      <Lobby 
        onSelectMode={handleSelectMode} 
        errorMsg={errorMsg} 
        status={isConnectionActive ? status : 'IDLE'}
        detailedStatus={isConnectionActive ? detailedStatus : 'بانتظار البدء...'}
        logs={[]}
        myPeerId={myId}
      />
    );
  }

  const me = playerList.find(p => p.id === myId);

  return (
    <div className="game-container fade-in">
      <header className="game-header">
        <div className="header-right">
          <div className="logo-mini">
            <img src="/LOGO.png" alt="Logo" />
          </div>
          <h1>استمتع باللعب أثناء الانتظار</h1>
          <p className="subtitle">الألعاب</p>
          <nav className="game-menu">
            <div className="menu-item active">
              <span className="dot"></span>
              طابق الأزواج
              <span className="icon">◈</span>
            </div>
          </nav>
        </div>
        <div className="header-left">
          <button className="btn btn-exit" onClick={handleExit}>خروج ←</button>
          {gameMode === 'multiplayer' && (
            <div className="room-info">
              <span className="label">كود الغرفة:</span>
              <span className="code">{generatedCode || selectedRoom}</span>
              <div className={`status-dot ${status}`}></div>
            </div>
          )}
        </div>
      </header>

      <div className="game-layout">
        <main className="game-main">
          <Stats 
            pairsMatched={pairsMatched} 
            totalPairs={TOTAL_PAIRS} 
            moves={moves}
          />

          {showWinner && (
            <div className="winner-overlay">
              <div className="winner-card">
                <h2>{me?.isFinished && !isAllFinished ? 'لقد أنهيت اللعبة! 👏' : 'تم انتهاء التحدي! 🎉'}</h2>
                <p>السكور الخاص بك: {pairsMatched}</p>
                {gameMode === 'multiplayer' && !isAllFinished && (
                  <p className="waiting-msg pulse">بانتظار بقية اللاعبين لإنهاء الجولة...</p>
                )}
                {isAllFinished && (
                   <div className="final-ranking">
                      <h3>الترتيب النهائي:</h3>
                      <div className="ranking-list">
                         {playerList.sort((a,b) => b.score - a.score).map((p, idx) => (
                           <div key={p.id} className="rank-item">
                              <span>#{idx + 1} {p.name}</span>
                              <span>{p.score} نقطة {p.id === leaderId ? '👑' : ''}</span>
                           </div>
                         ))}
                      </div>
                      {(!selectedRoom || (me && me.isHost)) && (
                        <button className="btn btn-primary" onClick={handleRestart}>العب مرة أخرى للجميع</button>
                      )}
                   </div>
                )}
                {gameMode === 'solo' && (
                  <button className="btn btn-primary" onClick={initializeGame}>العب مرة أخرى</button>
                )}
              </div>
            </div>
          )}

          <div className={`card-grid pairs-${TOTAL_PAIRS} ${me?.isFinished ? 'dimmed' : ''}`}>
            {cards.map(card => (
              <Card 
                key={card.id}
                {...card}
                onClick={handleCardClick}
              />
            ))}
          </div>

          <div className="game-controls">
            <button className="btn btn-primary" onClick={handleRestart}>إعادة التشغيل</button>
            <button className="btn btn-secondary" onClick={handleExit}>العودة للرئيسية</button>
          </div>
        </main>

        {gameMode === 'multiplayer' && (
          <aside className="game-sidebar">
            <PlayerList players={playerList} myPeerId={myId} leaderId={leaderId} />
          </aside>
        )}
      </div>

      <style>{`
        .game-container { max-width: 1100px; margin: 0 auto; padding: 40px 20px; direction: rtl; }
        .game-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
        .header-left { display: flex; flex-direction: column; align-items: flex-end; gap: 15px; }
        .logo-mini { width: 60px; height: auto; margin-bottom: 16px; }
        .logo-mini img { width: 100%; height: auto; }
        .game-layout { display: flex; gap: 30px; align-items: flex-start; }
        .game-main { flex: 1; max-width: 640px; position: relative; }
        .game-sidebar { width: 300px; position: sticky; top: 20px; }
        .card-grid { display: grid; gap: 16px; margin-bottom: 32px; transition: 0.5s; }
        .card-grid.dimmed { opacity: 0.3; filter: grayscale(1); pointer-events: none; }
        .card-grid.pairs-5 { grid-template-columns: repeat(5, 1fr); }
        .room-info { background-color: #1c2128; padding: 8px 16px; border-radius: 8px; display: flex; align-items: center; gap: 10px; border: 1px solid #30363d; }
        .room-info .code { color: var(--accent); font-weight: 800; font-family: monospace; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; }
        .status-dot.CONNECTED { background-color: #238636; box-shadow: 0 0 5px #238636; }
        .status-dot.CONNECTING { background-color: #d29922; }
        .status-dot.ERROR { background-color: #f85149; }
        .btn { padding: 12px 24px; border-radius: 8px; font-weight: 700; cursor: pointer; border: none; transition: 0.2s; }
        .btn-primary { background-color: var(--accent); color: #000; }
        .btn-secondary { background-color: #30363d; color: var(--text-primary); }
        .btn-exit { background-color: rgba(248, 81, 73, 0.1); color: #f85149; border: 1px solid rgba(248, 81, 73, 0.2); padding: 6px 16px; font-size: 13px; }
        .winner-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(13, 17, 23, 0.9); z-index: 10; display: flex; justify-content: center; align-items: center; border-radius: 12px; }
        .winner-card { background-color: #1c2128; padding: 40px; border-radius: 16px; border: 2px solid var(--accent); text-align: center; max-width: 400px; width: 90%; }
        .waiting-msg { color: var(--accent); margin-top: 15px; font-weight: 600; }
        .final-ranking { margin-top: 25px; padding-top: 20px; border-top: 1px solid #30363d; }
        .ranking-list { margin: 15px 0 25px; display: flex; flex-direction: column; gap: 10px; }
        .rank-item { display: flex; justify-content: space-between; background: #0d1117; padding: 10px 15px; border-radius: 8px; }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        @media (max-width: 900px) { .game-layout { flex-direction: column; } .game-sidebar { width: 100%; position: static; } }
        @media (max-width: 600px) { .card-grid.pairs-5 { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
    </div>
  );
}

export default App;
