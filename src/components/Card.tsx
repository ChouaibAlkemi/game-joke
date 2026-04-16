import React from 'react';

interface CardProps {
  id: number;
  content: string;
  type: 'normal' | 'bomb' | 'shuffle' | 'x3';
  isFlipped: boolean;
  isMatched: boolean;
  isHidden: boolean;
  onClick: (id: number) => void;
}

const Card: React.FC<CardProps> = ({ id, content, type, isFlipped, isMatched, isHidden, onClick }) => {
  return (
    <div 
      className={`card-wrapper ${isFlipped ? 'flipped' : ''} ${isMatched ? 'matched' : ''} ${isHidden ? 'is-hidden' : ''} type-${type}`}
      onClick={() => !isFlipped && !isMatched && !isHidden && onClick(id)}
    >
      <div className="card-inner">
        <div className="card-front">
          <div className="logo-placeholder">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 12L12 22L22 12L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fill="currentColor" fontSize="8" style={{fontFamily: 'sans-serif'}}>-n-</text>
            </svg>
          </div>
        </div>
        <div className="card-back">
          {type === 'normal' ? (
            <img src={content} alt="Card Character" className="card-image" />
          ) : (
            <div className={`special-icon icon-${type}`}>{content}</div>
          )}
        </div>
      </div>

      <style>{`
        .card-wrapper {
          aspect-ratio: 1 / 1;
          perspective: 1000px;
          cursor: pointer;
          transition: transform 0.2s ease;
        }

        .card-wrapper:hover:not(.flipped):not(.matched) {
          transform: translateY(-4px);
        }

        .card-wrapper.is-hidden {
          visibility: hidden;
          opacity: 0;
          pointer-events: none;
          transition: 0.5s;
        }

        .card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          text-align: center;
          transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
          transform-style: preserve-3d;
        }

        .flipped .card-inner {
          transform: rotateY(180deg);
        }

        .matched .card-inner {
          transform: rotateY(180deg);
        }

        .card-front, .card-back {
          position: absolute;
          width: 100%;
          height: 100%;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .card-front {
          background-color: var(--card-bg);
          border: 1px solid #30363d;
          color: var(--text-secondary);
        }

        .card-wrapper.flipped .card-front,
        .card-wrapper.matched .card-front {
           border-color: var(--accent);
        }

        .card-back {
          background-color: rgba(22, 27, 34, 0.5);
          color: var(--accent);
          transform: rotateY(180deg);
          border: 2px solid var(--accent);
          overflow: hidden;
        }

        /* Special Card Styles */
        .type-bomb .card-back { background-color: #440000; border-color: #f85149; }
        .type-shuffle .card-back { background-color: #002244; border-color: #388bfd; }
        .type-x3 .card-back { background-color: #443300; border-color: #d29922; }

        .special-icon {
          font-size: 48px;
          filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.3));
          animation: bounce 2s infinite;
        }

        .icon-bomb { color: #f85149; }
        .icon-shuffle { color: #388bfd; }
        .icon-x3 { color: #d29922; }

        @keyframes bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        .card-image {
          width: 80%;
          height: 80%;
          object-fit: contain;
          filter: drop-shadow(0 0 5px rgba(0, 0, 0, 0.5));
        }

        .matched .card-back {
          background-color: var(--accent-muted);
          border-color: var(--accent);
          opacity: 0.8;
        }

        .logo-placeholder {
          width: 40px;
          height: 40px;
          opacity: 0.5;
        }

        @keyframes success-pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }

        .matched {
          animation: success-pulse 0.4s ease-out;
        }
      `}</style>
    </div>
  );
};

export default Card;
