import React, { useState, useRef } from 'react';
import { ControlPanelProps } from '../types';
import { SAMPLE_HLS_URL, MORE_SAMPLES } from '../constants';
import { Play, Pause, Volume2, VolumeX, Link, Maximize, Minimize, HelpCircle, AlertCircle, Star } from 'lucide-react';

export const ControlPanel: React.FC<ControlPanelProps> = ({ 
  videoState, 
  showControls,
  isFullscreen,
  onPlayPause, 
  onUrlSubmit,
  onSeek,
  onVolumeChange,
  onToggleFullscreen,
  onOpenSaveModal
}) => {
  const [inputUrl, setInputUrl] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<number>(0);
  
  const progressBarRef = useRef<HTMLDivElement>(null);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !videoState.duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    onSeek(pos * videoState.duration);
  };

  const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !videoState.duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    setHoverPos(e.clientX - rect.left);
    setHoverTime(Math.max(0, Math.min(pos * videoState.duration, videoState.duration)));
  };

  const validateAndSubmit = (url: string) => {
    setErrorMsg(null);
    const trimmed = url.trim();
    if (!trimmed) return;
    
    // Basic format check (not strictly enforcing .m3u8 anymore due to YouTube support)
    onUrlSubmit(trimmed);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    validateAndSubmit(inputUrl);
  };

  const loadSample = (url: string) => {
    setInputUrl(url);
    validateAndSubmit(url);
  };

  // Calculate percentages
  const progressPercent = videoState.duration ? (videoState.currentTime / videoState.duration) * 100 : 0;

  return (
    <div 
      className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
      onClick={(e) => e.stopPropagation()} 
    >
      {/* Progress Bar */}
      <div 
        className="group/progress relative w-full h-1 bg-gray-600/50 hover:bg-gray-600 rounded-full mb-4 cursor-pointer hover:h-1.5 transition-all touch-none"
        ref={progressBarRef}
        onClick={handleProgressClick}
        onMouseMove={handleProgressHover}
        onMouseLeave={() => setHoverTime(null)}
      >
        <div 
           className="absolute top-0 left-0 h-full bg-red-600 rounded-full" 
           style={{ width: `${progressPercent}%` }}
        />
        <div 
          className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md scale-0 group-hover/progress:scale-100 transition-transform"
          style={{ left: `${progressPercent}%`, transform: `translate(-50%, -50%) scale(${showControls ? 1 : 0})` }}
        />
        {hoverTime !== null && (
          <div 
            className="absolute bottom-4 bg-black/90 text-white text-xs px-1.5 py-0.5 rounded -translate-x-1/2 pointer-events-none whitespace-nowrap border border-gray-700"
            style={{ left: hoverPos }}
          >
            {formatTime(hoverTime)}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => onPlayPause(!videoState.isPlaying)}
              className="hover:text-white text-gray-200 transition-colors"
            >
              {videoState.isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
            </button>

            <div className="flex items-center gap-2 group/vol">
              <button onClick={() => onVolumeChange(videoState.volume === 0 ? 1 : 0)} className="hover:text-white text-gray-200">
                  {videoState.volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05"
                value={videoState.volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                onClick={(e) => e.stopPropagation()}
                className="w-0 overflow-hidden group-hover/vol:w-24 transition-all h-1 bg-white/30 rounded-lg appearance-none cursor-pointer hover:bg-white"
              />
            </div>

            <div className="text-xs text-gray-300 font-mono">
              {formatTime(videoState.currentTime)} / {formatTime(videoState.duration)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <form onSubmit={handleSubmit} className="hidden md:flex items-center bg-black/40 rounded-full border border-white/10 focus-within:border-white/30 transition-colors">
              <input 
                type="text" 
                placeholder="Link / YT..." 
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                className="bg-transparent border-none text-xs text-white px-3 py-1.5 w-40 focus:outline-none"
              />
              <button type="submit" className="pr-3 pl-1 text-gray-400 hover:text-white">
                <Link size={14} />
              </button>
            </form>

            <button 
              onClick={onOpenSaveModal}
              disabled={!videoState.url}
              className={`p-2 hover:bg-white/10 rounded-full ${videoState.url ? 'text-yellow-400 hover:text-yellow-300' : 'text-gray-500 cursor-not-allowed'}`}
              title="Save to Library"
            >
              <Star size={20} fill={videoState.url ? "currentColor" : "none"} />
            </button>

            <button 
              onClick={() => setShowHelp(!showHelp)}
              className="p-2 hover:bg-white/10 rounded-full text-gray-300"
              title="Help"
            >
              <HelpCircle size={20} />
            </button>

            <button 
              onClick={onToggleFullscreen}
              className="p-2 hover:bg-white/10 rounded-full text-gray-300"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 text-yellow-500 text-xs px-1 bg-black/60 p-2 rounded w-fit">
            <AlertCircle size={12} />
            <span>{errorMsg}</span>
          </div>
        )}

        {!videoState.url && (
          <div className="flex flex-wrap gap-2 pt-2">
             <button onClick={() => loadSample(SAMPLE_HLS_URL)} className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-gray-200">
                Test HLS
              </button>
              {MORE_SAMPLES.map((sample, idx) => (
                <button key={idx} onClick={() => loadSample(sample.url)} className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-gray-200">
                  {sample.name}
                </button>
              ))}
          </div>
        )}
      </div>

      {showHelp && (
        <div className="absolute bottom-full right-4 mb-2 w-64 bg-[#202225] p-3 rounded-md text-xs text-gray-300 shadow-xl border border-gray-700">
          <h3 className="font-bold text-white mb-1">Supported Formats:</h3>
          <ul className="list-disc list-inside space-y-1 ml-1 mb-1">
             <li><strong>HLS:</strong> .m3u8 links</li>
             <li><strong>YouTube:</strong> Standard & Shorts</li>
          </ul>
          {/* FIXED LINE BELOW: Changed -> to &rarr; */}
          <div className="mt-2 text-gray-400 italic">For HLS: Press F12 &rarr; Network &rarr; Filter 'm3u8'</div>
          <button onClick={() => setShowHelp(false)} className="text-blue-400 hover:underline mt-1 w-full text-center">Close</button>
        </div>
      )}
    </div>
  );
};