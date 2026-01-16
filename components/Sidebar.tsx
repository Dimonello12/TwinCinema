import React, { useState, useEffect } from 'react';
import { Participant, SidebarProps, FavoriteItem } from '../types';
import { Crown, Users, Library, Play, Trash2, X } from 'lucide-react';

export const Sidebar: React.FC<SidebarProps> = ({ 
  user, 
  participants, 
  hostId, 
  isOpen,
  onClose,
  onPromoteUser,
  onPlayLibraryItem
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'library'>('users');
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  // Load favorites from local storage
  useEffect(() => {
    const loadFavs = () => {
      try {
        const stored = localStorage.getItem('tc_favorites');
        if (stored) setFavorites(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to load favorites", e);
      }
    };
    loadFavs();
    
    // Listen for storage events (if multiple tabs or update from App)
    window.addEventListener('storage', loadFavs);
    // Custom event for same-tab updates
    window.addEventListener('favoritesUpdated', loadFavs);
    
    return () => {
      window.removeEventListener('storage', loadFavs);
      window.removeEventListener('favoritesUpdated', loadFavs);
    };
  }, []);

  const deleteFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFavs = favorites.filter(f => f.id !== id);
    setFavorites(newFavs);
    localStorage.setItem('tc_favorites', JSON.stringify(newFavs));
    window.dispatchEvent(new Event('favoritesUpdated'));
  };
  
  const handleUserDoubleClick = (p: Participant) => {
    if (user?.id === hostId && p.id !== hostId) {
      onPromoteUser(p.id, p.username);
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-72 bg-[#2f3136] flex flex-col border-r border-[#202225]
        transform transition-transform duration-300 ease-in-out shadow-2xl lg:shadow-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Mobile Close Button */}
        <div className="lg:hidden absolute top-2 right-2">
            <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
                <X size={20} />
            </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#202225] bg-[#292b2f]">
          <button 
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'users' ? 'text-white border-b-2 border-[#5865F2] bg-[#36393f]' : 'text-[#b9bbbe] hover:bg-[#32353b]'}`}
          >
            <Users size={16} /> Participants
          </button>
          <button 
            onClick={() => setActiveTab('library')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'library' ? 'text-white border-b-2 border-[#5865F2] bg-[#36393f]' : 'text-[#b9bbbe] hover:bg-[#32353b]'}`}
          >
            <Library size={16} /> Your Library
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {activeTab === 'users' ? (
            <>
              <div className="text-xs font-bold text-[#8e9297] uppercase mb-3 px-2">
                 Participants — {participants.length}
              </div>
              {participants.length > 0 ? (
                participants.map((p) => (
                  <div 
                    key={p.id} 
                    onDoubleClick={() => handleUserDoubleClick(p)}
                    className={`flex items-center gap-3 px-2 py-2 rounded transition-colors group select-none ${p.id !== hostId && user?.id === hostId ? 'cursor-pointer hover:bg-[#36393f] active:bg-[#40444b]' : 'hover:bg-[#36393f]'}`}
                    title={user?.id === hostId && p.id !== hostId ? "Double-click to make Host" : ""}
                  >
                    <div className="relative">
                      <img 
                        src={p.avatar ? `https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.png` : "https://cdn.discordapp.com/embed/avatars/0.png"} 
                        alt={p.username}
                        className="w-8 h-8 rounded-full bg-[#202225]"
                      />
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#2f3136] rounded-full"></div>
                    </div>
                    <div className="overflow-hidden flex-1">
                       <div className="flex items-center gap-1">
                          <span className={`font-medium text-sm truncate ${p.id === hostId ? 'text-yellow-400' : 'text-white'}`}>
                              {p.username}
                          </span>
                          {p.id === hostId && <Crown size={12} className="text-yellow-400 fill-yellow-400" />}
                       </div>
                       <div className="text-xs text-[#b9bbbe]">
                          {p.id === hostId ? "Hosting" : "Watching"}
                       </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-2 text-sm text-gray-500 italic">No one else is here...</div>
              )}
            </>
          ) : (
            <>
               <div className="text-xs font-bold text-[#8e9297] uppercase mb-3 px-2">
                 Saved Media — {favorites.length}
              </div>
              {favorites.length > 0 ? (
                <div className="space-y-2">
                  {favorites.map((fav) => (
                    <div 
                      key={fav.id}
                      onClick={() => onPlayLibraryItem(fav.url, fav.timestamp)}
                      className="group bg-[#202225] p-3 rounded hover:bg-[#36393f] transition-colors cursor-pointer border border-transparent hover:border-[#40444b]"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-200 truncate pr-2">{fav.name}</div>
                          <div className="text-[10px] text-gray-500 truncate mt-0.5">{fav.url}</div>
                          {fav.timestamp > 0 && (
                            <div className="text-[10px] text-[#5865F2] mt-1 flex items-center gap-1">
                              <Play size={10} fill="currentColor" /> Starts at {new Date(fav.timestamp * 1000).toISOString().substr(14, 5)}
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={(e) => deleteFavorite(fav.id, e)}
                          className="text-gray-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                  <Library size={32} className="text-[#40444b] mb-2" />
                  <p className="text-sm text-gray-400">Nothing here!</p>
                  <p className="text-xs text-gray-500">Save something first.</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* User Status Bottom */}
        <div className="bg-[#292b2f] p-3 flex items-center gap-2">
          {user ? (
             <>
              <img 
                  src={user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : "https://cdn.discordapp.com/embed/avatars/0.png"} 
                  alt="Me"
                  className="w-8 h-8 rounded-full"
              />
              <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate">{user.username}</div>
                  <div className="text-xs text-[#b9bbbe] truncate">#{user.discriminator}</div>
              </div>
             </>
          ) : (
            <div className="text-xs text-gray-500">Loading User...</div>
          )}
        </div>
      </aside>
    </>
  );
};