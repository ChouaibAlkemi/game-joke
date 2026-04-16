import React from 'react';

interface StatsProps {
  pairsMatched: number;
  totalPairs: number;
  moves: number;
  opponentScore?: number;
  isMultiplayer?: boolean;
}

const Stats: React.FC<StatsProps> = ({ 
  pairsMatched, 
  totalPairs, 
  moves, 
  opponentScore, 
  isMultiplayer 
}) => {
  return (
    <div className="stats-container">
      <div className="stat-box">
        <span className="stat-label">الأزواج المتطابقة</span>
        <div className="stat-value">
          <span className="matched-count">{pairsMatched}</span>
          <span className="total-count">/{totalPairs}</span>
        </div>
      </div>

      {isMultiplayer && (
        <div className="stat-box highlight">
          <span className="stat-label">سكور الخصم</span>
          <div className="stat-value">{opponentScore}</div>
        </div>
      )}

      <div className="stat-box">
        <span className="stat-label">مجموع الحركات</span>
        <div className="stat-value">{moves}</div>
      </div>

      <style>{`
        .stats-container {
          display: flex;
          gap: 20px;
          margin-bottom: 24px;
          width: 100%;
          direction: rtl;
        }

        .stat-box {
          flex: 1;
          background-color: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-box.highlight {
          border-color: var(--accent);
          background-color: var(--accent-muted);
        }

        .stat-label {
          color: var(--text-secondary);
          font-size: 14px;
          font-weight: 600;
        }

        .stat-value {
          color: var(--text-primary);
          font-size: 24px;
          font-weight: 800;
        }

        .matched-count {
          color: var(--text-primary);
        }

        .total-count {
          color: var(--text-secondary);
          font-size: 18px;
        }
      `}</style>
    </div>
  );
};

export default Stats;
