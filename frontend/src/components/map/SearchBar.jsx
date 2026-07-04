import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, X, ArrowLeft, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../../stores/useAppStore';
import { getMapItems } from '../../services/api';

const removeAccents = (str) => {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
};

const SearchBar = () => {
  const { floors, setSelectedMapItem, setCurrentFloorId, setHighlightedRoomCode, isDeltaDraftMode, draftDeltaData, activeObstacles } = useAppStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [allMapItems, setAllMapItems] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth <= 768);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isDeltaDraftMode && draftDeltaData && draftDeltaData.floors) {
      const allDraftItems = draftDeltaData.floors.flatMap(f => {
        return (f.items || []).filter(item => item.is_clickable && item.item_type !== 'wall').map(item => ({
          ...item,
          floor_name: `Tầng ${f.floor_number || f.floor}`,
          floor_id: f.floor_number || f.floor,
          name: item.display_name
        }));
      });
      setAllMapItems(allDraftItems);
      return;
    }
    const fetchAllItems = async () => {
      if (!floors || floors.length === 0) return;
      try {
        const promises = floors.map(f => getMapItems(f.id));
        const responses = await Promise.all(promises);
        const allItems = responses.flatMap((res, idx) =>
          res.data.map(item => ({ ...item, floor_name: floors[idx].name, floor_id: floors[idx].id }))
        );
        setAllMapItems(allItems);
      } catch (err) {
        console.error('Error fetching map items for search', err);
      }
    };
    fetchAllItems();
  }, [floors, isDeltaDraftMode, draftDeltaData]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setResults([]);
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (val) => {
    setQuery(val);
    if (val.trim() === '') { setResults([]); return; }
    if (allMapItems && allMapItems.length > 0) {
      const lowerQ = removeAccents(val.toLowerCase());
      const queryWords = lowerQ.split(/\s+/).filter(w => w);

      const filtered = allMapItems.filter(r => {
        const matchesWords = (text) => {
          if (!text) return false;
          const normalized = removeAccents(text.toLowerCase());
          return queryWords.every(word => normalized.includes(word));
        };

        if (isDeltaDraftMode) {
          return matchesWords(r.room_code) || matchesWords(r.display_name) || matchesWords(r.item_id);
        }
        return matchesWords(r.room_code) || matchesWords(r.name) || (r.aliases && r.aliases.some(alias => matchesWords(alias)));
      }).slice(0, 20);
      setResults(filtered);
    }
  };

  const handleSelect = (item) => {
    setCurrentFloorId(item.floor_id);
    setSelectedMapItem(item);
    setHighlightedRoomCode(item.room_code);
    setQuery('');
    setResults([]);
    useAppStore.getState().clearRoute();
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  const handleAskAI = () => {
    if (!query.trim()) return;
    sessionStorage.setItem('pending_ai_query', query);
    navigate('/chat');
  };

  /* ── Shared result item ── */
  const ResultItem = ({ item, isMobile = false }) => {
    const hasObstacle = activeObstacles?.some(o => o.target_item_id === item.item_id || (item.room_code && o.target_item_id === item.room_code));

    return (
      <button
        onClick={() => handleSelect(item)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          padding: isMobile ? '14px 16px' : '10px 14px',
          borderBottom: '1px solid var(--color-border)',
          textAlign: 'left',
          backgroundColor: 'transparent',
          cursor: 'pointer',
          gap: '12px',
          minHeight: isMobile ? '60px' : '52px',
          border: 'none',
          borderBottom: '1px solid var(--color-border)',
          fontFamily: 'inherit',
          WebkitTapHighlightColor: 'transparent',
        }}
        onTouchStart={(e) => e.currentTarget.style.backgroundColor = 'var(--color-muted)'}
        onTouchEnd={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-muted)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <div style={{
          width: isMobile ? 40 : 34,
          height: isMobile ? 40 : 34,
          borderRadius: isMobile ? 12 : 10,
          backgroundColor: hasObstacle ? 'rgba(245, 158, 11, 0.2)' : 'var(--color-primary-soft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          border: hasObstacle ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(242,109,33,0.2)',
        }}>
          <MapPin size={isMobile ? 17 : 15} color={hasObstacle ? '#F59E0B' : 'var(--color-primary)'} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 600,
            color: hasObstacle ? '#F59E0B' : 'var(--color-foreground)',
            fontSize: isMobile ? '14.5px' : '13.5px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: '-0.01em',
          }}>
            {item.room_code || item.name}
            {isDeltaDraftMode && ` — ${item.item_id?.split('-').slice(-2).join('-')}`}
            {hasObstacle && <span style={{ marginLeft: '4px', fontSize: '14px' }}>⚠️</span>}
          </div>
        <div style={{
          fontSize: isMobile ? '12.5px' : '12px',
          color: 'var(--color-muted-foreground)',
          marginTop: '2px',
          fontWeight: 500,
        }}>
          {item.floor_name}
          {item.name && item.name !== item.room_code ? ` · ${item.name}` : ''}
        </div>
      </div>
      {isMobile && (
        <div style={{ color: 'var(--color-muted-foreground)', opacity: 0.35, fontSize: '20px', lineHeight: 1, flexShrink: 0 }}>›</div>
      )}
    </button>
  );
  };

  return (
    <div ref={containerRef} className="search-bar-container" style={{ position: 'relative', width: '100%', zIndex: 2000 }}>
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0.75rem 1rem',
          border: isFocused ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
          boxShadow: isFocused ? 'var(--shadow-inner-glow)' : 'var(--shadow-card)',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          cursor: 'text',
          backgroundColor: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderRadius: '16px',
        }}
      >
        <Search size={18} color={isFocused ? 'var(--color-primary)' : 'var(--color-muted-foreground)'} style={{ flexShrink: 0, transition: 'color 0.2s' }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder="Tìm phòng học, lab, phòng hành chính..."
          style={{
            border: 'none', outline: 'none', flex: 1,
            marginLeft: '0.5rem', fontSize: '0.95rem',
            backgroundColor: 'transparent', color: 'var(--color-foreground)',
            fontFamily: 'inherit',
          }}
        />
        {query && (
          <button onClick={handleClear} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', color: 'var(--color-muted-foreground)', flexShrink: 0 }}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* Floating results list */}
      {isFocused && (results.length > 0 || (query.trim() !== '' && results.length === 0)) && (
        <div 
          onMouseDown={(e) => e.preventDefault()}
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            marginTop: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.97)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '16px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.05)',
            overflow: 'hidden',
            border: '1px solid var(--color-border)',
            zIndex: 2100,
            maxHeight: '300px',
            overflowY: 'auto',
          }}
        >
          {results.length > 0 ? (
            <>
              {results.map((item) => (
                <ResultItem 
                  key={item.item_id || item.room_code} 
                  item={item} 
                  isMobile={isMobileView} 
                />
              ))}
              <button
                onClick={handleAskAI}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  padding: isMobileView ? '14px 16px' : '10px 14px',
                  backgroundColor: 'rgba(242, 109, 33, 0.04)',
                  border: 'none',
                  borderTop: '1px solid var(--color-border)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  gap: '12px',
                  fontFamily: 'inherit',
                  color: 'var(--color-primary)',
                  WebkitTapHighlightColor: 'transparent',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(242, 109, 33, 0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(242, 109, 33, 0.04)'}
              >
                <div style={{
                  width: isMobileView ? 40 : 34,
                  height: isMobileView ? 40 : 34,
                  borderRadius: isMobileView ? 12 : 10,
                  backgroundColor: 'var(--color-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(242, 109, 33, 0.25)',
                }}>
                  <Sparkles size={isMobileView ? 16 : 14} color="white" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: isMobileView ? '14px' : '13px' }}>
                    Hỏi Cóc AI (Gemini)
                  </div>
                  <div style={{ fontSize: isMobileView ? '11.5px' : '11px', color: 'var(--color-muted-foreground)', marginTop: '2px', fontWeight: 500 }}>
                    Tra cứu vị trí "{query}" bằng AI
                  </div>
                </div>
                <div style={{ color: 'var(--color-primary)', opacity: 0.7, fontSize: '18px', fontWeight: 700, paddingRight: '4px' }}>›</div>
              </button>
            </>
          ) : (
            <button
              onClick={handleAskAI}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                padding: isMobileView ? '16px' : '12px 14px',
                backgroundColor: 'rgba(242, 109, 33, 0.04)',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                gap: '12px',
                fontFamily: 'inherit',
                color: 'var(--color-primary)',
                WebkitTapHighlightColor: 'transparent',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(242, 109, 33, 0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(242, 109, 33, 0.04)'}
            >
              <div style={{
                width: isMobileView ? 42 : 36,
                height: isMobileView ? 42 : 36,
                borderRadius: isMobileView ? 12 : 10,
                backgroundColor: 'var(--color-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(242, 109, 33, 0.25)',
              }}>
                <Sparkles size={isMobileView ? 18 : 16} color="white" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: isMobileView ? '14px' : '13px' }}>
                  Hỏi Cóc AI (Gemini)
                </div>
                <div style={{ fontSize: isMobileView ? '12px' : '11.5px', color: 'var(--color-muted-foreground)', marginTop: '2px', fontWeight: 500 }}>
                  Không thấy phòng. Hỏi AI để tìm chỉ dẫn chi tiết.
                </div>
              </div>
              <div style={{ color: 'var(--color-primary)', opacity: 0.7, fontSize: '18px', fontWeight: 700, paddingRight: '4px' }}>›</div>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
