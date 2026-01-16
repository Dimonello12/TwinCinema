// Fix TS errors by casting import.meta to any since vite/client types are missing
export const CLIENT_ID = (import.meta as any).env?.VITE_DISCORD_CLIENT_ID || 'mock_client_id';

// For HLS testing if user doesn't have one handy
export const SAMPLE_HLS_URL = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

export const MORE_SAMPLES = [
    { name: 'Bunny (Cartoon)', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
    { name: 'Sintel (Animation)', url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8' },
    { name: 'Tears of Steel (Sci-Fi)', url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8' }
];