export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  public_flags?: number;
}

export interface Participant {
  id: string;
  username: string;
  avatar: string | null;
}

export interface VideoState {
  url: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  hostId?: string;
  participants?: Participant[];
}

export interface FavoriteItem {
  id: string;
  name: string;
  url: string;
  timestamp: number; // 0 if not saved
  createdAt: number;
}

export interface VideoPlayerProps {
  url: string;
  isPlaying: boolean;
  volume: number;
  seekTime: number | null; // Timestamp to seek to
  onTimeUpdate: (currentTime: number) => void;
  onDurationChange: (duration: number) => void;
  onEnded: () => void;
  onBuffer: (isBuffering: boolean) => void;
}

export interface ControlPanelProps {
  videoState: VideoState;
  showControls: boolean;
  isFullscreen: boolean;
  onPlayPause: (isPlaying: boolean) => void;
  onUrlSubmit: (url: string) => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleFullscreen: () => void;
  onOpenSaveModal: () => void;
}

export interface SidebarProps {
  user: DiscordUser | null;
  participants: Participant[];
  hostId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onPromoteUser: (userId: string, username: string) => void;
  onPlayLibraryItem: (url: string, time: number) => void;
}