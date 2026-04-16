import { useState, useEffect, useCallback, useMemo } from 'react';
import Stats from './components/Stats';
import Card from './components/Card';
import Lobby from './components/Lobby';
import PlayerList from './components/PlayerList';
import { useMultiplayer } from './hooks/useMultiplayer';

const CARD_IMAGES = [
  '/cards/C1.png',
  '/cards/C2.png',
  '/cards/C3.png',
  '/cards/C4.png',
  '/cards/C5.png',
];

const SPECIAL_CARDS = [
  { content: '💣', type: 'bomb' },
  { content: '🔄', type: 'shuffle' },
  { content: '⚡', type: 'x3' },
];

interface CardType {
  id: number;
  content: string;
  type: 'normal' | 'bomb' | 'shuffle' | 'x3';
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
  const [matchCountRequired, setMatchCountRequired] = useState(2);

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
      // Determine match mode from board content
      const firstNormal = remoteBoard.find(c => c.type === 'normal')?.content;
      const count = remoteBoard.filter(c => c.content === firstNormal).length;
      setMatchCountRequired(count);
    },
    isConnectionActive
  );

  const totalPossibleMatches = useMemo(() => CARD_IMAGES.length, []);

  const isAllFinished = useMemo(() => {
    return playerList.length > 0 && playerList.every(p => p.isFinished);
  }, [playerList]);

  const leaderId = useMemo(() => {
    if (playerList.length === 0) return null;
    return [...playerList].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.isFinished && b.isFinished) return (a.finishTime || 0) - (b.finishTime || 0);
      return 0;
    })[0].id;
  }, [playerList]);

  const initializeBoard = useCallback((matchCount: number) => {
    let cardPool: any[] = [];
    
    // Add normal character cards
    CARD_IMAGES.forEach(content => {
      for (let i = 0; i < matchCount; i++) {
        cardPool.push({ content, type: 'normal' });
      }
    });

    // Add special trap cards
    SPECIAL_CARDS.forEach(special => {
      cardPool.push(special);
    });

    const shuffledBoard = cardPool
      .sort(() => Math.random() - 0.5)
      .map((item, index) => ({
        ...item,
        id: index,
        isFlipped: false,
        isMatched: false,
      }));
    
    setCards(shuffledBoard);
    setFlippedCards([]);
    setPairsMatched(0);
    setMoves(0);
    setLockBoard(false);
    setShowWinner(false);
    setMatchCountRequired(matchCount);

    if (gameMode === 'multiplayer' && (!selectedRoom || playerList.find(p => p.id === myId)?.isHost)) {
      broadcastBoard(shuffledBoard);
    }
  }, [gameMode, selectedRoom, playerList, myId, broadcastBoard]);

  const handleRestart = () => {
    if (gameMode === 'multiplayer') broadcastRestart();
    initializeBoard(2); // Start normal
  };

  useEffect(() => {
    const onRemoteRestart = () => initializeBoard(2);
    window.addEventListener('gamejoke_restart', onRemoteRestart);
    return () => window.removeEventListener('gamejoke_restart', onRemoteRestart);
  }, [initializeBoard]);

  const handleExit = () => {
    setGameMode('lobby');
    setSelectedRoom(undefined);
    setIsConnectionActive(false);
    setCards([]);
    setPairsMatched(0);
  };

  useEffect(() => {
    if (!isConnectionActive || gameMode !== 'lobby') return;
    if (status === 'CONNECTED') {
      setTimeout(() => setGameMode('multiplayer'), 500);
    }
  }, [status, gameMode, isConnectionActive]);

  useEffect(() => {
    if (gameMode !== 'lobby') initializeBoard(2);
  }, [gameMode]); // Removed initializeBoard to prevent loop, first run only

  useEffect(() => {
    if (gameMode === 'multiplayer') {
      const amIFinished = pairsMatched === totalPossibleMatches && totalPossibleMatches > 0;
      updateMyState({ 
        score: pairsMatched, 
        isFinished: amIFinished,
        finishTime: amIFinished ? Date.now() : undefined
      });
    }
    if (pairsMatched === totalPossibleMatches && totalPossibleMatches > 0) {
      setShowWinner(true);
    }
  }, [pairsMatched, gameMode, updateMyState, totalPossibleMatches]);

  const handleCardClick = (id: number) => {
    if (lockBoard || flippedCards.includes(id)) return;
    
    const me = playerList.find(p => p.id === myId);
    if (gameMode === 'multiplayer' && me?.isFinished) return;

    const clickedCard = cards.find(c => c.id === id);
    if (!clickedCard) return;

    // 1. Flip the card visually
    setCards(prev => prev.map(card => card.id === id ? { ...card, isFlipped: true } : card));

    // 2. Handle Special Effects Immediately
    if (clickedCard.type === 'bomb') {
      setLockBoard(true);
      setTimeout(() => {
        setPairsMatched(0);
        setCards(prev => prev.map(c => ({ ...c, isMatched: false, isFlipped: false })));
        setFlippedCards([]);
        setLockBoard(false);
      }, 1000);
      return;
    }

    if (clickedCard.type === 'shuffle') {
      setLockBoard(true);
      setTimeout(() => {
        setPairsMatched(0);
        const currentMatchReq = matchCountRequired;
        initializeBoard(currentMatchReq);
      }, 1000);
      return;
    }

    if (clickedCard.type === 'x3') {
      setLockBoard(true);
      setTimeout(() => {
        initializeBoard(3); // Enter Triple Mode
      }, 1000);
      return;
    }

    // 3. Handle Normal Logic
    const newFlippedCards = [...flippedCards, id];
    setFlippedCards(newFlippedCards);

    if (newFlippedCards.length === matchCountRequired) {
      setMoves(prev => prev + 1);
      setLockBoard(true);
      checkForMatch(newFlippedCards);
    }
  };

  const checkForMatch = (currentFlipped: number[]) => {
    const flippedObjects = currentFlipped.map(id => cards.find(c => c.id === id));
    const firstContent = flippedObjects[0]?.content;
    const allMatch = flippedObjects.every(c => c?.content === firstContent);

    if (allMatch) {
      setTimeout(() => {
        setCards(prev => prev.map(card => 
          currentFlipped.includes(card.id) ? { ...card, isMatched: true } : card
        ));
        setPairsMatched(prev => prev + 1);
        setFlippedCards([]);
        setLockBoard(false);
      }, 600);
    } else {
      setTimeout(() => {
        setCards(prev => prev.map(card => 
          currentFlipped.includes(card.id) ? { ...card, isFlipped: false } : card
        ));
        setFlippedCards([]);
        setLockBoard(false);
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
          <h1>لعبة الذاكرة المطورة</h1>
          <p className="subtitle">{matchCountRequired === 3 ? '⚡ وضع الثلاثي مفعل ⚡' : 'وضع التحدي الذكي'}</p>
        </div>
        <div className="header-left">
          <button className="btn btn-exit" onClick={handleExit}>خروج ←</button>
          {gameMode === 'multiplayer' && (
            <div className="room-info">
              <span className="label">الغرفة:</span>
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
            totalPairs={totalPossibleMatches} 
            moves={moves}
          />

          {showWinner && (
            <div className="winner-overlay">
              <div className="winner-card">
                <h2>{me?.isFinished && !isAllFinished ? 'أنهيت مهمتك! 👏' : 'انتهى التحدي الكبير! 🎉'}</h2>
                <p>النقاط: {pairsMatched} / {totalPossibleMatches}</p>
                {gameMode === 'multiplayer' && !isAllFinished && (
                  <p className="waiting-msg pulse">بانتظار المتحدين الآخرين...</p>
                )}
                {isAllFinished && (
                   <div className="final-ranking">
                      <h3>الترتيب الختامي:</h3>
                      <div className="ranking-list">
                         {playerList.sort((a,b) => b.score - a.score).map((p, idx) => (
                           <div key={p.id} className="rank-item">
                              <span>#{idx + 1} {p.name} {p.id === leaderId ? '👑' : ''}</span>
                              <span>{p.score} نجاح</span>
                           </div>
                         ))}
                      </div>
                      {(!selectedRoom || (me && me.isHost)) && (
                        <button className="btn btn-primary" onClick={handleRestart}>تحدي جديد للكل</button>
                      )}
                   </div>
                )}
                {(gameMode === 'solo' || (isAllFinished && selectedRoom && me && !me.isHost)) && (
                  <button className="btn btn-primary" onClick={() => initializeBoard(2)}>لعب جديد</button>
                )}
              </div>
            </div>
          )}

          <div className={`card-grid pairs-${totalPossibleMatches} ${matchCountRequired === 3 ? 'triple-mode' : ''} ${me?.isFinished ? 'dimmed' : ''}`}>
            {cards.map(card => (
              <Card 
                key={`${card.id}-${matchCountRequired}`}
                {...card}
                onClick={handleCardClick}
              />
            ))}
          </div>

          <div className="game-controls">
            <button className="btn btn-primary" onClick={handleRestart}>إعادة الضبط</button>
            <button className="btn btn-secondary" onClick={handleExit}>القائمة الرئيسية</button>
          </div>
        </main>

        {gameMode === 'multiplayer' && (
          <aside className="game-sidebar">
            <PlayerList players={playerList} myPeerId={myId} leaderId={leaderId} />
          </aside>
        )}
      </div>

      <style>{`
        .game-container { max-width: 1100px; margin: 0 auto; padding: 20px; direction: rtl; }
        .game-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
        .subtitle { color: var(--accent); font-weight: bold; font-size: 14px; margin-top: 5px; }
        .game-layout { display: flex; gap: 20px; flex-wrap: wrap; }
        .game-main { flex: 2; min-width: 320px; position: relative; }
        .game-sidebar { flex: 1; min-width: 250px; }
        .card-grid { display: grid; gap: 12px; margin-bottom: 24px; transition: 0.5s; grid-template-columns: repeat(4, 1fr); }
        .card-grid.triple-mode { gap: 8px; grid-template-columns: repeat(6, 1fr); }
        .card-grid.dimmed { opacity: 0.3; pointer-events: none; }
        .winner-overlay { position: absolute; inset: 0; background: rgba(13, 17, 23, 0.95); z-index: 100; display: flex; align-items: center; justify-content: center; border-radius: 12px; }
        .winner-card { background: #1c2128; padding: 30px; border-radius: 16px; border: 2px solid var(--accent); text-align: center; width: 90%; max-width: 400px; }
        .rank-item { display: flex; justify-content: space-between; padding: 10px; background: #0d1117; border-radius: 8px; margin-bottom: 5px; }
        .btn { border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; }
        .btn-primary { background: var(--accent); color: #000; }
        .btn-secondary { background: #30363d; color: #fff; }
        @media (max-width: 600px) { 
           .card-grid { grid-template-columns: repeat(3, 1fr); } 
           .card-grid.triple-mode { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>
    </div>
  );
}

export default App;
