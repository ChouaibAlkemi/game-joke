import React, { useState, useEffect } from 'react';

interface LobbyProps {
  onSelectMode: (mode: 'solo' | 'multiplayer', playerName: string, roomCode?: string) => void;
  errorMsg?: string | null;
  status: 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
}

const Lobby: React.FC<LobbyProps> = ({ onSelectMode, errorMsg, status }) => {
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (errorMsg) {
      setLocalError(errorMsg);
    }
  }, [errorMsg]);

  const validateAndSelect = (mode: 'solo' | 'multiplayer', code?: string) => {
    if (!playerName.trim()) {
      setLocalError('من فضلك أدخل اسمك أولاً');
      return;
    }
    setLocalError(null);
    onSelectMode(mode, playerName.trim(), code);
  };

  const handleJoinRoom = () => {
    if (roomCode.trim().length < 4) {
      setLocalError('كود الغرفة يجب أن يكون 4 أحرف على الأقل');
      return;
    }
    validateAndSelect('multiplayer', roomCode.trim());
  };

  return (
    <div className="lobby-container fade-in">
      <div className="lobby-content">
        <div className="logo-wrapper">
          <img src="/LOGO.png" alt="Logo" className="main-logo" />
        </div>
        
        <h1 className="lobby-title">استمتع باللعب أثناء الانتظار</h1>

        <div className="name-section">
          <label className="input-label">ما هو اسمك؟</label>
          <input 
            type="text" 
            placeholder="اكتب اسمك هنا..." 
            className="name-input"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={15}
          />
        </div>
        
        {localError && <div className="error-message fade-in">{localError}</div>}
        
        {!showJoinInput ? (
          <div className="mode-selection">
            <button 
              className="lobby-btn primary-btn" 
              onClick={() => validateAndSelect('solo')}
              disabled={status === 'CONNECTING'}
            >
              اللعب بمفردك (أوفلاين)
            </button>
            <button 
              className="lobby-btn secondary-btn" 
              onClick={() => setShowJoinInput(true)}
              disabled={status === 'CONNECTING'}
            >
              اللعب مع الأصدقاء (أونلاين)
            </button>
          </div>
        ) : (
          <div className="join-section fade-in">
            <input 
              type="text" 
              placeholder="أدخل كود الغرفة" 
              className="room-input"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={8}
            />
            <div className="join-actions">
              <button 
                className={`lobby-btn primary-btn ${status === 'CONNECTING' ? 'loading' : ''}`} 
                onClick={handleJoinRoom}
                disabled={status === 'CONNECTING'}
              >
                {status === 'CONNECTING' ? 'جاري التحقق...' : 'انضم الآن'}
              </button>
              <button className="lobby-btn ghost-btn" onClick={() => validateAndSelect('multiplayer')}>
                إنشاء غرفة جديدة
              </button>
              <button className="lobby-btn tertiary-btn" onClick={() => setShowJoinInput(false)}>
                رجوع
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .lobby-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 80vh;
          width: 100%;
          text-align: center;
          padding: 20px;
        }

        .lobby-content {
          max-width: 500px;
          width: 100%;
          background-color: #161b22;
          padding: 40px;
          border-radius: 20px;
          border: 1px solid #30363d;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }

        .logo-wrapper {
          margin-bottom: 30px;
        }

        .main-logo {
          max-width: 200px;
          height: auto;
          filter: drop-shadow(0 0 15px var(--accent-muted));
        }

        .lobby-title {
          font-size: 24px;
          margin-bottom: 40px;
          color: var(--text-primary);
        }

        .name-section {
          margin-bottom: 32px;
          text-align: right;
        }

        .input-label {
          display: block;
          margin-bottom: 8px;
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 14px;
        }

        .name-input {
          width: 100%;
          padding: 14px;
          border-radius: 12px;
          border: 1px solid #30363d;
          background-color: #0d1117;
          color: #fff;
          font-size: 16px;
          text-align: right;
        }

        .name-input:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 2px var(--accent-muted);
        }

        .error-message {
          color: #f85149;
          background-color: rgba(248, 81, 73, 0.1);
          padding: 10px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 14px;
          border: 1px solid rgba(248, 81, 73, 0.2);
        }

        .mode-selection, .join-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .lobby-btn {
          padding: 14px 28px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
        }

        .lobby-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .primary-btn {
          background-color: var(--accent);
          color: #000;
        }

        .secondary-btn {
          background-color: var(--card-bg);
          color: var(--text-primary);
          border: 1px solid #444;
        }

        .ghost-btn {
          background-color: transparent;
          color: var(--accent);
          border: 1.5px solid var(--accent);
        }

        .tertiary-btn {
          background-color: transparent;
          color: var(--text-secondary);
          padding: 8px;
        }

        .room-input {
          padding: 14px;
          border-radius: 12px;
          border: 1px solid #30363d;
          background-color: #0d1117;
          color: #fff;
          font-size: 18px;
          text-align: center;
          font-weight: 700;
          letter-spacing: 2px;
        }

        .loading {
          position: relative;
          color: transparent !important;
        }

        .loading::after {
          content: "";
          position: absolute;
          width: 20px;
          height: 20px;
          top: 50%;
          left: 50%;
          margin: -10px 0 0 -10px;
          border: 2px solid #000;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Lobby;
