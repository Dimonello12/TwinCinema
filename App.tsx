import React, { useState, useEffect, useCallback, useRef } from 'react';
import { VideoPlayer } from './components/VideoPlayer';
import { ControlPanel } from './components/ControlPanel';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { initializeDiscordSdk, mockDiscordSetup, isDiscordEnvironment, setInstanceId, getInstanceId } from './services/discordService';
import { syncService } from './services/syncService';
import { DiscordUser, VideoState, Participant, FavoriteItem } from './types';
import { Crown, Loader2, Pause, AlertTriangle, Menu, Play, Users, ArrowRight, X, Save, Minimize, Maximize, Star } from 'lucide-react';

const App: React.FC = () => {
  // App Lifecycle States
  const [appState, setAppState] = useState<'LOADING' | 'LANDING' | 'APP'>('LOADING');
  
  // Data States
  const [discordUser, setDiscordUser] = useState<DiscordUser | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [partyCode, setPartyCode] = useState<string>('');
  
  const [videoState, setVideoState] = useState<VideoState>({
    url: '',
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
  });
  
  // Local Player State
  const [seekRequest, setSeekRequest] = useState<number | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [transferModal, setTransferModal] = useState<{isOpen: boolean, targetId: string, targetName: string} | null>(null);
  
  // UI State
  const [showControls, setShowControls] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile sidebar
  const [isIdle, setIsIdle] = useState(false); // Idle mode
  const [saveModalOpen, setSaveModalOpen] = useState(false); // Favorites modal
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const idleTimeoutRef = useRef<number | null>(null);
  const isHost = discordUser?.id === hostId;

  // --- Initialization ---

  useEffect(() => {
  const init = async () => {
    try {
      // 1. Environment Preparation
      // If we aren't in Discord, we MUST run the mock setup before initializing the SDK
      if (!isDiscordEnvironment()) {
        mockDiscordSetup(); 
      }

      // 2. Initialize SDK & Set User
      // This works for both real Discord and the Mocked Web environment
      const user = await initializeDiscordSdk();
      setDiscordUser(user);
      
      // 3. Routing Logic (The "Smart" Bridge)
      if (isDiscordEnvironment()) {
        // Inside Discord: Always try to auto-join the activity session
        connectToParty(user);
      } else {
        // Inside Web: Check if the URL contains a valid Instance/Room ID
        const urlInstanceId = getInstanceId();
        
        // If a valid ID exists (and it's not the default dev string), connect to it
        if (urlInstanceId && urlInstanceId !== "local-dev-room") {
          console.log(`Web client joining specific instance: ${urlInstanceId}`);
          connectToParty(user);
        } else {
          // No room code? Show the landing page to create/join manually
          setAppState('LANDING');
        }
      }
    } catch (e) {
      console.error("Initialization failed:", e);
      // Fallback to landing if everything breaks
      setAppState('LANDING');
    }
  };

  init();
}, []);

  const connectToParty = (user: DiscordUser) => {
    setAppState('APP');
    setPartyCode(syncService.getInstanceId());
    
    // Connect to Sync Service
    syncService.connect(
      user.id, 
      (remoteState) => {
        setHostId(remoteState.hostId || null);
        if (remoteState.participants) {
          setParticipants(remoteState.participants);
        }

        setVideoState(prev => {
          const localVolume = prev.volume;
          const timeDiff = Math.abs(prev.currentTime - remoteState.currentTime);
          const shouldUpdateTime = timeDiff > 2 || !prev.isPlaying;

          if (shouldUpdateTime) {
            setSeekRequest(remoteState.currentTime);
          }

          return {
            ...prev,
            url: remoteState.url,
            isPlaying: remoteState.isPlaying,
            currentTime: shouldUpdateTime ? remoteState.currentTime : prev.currentTime,
            volume: localVolume 
          };
        });
      },
      { username: user.username, avatar: user.avatar }
    );
  };

  // --- Host Synchronization Heartbeat ---
  // Broadcasts Host's actual time every 4s to ensure server/clients are aligned with Host
  useEffect(() => {
    if (!isHost || !videoState.isPlaying) return;
    const interval = setInterval(() => {
        broadcastUpdate({ currentTime: videoState.currentTime });
    }, 4000);
    return () => clearInterval(interval);
  }, [isHost, videoState.isPlaying, videoState.currentTime]);


  // --- Web Landing Page Logic ---
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleWebCreateParty = () => {
    if (!discordUser) return;
    const newId = Math.random().toString(36).substring(2, 10).toUpperCase();
    setInstanceId(newId);
    connectToParty(discordUser);
  };

  const handleWebJoinParty = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    if (!discordUser || !joinCode.trim()) return;

    // Validate if party exists
    try {
        const res = await fetch(`/api/party/${joinCode.trim()}`);
        const data = await res.json();
        if (!res.ok || !data.exists) {
            setJoinError("Party not found!");
            return;
        }
    } catch (e) {
        setJoinError("Connection failed.");
        return;
    }
    
    setInstanceId(joinCode.trim()); 
    connectToParty(discordUser);
  };


  // --- Sync Actions ---
  const broadcastUpdate = (updates: Partial<VideoState>) => {
    if (!isHost) return;
    const { volume, ...safeUpdates } = updates;
    syncService.updateState(safeUpdates);
    setVideoState(prev => ({ ...prev, ...updates }));
  };

const handleUrlChange = useCallback((newUrl: string) => {
  if (isDiscordEnvironment()) {
    // Если мы в Дискорде и ссылка ведет на Ютуб
    if (newUrl.includes('youtube.com') || newUrl.includes('youtu.be')) {
      // Здесь можно либо выводить ошибку, либо ничего не делать
      console.warn("YouTube disabled in Discord due to Proxy issues");
      return; 
    }
  }
  // Если всё ок (или мы в браузере), обновляем состояние
  broadcastUpdate({ url: newUrl, isPlaying: true, currentTime: 0 });
}, [isHost]);

  const handlePlayPause = useCallback((isPlaying: boolean) => {
    broadcastUpdate({ isPlaying, currentTime: videoState.currentTime });
  }, [isHost, videoState.currentTime]);

  const handleSeek = useCallback((time: number) => {
    setSeekRequest(time);
    broadcastUpdate({ currentTime: time });
  }, [isHost]);

  const handleTimeUpdate = useCallback((time: number) => {
    setVideoState(prev => ({ ...prev, currentTime: time }));
  }, []);

  const handleDurationChange = useCallback((duration: number) => {
    setVideoState(prev => ({ ...prev, duration }));
  }, []);

  const handleVolumeChange = useCallback((volume: number) => {
    setVideoState(prev => ({ ...prev, volume }));
  }, []);

  // --- Interaction & Idle Mode ---

  const resetIdleTimer = useCallback(() => {
    setIsIdle(false);
    setShowControls(true);
    
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    if (idleTimeoutRef.current) window.clearTimeout(idleTimeoutRef.current);

    // Hide controls after 3s if playing
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (videoState.isPlaying) setShowControls(false);
    }, 3000);

    // Enter full idle mode (hide sidebar toggle, headers) after 3s if playing
    idleTimeoutRef.current = window.setTimeout(() => {
       if (videoState.isPlaying) setIsIdle(true);
    }, 3000);
  }, [videoState.isPlaying]);

  const handleUserActivity = () => {
    resetIdleTimer();
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    return () => {
        window.removeEventListener('mousemove', handleUserActivity);
        window.removeEventListener('touchstart', handleUserActivity);
        window.removeEventListener('keydown', handleUserActivity);
    };
  }, [handleUserActivity]);


  // --- Fullscreen & Hotkeys ---

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    const doc = document as any;
    const el = containerRef.current as any;
    const isNativeFullscreen = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);

    if (isFullscreen || isNativeFullscreen) {
        if (isNativeFullscreen) {
            try {
                if (doc.exitFullscreen) await doc.exitFullscreen();
                else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
                else if (doc.mozCancelFullScreen) await doc.mozCancelFullScreen();
                else if (doc.msExitFullscreen) await doc.msExitFullscreen();
            } catch (e) {}
        }
        setIsFullscreen(false);
    } else {
        try {
            if (el.requestFullscreen) await el.requestFullscreen();
            else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
            else if (el.mozRequestFullScreen) await el.mozRequestFullScreen();
            else if (el.msRequestFullscreen) await el.msRequestFullscreen();
        } catch (e) { } 
        finally {
            setIsFullscreen(true);
        }
    }
  }, [isFullscreen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
         if (isFullscreen) {
             const doc = document as any;
             const isNative = !!(doc.fullscreenElement || doc.webkitFullscreenElement);
             if (!isNative) setIsFullscreen(false);
         }
      }
      if (!isHost) return;
      if (e.target instanceof HTMLInputElement) return;

      switch(e.code) {
        case 'Space': e.preventDefault(); handlePlayPause(!videoState.isPlaying); break;
        case 'ArrowLeft': handleSeek(Math.max(0, videoState.currentTime - 5)); break;
        case 'ArrowRight': handleSeek(Math.min(videoState.duration, videoState.currentTime + 5)); break;
      }
      resetIdleTimer();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHost, videoState, handlePlayPause, handleSeek, isFullscreen, resetIdleTimer]);


  // --- Favorites Logic ---
  const [favName, setFavName] = useState('');
  const [saveTimestamp, setSaveTimestamp] = useState(false);

  const handleSaveFavorite = () => {
    if (!videoState.url) return;
    const newFav: FavoriteItem = {
      id: Date.now().toString(),
      name: favName || 'Untitled Video',
      url: videoState.url,
      timestamp: saveTimestamp ? videoState.currentTime : 0,
      createdAt: Date.now()
    };
    
    try {
      const existing = JSON.parse(localStorage.getItem('tc_favorites') || '[]');
      const updated = [newFav, ...existing];
      localStorage.setItem('tc_favorites', JSON.stringify(updated));
      window.dispatchEvent(new Event('favoritesUpdated'));
      setSaveModalOpen(false);
      setFavName('');
    } catch(e) { console.error("Save failed", e); }
  };
  
  const handlePlayLibraryItem = (url: string, time: number) => {
    // Only host can load
    if (isHost) {
        broadcastUpdate({ url, isPlaying: true, currentTime: 0 }); // Load first
        // If time is provided (even 0), ensure we seek to it
        if (time >= 0) {
            // Slight delay to allow load, then seek
            setTimeout(() => {
                setSeekRequest(time);
                broadcastUpdate({ currentTime: time });
            }, 500);
        }
        setIsSidebarOpen(false); // Close sidebar on mobile
    }
  };


  // --- Render: Loading ---
  if (appState === 'LOADING') {
    return (
      <div className="flex items-center justify-center h-screen bg-[#36393f] text-white">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 bg-[#5865F2] rounded-full mb-4"></div>
          <p>Connecting to TwinCinema...</p>
        </div>
      </div>
    );
  }

  // --- Render: Landing Page (Web Only) ---
  if (appState === 'LANDING') {
    return (
      <div className="flex h-screen bg-[#36393f] text-[#dcddde] items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#2f3136] p-8 rounded-xl shadow-2xl border border-[#202225] text-center">
          <div className="flex justify-center mb-6">
             <div className="bg-[#5865F2] p-4 rounded-2xl">
                <Play className="text-white w-8 h-8" />
             </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">TwinCinema Web</h1>
          <p className="text-gray-400 mb-8">Watch YouTube & HLS streams together in perfect sync.</p>
          
          <div className="space-y-4">
             <button 
                onClick={handleWebCreateParty}
                className="w-full py-3 bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold rounded flex items-center justify-center gap-2 transition-colors"
             >
                <Users size={20} /> Create a Party
             </button>
             
             <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-[#40444b]"></span></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#2f3136] px-2 text-gray-500">Or Join Existing</span></div>
             </div>

             <form onSubmit={handleWebJoinParty} className="flex flex-col gap-2">
                <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Enter Party Code..." 
                      className={`flex-1 bg-[#202225] border ${joinError ? 'border-red-500' : 'border-[#202225]'} rounded px-4 py-2 text-white focus:outline-none focus:border-[#5865F2]`}
                      value={joinCode}
                      onChange={(e) => {setJoinCode(e.target.value); setJoinError(null);}}
                    />
                    <button 
                      type="submit"
                      disabled={!joinCode}
                      className="px-4 bg-[#40444b] hover:bg-[#36393f] text-white rounded font-medium disabled:opacity-50 transition-colors"
                    >
                      <ArrowRight />
                    </button>
                </div>
                {joinError && <p className="text-red-400 text-xs text-left ml-1 font-bold">{joinError}</p>}
             </form>
          </div>
        </div>
      </div>
    );
  }

  // --- Render: Main App ---
  return (
    <div className="flex h-screen bg-[#36393f] text-[#dcddde] overflow-hidden font-sans relative">
      
      {/* Mobile Sidebar Toggle - Hidden if Idle */}
      <button 
        onClick={() => setIsSidebarOpen(true)}
        className={`lg:hidden fixed top-4 left-4 z-50 p-2 bg-black/50 text-white rounded backdrop-blur-sm transition-opacity duration-300 ${isIdle ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      >
        <Menu size={24} />
      </button>

      {/* Sidebar */}
      {!isFullscreen && (
        <Sidebar 
          user={discordUser} 
          participants={participants} 
          hostId={hostId} 
          onPromoteUser={(uid, uname) => setTransferModal({isOpen: true, targetId: uid, targetName: uname})}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onPlayLibraryItem={handlePlayLibraryItem}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Header - Hidden if Idle */}
        {!isFullscreen && (
           <div className={`transition-opacity duration-300 ${isIdle ? 'opacity-0' : 'opacity-100'}`}>
              <Header isHost={isHost} partyCode={partyCode} />
           </div>
        )}
        
        <main className={`flex-1 flex flex-col ${isFullscreen ? 'p-0' : 'p-4'} overflow-y-auto`}>
          <div 
            ref={containerRef}
            className={`flex-1 flex flex-col bg-black overflow-hidden shadow-2xl relative group select-none ${isFullscreen ? 'rounded-none w-full h-full' : 'rounded-xl'}`}
            onMouseMove={resetIdleTimer}
            onMouseLeave={() => videoState.isPlaying && setShowControls(false)}
          >
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              {videoState.url ? (
                <>
                    <VideoPlayer 
                      url={videoState.url}
                      isPlaying={videoState.isPlaying}
                      volume={videoState.volume}
                      seekTime={seekRequest}
                      onTimeUpdate={handleTimeUpdate} 
                      onDurationChange={handleDurationChange}
                      onEnded={() => handlePlayPause(false)}
                      onBuffer={setIsBuffering}
                    />

                    {/* Dynamic Overlays */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                        {isBuffering ? (
                            <div className="bg-black/40 p-4 rounded-full backdrop-blur-sm">
                                <Loader2 size={48} className="text-white animate-spin" />
                            </div>
                        ) : !videoState.isPlaying ? (
                             <div className="bg-black/40 p-6 rounded-full backdrop-blur-sm animate-in fade-in zoom-in duration-200">
                                <Pause size={48} className="text-white fill-white" />
                             </div>
                        ) : null}
                    </div>
                </>
              ) : (
                <div className="text-center p-8 text-gray-500 z-0">
                  <p className="text-lg font-medium">No video loaded</p>
                  {isHost ? (
                     <p className="text-sm">Enter a YouTube or .m3u8 link to start.</p>
                  ) : (
                     <p className="text-sm">Waiting for Host to select a video...</p>
                  )}
                  {/* Web Party Code Display */}
                  {!isDiscordEnvironment() && (
                    <div className="mt-6 bg-[#202225] p-2 rounded inline-block">
                        <span className="text-xs uppercase font-bold text-gray-400 mr-2">Party Code:</span>
                        <span className="text-white font-mono font-bold select-all tracking-widest">{syncService.getInstanceId()}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Controls - Hidden if Idle */}
            <div className={`transition-opacity duration-300 ${isIdle ? 'opacity-0' : 'opacity-100'}`}>
                {isHost ? (
                  <ControlPanel 
                    videoState={videoState}
                    showControls={showControls || !videoState.url}
                    isFullscreen={isFullscreen}
                    onPlayPause={handlePlayPause}
                    onUrlSubmit={handleUrlChange}
                    onSeek={handleSeek}
                    onVolumeChange={handleVolumeChange}
                    onToggleFullscreen={toggleFullscreen}
                    onOpenSaveModal={() => setSaveModalOpen(true)}
                  />
                ) : (
                  <div className={`absolute bottom-0 left-0 right-0 p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'} bg-gradient-to-t from-black/80 to-transparent z-20`}>
                    <div className="flex justify-between items-center">
                        <div className="flex gap-2 items-center">
                            <div className="text-xs text-yellow-400 flex items-center gap-1 bg-yellow-400/10 px-2 py-1 rounded">
                                <Crown size={12} />
                                <span>Spectator Mode</span>
                            </div>
                            <div className="text-xs text-gray-300 font-mono">
                                {new Date(videoState.currentTime * 1000).toISOString().substr(14, 5)}
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                             <input 
                                type="range" 
                                min="0" 
                                max="1" 
                                step="0.05"
                                value={videoState.volume}
                                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                className="w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer hover:bg-white"
                                onClick={(e) => e.stopPropagation()}
                              />
                            
                            <button 
                                onClick={() => setSaveModalOpen(true)}
                                disabled={!videoState.url}
                                className={`p-2 hover:bg-white/10 rounded-full ${videoState.url ? 'text-yellow-400 hover:text-yellow-300' : 'text-gray-500 cursor-not-allowed'}`}
                                title="Save to Library"
                            >
                                <Star size={20} fill={videoState.url ? "currentColor" : "none"} />
                            </button>

                            <button onClick={toggleFullscreen} className="text-white hover:text-gray-200">
                                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                            </button>
                        </div>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </main>
      </div>

      {/* --- Modals --- */}

      {/* Save Favorite Modal */}
      {saveModalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
             <div className="bg-[#36393f] p-6 rounded-lg shadow-2xl w-full max-w-sm border border-[#202225] animate-in fade-in zoom-in-95 duration-200">
                 <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Save size={18} className="text-yellow-400" /> Name this save?
                    </h2>
                    <button onClick={() => setSaveModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                 </div>
                 
                 <div className="space-y-4">
                    <div>
                        <label className="text-xs text-gray-400 uppercase font-bold mb-1 block">Name</label>
                        <input 
                            type="text" 
                            autoFocus
                            placeholder="My awesome video..."
                            className="w-full bg-[#202225] text-white p-2 rounded focus:outline-none focus:ring-1 focus:ring-[#5865F2]"
                            value={favName}
                            onChange={(e) => setFavName(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex items-center justify-between p-2 bg-[#2f3136] rounded border border-[#202225]">
                        <span className="text-sm text-gray-300">Save Timestamp?</span>
                        <button 
                            onClick={() => setSaveTimestamp(!saveTimestamp)}
                            className={`w-10 h-5 rounded-full relative transition-colors ${saveTimestamp ? 'bg-green-500' : 'bg-gray-500'}`}
                        >
                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${saveTimestamp ? 'left-6' : 'left-1'}`} />
                        </button>
                    </div>

                    <button 
                        onClick={handleSaveFavorite}
                        className="w-full py-2 bg-[#5865F2] hover:bg-[#4752c4] text-white rounded font-bold transition-colors"
                    >
                        Save
                    </button>
                 </div>
             </div>
         </div>
      )}

      {/* Host Transfer Confirmation Modal */}
      {transferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-[#36393f] p-6 rounded-lg shadow-2xl max-w-sm w-full border border-[#202225] animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3 text-yellow-500 mb-4">
                    <AlertTriangle size={24} />
                    <h2 className="text-lg font-bold text-white">Transfer Host?</h2>
                </div>
                <p className="text-gray-300 text-sm mb-6">
                    Make <span className="font-bold text-white">{transferModal.targetName}</span> the Host? You will lose control.
                </p>
                <div className="flex justify-end gap-3">
                    <button onClick={() => setTransferModal(null)} className="px-4 py-2 text-sm rounded hover:bg-[#40444b] text-gray-300">Cancel</button>
                    <button 
                        onClick={() => {
                            if (transferModal) {
                                syncService.transferHost(transferModal.targetId);
                                setTransferModal(null);
                            }
                        }}
                        className="px-4 py-2 text-sm bg-yellow-600 hover:bg-yellow-700 text-white rounded font-medium shadow-lg"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;