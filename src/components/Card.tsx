import React from 'react';

interface CardProps {
  id: number;
  content: string; // This will now be the image URL
  isFlipped: boolean;
  isMatched: boolean;
  onClick: (id: number) => void;
}

const Card: React.FC<CardProps> = ({ id, content, isFlipped, isMatched, onClick }) => {
  return (
    <div 
      className={`card-wrapper ${isFlipped ? 'flipped' : ''} ${isMatched ? 'matched' : ''}`}
      onClick={() => !isFlipped && !isMatched && onClick(id)}
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
          <img src={content} alt="Card Character" className="card-image" />
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
          background-color: rgba(22, 27, 34, 0.5); /* Semi-transparent background */
          color: var(--accent);
          transform: rotateY(180deg);
          border: 2px solid var(--accent);
          overflow: hidden;
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
