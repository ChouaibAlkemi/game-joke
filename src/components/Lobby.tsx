import React, { useState, useEffect } from 'react';

interface LobbyProps {
  onSelectMode: (mode: 'solo' | 'multiplayer', playerName: string, roomCode?: string) => void;
  errorMsg?: string | null;
  status: 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
  detailedStatus?: string;
  logs?: string[];
  myPeerId?: string | null;
}

const Lobby: React.FC<LobbyProps> = ({ 
  onSelectMode, 
  errorMsg, 
  status, 
  detailedStatus, 
  logs = [],
  myPeerId 
}) => {
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('gamejoke_player_name') || '');
  const [localError, setLocalError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);

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
    localStorage.setItem('gamejoke_player_name', playerName.trim());
    onSelectMode(mode, playerName.trim(), code);
  };

  const handleJoinRoom = () => {
    if (roomCode.trim().length < 4) {
      setLocalError('كود الغرفة يجب أن يكون 4 أحرف على الأقل');
      return;
    }
    validateAndSelect('multiplayer', roomCode.trim());
  };

  const handleRoomCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setRoomCode(val);
    if (localError) setLocalError(null);
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
            onChange={(e) => {
              setPlayerName(e.target.value);
              if (localError) setLocalError(null);
            }}
            maxLength={15}
          />
        </div>
        
        {localError && <div className="error-message fade-in">{localError}</div>}
        
        {status === 'CONNECTING' && detailedStatus && (
          <div className="connecting-info fade-in">
            <div className="spinner"></div>
            <p>{detailedStatus}</p>
          </div>
        )}
        
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
              onChange={handleRoomCodeChange}
              maxLength={8}
            />
            <div className="join-actions">
              <button 
                className={`lobby-btn primary-btn ${status === 'CONNECTING' ? 'loading' : ''}`} 
                onClick={handleJoinRoom}
                disabled={status === 'CONNECTING'}
              >
                {status === 'CONNECTING' ? 'سيفحص...' : 'انضم الآن'}
              </button>
              <button 
                className="lobby-btn ghost-btn" 
                onClick={() => validateAndSelect('multiplayer')}
                disabled={status === 'CONNECTING'}
              >
                إنشاء غرفة جديدة
              </button>
              <button className="lobby-btn tertiary-btn" onClick={() => setShowJoinInput(false)}>
                رجوع
              </button>
            </div>
          </div>
        )}

        <div className="debug-toggle" onClick={() => setShowDebug(!showDebug)}>
          {showDebug ? 'إخفاء سجل الاتصال ▲' : 'إظهار سجل الاتصال التقني ▼'}
        </div>

        {showDebug && (
          <div className="debug-panel fade-in">
            <div className="debug-header">
              <span>هوية الجهاز: {myPeerId || '... جارِ الجلب'}</span>
              <span className={`status-badge ${status}`}>{status}</span>
            </div>
            <div className="debug-logs">
              {logs.length > 0 ? logs.map((log, i) => (
                <div key={i} className="log-line">{log}</div>
              )) : <div className="log-line empty">لا توجد سجلات بعد...</div>}
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

        .logo-wrapper { margin-bottom: 30px; }
        .main-logo { max-width: 200px; height: auto; filter: drop-shadow(0 0 15px var(--accent-muted)); }
        .lobby-title { font-size: 24px; margin-bottom: 40px; color: var(--text-primary); }
        .name-section { margin-bottom: 32px; text-align: right; }
        .input-label { display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 14px; }

        .name-input, .room-input {
          width: 100%; padding: 14px; border-radius: 12px; border: 1px solid #30363d;
          background-color: #0d1117; color: #fff; font-size: 16px; text-align: right;
        }

        .room-input { text-align: center; font-weight: 700; letter-spacing: 2px; }
        .error-message { color: #f85149; background-color: rgba(248, 81, 73, 0.1); padding: 10px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; }

        .connecting-info {
          display: flex; align-items: center; justify-content: center; gap: 12px;
          padding: 15px; background: rgba(0, 215, 192, 0.1); border-radius: 10px; margin-bottom: 20px;
        }

        .spinner { width: 16px; height: 16px; border: 2px solid var(--accent); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; }

        .mode-selection, .join-section { display: flex; flex-direction: column; gap: 16px; }
        .lobby-btn { padding: 14px 28px; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer; border: none; transition: 0.2s; }
        .primary-btn { background: var(--accent); color: #000; }
        .secondary-btn { background: #30363d; color: var(--text-primary); }
        .ghost-btn { background: transparent; color: var(--accent); border: 1.5px solid var(--accent); }
        .tertiary-btn { background: transparent; color: var(--text-secondary); }

        .debug-toggle {
          margin-top: 30px; font-size: 12px; color: var(--text-secondary); cursor: pointer;
          text-decoration: underline; opacity: 0.7;
        }

        .debug-panel {
          margin-top: 20px; text-align: left; background: #0d1117; border-radius: 10px;
          border: 1px solid #30363d; overflow: hidden;
        }

        .debug-header {
          padding: 8px 12px; background: #1c2128; font-size: 11px; color: var(--text-secondary);
          display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #30363d;
        }

        .status-badge { padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 800; }
        .status-badge.CONNECTED { background: #238636; color: #fff; }
        .status-badge.CONNECTING { background: #d29922; color: #fff; }
        .status-badge.ERROR { background: #f85149; color: #fff; }

        .debug-logs {
          padding: 10px; font-family: monospace; font-size: 10px; max-height: 150px;
          overflow-y: auto; color: #8b949e; line-height: 1.4;
        }

        .log-line { border-bottom: 1px solid #21262d; padding: 2px 0; }
        .log-line.empty { text-align: center; padding: 20px; opacity: 0.5; }

        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default Lobby;
