import { VideoState } from "../types";
import { getInstanceId } from "./discordService";

type StateCallback = (state: VideoState & { hostId: string }) => void;

class SyncService {
  private ws: WebSocket | null = null;
  private onStateChange: StateCallback | null = null;

  // New Helper for displaying Party Code
  getInstanceId() {
    return getInstanceId();
  }

  connect(userId: string, onStateChange: StateCallback, metadata?: { username: string; avatar: string | null }) {
    this.onStateChange = onStateChange;
    
    const instanceId = getInstanceId();
    // Determine WS protocol (ws for localhost, wss for production)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    const params = new URLSearchParams({
      instanceId,
      userId,
      username: metadata?.username || 'Guest',
      avatar: metadata?.avatar || ''
    });

    this.ws = new WebSocket(`${protocol}//${host}?${params.toString()}`);

    this.ws.onmessage = (event) => {
      const { type, data } = JSON.parse(event.data);
      if (type === 'STATE_UPDATE') {
        if (this.onStateChange) {
          this.onStateChange(data);
        }
      }
    };

    this.ws.onclose = () => {
      console.log('Sync connection closed. Reconnecting in 3s...');
      setTimeout(() => this.connect(userId, onStateChange, metadata), 3000);
    };
  }

  updateState(newState: Partial<VideoState>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'UPDATE_STATE',
        data: newState
      }));
    }
  }

  transferHost(targetUserId: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'TRANSFER_HOST',
        data: { targetUserId }
      }));
    }
  }
}

export const syncService = new SyncService();