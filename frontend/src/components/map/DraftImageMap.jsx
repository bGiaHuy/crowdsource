import React, { useEffect, useState, useRef } from 'react';
import useAppStore from '../../stores/useAppStore';
import { ZoomIn, ZoomOut, RefreshCw, Box, Layers, X, Move, RotateCw, AlertTriangle } from 'lucide-react';
import ObstacleMarkers from './ObstacleMarkers';
import ReportPanel from './ReportPanel';

/* ── Inline SVG Icons for Legend ── */
const StairSvg = ({ color = '#7C3AED' }) => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <rect x="0" y="8" width="12" height="4" rx="1" fill={color} opacity="0.35"/>
    <rect x="3" y="4" width="9" height="4" rx="1" fill={color} opacity="0.6"/>
    <rect x="6" y="0" width="6" height="4" rx="1" fill={color} opacity="0.85"/>
  </svg>
);
const ElevatorSvg = ({ color = '#7C3AED' }) => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <rect x="1" y="1" width="10" height="10" rx="2" stroke={color} strokeWidth="1.2" fill="none"/>
    <path d="M6 3 L4.5 5.5 L7.5 5.5 Z" fill={color}/>
    <path d="M6 9 L4.5 6.5 L7.5 6.5 Z" fill={color}/>
  </svg>
);
const ToiletSvg = ({ color = '#DB2777' }) => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <rect x="0.5" y="1" width="11" height="10" rx="2" stroke={color} strokeWidth="1.2" fill="none"/>
    <text x="6" y="8.5" textAnchor="middle" fontSize="6.5" fontWeight="bold" fontFamily="sans-serif" fill={color}>WC</text>
  </svg>
);

const getItemStyle = (type) => {
  switch(type) {
    case 'room':           return { fill: '#FFD8B8', stroke: '#EA580C', strokeWidth: '1' };
    case 'office':         return { fill: '#BFDBFE', stroke: '#2563EB', strokeWidth: '1' };
    case 'research_center':return { fill: '#E9D5FF', stroke: '#7C3AED', strokeWidth: '1' };
    case 'library':        return { fill: '#BBF7D0', stroke: '#16A34A', strokeWidth: '1' };
    case 'toilet':         return { fill: '#FBCFE8', stroke: '#DB2777', strokeWidth: '1' };
    case 'stair':          return { fill: '#DDD6FE', stroke: '#7C3AED', strokeWidth: '1' };
    case 'elevator':       return { fill: '#7C3AED', stroke: '#5B21B6', strokeWidth: '2' };
    case 'door':           return { fill: '#CBD5E1', stroke: '#64748B', strokeWidth: '1' };
    case 'lobby':          return { fill: '#F1F5F9', stroke: '#94A3B8', strokeWidth: '1' };
    case 'technical_room': return { fill: '#FEF08A', stroke: '#CA8A04', strokeWidth: '1' };
    case 'block':          return { fill: 'rgba(150,150,150,0.4)', stroke: 'rgba(0,0,0,0.08)', strokeWidth: '1' };
    case 'skylight':       return { fill: 'rgba(100,180,255,0.3)', stroke: '#60A5FA', strokeWidth: '1' };
    case 'unknown':        return { fill: 'rgba(128,128,128,0.35)', stroke: '#9CA3AF', strokeWidth: '1' };
    case 'wall':           return { fill: 'rgba(71,85,105,0.65)', stroke: 'rgba(0,0,0,0.4)', strokeWidth: '1' };
    default:               return { fill: '#CBD5E1', stroke: '#94A3B8', strokeWidth: '1' };
  }
};

const formatDisplayName = (name, type) => {
  if (!name) return name;
  if (type === 'stair' || name.toLowerCase().includes('cầu thang')) return 'Cầu thang bộ';
  if (type === 'elevator' || name.toLowerCase().includes('thang máy')) return 'Thang máy (Duy nhất)';
  if (name === 'NVS NAM') return 'Nhà vệ sinh Nam';
  if (name === 'NVS NỮ') return 'Nhà vệ sinh Nữ';
  if (name === 'ICPD') return 'ICPDP';
  return name;
};

const LEGEND_ITEMS = [
  { type: 'Phòng học / Chức năng', color: '#FFD8B8', border: '#EA580C' },
  { type: 'Thư viện / Học tập',    color: '#BBF7D0', border: '#16A34A' },
  { type: 'Kỹ thuật / Điện',       color: '#FEF08A', border: '#CA8A04' },
  { type: 'Văn phòng',              color: '#BFDBFE', border: '#2563EB' },
  { type: 'TT Nghiên cứu',          color: '#E9D5FF', border: '#7C3AED' },
  { type: 'Nhà vệ sinh Nam',        color: '#FBCFE8', border: '#DB2777', icon: <span style={{fontSize:'9px',fontWeight:800,color:'#DB2777',lineHeight:1}}>♂</span> },
  { type: 'Nhà vệ sinh Nữ',         color: '#FBCFE8', border: '#DB2777', icon: <span style={{fontSize:'9px',fontWeight:800,color:'#DB2777',lineHeight:1}}>♀</span> },
  { type: 'Cầu thang bộ',           color: '#DDD6FE', border: '#7C3AED', icon: <StairSvg color="#7C3AED"/> },
  { type: 'Thang máy (Duy nhất)',   color: '#7C3AED', border: '#5B21B6', icon: <ElevatorSvg color="white"/> },
  { type: 'Sảnh / Lối ra vào',      color: '#F1F5F9', border: '#94A3B8' },
];

const DraftImageMap = () => {
  const { currentFloorId, draftDeltaData, selectedMapItem, setSelectedMapItem, highlightedRoomCode, routePath, routeStart, routeEnd, clickPoint, setCurrentFloorId, activeObstacles, mockObstacles, isReportMode, setReportMode, reportStep, pendingReport, setPendingReport, setReportStep, clearPendingReport } = useAppStore();
  const [currentFloor, setCurrentFloor] = useState(null);
  
  // Viewport states
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(180);
  const [tilt, setTilt] = useState(60);
  const [interactionMode, setInteractionMode] = useState('pan');
  const [is3DMode, setIs3DMode] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [clickPos, setClickPos] = useState(null); // screen coords relative to container
  const [isLegendOpen, setIsLegendOpen] = useState(false); // mobile legend toggle
  
  // Drag box states for Area Report
  const [reportDragStart, setReportDragStart] = useState(null);
  const [reportDragCurrent, setReportDragCurrent] = useState(null);
  
  const dragStart = useRef({ x: 0, y: 0 });

  const containerRef = useRef(null);
  const hasDragged = useRef(false);
  const clickStartPos = useRef({ x: 0, y: 0 });

  const handleSvgClick = (e, svgElement, floorId) => {
    if (!svgElement) return;
    if (hasDragged.current) return;
    
    const pt = svgElement.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svgElement.getScreenCTM();
    if (!ctm) return;
    const svgP = pt.matrixTransform(ctm.inverse());
    
    // Report mode: area type click is now handled by pointer events
    const store = useAppStore.getState();
    if (store.isReportMode && store.reportStep === 'select_target' && store.pendingReport) {
      const isArea = ['wet_floor','construction','debris','other'].includes(store.pendingReport.obstacle_type);
      if (isArea) return;
    }
    
    useAppStore.getState().handleMapClick(svgP.x, svgP.y, floorId);
  };

  // --- SVG Pointer handlers for Area Report Drag Box ---
  const handleSvgPointerDown = (e, svgElement, floorId) => {
    const store = useAppStore.getState();
    if (store.isReportMode && store.reportStep === 'select_target' && store.pendingReport) {
      const isArea = ['wet_floor','construction','debris','other'].includes(store.pendingReport.obstacle_type);
      if (isArea) {
        e.stopPropagation(); // Ngăn kéo bản đồ
        e.currentTarget.setPointerCapture(e.pointerId); // Giữ pointer
        const pt = svgElement.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        const ctm = svgElement.getScreenCTM();
        if (!ctm) return;
        const svgP = pt.matrixTransform(ctm.inverse());
        
        setReportDragStart({ x: svgP.x, y: svgP.y, floorId });
        setReportDragCurrent({ x: svgP.x, y: svgP.y });
      }
    }
  };

  const handleSvgPointerMove = (e, svgElement) => {
    if (reportDragStart) {
      e.stopPropagation();
      const pt = svgElement.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const ctm = svgElement.getScreenCTM();
      if (!ctm) return;
      const svgP = pt.matrixTransform(ctm.inverse());
      setReportDragCurrent({ x: svgP.x, y: svgP.y });
    }
  };

  const handleSvgPointerUp = (e) => {
    if (reportDragStart && reportDragCurrent) {
      e.stopPropagation();
      e.currentTarget.releasePointerCapture(e.pointerId);
      const store = useAppStore.getState();
      
      const dx = reportDragCurrent.x - reportDragStart.x;
      const dy = reportDragCurrent.y - reportDragStart.y;
      
      const cx = reportDragStart.x;
      const cy = reportDragStart.y;
      
      let radius = Math.hypot(dx, dy);
      const finalRadius = Math.max(30, Math.min(radius, 300));
      
      store.setPendingReport({ 
        ...store.pendingReport, 
        x: cx, 
        y: cy, 
        radius: finalRadius, 
        floor: reportDragStart.floorId 
      });
      store.setReportStep('confirm');
      
      setReportDragStart(null);
      setReportDragCurrent(null);
    }
  };
  // -----------------------------------------------------

  // Reset init when floor changes so map re-fits on floor switch
  const prevFloorRef = useRef(null);
  useEffect(() => {
    if (currentFloorId !== prevFloorRef.current) {
      prevFloorRef.current = currentFloorId;
      setHasInitialized(false);
    }
  }, [currentFloorId]);

  useEffect(() => {
    if (!currentFloorId || !draftDeltaData) return;
    const floor = draftDeltaData.floors.find(f => f.floor === currentFloorId || f.id === currentFloorId);
    setCurrentFloor(floor);

    if (!hasInitialized && floor) {
      const fitToContainer = () => {
        if (!containerRef.current) return false;
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        const scaleX = rect.width  / floor.image_width;
        const scaleY = rect.height / floor.image_height;
        let s = Math.min(scaleX, scaleY) * 0.88;
        if (!isFinite(s) || s <= 0) s = 0.55;
        setScale(s);
        setPosition({ x: 0, y: 0 });
        setRotation(180);
        setTilt(60);
        setHasInitialized(true);
        return true;
      };

      // Try immediately; if container has no size yet, watch with ResizeObserver
      if (!fitToContainer()) {
        const ro = new ResizeObserver(() => {
          if (fitToContainer()) ro.disconnect();
        });
        if (containerRef.current) ro.observe(containerRef.current);
        return () => ro.disconnect();
      }
    }
  }, [currentFloorId, draftDeltaData, hasInitialized]);

  // When a room is selected via SearchBar (no clickPos yet), compute its screen position
  // so the info card appears right next to the room on the map.
  useEffect(() => {
    if (!selectedMapItem || !selectedMapItem.bbox || !containerRef.current || !currentFloor) return;
    // Only auto-position when clickPos is null (i.e. selected via search, not by direct click)
    if (clickPos) return;

    const bbox = selectedMapItem.bbox;
    const bboxCenterX = bbox.min_x + (bbox.max_x - bbox.min_x) / 2;
    const bboxCenterY = bbox.min_y + (bbox.max_y - bbox.min_y) / 2;

    // Map center in SVG space
    const mapCenterX = (currentFloor.image_min_x || 0) + currentFloor.image_width / 2;
    const mapCenterY = (currentFloor.image_min_y || 0) + currentFloor.image_height / 2;

    // Offset from map center
    const dx = bboxCenterX - mapCenterX;
    const dy = bboxCenterY - mapCenterY;

    // Apply rotation (in radians)
    const actualRotation = is3DMode ? (rotation - 45) : rotation;
    const rotRad = (actualRotation * Math.PI) / 180;
    let rotatedX = dx * Math.cos(rotRad) - dy * Math.sin(rotRad);
    let rotatedY = dx * Math.sin(rotRad) + dy * Math.cos(rotRad);

    // Apply tilt projection to adjust screen Y coordinates in 3D mode
    if (is3DMode) {
      rotatedY = rotatedY * Math.cos(tilt * Math.PI / 180);
    }

    // Apply scale and translate to get container-relative coords
    const containerW = containerRef.current.clientWidth;
    const containerH = containerRef.current.clientHeight;
    const screenX = containerW / 2 + position.x + rotatedX * scale;
    const screenY = containerH / 2 + position.y + rotatedY * scale;

    setClickPos({ x: screenX, y: screenY });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMapItem]);

  if (!draftDeltaData) return <div className="flex-center w-full h-full text-muted">Đang tải bản đồ (Draft)...</div>;
  if (!currentFloor) return <div className="flex-center w-full h-full text-muted">Không tìm thấy dữ liệu tầng.</div>;

  const viewBox = `0 0 ${currentFloor.image_width} ${currentFloor.image_height}`;

  // Removed single publicItems filter since it's mapped below

  // Handlers for Pan and Zoom
  const handleWheel = (e) => {
    // Basic zoom towards center
    const zoomFactor = 1.1;
    const newScale = e.deltaY < 0 ? scale * zoomFactor : scale / zoomFactor;
    setScale(Math.max(0.1, Math.min(newScale, 10))); // clamp scale between 0.1 and 10
  };

  // Pointer-based rotation states

  const handlePointerDown = (e) => {
    // Prevent default context menu behavior if right-clicking
    if (e.button === 2) {
      e.preventDefault();
    }
    
    clickStartPos.current = { x: e.clientX, y: e.clientY };
    hasDragged.current = false;
    
    // Rotate if Shift key is held down, right mouse button is used, or interaction mode is set to 'rotate'
    const shouldRotate = e.shiftKey || e.button === 2 || interactionMode === 'rotate';
    
    if (shouldRotate) {
      setIsDragging(true);
      setIsRotating(true);
      dragStart.current = {
        startX: e.clientX,
        startY: e.clientY,
        startRotation: rotation,
        startTilt: tilt
      };
    } else if (interactionMode === 'pan') {
      setIsDragging(true);
      setIsRotating(false);
      dragStart.current = {
        startX: e.clientX - position.x,
        startY: e.clientY - position.y
      };
    } else {
      setIsDragging(false);
      setIsRotating(false);
    }
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    
    if (Math.hypot(e.clientX - clickStartPos.current.x, e.clientY - clickStartPos.current.y) > 12) {
      hasDragged.current = true;
    }
    
    if (isRotating) {
      const deltaX = e.clientX - dragStart.current.startX;
      const deltaY = e.clientY - dragStart.current.startY;
      
      // Horizontal drag rotates (Z-axis rotation / Yaw)
      let newRotation = dragStart.current.startRotation - deltaX * 0.5;
      newRotation = (newRotation % 360 + 360) % 360;
      setRotation(newRotation);
      
      // Vertical drag tilts (X-axis rotation / Pitch)
      if (is3DMode) {
        let newTilt = dragStart.current.startTilt + deltaY * 0.4;
        newTilt = Math.max(15, Math.min(85, newTilt));
        setTilt(newTilt);
      }
    } else {
      setPosition({
        x: e.clientX - dragStart.current.startX,
        y: e.clientY - dragStart.current.startY
      });
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setIsRotating(false);
  };

  return (
    <div 
      ref={containerRef} 
      style={{
        height: '100%', width: '100%', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #eef2f7 0%, #e8edf5 100%)',
        touchAction: 'none'
      }}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      
      {/* Controls Overlay */}
      <div className="map-zoom-controls" style={{
        position: 'absolute', top: '80px', right: '16px', zIndex: 1000,
        display: 'flex', flexDirection: 'column', gap: '6px'
      }}>
        {/* Zoom In */}
        <button 
          onClick={() => setScale(s => Math.min(s * 1.2, 10))} 
          title="Phóng to" 
          style={{
            width: '38px', height: '38px',
            backgroundColor: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: '10px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#374151',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F26D21'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = '#F26D21'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.92)'; e.currentTarget.style.color = '#374151'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; }}
        >
          <ZoomIn size={18}/>
        </button>

        {/* Zoom Out */}
        <button 
          onClick={() => setScale(s => Math.max(s / 1.2, 0.1))} 
          title="Thu nhỏ" 
          style={{
            width: '38px', height: '38px',
            backgroundColor: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: '10px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#374151',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F26D21'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = '#F26D21'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.92)'; e.currentTarget.style.color = '#374151'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; }}
        >
          <ZoomOut size={18}/>
        </button>

        <div style={{ height: '1px', backgroundColor: 'rgba(0,0,0,0.08)', margin: '2px 0' }} />

        {/* Pan Mode Button */}
        <button 
          onClick={() => setInteractionMode(prev => prev === 'pan' ? 'none' : 'pan')} 
          title="Chế độ di chuyển (Kéo thả để di chuyển bản đồ)" 
          style={{
            width: '38px', height: '38px',
            backgroundColor: interactionMode === 'pan' ? '#F26D21' : 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${interactionMode === 'pan' ? '#F26D21' : 'rgba(0,0,0,0.08)'}`,
            borderRadius: '10px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: interactionMode === 'pan' ? 'white' : '#374151',
            boxShadow: interactionMode === 'pan' ? '0 4px 14px rgba(242,109,33,0.35)' : '0 2px 8px rgba(0,0,0,0.08)',
            transition: 'all 0.15s ease',
          }}
        >
          <Move size={18}/>
        </button>

        {/* Rotate Mode Button */}
        <button 
          onClick={() => setInteractionMode(prev => prev === 'rotate' ? 'none' : 'rotate')} 
          title="Chế độ xoay (Kéo thả để xoay bản đồ / thay đổi góc nghiêng)" 
          style={{
            width: '38px', height: '38px',
            backgroundColor: interactionMode === 'rotate' ? '#F26D21' : 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${interactionMode === 'rotate' ? '#F26D21' : 'rgba(0,0,0,0.08)'}`,
            borderRadius: '10px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: interactionMode === 'rotate' ? 'white' : '#374151',
            boxShadow: interactionMode === 'rotate' ? '0 4px 14px rgba(242,109,33,0.35)' : '0 2px 8px rgba(0,0,0,0.08)',
            transition: 'all 0.15s ease',
          }}
        >
          <RotateCw size={18}/>
        </button>

        {/* Reset View Angle */}
        <button 
          onClick={() => {
            setRotation(180);
            setTilt(60);
            setPosition({ x: 0, y: 0 });
            setScale(1);
          }} 
          title="Đặt lại góc nhìn mặc định" 
          style={{
            width: '38px', height: '38px',
            backgroundColor: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: '10px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#374151',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F26D21'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = '#F26D21'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.92)'; e.currentTarget.style.color = '#374151'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; }}
        >
          <RefreshCw size={18}/>
        </button>

        <div style={{ height: '1px', backgroundColor: 'rgba(0,0,0,0.08)', margin: '2px 0' }} />

        {/* 3D Mode Toggle */}
        <button 
          onClick={() => setIs3DMode(!is3DMode)} 
          title={is3DMode ? 'Tắt chế độ 3D' : 'Bật chế độ 3D'} 
          style={{
            width: '38px', height: '38px',
            backgroundColor: is3DMode ? '#F26D21' : 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${is3DMode ? '#F26D21' : 'rgba(0,0,0,0.08)'}`,
            borderRadius: '10px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: is3DMode ? 'white' : '#374151',
            boxShadow: is3DMode ? '0 4px 14px rgba(242,109,33,0.35)' : '0 2px 8px rgba(0,0,0,0.08)',
            transition: 'all 0.2s ease',
          }}
        >
          <Box size={18}/>
        </button>

        <div style={{ height: '1px', backgroundColor: 'rgba(0,0,0,0.08)', margin: '2px 0' }} />

        {/* Report Mode Toggle */}
        <button
          onClick={() => {
            if (isReportMode) { clearPendingReport(); }
            else { setReportMode(true); setReportStep('select_type'); }
          }}
          title={isReportMode ? 'Hủy báo cáo' : 'Báo cáo sự cố'}
          style={{
            width: '38px', height: '38px',
            backgroundColor: isReportMode ? '#DC2626' : 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${isReportMode ? '#DC2626' : 'rgba(0,0,0,0.08)'}`,
            borderRadius: '10px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: isReportMode ? 'white' : '#DC2626',
            boxShadow: isReportMode ? '0 4px 14px rgba(220,38,38,0.35)' : '0 2px 8px rgba(0,0,0,0.08)',
            transition: 'all 0.2s ease',
          }}
        >
          <AlertTriangle size={18}/>
        </button>
      </div>

      {/* ── Legend Panel (Desktop — always visible) ── */}
      <div className="draft-legend-desktop" style={{
        position: 'absolute', bottom: '20px', right: '16px', zIndex: 900,
        backgroundColor: 'rgba(255,255,255,0.94)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        padding: '14px 16px',
        borderRadius: '16px',
        boxShadow: '0 8px 28px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)',
        border: '1px solid rgba(255,255,255,0.8)',
        pointerEvents: 'none',
        minWidth: '192px',
      }}>
        <div style={{
          fontSize: '10px', fontWeight: 800, color: '#111827',
          letterSpacing: '1.2px', marginBottom: '10px',
          paddingBottom: '8px', borderBottom: '1.5px solid #F3F4F6',
          fontFamily: 'var(--font-sans)',
        }}>BẢNG CHÚ THÍCH</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {LEGEND_ITEMS.map(l => (
            <div key={l.type} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '22px', height: '22px', flexShrink: 0,
                backgroundColor: l.color,
                borderRadius: '6px',
                border: `1.5px solid ${l.border}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{l.icon}</div>
              <span style={{ fontSize: '11.5px', color: '#374151', fontWeight: 500,
                fontFamily: 'var(--font-sans)', lineHeight: 1.3,
              }}>{l.type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Legend Toggle Button (Mobile only) ── */}
      <button
        className="legend-toggle-btn"
        onClick={() => setIsLegendOpen(v => !v)}
        style={{
          position: 'absolute', bottom: '20px', left: '16px', zIndex: 1001,
          backgroundColor: isLegendOpen ? 'var(--color-primary)' : 'rgba(255,255,255,0.94)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1.5px solid ${isLegendOpen ? 'var(--color-primary)' : 'rgba(0,0,0,0.1)'}`,
          borderRadius: '12px',
          padding: '8px 14px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          cursor: 'pointer',
          alignItems: 'center',
          gap: '6px',
          color: isLegendOpen ? 'white' : '#374151',
          fontSize: '13px',
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          minHeight: '44px',
        }}
      >
        <Layers size={16} />
        <span>Chú thích</span>
      </button>

      {/* ── Legend Mobile Bottom Sheet ── */}
      {isLegendOpen && (
        <div
          className="legend-mobile-sheet"
          style={{
            position: 'fixed',
            left: 0, right: 0,
            bottom: 'calc(var(--bottom-nav-height) + var(--safe-bottom) + var(--floor-selector-height))',
            zIndex: 1100,
            flexDirection: 'column',
            backgroundColor: 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px 20px 0 0',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.15)',
            padding: '0 0 16px 0',
            maxHeight: '60vh',
            overflowY: 'auto',
          }}
        >
          {/* Sheet header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px 12px',
            borderBottom: '1px solid #F3F4F6',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="var(--color-primary)" />
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827', fontFamily: 'var(--font-sans)' }}>
                BẢNG CHÚ THÍCH
              </span>
            </div>
            <button
              onClick={() => setIsLegendOpen(false)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '6px', borderRadius: '8px',
                color: '#6b7280', display: 'flex', alignItems: 'center',
                minWidth: 36, minHeight: 36,
              }}
            >
              <X size={18} />
            </button>
          </div>
          {/* Legend items grid */}
          <div style={{ padding: '12px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {LEGEND_ITEMS.map(l => (
              <div key={l.type} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '26px', height: '26px', flexShrink: 0,
                  backgroundColor: l.color,
                  borderRadius: '7px',
                  border: `1.5px solid ${l.border}55`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{l.icon}</div>
                <span style={{
                  fontSize: '12px', color: '#374151', fontWeight: 500,
                  fontFamily: 'var(--font-sans)', lineHeight: 1.3,
                }}>{l.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Dimmed backdrop for legend sheet */}
      {isLegendOpen && (
        <div
          onClick={() => setIsLegendOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1099,
            background: 'rgba(0,0,0,0.15)',
          }}
        />
      )}

      {/* Transform Container */}
      <div style={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        transform: `translate(${position.x}px, ${position.y}px)`
      }}>
        <div style={{ 
          width: currentFloor.image_width, 
          height: currentFloor.image_height, 
          position: 'relative', 
          transform: is3DMode 
            ? `scale(${scale}) rotateX(${tilt}deg) rotateZ(${rotation - 45}deg)`
            : `scale(${scale}) rotate(${rotation}deg)`,
          transformStyle: is3DMode ? 'preserve-3d' : 'flat',
          transformOrigin: 'center',
          transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          
          {/* SVG Map Renderer - Stacks multiple floors in 3D mode */}
            {(is3DMode ? draftDeltaData.floors : [currentFloor]).map((floor, idx) => {
              if (!floor) return null;
              const floorItems = floor.items || [];
              const isActiveFloor = floor.floor === currentFloorId || floor.id === currentFloorId;
            // Reverse the Z order so floor 1 is at bottom (lowest Z), floor 4 at top (highest Z)
            // But draftDeltaData.floors is usually ordered F1, F2, F3, F4.
            // So idx * 400 space them out. 400 is the gap size.
            
            return (
              <svg 
                key={floor.floor || idx}
                onClick={(e) => handleSvgClick(e, e.currentTarget, floor.floor || floor.id)}
                onPointerDown={(e) => handleSvgPointerDown(e, e.currentTarget, floor.floor || floor.id)}
                onPointerMove={(e) => handleSvgPointerMove(e, e.currentTarget)}
                onPointerUp={(e) => handleSvgPointerUp(e)}
                onPointerCancel={(e) => handleSvgPointerUp(e)}
                viewBox={`${floor.image_min_x || 0} ${floor.image_min_y || 0} ${floor.image_width} ${floor.image_height}`}
                style={{ 
                  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
                  cursor: isDragging ? 'grabbing' : 'crosshair', 
                  display: 'block', 
                  backgroundColor: is3DMode ? 'rgba(255, 255, 255, 0.85)' : 'transparent',
                  border: is3DMode ? '1px solid rgba(0,0,0,0.15)' : 'none',
                  boxShadow: is3DMode && idx === 0 ? '0 40px 100px rgba(0,0,0,0.4)' : 'none',
                  transform: is3DMode ? `translateZ(${idx * 400}px)` : 'none',
                  transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s',
                  opacity: (is3DMode && !isActiveFloor) ? 0.35 : 1,
                  pointerEvents: (is3DMode && !isActiveFloor) ? 'none' : 'auto'
                }}
                preserveAspectRatio="xMidYMid meet"
              >
                {/* SVG Defs — drop shadows, glows */}
                <defs>
                  <filter id={`glow-${floor.floor}`} x="-25%" y="-25%" width="150%" height="150%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur"/>
                    <feFlood floodColor="#F26D21" floodOpacity="0.85" result="color"/>
                    <feComposite in="color" in2="blur" operator="in" result="shadow"/>
                    <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                  <filter id={`hover-${floor.floor}`} x="-8%" y="-8%" width="116%" height="116%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" result="blur"/>
                    <feFlood floodColor="#374151" floodOpacity="0.18" result="color"/>
                    <feComposite in="color" in2="blur" operator="in" result="shadow"/>
                    <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                  <filter id="wall-shadow" x="-4%" y="-4%" width="108%" height="108%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="blur"/>
                    <feFlood floodColor="#000" floodOpacity="0.3" result="color"/>
                    <feComposite in="color" in2="blur" operator="in" result="shadow"/>
                    <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                </defs>

                {/* Clean white building background */}
                {!is3DMode && (
                  <rect
                    x={floor.image_min_x || 0}
                    y={floor.image_min_y || 0}
                    width={floor.image_width}
                    height={floor.image_height}
                    fill="white"
                    rx="8" ry="8"
                    filter="url(#wall-shadow)"
                    stroke="#cbd5e1"
                    strokeWidth="1"
                  />
                )}

                {/* Background rect to ensure empty areas are clickable */}
                <rect width="100%" height="100%" fill="transparent" />
                
                {/* Base floor image */}
                {floor.image_path && (
                  <image href={floor.image_path} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" opacity={0.4} />
                )}

                {/* Floor Label Tag (only visible in 3D mode) */}
                {is3DMode && (
                   <text x="50" y="80" fontSize="80" fontWeight="bold" fill="rgba(0,0,0,0.3)" transform={`rotate(${-(rotation - 45)} 50 80)`}>
                     {floor.floor_name || `Tầng ${floor.floor}`}
                   </text>
                )}

                {floorItems.map((item) => {
                  if (!item.bbox || (item.bbox.min_x === 0 && item.bbox.max_x === 0)) return null;
                  if (item.item_id && item.item_id.startsWith('PERIMETER')) return null; // Hide invisible pathfinding walls
                  
                  const isSelected = selectedMapItem?.item_id === item.item_id || (highlightedRoomCode && highlightedRoomCode === item.room_code);
                  const isHovered = !isSelected && hoveredItem?.item_id === item.item_id;
                  const style = getItemStyle(item.item_type);
                  const width = item.bbox.max_x - item.bbox.min_x;
                  const height = item.bbox.max_y - item.bbox.min_y;

                  // Render selected item with bolder stroke
                  const selectedStrokeWidth = isSelected ? '4' : isHovered ? '2' : (style.strokeWidth || '1');
                  
                  const cx = item.bbox.min_x + width / 2;
                  const cy = item.bbox.min_y + height / 2;
                  
                  // Calculate dynamic font size based on bounding box height
                  const fontSize = Math.min(Math.max(height * 0.45, 16), 52);
                  const isInteractive = item.item_type !== 'wall' && item.item_type !== 'block' && item.item_type !== 'skylight';

                  return (
                    <g
                      key={item.item_id}
                      className="map-item"
                      style={{ cursor: isInteractive ? 'pointer' : 'default' }}
                      onMouseEnter={() => isInteractive && !isDragging && setHoveredItem(item)}
                      onMouseLeave={() => setHoveredItem(null)}
                      onClick={(e) => {
                        if (hasDragged.current) return;
                        if (isInteractive) {
                          const store = useAppStore.getState();
                          
                          // Nếu đang chọn vùng (area) cho report, bỏ qua click trên item
                          // để event nổi bọt (bubble) lên <svg> xử lý lấy tọa độ.
                          if (store.isReportMode && store.reportStep === 'select_target' && store.pendingReport) {
                            const isArea = ['wet_floor','construction','debris','other'].includes(store.pendingReport.obstacle_type);
                            if (isArea) return;
                          }
                          
                          e.stopPropagation();
                          
                          // Report mode: targeted type → chọn item này
                          if (store.isReportMode && store.reportStep === 'select_target' && store.pendingReport) {
                            const isTargeted = ['elevator_broken','stairs_locked','room_locked'].includes(store.pendingReport.obstacle_type);
                            if (isTargeted) {
                              const typeMap = { 
                                elevator_broken: ['elevator'], 
                                stairs_locked: ['stair'], 
                                room_locked: ['room', 'office', 'lab', 'hall', 'meeting', 'library', 'door'] 
                              };
                              const expectedTypes = typeMap[store.pendingReport.obstacle_type];
                              if (expectedTypes && !expectedTypes.includes(item.item_type)) return;
                              store.setPendingReport({ ...store.pendingReport, target_item_id: item.item_id, floor: floor.floor || floor.id });
                              store.setReportStep('confirm');
                              return;
                            }
                          }
                          
                          const routingMode = store.routingSelectionMode;
                          if (routingMode) {
                            const point = {
                              type: 'room',
                              roomCode: item.room_code || item.item_id,
                              itemId: item.item_id,
                              bboxCenter: { x: cx, y: cy, floor: floor.floor || floor.id },
                              label: item.display_name || item.room_code || 'Phòng'
                            };
                            if (routingMode === 'start') {
                              store.setRouteStart(point);
                            } else {
                              store.setRouteEnd(point);
                            }
                            store.setRoutingSelectionMode(null);
                          } else {
                            setSelectedMapItem(item);
                            if (containerRef.current) {
                              const rect = containerRef.current.getBoundingClientRect();
                              setClickPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                            }
                          }
                        }
                      }}
                    >
                      {/* Main room rectangle */}
                      <rect
                        x={item.bbox.min_x}
                        y={item.bbox.min_y}
                        width={width}
                        height={height}
                        rx="5" ry="5"
                        fill={style.fill}
                        stroke={isSelected ? '#F26D21' : isHovered ? style.stroke : style.stroke}
                        strokeWidth={selectedStrokeWidth}
                        filter={
                          isSelected && isInteractive
                            ? `url(#glow-${floor.floor})`
                            : isHovered
                              ? `url(#hover-${floor.floor})`
                              : 'none'
                        }
                        style={{ transition: 'stroke 0.12s ease, stroke-width 0.12s ease' }}
                      />
                      {/* Room label text & icons */}
                      {isInteractive && width > 15 && height > 15 && (
                        <g
                          transform={`translate(${cx}, ${cy}) rotate(${is3DMode ? -(rotation - 45) : -rotation})`}
                          style={{ pointerEvents: 'none', userSelect: 'none' }}
                        >
                          {(() => {
                            const textColor = isSelected ? '#9A3412' : isHovered ? '#111827' : '#1F2937';
                            const fontWeight = isSelected ? '800' : isHovered ? '700' : '600';
                            const name = item.room_code || formatDisplayName(item.display_name, item.item_type);
                            
                            let IconComponent = null;
                            if (item.item_type === 'stair') IconComponent = StairSvg;
                            else if (item.item_type === 'elevator') IconComponent = ElevatorSvg;
                            else if (item.item_type === 'toilet') IconComponent = ToiletSvg;
                            
                            if (IconComponent) {
                              // Compute icon size based on available room space
                              const iconSize = Math.min(width, height) * 0.55;
                              const ic = textColor;
                              let iconEl = null;
                              if (item.item_type === 'stair') {
                                const s = iconSize;
                                iconEl = (
                                  <g transform={`translate(${-s/2}, ${-s/2})`}>
                                    <rect x={0}      y={s*0.67} width={s}      height={s*0.33} rx={s*0.08} fill={ic} opacity="0.35"/>
                                    <rect x={s*0.25} y={s*0.33} width={s*0.75} height={s*0.33} rx={s*0.08} fill={ic} opacity="0.6"/>
                                    <rect x={s*0.5}  y={0}      width={s*0.5}  height={s*0.33} rx={s*0.08} fill={ic} opacity="0.9"/>
                                  </g>
                                );
                              } else if (item.item_type === 'elevator') {
                                // White icon inside (contrasts with dark purple fill)
                                const s = Math.min(iconSize * 0.9, Math.min(width, height) * 0.6);
                                iconEl = (
                                  <g transform={`translate(${-s/2}, ${-s/2})`}>
                                    <rect x={s*0.08} y={s*0.08} width={s*0.84} height={s*0.84} rx={s*0.18} stroke="white" strokeWidth={Math.max(s*0.1, 2)} fill="rgba(255,255,255,0.15)"/>
                                    <path d={`M${s*0.5} ${s*0.17} L${s*0.28} ${s*0.46} L${s*0.72} ${s*0.46} Z`} fill="white"/>
                                    <path d={`M${s*0.5} ${s*0.83} L${s*0.28} ${s*0.54} L${s*0.72} ${s*0.54} Z`} fill="white"/>
                                  </g>
                                );
                              } else if (item.item_type === 'toilet') {
                                const s = iconSize;
                                const rawName = item.display_name || '';
                                const isMale = rawName.includes('NAM') || rawName.toLowerCase().includes('nam');
                                
                                if (isMale) {
                                  // Male icon: small chevron + text
                                  const iconS = Math.min(iconSize * 0.5, Math.min(width, height) * 0.3);
                                  const sw = iconS * 0.14;
                                  const labelFontSize = Math.min(Math.max(height * 0.22, 10), fontSize * 0.75);
                                  iconEl = (
                                    <g>
                                      <g transform={`translate(0, ${-labelFontSize * 0.6})`}>
                                        <path
                                          d={`M${iconS*0.3} ${-iconS*0.45} L${-iconS*0.2} 0 L${iconS*0.3} ${iconS*0.45}`}
                                          fill="none"
                                          stroke={ic}
                                          strokeWidth={sw}
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </g>
                                      <text
                                        x={0}
                                        y={iconS * 0.7 + labelFontSize * 0.5}
                                        textAnchor="middle"
                                        alignmentBaseline="middle"
                                        fontSize={labelFontSize}
                                        fontFamily="var(--font-sans)"
                                        fill={ic}
                                        fontWeight="700"
                                      >NVS Nam</text>
                                    </g>
                                  );
                                } else {
                                  // Female: small S-curve + text
                                  const iconS = Math.min(iconSize * 0.5, Math.min(width, height) * 0.3);
                                  const sw = iconS * 0.13;
                                  const labelFontSize = Math.min(Math.max(height * 0.22, 10), fontSize * 0.75);
                                  iconEl = (
                                    <g>
                                      <g transform={`translate(0, ${-labelFontSize * 0.6})`}>
                                        <circle cx={iconS*0.1} cy={-iconS*0.48} r={sw*0.6} fill={ic}/>
                                        <path
                                          d={`M${iconS*0.25} ${-iconS*0.36} C${iconS*0.28} ${-iconS*0.1} ${-iconS*0.28} ${-iconS*0.05} ${-iconS*0.2} ${iconS*0.18} C${-iconS*0.12} ${iconS*0.38} ${iconS*0.22} ${iconS*0.38} ${iconS*0.15} ${iconS*0.48}`}
                                          fill="none"
                                          stroke={ic}
                                          strokeWidth={sw}
                                          strokeLinecap="round"
                                        />
                                      </g>
                                      <text
                                        x={0}
                                        y={iconS * 0.7 + labelFontSize * 0.5}
                                        textAnchor="middle"
                                        alignmentBaseline="middle"
                                        fontSize={labelFontSize}
                                        fontFamily="var(--font-sans)"
                                        fill={ic}
                                        fontWeight="700"
                                      >NVS Nữ</text>
                                    </g>
                                  );
                                }
                              }
                              return iconEl;
                            }
                            
                            return (
                              <text
                                x="0"
                                y="0"
                                textAnchor="middle"
                                alignmentBaseline="middle"
                                fontSize={fontSize}
                                fontFamily="var(--font-sans)"
                                fill={textColor}
                                fontWeight={fontWeight}
                                letterSpacing="-0.02em"
                              >
                                {name}
                              </text>
                            );
                          })()}
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* ── SELECTED ROOM BEACON — pulsing rings to make found room unmissable ── */}
                {(() => {
                  if (!selectedMapItem || !selectedMapItem.bbox) return null;
                  const isOnThisFloor = selectedMapItem.floor_id === (floor.floor || floor.id);
                  if (!isOnThisFloor) return null;
                  const bx = selectedMapItem.bbox.min_x + (selectedMapItem.bbox.max_x - selectedMapItem.bbox.min_x) / 2;
                  const by = selectedMapItem.bbox.min_y + (selectedMapItem.bbox.max_y - selectedMapItem.bbox.min_y) / 2;
                  const r = Math.max(selectedMapItem.bbox.max_x - selectedMapItem.bbox.min_x, selectedMapItem.bbox.max_y - selectedMapItem.bbox.min_y) / 2 + 8;
                  return (
                    <g pointerEvents="none">
                      {/* Outer pulse ring 1 */}
                      <circle cx={bx} cy={by} r={r + 20} fill="none" stroke="#0EA5E9" strokeWidth="2" opacity="0">
                        <animate attributeName="r" values={`${r};${r+32};${r}`} dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.7;0;0.7" dur="2s" repeatCount="indefinite" />
                      </circle>
                      {/* Outer pulse ring 2 (offset) */}
                      <circle cx={bx} cy={by} r={r + 10} fill="none" stroke="#0EA5E9" strokeWidth="2.5" opacity="0">
                        <animate attributeName="r" values={`${r+8};${r+28};${r+8}`} dur="2s" begin="0.5s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" begin="0.5s" repeatCount="indefinite" />
                      </circle>
                      {/* Inner glow ring */}
                      <circle cx={bx} cy={by} r={r + 4} fill="rgba(14,165,233,0.12)" stroke="#0EA5E9" strokeWidth="2" opacity="0.9" />
                      {/* Pin dot at center */}
                      <circle cx={bx} cy={by} r="6" fill="#0EA5E9" opacity="0.9">
                        <animate attributeName="r" values="5;8;5" dur="1.5s" repeatCount="indefinite" />
                      </circle>
                    </g>
                  );
                })()}

                {/* Draw Route on this floor */}
                {(() => {
                  if (!routePath || routePath.length === 0) return null;
                  
                  // Extract contiguous segments for this floor
                  const floorSegments = [];
                  let currentSegment = [];
                  
                  routePath.forEach((node, idx) => {
                    if (node.floor === (floor.floor || floor.id)) {
                      currentSegment.push(node);
                    } else {
                      if (currentSegment.length > 0) {
                        floorSegments.push(currentSegment);
                        currentSegment = [];
                      }
                    }
                  });
                  if (currentSegment.length > 0) floorSegments.push(currentSegment);

                  return (
                    <>
                      {floorSegments.map((segment, segIdx) => (
                        <polyline
                          key={`seg-${segIdx}`}
                          points={segment.map(n => `${n.x},${n.y}`).join(' ')}
                          fill="none"
                          stroke="#3B82F6"
                          strokeWidth="8"
                          strokeDasharray="16 12"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{
                            animation: 'dash-flow 1s linear infinite',
                            filter: 'drop-shadow(0 4px 6px rgba(59, 130, 246, 0.4))'
                          }}
                        />
                      ))}
                      
                      {/* Floor-transition markers: show where route enters/exits this floor via stairs */}
                      {routePath.map((node, i) => {
                        if (i === 0) return null;
                        const prevNode = routePath[i - 1];
                        
                        // Transition OUT of this floor (current node leaves to another floor)
                        if (prevNode.floor === (floor.floor || floor.id) && node.floor !== (floor.floor || floor.id)) {
                          const direction = node.floor > (floor.floor || floor.id) ? '↑' : '↓';
                          const targetFloor = node.floor;
                          return (
                            <g 
                              key={`trans-out-${i}`}
                              style={{ cursor: 'pointer' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setCurrentFloorId(targetFloor);
                              }}
                            >
                              <circle cx={prevNode.x} cy={prevNode.y} r={24} fill="none" stroke="#3B82F6" strokeWidth="3" opacity="0.6">
                                <animate attributeName="r" values="20;30;20" dur="1.5s" repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1.5s" repeatCount="indefinite" />
                              </circle>
                              <circle cx={prevNode.x} cy={prevNode.y} r={20} fill="#3B82F6" fillOpacity="0.9" />
                              <text
                                x={prevNode.x}
                                y={prevNode.y + 7}
                                textAnchor="middle"
                                alignmentBaseline="middle"
                                fontSize="26"
                                fill="white"
                                fontWeight="bold"
                                pointerEvents="none"
                                transform={`rotate(${is3DMode ? -(rotation - 45) : -rotation} ${prevNode.x} ${prevNode.y})`}
                              >
                                {direction}
                              </text>
                              <rect
                                x={prevNode.x + 28}
                                y={prevNode.y - 23}
                                width={direction === '↑' ? 170 : 185}
                                height={46}
                                rx="12"
                                fill="#3B82F6"
                                fillOpacity="0.9"
                                transform={`rotate(${is3DMode ? -(rotation - 45) : -rotation} ${prevNode.x} ${prevNode.y})`}
                              />
                              <text
                                x={prevNode.x + 36}
                                y={prevNode.y + 7}
                                fontSize="22"
                                fill="white"
                                fontWeight="700"
                                pointerEvents="none"
                                transform={`rotate(${is3DMode ? -(rotation - 45) : -rotation} ${prevNode.x} ${prevNode.y})`}
                              >
                                {direction === '↑' ? `Lên tầng ${targetFloor}` : `Xuống tầng ${targetFloor}`}
                              </text>
                            </g>
                          );
                        }
                        
                        // Transition INTO this floor (current node arrives from another floor)
                        if (node.floor === (floor.floor || floor.id) && prevNode.floor !== (floor.floor || floor.id)) {
                          const direction = prevNode.floor < (floor.floor || floor.id) ? '↑' : '↓';
                          const fromFloor = prevNode.floor;
                          return (
                            <g 
                              key={`trans-in-${i}`}
                              style={{ cursor: 'pointer' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setCurrentFloorId(fromFloor);
                              }}
                            >
                              <circle cx={node.x} cy={node.y} r={24} fill="none" stroke="#10B981" strokeWidth="3" opacity="0.6">
                                <animate attributeName="r" values="20;30;20" dur="1.5s" repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1.5s" repeatCount="indefinite" />
                              </circle>
                              <circle cx={node.x} cy={node.y} r={20} fill="#10B981" fillOpacity="0.9" />
                              <text
                                x={node.x}
                                y={node.y + 7}
                                textAnchor="middle"
                                alignmentBaseline="middle"
                                fontSize="26"
                                fill="white"
                                fontWeight="bold"
                                pointerEvents="none"
                                transform={`rotate(${is3DMode ? -(rotation - 45) : -rotation} ${node.x} ${node.y})`}
                              >
                                {direction}
                              </text>
                              <rect
                                x={node.x + 28}
                                y={node.y - 23}
                                width={185}
                                height={46}
                                rx="12"
                                fill="#10B981"
                                fillOpacity="0.9"
                                transform={`rotate(${is3DMode ? -(rotation - 45) : -rotation} ${node.x} ${node.y})`}
                              />
                              <text
                                x={node.x + 36}
                                y={node.y + 7}
                                fontSize="22"
                                fill="white"
                                fontWeight="700"
                                pointerEvents="none"
                                transform={`rotate(${is3DMode ? -(rotation - 45) : -rotation} ${node.x} ${node.y})`}
                              >
                                {`Từ tầng ${fromFloor}`}
                              </text>
                            </g>
                          );
                        }
                        
                        return null;
                      })}
                    </>
                  );
                })()}

                {/* Draw Start Marker on this floor if start node is here */}
                {routeStart && routeStart.bboxCenter && routeStart.bboxCenter.floor === (floor.floor || floor.id) && (
                  <g transform={`translate(${routeStart.bboxCenter.x}, ${routeStart.bboxCenter.y}) rotate(${is3DMode ? -(rotation - 45) : -rotation}) scale(${1 / Math.max(scale, 0.3)})`}>
                    {/* Shadow */}
                    <ellipse cx="0" cy="8" rx="8" ry="4" fill="rgba(0,0,0,0.3)">
                      <animate attributeName="rx" values="8;6;8" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="ry" values="4;3;4" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
                    </ellipse>
                    {/* Map Pin */}
                    <g>
                      <animateTransform attributeName="transform" type="translate" values="0,0; 0,-6; 0,0" dur="2s" repeatCount="indefinite" />
                      <path d="M0,-24 C-8,-24 -14,-18 -14,-10 C-14,-2 0,8 0,8 C0,8 14,-2 14,-10 C14,-18 8,-24 0,-24 Z" fill="#10B981" />
                      <circle cx="0" cy="-10" r="5" fill="white" />
                    </g>
                  </g>
                )}

                {/* Draw End Marker on this floor if end node is here */}
                {routeEnd && routeEnd.bboxCenter && routeEnd.bboxCenter.floor === (floor.floor || floor.id) && (
                  <g transform={`translate(${routeEnd.bboxCenter.x}, ${routeEnd.bboxCenter.y}) rotate(${is3DMode ? -(rotation - 45) : -rotation}) scale(${1 / Math.max(scale, 0.3)})`}>
                    {/* Pulsing Halos */}
                    <circle cx="0" cy="0" r="24" fill="none" stroke="#EF4444" strokeWidth="2">
                      <animate attributeName="r" values="8;32" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.8;0" dur="2s" repeatCount="indefinite" />
                    </circle>
                      <circle cx="0" cy="0" r="16" fill="none" stroke="#EF4444" strokeWidth="2">
                      <animate attributeName="r" values="8;24" dur="2s" begin="1s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.8;0" dur="2s" begin="1s" repeatCount="indefinite" />
                    </circle>
                    {/* Flag Icon */}
                    <g transform="translate(0, -20)">
                      <path d="M -8,0 L -8,20 M -8,0 L 8,6 L -8,12" fill="#EF4444" stroke="#EF4444" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                    </g>
                  </g>
                )}
                {/* Obstacle Markers Overlay */}
                <ObstacleMarkers
                  obstacles={[...(activeObstacles || []), ...(mockObstacles || [])].filter(o => o.floor === (floor.floor || floor.id))}
                  draftFloorData={floor}
                  currentFloor={floor.floor || floor.id}
                  mapRotation={is3DMode ? (rotation - 45) : rotation}
                  onUpvote={async (id, isTesterMode) => {
                    try {
                      const { upvoteObstacle } = await import('../../services/api');
                      const userId = useAppStore.getState().user?.id || 'anonymous';
                      const res = await upvoteObstacle(id, { user_id: userId, tester_mode: isTesterMode });
                      const obs = useAppStore.getState().activeObstacles.map(o => o.id === id ? { ...o, upvotes: res.data.upvotes, downvotes: res.data.downvotes } : o);
                      useAppStore.getState().setActiveObstacles(obs);
                    } catch (err) { 
                      const msg = err.response?.data?.detail || 'Upvote failed';
                      alert('❌ ' + msg);
                    }
                  }}
                  onDownvote={async (id, isTesterMode) => {
                    try {
                      const { downvoteObstacle } = await import('../../services/api');
                      const userId = useAppStore.getState().user?.id || 'anonymous';
                      const res = await downvoteObstacle(id, { user_id: userId, tester_mode: isTesterMode });
                      if (res.data.auto_removed) {
                        useAppStore.getState().setActiveObstacles(useAppStore.getState().activeObstacles.filter(o => o.id !== id));
                      } else {
                        const obs = useAppStore.getState().activeObstacles.map(o => o.id === id ? { ...o, upvotes: res.data.upvotes, downvotes: res.data.downvotes } : o);
                        useAppStore.getState().setActiveObstacles(obs);
                      }
                    } catch (err) { 
                      const msg = err.response?.data?.detail || 'Downvote failed';
                      alert('❌ ' + msg);
                    }
                  }}
                />
                {/* Render report drag circle if active */}
                {reportDragStart && reportDragCurrent && isActiveFloor && (
                  <circle 
                    cx={reportDragStart.x}
                    cy={reportDragStart.y}
                    r={Math.max(10, Math.hypot(reportDragCurrent.x - reportDragStart.x, reportDragCurrent.y - reportDragStart.y))}
                    fill="rgba(239, 68, 68, 0.15)"
                    stroke="#EF4444"
                    strokeWidth="3"
                    strokeDasharray="6,6"
                    style={{ pointerEvents: 'none' }}
                  />
                )}
                {/* Render pending report area if in confirm step */}
                {!reportDragStart && isReportMode && reportStep === 'confirm' && pendingReport?.x && isActiveFloor && (
                  <circle
                    cx={pendingReport.x}
                    cy={pendingReport.y}
                    r={pendingReport.radius || 30}
                    fill="rgba(239, 68, 68, 0.15)"
                    stroke="#EF4444"
                    strokeWidth="3"
                    strokeDasharray="6,6"
                    style={{ pointerEvents: 'none' }}
                  />
                )}
                {/* Render recent click point for Mock Simulator */}
                {clickPoint && clickPoint.floor === (floor.floor || floor.id) && (
                  <g transform={`translate(${clickPoint.x}, ${clickPoint.y})`} style={{ pointerEvents: 'none' }}>
                    <circle cx="0" cy="0" r="4" fill="#8B5CF6" />
                    <circle cx="0" cy="0" r="16" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeDasharray="4,4">
                      <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="4s" repeatCount="indefinite" />
                    </circle>
                  </g>
                )}
              </svg>
            );
          })}
          
          {/* Draw vertical connectors spanning across floors in 3D Mode */}
          {is3DMode && routePath && routePath.length > 0 && (
            <div style={{ 
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
              pointerEvents: 'none',
              transformStyle: 'preserve-3d'
            }}>
              {routePath.map((node, i) => {
                if (i === 0) return null;
                const prevNode = routePath[i - 1];
                // Fix: use floor difference check only (no strict coordinate equality)
                // Stair nodes on different floors may have slightly different pixel coordinates
                if (node.floor !== prevNode.floor) {
                  const z1 = draftDeltaData.floors.findIndex(f => (f.floor || f.id) === prevNode.floor) * 400;
                  const z2 = draftDeltaData.floors.findIndex(f => (f.floor || f.id) === node.floor) * 400;
                  if (z1 < 0 || z2 < 0) return null;
                  const minZ = Math.min(z1, z2);
                  const maxZ = Math.max(z1, z2);
                  const height = maxZ - minZ;
                  // Use average coordinates when stair positions differ between floors
                  const avgX = (node.x + prevNode.x) / 2;
                  const avgY = (node.y + prevNode.y) / 2;

                  return (
                    <div key={`vert-${i}`} style={{
                      position: 'absolute',
                      left: avgX - 3,
                      top: avgY,
                      width: '6px',
                      height: `${height}px`,
                      backgroundColor: 'var(--color-primary)',
                      boxShadow: '0 0 12px var(--color-primary)',
                      transformOrigin: 'top center',
                      transform: `translateZ(${minZ}px) rotateX(-90deg)`,
                      borderRadius: '3px'
                    }} />
                  );
                }
                return null;
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── ROOM INFO CARD — appears near where the user clicked ── */}
      {selectedMapItem && !is3DMode && (() => {
        const CARD_W = 300;
        const CARD_H = 90;
        const OFFSET = 14; // gap between cursor and card edge
        const containerW = containerRef.current?.clientWidth || 800;
        const containerH = containerRef.current?.clientHeight || 600;

        let cardLeft, cardTop;
        if (clickPos) {
          // Prefer placing card to the right of click; flip left if near right edge
          const goLeft = clickPos.x + OFFSET + CARD_W > containerW - 16;
          cardLeft = goLeft
            ? clickPos.x - OFFSET - CARD_W
            : clickPos.x + OFFSET;

          // Prefer placing card below click; flip above if near bottom
          const goUp = clickPos.y + OFFSET + CARD_H > containerH - 60;
          cardTop = goUp
            ? clickPos.y - OFFSET - CARD_H
            : clickPos.y + OFFSET;

          // Clamp to container bounds
          cardLeft = Math.max(12, Math.min(cardLeft, containerW - CARD_W - 12));
          cardTop  = Math.max(12, Math.min(cardTop,  containerH - CARD_H - 60));
        }

        return (
          <div className="map-selected-card" style={{
            position: 'absolute',
            ...(clickPos
              ? { left: cardLeft, top: cardTop }
              : { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }
            ),
            zIndex: 1100,
            background: 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '18px',
            padding: '16px 20px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            minWidth: '260px',
            maxWidth: '320px',
            animation: 'popIn 0.22s cubic-bezier(0.16,1,0.3,1)',
            fontFamily: 'var(--font-sans)',
            pointerEvents: 'auto',
          }}>
          {/* Color dot */}
          <div className="color-dot" style={{
            width: '44px', height: '44px', flexShrink: 0,
            borderRadius: '12px',
            backgroundColor: getItemStyle(selectedMapItem.item_type).fill,
            border: `2px solid ${getItemStyle(selectedMapItem.item_type).stroke}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px',
          }}>
            {selectedMapItem.item_type === 'stair' ? '🚶' :
             selectedMapItem.item_type === 'elevator' ? '🔼' :
             selectedMapItem.item_type === 'toilet' ? '🚪' :
             selectedMapItem.item_type === 'library' ? '📚' :
             selectedMapItem.item_type === 'technical_room' ? '⚡' :
             selectedMapItem.item_type === 'lobby' ? '🕰️' : '🗒️'}
          </div>
          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="room-title" style={{ fontSize: '17px', fontWeight: 800, color: '#111827', letterSpacing: '-0.4px', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {selectedMapItem.room_code || formatDisplayName(selectedMapItem.display_name, selectedMapItem.item_type) || 'Phòng không tên'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '5px' }}>
              <span className="room-badge" style={{
                fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
                backgroundColor: getItemStyle(selectedMapItem.item_type).fill,
                color: '#374151', border: `1px solid ${getItemStyle(selectedMapItem.item_type).stroke}40`,
                letterSpacing: '0.3px',
              }}>
                {selectedMapItem.item_type === 'room' ? 'Phòng học / Chức năng' :
                 selectedMapItem.item_type === 'office' ? 'Văn phòng' :
                 selectedMapItem.item_type === 'research_center' ? 'TT Nghiên cứu' :
                 selectedMapItem.item_type === 'library' ? 'Thư viện / Học tập' :
                 selectedMapItem.item_type === 'toilet' ? 'Nhà vệ sinh' :
                 selectedMapItem.item_type === 'stair' ? 'Cầu thang bộ' :
                 selectedMapItem.item_type === 'elevator' ? 'Thang máy (Duy nhất)' :
                 selectedMapItem.item_type === 'lobby' ? 'Sảnh / Lối ra vào' :
                 selectedMapItem.item_type === 'technical_room' ? 'Kỹ thuật / Điện' :
                 selectedMapItem.item_type}
              </span>
              {currentFloor && (
                <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 500 }}>
                  Tầng {currentFloor.floor}
                </span>
              )}
            </div>
          </div>
          {/* Close */}
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedMapItem(null); setClickPos(null); }}
            style={{
              flexShrink: 0, width: '30px', height: '30px',
              background: '#F3F4F6', border: 'none',
              borderRadius: '50%', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px', color: '#6B7280',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#E5E7EB'}
            onMouseLeave={e => e.currentTarget.style.background = '#F3F4F6'}
          >×</button>
        </div>
        );
      })()}

      {/* ── BOTTOM-LEFT STATUS BAR ── */}
      <div className="map-status-bar" style={{
        position: 'absolute', bottom: '16px', left: '16px', zIndex: 900,
        display: 'flex', alignItems: 'center', gap: '10px',
        pointerEvents: 'none',
      }}>
        {/* Floor badge */}
        {currentFloor && (
          <div style={{
            padding: '6px 14px',
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRadius: '999px',
            fontSize: '12px', fontWeight: 700, color: '#F26D21',
            border: '1px solid rgba(242,109,33,0.2)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            fontFamily: 'var(--font-sans)',
            letterSpacing: '-0.2px',
            pointerEvents: 'auto',
          }}>
            {currentFloor.floor_name || `Tầng ${currentFloor.floor}`}
          </div>
        )}
        {/* Zoom level */}
        <div style={{
          padding: '6px 14px',
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: '999px',
          fontSize: '11px', fontWeight: 600, color: '#6B7280',
          border: '1px solid rgba(0,0,0,0.07)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          fontFamily: 'var(--font-sans)',
        }}>
          {Math.round(scale * 100)}%
        </div>
        {/* Help Tip */}
        <div style={{
          padding: '6px 14px',
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: '999px',
          fontSize: '11px', fontWeight: 600, color: '#4B5563',
          border: '1px solid rgba(0,0,0,0.07)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          fontFamily: 'var(--font-sans)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <span>💡</span>
          <span>{is3DMode ? 'Kéo chuột phải, giữ Shift hoặc chọn Chế độ Xoay để xoay 3D' : 'Chọn Chế độ Xoay hoặc giữ Shift để xoay bản đồ'}</span>
        </div>
      </div>

      {/* CSS keyframe for slide-up animation */}
      <style>{`
        @keyframes slideUpIn {
          from { opacity: 0; transform: translateX(-50%) translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        .map-item rect { cursor: inherit; }
        .map-item:hover text { fill: #111827 !important; }
      `}</style>

      {/* Report Panel */}
      <ReportPanel />

      {/* Report Mode Banner */}
      {reportStep === 'select_target' && (
        <div style={{
          position: 'absolute', top: '60px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 1200, padding: '10px 20px', borderRadius: '12px',
          background: 'rgba(220, 38, 38, 0.95)', color: 'white',
          fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)',
          boxShadow: '0 4px 16px rgba(220,38,38,0.3)',
          display: 'flex', alignItems: 'center', gap: '8px',
          backdropFilter: 'blur(8px)',
          animation: 'slideUpIn 0.3s ease',
        }}>
          <AlertTriangle size={16} />
          {pendingReport && ['elevator_broken','stairs_locked','room_locked'].includes(pendingReport.obstacle_type)
            ? 'Click vào đối tượng trên bản đồ'
            : 'Click vào vị trí vật cản trên bản đồ'}
        </div>
      )}
    </div>
  );
};

export default DraftImageMap;
