import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Navigation, X, Route, MousePointerClick, ChevronDown, ChevronUp, Clock, Ruler, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useAppStore from '../../stores/useAppStore';

const removeAccents = (str) => {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
};

/* ── useIsMobile hook ────────────────────────────────────────────────────── */
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
};

/* ── Main Component ──────────────────────────────────────────────────────── */
const PathfindingPanel = () => {
  const {
    isDeltaDraftMode, draftDeltaData, navGridData,
    routeMetadata, routeError, routeStart, routeEnd,
    setRoutePoints, clearRoute, isCalculatingRoute, setIsCalculatingRoute,
    routingSelectionMode, setRoutingSelectionMode, incrementRouteTrigger,
    preferElevator, setPreferElevator,
    avoidObstacles, setAvoidObstacles,
    activeObstacles
  } = useAppStore();

  const [startQuery, setStartQuery] = useState('');
  const [endQuery, setEndQuery] = useState('');
  const [startResults, setStartResults] = useState([]);
  const [endResults, setEndResults] = useState([]);
  const [allMapItems, setAllMapItems] = useState([]);
  const isMobile = useIsMobile();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const panelRef = useRef(null);

  // Sync expanded state with isMobile
  useEffect(() => {
    setIsExpanded(!isMobile);
  }, [isMobile]);

  // Auto-expand when selecting or calculating route
  useEffect(() => {
    if (routeStart || routeEnd || routingSelectionMode) {
      setIsExpanded(true);
    }
  }, [routeStart, routeEnd, routingSelectionMode]);

  // Sync inputs with global state
  useEffect(() => {
    if (routeStart) setStartQuery(routeStart.label || routeStart.roomCode || '');
    else setStartQuery('');
  }, [routeStart]);

  useEffect(() => {
    if (routeEnd) setEndQuery(routeEnd.label || routeEnd.roomCode || '');
    else setEndQuery('');
  }, [routeEnd]);

  // Load items for autocomplete
  useEffect(() => {
    if (isDeltaDraftMode && draftDeltaData && draftDeltaData.floors) {
      const allDraftItems = draftDeltaData.floors.flatMap(f => {
        return (f.items || []).filter(item => item.is_clickable && item.item_type !== 'wall').map(item => ({
          ...item,
          floor_name: f.floor_name || `Tầng ${f.floor}`,
          floor_id: f.floor,
          name: item.display_name
        }));
      });
      setAllMapItems(allDraftItems);
      return;
    }

    const fetchAllItems = async () => {
      const { floors } = useAppStore.getState();
      if (!floors || floors.length === 0) return;
      try {
        const { getMapItems } = await import('../../services/api');
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
  }, [isDeltaDraftMode, draftDeltaData, useAppStore.getState().floors]); // Ignoring strict dependency here since floors usually populates on mount

  // Close autocomplete when clicking outside (desktop)
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setStartResults([]);
        setEndResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // When route result comes in, auto-expand
  useEffect(() => {
    if (routeMetadata) {
      setIsExpanded(true);
    }
  }, [routeMetadata]);

  const searchItems = (val) => {
    if (val.trim() === '') return [];
    const lowerQ = removeAccents(val.toLowerCase());
    const queryWords = lowerQ.split(/\s+/).filter(w => w);

    return allMapItems.filter(r => {
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
  };

  const handleStartSearch = (e) => {
    const val = e.target.value;
    setStartQuery(val);
    setStartResults(searchItems(val));
    if (routeStart) {
      useAppStore.setState({ routeStart: null, routePath: [], routeMetadata: null, routeError: null, isCalculatingRoute: false });
    }
  };

  const handleEndSearch = (e) => {
    const val = e.target.value;
    setEndQuery(val);
    setEndResults(searchItems(val));
    if (routeEnd) {
      useAppStore.setState({ routeEnd: null, routePath: [], routeMetadata: null, routeError: null, isCalculatingRoute: false });
    }
  };

  const selectStart = (item) => {
    const floor = item.floor_id;
    const hasObstacle = activeObstacles?.some(o => o.target_item_id === item.item_id || (item.room_code && o.target_item_id === item.room_code));
    const labelWarning = hasObstacle ? ' ⚠️' : '';
    const newStart = {
      roomCode: item.room_code,
      label: `${item.room_code || item.name} - ${item.floor_name}${labelWarning}`,
      itemId: item.item_id || item.id,
      bboxCenter: item.bbox ? {
        x: item.bbox.min_x + (item.bbox.max_x - item.bbox.min_x)/2,
        y: item.bbox.min_y + (item.bbox.max_y - item.bbox.min_y)/2,
        floor: item.floor_id
      } : null
    };
    setRoutePoints(newStart, routeEnd);
    setStartResults([]);
    useAppStore.setState({ selectedMapItem: null, highlightedRoomCode: null });
    if (floor != null) useAppStore.getState().setCurrentFloorId(floor);
  };

  const selectEnd = (item) => {
    const hasObstacle = activeObstacles?.some(o => o.target_item_id === item.item_id || (item.room_code && o.target_item_id === item.room_code));
    const labelWarning = hasObstacle ? ' ⚠️' : '';
    setRoutePoints(routeStart, {
      roomCode: item.room_code,
      label: `${item.room_code || item.name} - ${item.floor_name}${labelWarning}`,
      itemId: item.item_id || item.id,
      bboxCenter: item.bbox ? {
        x: item.bbox.min_x + (item.bbox.max_x - item.bbox.min_x)/2,
        y: item.bbox.min_y + (item.bbox.max_y - item.bbox.min_y)/2,
        floor: item.floor_id
      } : null
    });
    setEndResults([]);
    useAppStore.setState({ selectedMapItem: null, highlightedRoomCode: null });
  };

  const handleFindPath = () => {
    if (!routeStart || !routeEnd) return;

    if (routeEnd.itemId || routeEnd.roomCode) {
      const hasObstacle = activeObstacles?.some(o => 
        o.target_item_id === routeEnd.itemId || 
        (routeEnd.roomCode && o.target_item_id === routeEnd.roomCode)
      );
      if (hasObstacle) {
        setShowWarningModal(true);
        return;
      }
    }

    proceedFindPath();
  };

  const proceedFindPath = () => {
    setShowWarningModal(false);
    useAppStore.setState({ routePath: [], routeMetadata: null, routeError: null });
    setIsCalculatingRoute(true);
    incrementRouteTrigger();
    setIsExpanded(true);
  };

  const handleClear = () => {
    setStartQuery('');
    setEndQuery('');
    clearRoute();
    useAppStore.setState({ selectedMapItem: null, highlightedRoomCode: null });
    if (isMobile) setIsExpanded(false);
  };

  if (!navGridData) return null;

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="glass-panel"
      style={{
        width: '100%',
        maxWidth: isMobile ? '100%' : '360px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-card)',
        backgroundColor: 'rgba(255, 255, 255, 0.94)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: '16px',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: isMobile ? '12px 14px' : '16px',
          color: 'var(--color-foreground)',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          borderBottom: isExpanded ? '1px solid var(--color-border)' : 'none',
          transition: 'background 0.2s',
          backgroundColor: 'rgba(255, 255, 255, 0.4)',
          borderRadius: isExpanded ? '16px 16px 0 0' : '16px',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.6)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.4)'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ backgroundColor: 'var(--color-primary-soft)', padding: '6px', borderRadius: '8px' }}>
            <Route size={18} color="var(--color-primary)" />
          </div>
          <span style={{ fontSize: isMobile ? '14px' : '15px' }}>Tìm đường đi</span>
        </div>
        {isExpanded ? <ChevronUp size={18} color="var(--color-muted-foreground)" /> : <ChevronDown size={18} color="var(--color-muted-foreground)" />}
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: 'visible' }}
          >
            <PanelBody
              startQuery={startQuery} endQuery={endQuery}
              startResults={startResults} endResults={endResults}
              handleStartSearch={handleStartSearch} handleEndSearch={handleEndSearch}
              selectStart={selectStart} selectEnd={selectEnd}
              handleFindPath={handleFindPath} handleClear={handleClear}
              routeStart={routeStart} routeEnd={routeEnd}
              routeMetadata={routeMetadata} routeError={routeError}
              isCalculatingRoute={isCalculatingRoute}
              routingSelectionMode={routingSelectionMode}
              setRoutingSelectionMode={setRoutingSelectionMode}
              isMobile={isMobile}
              preferElevator={preferElevator}
              setPreferElevator={setPreferElevator}
              avoidObstacles={avoidObstacles}
              setAvoidObstacles={setAvoidObstacles}
              incrementRouteTrigger={incrementRouteTrigger}
              activeObstacles={activeObstacles}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Warning Modal */}
      <AnimatePresence>
        {showWarningModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '20px', left: 0, top: 0
            }}
            onClick={() => setShowWarningModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              style={{
                backgroundColor: 'white', borderRadius: '20px', padding: '24px',
                maxWidth: '380px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ margin: '0 auto', width: 56, height: 56, borderRadius: '28px', backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706' }}>
                <AlertTriangle size={28} />
              </div>
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700, color: '#111827', fontFamily: 'var(--font-sans)' }}>Đích đến có sự cố</h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#4B5563', lineHeight: 1.5, fontFamily: 'var(--font-sans)' }}>
                  Phòng đích hiện tại đang có thông báo sự cố (bị khóa, sửa chữa...) và có thể không khả dụng! Bạn có chắc chắn muốn tìm đường tới đó không?
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button
                  onClick={() => setShowWarningModal(false)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                    backgroundColor: '#F3F4F6', color: '#374151', fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'var(--font-sans)', transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={e => e.target.style.backgroundColor = '#E5E7EB'}
                  onMouseLeave={e => e.target.style.backgroundColor = '#F3F4F6'}
                >Hủy</button>
                <button
                  onClick={proceedFindPath}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                    backgroundColor: '#F59E0B', color: 'white', fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'var(--font-sans)', transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={e => e.target.style.backgroundColor = '#D97706'}
                  onMouseLeave={e => e.target.style.backgroundColor = '#F59E0B'}
                >Tiếp tục</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/* ── Shared Panel Body ───────────────────────────────────────────────────── */
const PanelBody = ({
  startQuery, endQuery, startResults, endResults,
  handleStartSearch, handleEndSearch, selectStart, selectEnd,
  handleFindPath, handleClear, routeStart, routeEnd,
  routeMetadata, routeError, isCalculatingRoute,
  routingSelectionMode, setRoutingSelectionMode,
  isMobile, preferElevator, setPreferElevator,
  avoidObstacles, setAvoidObstacles, incrementRouteTrigger,
  activeObstacles
}) => {
  const inputStyle = {
    border: 'none', background: 'transparent', width: '100%', outline: 'none',
    fontSize: isMobile ? '16px' : '14px', /* 16px prevents iOS auto-zoom */
    color: 'var(--color-foreground)', fontWeight: 500,
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '16px' }}>

      {/* Start Input */}
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center',
            backgroundColor: 'var(--color-surface)',
            border: '1.5px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: isMobile ? '12px' : '10px 12px',
            transition: 'all 0.2s',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <MapPin size={16} color="var(--color-primary)" style={{ marginRight: '8px', flexShrink: 0 }} />
            <input
              type="text"
              placeholder={routingSelectionMode === 'start' ? "Đang chọn trên bản đồ..." : "Từ phòng..."}
              value={startQuery}
              onChange={handleStartSearch}
              disabled={routingSelectionMode === 'start'}
              style={{
                ...inputStyle,
                color: routingSelectionMode === 'start' ? 'var(--color-primary)' : 'var(--color-foreground)',
              }}
              autoComplete="off"
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => setRoutingSelectionMode(routingSelectionMode === 'start' ? null : 'start')}
            style={{
              padding: isMobile ? '12px' : '10px',
              backgroundColor: routingSelectionMode === 'start' ? 'var(--color-primary)' : 'var(--color-surface)',
              border: `1.5px solid ${routingSelectionMode === 'start' ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: routingSelectionMode === 'start' ? 'white' : 'var(--color-muted-foreground)',
              boxShadow: routingSelectionMode === 'start' ? 'var(--shadow-glow)' : 'var(--shadow-sm)',
              minWidth: 44, minHeight: 44,
            }}
            title="Chọn điểm đi trên bản đồ"
          >
            <MousePointerClick size={18} />
          </motion.button>
        </div>
        {startResults.length > 0 && (
          <div className="glass-panel" style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            zIndex: 50, marginTop: '6px', maxHeight: '220px', overflowY: 'auto',
            boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
          }}>
            {startResults.map(item => {
              const hasObstacle = activeObstacles?.some(o => o.target_item_id === item.item_id || (item.room_code && o.target_item_id === item.room_code));
              return (
                <div
                  key={item.item_id}
                  onClick={() => selectStart(item)}
                  style={{
                    padding: '12px', cursor: 'pointer',
                    borderBottom: '1px solid var(--color-border)',
                    fontSize: '13px', fontWeight: 500,
                    minHeight: '44px', display: 'flex', alignItems: 'center',
                    color: hasObstacle ? '#F59E0B' : 'inherit'
                  }}
                  onTouchStart={(e) => e.currentTarget.style.backgroundColor = 'var(--color-muted)'}
                  onTouchEnd={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-muted)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {item.room_code || item.name} ({item.floor_name}){hasObstacle ? ' ⚠️' : ''}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Connector dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 4px' }}>
        <div style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '4px' }}>
          <div style={{ width: 2, height: 16, background: 'var(--color-border)', borderRadius: 1 }} />
        </div>
      </div>

      {/* End Input */}
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center',
            backgroundColor: 'var(--color-surface)',
            border: '1.5px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: isMobile ? '12px' : '10px 12px',
            transition: 'all 0.2s',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <Navigation size={16} color="var(--color-destructive)" style={{ marginRight: '8px', flexShrink: 0 }} />
            <input
              type="text"
              placeholder={routingSelectionMode === 'end' ? "Đang chọn trên bản đồ..." : "Đến phòng..."}
              value={endQuery}
              onChange={handleEndSearch}
              disabled={routingSelectionMode === 'end'}
              style={{
                ...inputStyle,
                color: routingSelectionMode === 'end' ? 'var(--color-destructive)' : 'var(--color-foreground)',
              }}
              autoComplete="off"
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => setRoutingSelectionMode(routingSelectionMode === 'end' ? null : 'end')}
            style={{
              padding: isMobile ? '12px' : '10px',
              backgroundColor: routingSelectionMode === 'end' ? 'var(--color-destructive)' : 'var(--color-surface)',
              border: `1.5px solid ${routingSelectionMode === 'end' ? 'var(--color-destructive)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: routingSelectionMode === 'end' ? 'white' : 'var(--color-muted-foreground)',
              boxShadow: routingSelectionMode === 'end' ? '0 4px 12px rgba(239, 68, 68, 0.3)' : 'var(--shadow-sm)',
              minWidth: 44, minHeight: 44,
            }}
            title="Chọn điểm đến trên bản đồ"
          >
            <MousePointerClick size={18} />
          </motion.button>
        </div>
        {endResults.length > 0 && (
          <div className="glass-panel" style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            zIndex: 50, marginTop: '6px', maxHeight: '220px', overflowY: 'auto',
            boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
          }}>
            {endResults.map(item => {
              const hasObstacle = activeObstacles?.some(o => o.target_item_id === item.item_id || (item.room_code && o.target_item_id === item.room_code));
              return (
                <div
                  key={item.item_id}
                  onClick={() => selectEnd(item)}
                  style={{
                    padding: '12px', cursor: 'pointer',
                    borderBottom: '1px solid var(--color-border)',
                    fontSize: '13px', fontWeight: 500,
                    minHeight: '44px', display: 'flex', alignItems: 'center',
                    color: hasObstacle ? '#F59E0B' : 'inherit'
                  }}
                  onTouchStart={(e) => e.currentTarget.style.backgroundColor = 'var(--color-muted)'}
                  onTouchEnd={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-muted)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {item.room_code || item.name} ({item.floor_name}){hasObstacle ? ' ⚠️' : ''}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Prefer Elevator Checkbox */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 4px', marginBottom: '8px' }}>
        <input 
          type="checkbox" 
          id="preferElevator" 
          checked={preferElevator} 
          onChange={(e) => setPreferElevator(e.target.checked)} 
          style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
        />
        <label htmlFor="preferElevator" style={{ fontSize: '14px', cursor: 'pointer', color: 'var(--color-foreground)', fontWeight: 500 }}>
          Ưu tiên đi thang máy
        </label>
      </div>

      {/* Avoid Obstacles Checkbox */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 4px', marginBottom: '12px' }}>
        <input 
          type="checkbox" 
          id="avoidObstacles" 
          checked={avoidObstacles} 
          onChange={(e) => {
            setAvoidObstacles(e.target.checked);
            if (routeStart && routeEnd) incrementRouteTrigger();
          }} 
          style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--color-destructive)' }}
        />
        <label htmlFor="avoidObstacles" style={{ fontSize: '14px', cursor: 'pointer', color: 'var(--color-foreground)', fontWeight: 500 }}>
          Né vật cản (Sự cố)
        </label>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginTop: isMobile ? '4px' : '0' }}>
        <motion.button
          whileHover={(!routeStart || !routeEnd || isCalculatingRoute) ? {} : { scale: 1.02 }}
          whileTap={(!routeStart || !routeEnd || isCalculatingRoute) ? {} : { scale: 0.98 }}
          onClick={handleFindPath}
          disabled={!routeStart || !routeEnd || isCalculatingRoute}
          style={{
            flex: 1,
            backgroundColor: (!routeStart || !routeEnd) ? 'var(--color-muted)' : 'var(--color-primary)',
            color: (!routeStart || !routeEnd) ? 'var(--color-muted-foreground)' : 'white',
            border: 'none',
            padding: isMobile ? '14px' : '12px',
            borderRadius: 'var(--radius-md)',
            cursor: (!routeStart || !routeEnd) ? 'not-allowed' : 'pointer',
            fontWeight: 700,
            fontSize: '15px',
            boxShadow: (!routeStart || !routeEnd) ? 'none' : 'var(--shadow-glow)',
            transition: 'all 0.2s',
            minHeight: '44px',
          }}
        >
          {isCalculatingRoute ? 'Đang tìm...' : 'Tìm đường'}
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={handleClear}
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1.5px solid var(--color-border)',
            padding: isMobile ? '14px' : '12px',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-muted-foreground)',
            boxShadow: 'var(--shadow-sm)',
            minWidth: '44px', minHeight: '44px',
          }}
          title="Xóa đường đi"
        >
          <X size={18} />
        </motion.button>
      </div>

      {/* Route Error */}
      <AnimatePresence>
        {routeError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              fontSize: '13px', color: 'var(--color-destructive)',
              padding: '12px', backgroundColor: 'var(--color-destructive-soft)',
              borderRadius: 'var(--radius-md)', fontWeight: 500,
            }}
          >
            {routeError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Route Metadata */}
      <AnimatePresence>
        {routeMetadata && !routeError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {/* Summary stats */}
            <div style={{
              display: 'flex', gap: '8px', marginBottom: '12px',
            }}>
              <div style={{
                flex: 1, padding: '12px', borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-primary-soft)',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <Clock size={16} color="var(--color-primary)" />
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary)' }}>
                    ~{Math.ceil(routeMetadata.estimated_time_seconds / 60)} phút
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-muted-foreground)', fontWeight: 500 }}>Ước tính</div>
                </div>
              </div>
              <div style={{
                flex: 1, padding: '12px', borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-muted)',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <Ruler size={16} color="var(--color-foreground)" />
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-foreground)' }}>
                    {routeMetadata.distance}m
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-muted-foreground)', fontWeight: 500 }}>Khoảng cách</div>
                </div>
              </div>
            </div>

            {/* Step instructions */}
            <div style={{
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '10px 14px',
                backgroundColor: 'var(--color-muted)',
                fontSize: '12px', fontWeight: 700,
                color: 'var(--color-muted-foreground)',
                letterSpacing: '0.05em', textTransform: 'uppercase',
              }}>
                Hướng dẫn từng bước
              </div>
              <div style={{ maxHeight: isMobile ? '200px' : '180px', overflowY: 'auto', padding: '8px 0' }}>
                {routeMetadata.instructions?.map((inst, idx) => (
                  <div key={idx} style={{
                    display: 'flex', gap: '12px', padding: '10px 14px',
                    fontSize: '13px', fontWeight: 500, color: 'var(--color-foreground)',
                    borderBottom: idx < routeMetadata.instructions.length - 1 ? '1px solid var(--color-border)' : 'none',
                    alignItems: 'flex-start',
                  }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: '50%',
                      backgroundColor: 'var(--color-primary)', color: 'white',
                      fontWeight: 700, fontSize: '11px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, marginTop: '1px',
                    }}>
                      {idx + 1}
                    </span>
                    <span style={{ lineHeight: 1.5 }}>{inst.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default PathfindingPanel;
