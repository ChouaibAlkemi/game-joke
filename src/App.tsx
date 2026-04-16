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
  isHidden: boolean; 
  foundBy?: string; // Tracks who matched the card
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
    (remoteBoard) => setCards(remoteBoard),
    isConnectionActive
  );

  const me = useMemo(() => playerList.find(p => p.id === myId), [playerList, myId]);
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

  const initializeBoard = useCallback(() => {
    let cardPool: any[] = [];
    
    // Start with 2 instances (Normal mode)
    CARD_IMAGES.forEach(content => {
      for (let i = 0; i < 2; i++) {
        cardPool.push({ content, type: 'normal' });
      }
    });

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
        isHidden: false,
      }));
    
    setCards(shuffledBoard);
    setFlippedCards([]);
    setPairsMatched(0);
    setMoves(0);
    setLockBoard(false);
    setShowWinner(false);

    if (gameMode === 'multiplayer' && (!selectedRoom || me?.isHost)) {
      broadcastBoard(shuffledBoard);
    }
  }, [gameMode, selectedRoom, me, broadcastBoard]);

  const handleRestart = () => {
    if (gameMode === 'multiplayer') broadcastRestart();
    updateMyState({ matchCountRequired: 2, score: 0, isFinished: false });
    initializeBoard();
  };

  useEffect(() => {
    const onRemoteRestart = () => {
      updateMyState({ matchCountRequired: 2, score: 0, isFinished: false });
      initializeBoard();
    };
    window.addEventListener('gamejoke_restart', onRemoteRestart);
    return () => window.removeEventListener('gamejoke_restart', onRemoteRestart);
  }, [initializeBoard, updateMyState]);

  useEffect(() => {
    if (!isConnectionActive || gameMode !== 'lobby') return;
    if (status === 'CONNECTED') {
      setTimeout(() => setGameMode('multiplayer'), 500);
    }
  }, [status, gameMode, isConnectionActive]);

  useEffect(() => {
    if (gameMode !== 'lobby') initializeBoard();
  }, [gameMode]);

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

  const triggerDynamicX3 = useCallback(() => {
    setLockBoard(true);
    updateMyState({ matchCountRequired: 3 });

    // 1. Identify unmatched character types
    const matchedContents = new Set(cards.filter(c => c.isMatched).map(c => c.content));
    const unmatchedNormalContents = CARD_IMAGES.filter(c => !matchedContents.has(c));

    // 2. Add 3rd instance for each unmatched type
    const newCardsToAdd = unmatchedNormalContents.map((content, idx) => ({
      id: cards.length + idx,
      content,
      type: 'normal' as const,
      isFlipped: false,
      isMatched: false,
      isHidden: false,
    }));

    const allCurrentCards = [...cards, ...newCardsToAdd].map((c, i) => ({ ...c, id: i, isFlipped: false }));
    const resultBoard = allCurrentCards.sort(() => Math.random() - 0.5).map((c, i) => ({ ...c, id: i }));

    setTimeout(() => {
      setCards(resultBoard);
      if (gameMode === 'multiplayer') broadcastBoard(resultBoard);
      setLockBoard(false);
    }, 1000);
  }, [cards, gameMode, broadcastBoard, updateMyState]);

  const handleExit = () => {
    setGameMode('lobby');
    setSelectedRoom(undefined);
    setIsConnectionActive(false);
    setCards([]);
  };

  const handleCardClick = (id: number) => {
    if (lockBoard || flippedCards.includes(id)) return;
    if (gameMode === 'multiplayer' && me?.isFinished) return;

    const clickedCard = cards.find(c => c.id === id);
    if (!clickedCard || clickedCard.isHidden || clickedCard.isMatched) return;

    const myMatchReq = me?.matchCountRequired || 2;

    const updatedCards = cards.map(card => card.id === id ? { ...card, isFlipped: true } : card);
    setCards(updatedCards);

    // Trap handling
    if (clickedCard.type !== 'normal') {
      setLockBoard(true);
      setTimeout(() => {
        let finalCards = updatedCards.map(c => {
          if (c.id === id) return { ...c, isHidden: true };
          
          if (clickedCard.type === 'bomb') {
            // Bomb: Release only cards FOUND BY ME
            if (c.foundBy === myId) {
              return { ...c, isMatched: false, isFlipped: false, foundBy: undefined };
            }
          }

          if (clickedCard.type === 'shuffle') {
            // Global Shuffle: Flip all back and reset progress
             return { ...c, isMatched: false, isFlipped: false, foundBy: undefined };
          }
          return c;
        });

        if (clickedCard.type === 'bomb' || clickedCard.type === 'shuffle') {
          setPairsMatched(0);
        }

        if (clickedCard.type === 'x3') {
          triggerDynamicX3();
          return;
        }

        if (clickedCard.type === 'shuffle') {
           finalCards = finalCards.sort(() => Math.random() - 0.5).map((c, i) => ({ ...c, id: i }));
        }
        
        setCards(finalCards);
        if (gameMode === 'multiplayer') broadcastBoard(finalCards);
        setLockBoard(false);
      }, 800);
      return;
    }

    const newFlippedCards = [...flippedCards, id];
    setFlippedCards(newFlippedCards);

    if (newFlippedCards.length === myMatchReq) {
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
        const newCards = cards.map(card => 
          currentFlipped.includes(card.id) ? { ...card, isMatched: true, foundBy: myId } : card
        );
        setCards(newCards);
        setPairsMatched(prev => prev + 1);
        setFlippedCards([]);
        setLockBoard(false);
        if (gameMode === 'multiplayer') broadcastBoard(newCards);
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

  return (
    <div className="game-container fade-in">
      <header className="game-header">
        <div className="header-right">
          <div className="logo-mini">
            <img src="/LOGO.png" alt="Logo" />
          </div>
          <h1>لعبة الذاكرة المطورة</h1>
          <p className={`subtitle ${me?.matchCountRequired === 3 ? 'warning-text' : ''}`}>
            {me?.matchCountRequired === 3 ? '⚠️ وضع التحدي الثلاثي مفعل لديك ⚠️' : 'مطابقة زوجية قياسية'}
          </p>
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
              <div className="winner-card shadow-lg">
                <h2>{me?.isFinished && !isAllFinished ? 'المرحلة الأولى انتهت! 👏' : 'اكتملت جميع التحديات! 🎉'}</h2>
                <div className={`leader-indicator ${leaderId === myId ? 'is-winner' : ''}`}>
                   {leaderId === myId ? 'أنت ملك الذاكرة حالياً! 👑' : 'ننتظر النتيجة النهائية'}
                </div>
                {gameMode === 'multiplayer' && !isAllFinished && (
                  <p className="waiting-msg pulse">المنافس لا يزال يجمع الصور...</p>
                )}
                {isAllFinished && (
                   <div className="final-ranking">
                      <div className="ranking-list">
                         {playerList.sort((a,b) => b.score - a.score).map((p, idx) => (
                           <div key={p.id} className="rank-item">
                              <span>#{idx + 1} {p.name} {p.id === leaderId ? '👑' : ''}</span>
                              <span>{p.score} نقطة</span>
                           </div>
                         ))}
                      </div>
                      {(!selectedRoom || (me && me.isHost)) && (
                        <button className="btn btn-primary" onClick={handleRestart}>خوض تحدي جديد</button>
                      )}
                   </div>
                )}
                {(gameMode === 'solo' || (isAllFinished && selectedRoom && me && !me.isHost)) && (
                  <button className="btn btn-primary" onClick={initializeBoard}>لعب فردي جديد</button>
                )}
              </div>
            </div>
          )}

          <div className={`card-grid size-${cards.length} ${me?.isFinished ? 'dimmed' : ''}`}>
            {cards.map(card => (
              <Card 
                key={`${card.id}`}
                {...card}
                onClick={handleCardClick}
              />
            ))}
          </div>

          <div className="game-controls">
            <button className="btn btn-primary" onClick={handleRestart}>تصفير اللعبة</button>
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
        .game-container { max-width: 1200px; margin: 0 auto; padding: 15px; direction: rtl; }
        .game-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
        .subtitle { color: var(--accent); font-weight: bold; font-size: 14px; margin-top: 5px; }
        .warning-text { color: #d29922; animation: blink 1s infinite; }
        @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        
        .game-layout { display: flex; gap: 20px; flex-wrap: wrap; }
        .game-main { flex: 2; min-width: 320px; position: relative; }
        .game-sidebar { flex: 1; min-width: 280px; }
        
        .card-grid { 
          display: grid; 
          gap: 10px; 
          margin-bottom: 24px; 
          transition: 0.5s; 
          grid-template-columns: repeat(4, 1fr); 
        }
        
        @media (min-width: 1000px) {
          .card-grid { grid-template-columns: repeat(5, 1fr); }
          .card-grid.size-18 { grid-template-columns: repeat(6, 1fr); }
        }

        .card-grid.dimmed { opacity: 0.15; pointer-events: none; }
        
        .winner-overlay { position: absolute; inset: 0; background: rgba(13, 17, 23, 0.99); z-index: 1000; display: flex; align-items: center; justify-content: center; border-radius: 12px; }
        .winner-card { background: #1c2128; padding: 40px; border-radius: 20px; border: 2px solid var(--accent); text-align: center; width: 95%; max-width: 480px; box-shadow: 0 0 60px rgba(0,215,192,0.2); }
        .leader-indicator { margin-bottom: 20px; font-size: 18px; font-weight: 800; color: var(--text-secondary); }
        .leader-indicator.is-winner { color: var(--accent); }
        
        .rank-item { display: flex; justify-content: space-between; padding: 12px; background: #0d1117; border-radius: 12px; margin-bottom: 8px; border: 1px solid #30363d; font-size: 15px; }
        .btn { border: none; padding: 14px 28px; border-radius: 12px; cursor: pointer; font-weight: 800; font-size: 16px; transition: 0.3s; }
        .btn-primary { background: var(--accent); color: #000; box-shadow: 0 4px 15px rgba(0, 215, 192, 0.3); }
        .btn-primary:hover { transform: scale(1.02); }
        .btn-secondary { background: #21262d; color: #fff; }
        
        .waiting-msg { color: var(--accent); margin: 25px 0; font-weight: 800; }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
        
        .logo-mini { width: 50px; height: auto; margin-bottom: 10px; }
        .logo-mini img { width: 100%; height: auto; filter: drop-shadow(0 0 5px var(--accent-muted)); }

        @media (max-width: 600px) { 
           .card-grid { grid-template-columns: repeat(3, 1fr); gap: 8px; } 
           .game-container { padding: 8px; }
           .winner-card { padding: 25px; }
        }
      `}</style>
    </div>
  );
}

export default App;
