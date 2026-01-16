import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { VideoPlayerProps } from '../types';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  url, 
  isPlaying, 
  volume,
  seekTime,
  onTimeUpdate,
  onDurationChange,
  onEnded,
  onBuffer
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytIntervalRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playerType, setPlayerType] = useState<'hls' | 'youtube' | null>(null);
  const attemptPlayRef = useRef<number | null>(null);

  // Helper to proxy HLS URLs
  const getProxyUrl = (targetUrl: string) => {
    if (!targetUrl) return '';
    if (targetUrl.includes('/proxy/')) return targetUrl;
    if (targetUrl.startsWith('http')) {
      return `/proxy/${targetUrl}`;
    }
    return targetUrl;
  };

  // Helper: Identify URL Type & Normalize
  const getUrlType = (rawUrl: string): { type: 'hls' | 'youtube', cleanUrl: string } => {
    // YouTube / Shorts detection
    const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    if (ytRegex.test(rawUrl)) {
      // Shorts conversion: /shorts/ -> /watch?v=
      let clean = rawUrl.replace(/\/shorts\//, '/watch?v=');
      return { type: 'youtube', cleanUrl: clean };
    }
    return { type: 'hls', cleanUrl: rawUrl };
  };

  const extractYoutubeId = (url: string) => {
    try {
        const urlObj = new URL(url);
        // Handle www.youtube.com/watch?v=ID
        if (urlObj.hostname.includes('youtube.com')) {
             if (urlObj.searchParams.has('v')) return urlObj.searchParams.get('v');
             if (urlObj.pathname.startsWith('/embed/')) return urlObj.pathname.split('/')[2];
             if (urlObj.pathname.startsWith('/v/')) return urlObj.pathname.split('/')[2];
        }
        // Handle youtu.be/ID
        if (urlObj.hostname.includes('youtu.be')) {
             return urlObj.pathname.slice(1);
        }
    } catch(e) {
        // Fallback to Regex if URL parsing fails
    }

    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // Main Effect: URL Change
  useEffect(() => {
    if (!url) return;

    const { type, cleanUrl } = getUrlType(url);
    setPlayerType(type);
    setError(null);
    onBuffer(true);

    // Cleanup previous players
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (ytIntervalRef.current) {
      clearInterval(ytIntervalRef.current);
      ytIntervalRef.current = null;
    }
    if (attemptPlayRef.current) {
        clearTimeout(attemptPlayRef.current);
        attemptPlayRef.current = null;
    }

    if (type === 'hls') {
      // --- HLS Logic ---
      if (ytPlayerRef.current) {
        ytPlayerRef.current.destroy();
        ytPlayerRef.current = null;
      }
      
      // Allow DOM to update first
      setTimeout(() => {
        const video = videoRef.current;
        if (!video) return;

        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false, // Disabled for better stability
            maxBufferLength: 30, // Increase buffer
            backBufferLength: 90,
            startFragPrefetch: true,
            xhrSetup: (xhr, requestUrl) => {
              if (requestUrl.startsWith('http') && !requestUrl.includes(window.location.origin)) {
                 const proxiedUrl = getProxyUrl(requestUrl);
                 xhr.open('GET', proxiedUrl);
              }
            }
          });

          hls.loadSource(cleanUrl);
          hls.attachMedia(video);
          
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  console.log('HLS Network error, trying to recover...');
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  console.log('HLS Media error, trying to recover...');
                  hls.recoverMediaError();
                  break;
                default:
                  console.error('HLS Fatal error', data);
                  setError(`Stream Error: ${data.details}`);
                  hls.destroy();
                  break;
              }
            }
          });

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
             // If supposed to be playing, try to play
             if (isPlaying) {
                 video.play().catch(e => console.warn("Autoplay blocked/failed", e));
             }
             onBuffer(false);
          });

          hlsRef.current = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = getProxyUrl(cleanUrl);
        } else {
          setError("HLS is not supported in this browser.");
        }
      }, 0);

    } else {
      // --- YouTube Logic ---
      const videoId = extractYoutubeId(cleanUrl.trim());
      if (!videoId) {
        setError("Invalid YouTube URL");
        onBuffer(false);
        return;
      }

      const initPlayer = () => {
        if (!window.YT) return;
        
        // If player exists, load new video
        if (ytPlayerRef.current && ytPlayerRef.current.loadVideoById) {
          ytPlayerRef.current.loadVideoById(videoId);
          return;
        }

      ytPlayerRef.current = new window.YT.Player('youtube-player', {
  height: '100%',
  width: '100%',
  videoId: videoId,
  // ВОТ ЭТА СТРОКА РЕШАЕТ ВСЁ:
host: `${window.location.protocol}//${window.location.host}/yts`,
  playerVars: {
    'playsinline': 1,
    'controls': 0,
    'enablejsapi': 1,
    'widget_referrer': window.location.href,
    'origin': window.location.origin // Попробуй вернуть его вместе с host
  },
          events: {
            'onReady': () => {
              onBuffer(false);
              onDurationChange(ytPlayerRef.current.getDuration());
              if (isPlaying) ytPlayerRef.current.playVideo();
            },
            'onStateChange': (event: any) => {
              // 0: ended, 1: playing, 2: paused, 3: buffering, 5: cued
              if (event.data === window.YT.PlayerState.BUFFERING) onBuffer(true);
              if (event.data === window.YT.PlayerState.PLAYING) onBuffer(false);
              if (event.data === window.YT.PlayerState.ENDED) onEnded();
            },
            'onError': (e: any) => {
                console.error("YouTube Player Error", e);
                // Error 100/101/150 usually means embedding not allowed
                if (e.data === 150 || e.data === 101) {
                    setError("This video cannot be played (Embed blocked by owner).");
                } else {
                    setError(`YouTube Error Code: ${e.data}`);
                }
            }
          }
        });
      };
      // Load API
      
     if (!window.YT) {
        const tag = document.createElement('script');
        // 1. ПУТЬ ЧЕРЕЗ ПРОКСИ (в Mapping Prefix: yt)
        tag.src = "/yt/iframe_api"; 
        
        const existingScript = document.querySelector('script[nonce]');
        const metaNonce = document.querySelector('meta[property="csp-nonce"]');
        const nonce = (existingScript as any)?.nonce || existingScript?.getAttribute('nonce') || metaNonce?.getAttribute('content');
        
        if (nonce) {
            tag.setAttribute('nonce', nonce);
        }

        // 2. ВАЖНО: Добавляем обработчик ДО вставки скрипта
        window.onYouTubeIframeAPIReady = initPlayer;

        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      } else {
        initPlayer();
      }

      // Polling for time update (YouTube API doesn't have a frequent event for this)
      ytIntervalRef.current = window.setInterval(() => {
        if (ytPlayerRef.current && ytPlayerRef.current.getCurrentTime) {
          onTimeUpdate(ytPlayerRef.current.getCurrentTime());
          // Update duration occasionally just in case
          if (ytPlayerRef.current.getDuration) {
             onDurationChange(ytPlayerRef.current.getDuration());
          }
        }
      }, 500);
    }

    return () => {
      if (ytIntervalRef.current) {
        clearInterval(ytIntervalRef.current);
      }
    };
  }, [url]);

  // Handle Play/Pause
  useEffect(() => {
    // Small debounce/delay to allow player to stabilize before commands
    if (attemptPlayRef.current) clearTimeout(attemptPlayRef.current);

    attemptPlayRef.current = window.setTimeout(() => {
        if (playerType === 'hls') {
            const video = videoRef.current;
            if (!video) return;
            if (isPlaying) {
                const playPromise = video.play();
                if (playPromise !== undefined) {
                    playPromise.catch(e => {
                        console.log("Play interrupted or blocked", e);
                        // If blocked, we might need to mute first (but we are sync app, usually user has interacted)
                    });
                }
            }
            else video.pause();
        } else if (playerType === 'youtube' && ytPlayerRef.current && ytPlayerRef.current.playVideo) {
            if (isPlaying) ytPlayerRef.current.playVideo();
            else ytPlayerRef.current.pauseVideo();
        }
    }, 100); 

  }, [isPlaying, playerType]);

  // Handle Seeking
  useEffect(() => {
    if (seekTime === null) return;
    
    // Defer seek slightly to ensure media is ready
    requestAnimationFrame(() => {
        if (playerType === 'hls' && videoRef.current) {
            if (Math.abs(videoRef.current.currentTime - seekTime) > 0.5) {
                videoRef.current.currentTime = seekTime;
            }
        } else if (playerType === 'youtube' && ytPlayerRef.current && ytPlayerRef.current.seekTo) {
            ytPlayerRef.current.seekTo(seekTime, true);
        }
    });
  }, [seekTime, playerType]);

  // Handle Volume
  useEffect(() => {
    if (playerType === 'hls' && videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = volume === 0;
    } else if (playerType === 'youtube' && ytPlayerRef.current && ytPlayerRef.current.setVolume) {
      ytPlayerRef.current.setVolume(volume * 100);
      if (volume === 0) ytPlayerRef.current.mute();
      else ytPlayerRef.current.unMute();
    }
  }, [volume, playerType]);

  const handleHlsTimeUpdate = () => {
    if (videoRef.current) onTimeUpdate(videoRef.current.currentTime);
  };

  const handleHlsLoadedMetadata = () => {
    if (videoRef.current) onDurationChange(videoRef.current.duration);
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black relative">
      {error && (
        <div className="absolute top-4 left-4 right-4 z-50 bg-red-500/90 text-white p-3 rounded-md text-sm shadow-lg backdrop-blur-sm border border-red-400">
          <p className="font-bold">Playback Error</p>
          <p className="opacity-90">{error}</p>
        </div>
      )}
      
      {playerType === 'hls' && (
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          onTimeUpdate={handleHlsTimeUpdate}
          onLoadedMetadata={handleHlsLoadedMetadata}
          onDurationChange={handleHlsLoadedMetadata}
          onEnded={onEnded}
          onWaiting={() => onBuffer(true)}
          onCanPlay={() => onBuffer(false)}
          onPlaying={() => onBuffer(false)}
          onStalled={() => onBuffer(true)}
          playsInline
          autoPlay
        />
      )}

      {/* YouTube Container */}
      <div 
        id="youtube-player" 
        className={`${playerType === 'youtube' ? 'block' : 'hidden'} w-full h-full`} 
      />
    </div>
  );
};