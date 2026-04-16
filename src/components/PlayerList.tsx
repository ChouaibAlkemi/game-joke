import React from 'react';

interface Player {
  peerId: string;
  name: string;
  icon: string;
  score: number;
  isHost?: boolean;
}

interface PlayerListProps {
  players: Player[];
  myPeerId?: string;
  leaderId?: string | null;
}

const PlayerList: React.FC<PlayerListProps> = ({ players, myPeerId, leaderId }) => {
  return (
    <div className="player-list-container">
      <h3 className="list-title">ترتيب المتحدين</h3>
      <div className="players-grid">
        {players.sort((a,b) => b.score - a.score).map((player) => (
          <div 
            key={player.id} 
            className={`player-item ${player.id === myPeerId ? 'is-me' : ''} ${player.isFinished ? 'finished' : ''}`}
          >
            <div className="player-avatar">
               {player.icon}
               {player.id === leaderId && <span className="leader-crown">👑</span>}
            </div>
            <div className="player-info">
              <span className="player-name">
                {player.name}
                {player.id === myPeerId && <span className="me-badge">(أنت)</span>}
                {player.isFinished && <span className="finish-check" title="أنهى اللعبة">✅</span>}
              </span>
              <span className="player-score">سكور: {player.score}</span>
            </div>
            {player.isHost && <span className="host-icon" title="مضيف الغرفة">🏠</span>}
          </div>
        ))}
      </div>

      <style>{`
        .player-list-container {
          background-color: #161b22;
          border: 1px solid #30363d;
          border-radius: 12px;
          padding: 16px;
          width: 100%;
          margin-bottom: 24px;
          direction: rtl;
        }

        .list-title {
          font-size: 14px;
          color: var(--text-secondary);
          margin-bottom: 12px;
          font-weight: 700;
        }

        .players-grid {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .player-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          background-color: #0d1117;
          border-radius: 8px;
          border: 1px solid transparent;
          position: relative;
        }

        .player-item.is-me {
          border-color: var(--accent-muted);
          background-color: rgba(0, 215, 192, 0.05);
        }

        .player-item.finished {
          opacity: 0.8;
          background-color: #1c2128;
        }

        .player-avatar {
          font-size: 24px;
          background-color: #1c2128;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          position: relative;
        }

        .leader-crown {
          position: absolute;
          top: -12px;
          right: -5px;
          font-size: 18px;
          transform: rotate(15deg);
        }

        .finish-check {
          font-size: 14px;
          margin-right: 8px;
        }

        .player-info {
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .player-name {
          font-weight: 700;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .me-badge {
          font-size: 11px;
          color: var(--accent);
          font-weight: 400;
        }

        .player-score {
          font-size: 12px;
          color: var(--text-secondary);
        }

        .host-icon {
          font-size: 14px;
        }
      `}</style>
    </div>
  );
};

export default PlayerList;
