import { useState, useEffect, useCallback } from 'react';
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
  const [playerName, setPlayerName] = useState<string>('');
  const [selectedRoom, setSelectedRoom] = useState<string | undefined>(undefined);
  
  const [cards, setCards] = useState<CardType[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [pairsMatched, setPairsMatched] = useState(0);
  const [lockBoard, setLockBoard] = useState(false);
  const [showWinner, setShowWinner] = useState(false);

  const { playerList, myPeerId, status, errorMsg, generatedCode, syncScore } = useMultiplayer(
    selectedRoom, 
    playerName
  );

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
  }, []);

  useEffect(() => {
    if (gameMode !== 'lobby') {
      initializeGame();
    }
  }, [gameMode, initializeGame]);

  useEffect(() => {
    if (gameMode === 'multiplayer') {
      syncScore(pairsMatched);
    }
    
    if (pairsMatched === TOTAL_PAIRS && TOTAL_PAIRS > 0) {
      setShowWinner(true);
    }
  }, [pairsMatched, gameMode, syncScore]);

  const handleCardClick = (id: number) => {
    if (lockBoard || flippedCards.includes(id)) return;

    const newFlippedCards = [...flippedCards, id];
    setFlippedCards(newFlippedCards);

    setCards(prev => prev.map(card => 
      card.id === id ? { ...card, isFlipped: true } : card
    ));

    if (newFlippedCards.length === 2) {
      setMoves(prev => prev + 1);
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
      }, 600);
    } else {
      setLockBoard(true);
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
    if (mode === 'multiplayer' && roomCode) {
      setSelectedRoom(roomCode);
    }
    setGameMode(mode);
  };

  if (gameMode === 'lobby') {
    return (
      <Lobby 
        onSelectMode={handleSelectMode} 
        errorMsg={errorMsg} 
        status={status} 
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
          {gameMode === 'multiplayer' && (
            <div className="room-info">
              <span className="label">كود الغرفة:</span>
              <span className="code">{generatedCode}</span>
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
                <h2>مبروك يا {playerName}! 🎉</h2>
                <p>أنهيت اللعبة بـ {moves} حركة.</p>
                <button className="btn btn-primary" onClick={initializeGame}>العب مرة أخرى</button>
              </div>
            </div>
          )}

          <div className={`card-grid pairs-${TOTAL_PAIRS}`}>
            {cards.map(card => (
              <Card 
                key={card.id}
                {...card}
                onClick={handleCardClick}
              />
            ))}
          </div>

          <div className="game-controls">
            <button className="btn btn-primary" onClick={initializeGame}>إعادة التشغيل</button>
            <button className="btn btn-secondary" onClick={() => setGameMode('lobby')}>العودة للرئيسية</button>
          </div>
        </main>

        {gameMode === 'multiplayer' && (
          <aside className="game-sidebar">
            <PlayerList players={playerList} myPeerId={myPeerId} />
          </aside>
        )}
      </div>

      <style>{`
        .game-container {
          max-width: 1100px;
          margin: 0 auto;
          padding: 40px 20px;
          direction: rtl;
        }

        .game-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 40px;
        }

        .logo-mini { width: 60px; height: auto; margin-bottom: 16px; }
        .logo-mini img { width: 100%; height: auto; }

        .game-layout {
          display: flex;
          gap: 30px;
          align-items: flex-start;
        }

        .game-main { flex: 1; max-width: 640px; position: relative; }
        .game-sidebar { width: 300px; position: sticky; top: 20px; }

        .card-grid { display: grid; gap: 16px; margin-bottom: 32px; }
        .card-grid.pairs-5 { grid-template-columns: repeat(5, 1fr); }

        .room-info {
          background-color: #1c2128;
          padding: 8px 16px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid #30363d;
        }

        .room-info .code { color: var(--accent); font-weight: 800; }

        .status-dot { width: 8px; height: 8px; border-radius: 50%; }
        .status-dot.CONNECTED { background-color: #238636; }
        .status-dot.CONNECTING { background-color: #d29922; }
        .status-dot.ERROR { background-color: #f85149; }

        .btn { padding: 12px 24px; border-radius: 8px; font-weight: 700; cursor: pointer; border: none; }
        .btn-primary { background-color: var(--accent); color: #000; }
        .btn-secondary { background-color: #30363d; color: var(--text-primary); }

        .winner-overlay {
          position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          background-color: rgba(13, 17, 23, 0.9); z-index: 10;
          display: flex; justify-content: center; align-items: center; border-radius: 12px;
        }

        .winner-card {
           background-color: #1c2128; padding: 40px; border-radius: 16px;
           border: 2px solid var(--accent); text-align: center;
        }

        @media (max-width: 900px) {
          .game-layout { flex-direction: column; }
          .game-sidebar { width: 100%; position: static; }
        }

        @media (max-width: 600px) {
          .card-grid.pairs-5 { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}

export default App;
