/**
 * ObstacleMarkers.jsx — SVG overlay hiển thị vật cản trên bản đồ
 *
 * 2 loại render:
 *  - Targeted (elevator/stair/room): badge overlay trên bbox của item
 *  - Area (wet_floor/construction/debris/other): circle đỏ nhấp nháy
 *
 * Click vào obstacle → popup upvote/downvote
 */
import React, { useState } from 'react';

const OBSTACLE_STYLES = {
  elevator_broken: { fill: 'rgba(124, 58, 237, 0.2)', stroke: '#7C3AED', icon: '🛗', label: 'HƯ HỎNG' },
  stairs_locked:   { fill: 'rgba(220, 38, 38, 0.2)',  stroke: '#DC2626', icon: '🚫', label: 'BỊ KHÓA' },
  room_locked:     { fill: 'rgba(245, 158, 11, 0.2)', stroke: '#F59E0B', icon: '🔒', label: 'ĐÓNG CỬA' },
  wet_floor:       { fill: 'rgba(37, 99, 235, 0.2)',  stroke: '#2563EB', icon: '💧', label: 'SÀN ƯỚT' },
  construction:    { fill: 'rgba(234, 88, 12, 0.2)',  stroke: '#EA580C', icon: '🔧', label: 'THI CÔNG' },
  debris:          { fill: 'rgba(120, 113, 108, 0.2)',stroke: '#78716C', icon: '📦', label: 'VẬT CẢN' },
  other:           { fill: 'rgba(107, 114, 128, 0.2)',stroke: '#6B7280', icon: '⚠️', label: 'CẢNH BÁO' },
};

const TARGETED_TYPES = new Set(['elevator_broken', 'stairs_locked', 'room_locked']);

const ObstacleMarkers = ({ obstacles = [], draftFloorData, currentFloor, onUpvote, onDownvote, mapRotation = 0 }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [isTesterMode, setIsTesterMode] = useState(false);

  if (obstacles.length === 0) return null;

  // Tìm bbox của item theo item_id trong floor data
  const findItemBbox = (targetItemId) => {
    if (!draftFloorData?.items || !targetItemId) return null;
    const item = draftFloorData.items.find(i => i.item_id === targetItemId);
    return item?.bbox || null;
  };

  return (
    <g className="obstacle-markers-layer">
      <defs>
        <style>{`
          @keyframes obstacle-pulse {
            0%   { opacity: 0.6; }
            50%  { opacity: 0.2; }
            100% { opacity: 0.6; }
          }
          .obstacle-pulse { animation: obstacle-pulse 2s ease-in-out infinite; }
        `}</style>
      </defs>

      {obstacles.map(obs => {
        const style = OBSTACLE_STYLES[obs.obstacle_type] || OBSTACLE_STYLES.other;
        const isTargeted = TARGETED_TYPES.has(obs.obstacle_type);
        const isSelected = selectedId === obs.id;

        if (isTargeted) {
          // ── Targeted: overlay trên bbox item ──
          const bbox = findItemBbox(obs.target_item_id);
          if (!bbox) return null;

          const cx = (bbox.min_x + bbox.max_x) / 2;
          const cy = (bbox.min_y + bbox.max_y) / 2;
          const w = bbox.max_x - bbox.min_x;
          const h = bbox.max_y - bbox.min_y;

          return (
            <g key={obs.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(isSelected ? null : obs.id)}>
              {/* Red border overlay */}
              <rect x={bbox.min_x} y={bbox.min_y} width={w} height={h}
                rx="5" ry="5" fill={style.fill} stroke={style.stroke}
                strokeWidth="3" strokeDasharray="8 4" className="obstacle-pulse"
              />
              {/* Badge */}
              <g transform={`translate(${cx}, ${cy}) rotate(${-mapRotation})`}>
                <rect x="-40" y="-14" width="80" height="28" rx="6"
                  fill={style.stroke} opacity="0.95" />
                <text x="0" y="5" textAnchor="middle" fontSize="12"
                  fill="white" fontWeight="bold" fontFamily="var(--font-sans)">
                  {style.icon} {style.label}
                </text>
              </g>

              {/* Vote popup */}
              {isSelected && (
                <foreignObject 
                  x={-120} y={-120} width="240" height="110"
                  transform={`translate(${cx}, ${cy}) rotate(${-mapRotation})`}
                >
                  <div xmlns="http://www.w3.org/1999/xhtml" style={{
                    background: 'rgba(0,0,0,0.9)', borderRadius: '14px', padding: '12px 16px',
                    display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button onClick={(e) => { e.stopPropagation(); onUpvote?.(obs.id, isTesterMode); }} style={{
                        padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                        background: '#16A34A', color: 'white', fontSize: '15px', fontWeight: 700,
                      }}>👍 Còn ({obs.upvotes})</button>
                      <button onClick={(e) => { e.stopPropagation(); onDownvote?.(obs.id, isTesterMode); }} style={{
                        padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                        background: '#DC2626', color: 'white', fontSize: '15px', fontWeight: 700,
                      }}>👎 Hết ({obs.downvotes})</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input 
                        type="checkbox" id={`tester-${obs.id}`}
                        checked={isTesterMode} onChange={e => setIsTesterMode(e.target.checked)}
                        style={{ accentColor: '#EA580C', cursor: 'pointer' }}
                      />
                      <label htmlFor={`tester-${obs.id}`} style={{ fontSize: '12px', color: '#D1D5DB', cursor: 'pointer', fontWeight: 600 }}>
                        Tester Mode (Bỏ chặn vote)
                      </label>
                    </div>
                  </div>
                </foreignObject>
              )}
            </g>
          );
        } else {
          // ── Area: circle đỏ nhấp nháy ──
          if (obs.x == null || obs.y == null) return null;
          const r = obs.radius || 60;

          return (
            <g key={obs.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(isSelected ? null : obs.id)}>
              {/* Outer pulse */}
              <rect x={obs.x - (r + 10)} y={obs.y - (r + 10)} width={(r + 10) * 2} height={(r + 10) * 2} rx="8" ry="8"
                fill="none" stroke={style.stroke} strokeWidth="2" opacity="0.3"
                className="obstacle-pulse" />
              {/* Main zone */}
              <rect x={obs.x - r} y={obs.y - r} width={r * 2} height={r * 2} rx="6" ry="6"
                fill={style.fill} stroke={style.stroke}
                strokeWidth="2.5" strokeDasharray="8 4" />
              {/* Strikethrough (Gạch chéo) */}
              <line x1={obs.x - r} y1={obs.y - r} x2={obs.x + r} y2={obs.y + r} stroke={style.stroke} strokeWidth="2" opacity="0.6" />
              <line x1={obs.x + r} y1={obs.y - r} x2={obs.x - r} y2={obs.y + r} stroke={style.stroke} strokeWidth="2" opacity="0.6" />
              
              {/* Center icon + label */}
              <g transform={`translate(${obs.x}, ${obs.y}) rotate(${-mapRotation})`}>
                <text x="0" y="-4" textAnchor="middle" fontSize="24"
                  style={{ pointerEvents: 'none' }}>{style.icon}</text>
                <text x="0" y="18" textAnchor="middle" fontSize="10"
                  fill={style.stroke} fontWeight="bold" fontFamily="var(--font-sans)"
                  style={{ pointerEvents: 'none' }}>{style.label}</text>
              </g>

              {/* Vote popup */}
              {isSelected && (
                <foreignObject 
                  x={-120} y={-r - 120} width="240" height="110"
                  transform={`translate(${obs.x}, ${obs.y}) rotate(${-mapRotation})`}
                >
                  <div xmlns="http://www.w3.org/1999/xhtml" style={{
                    background: 'rgba(0,0,0,0.9)', borderRadius: '14px', padding: '12px 16px',
                    display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button onClick={(e) => { e.stopPropagation(); onUpvote?.(obs.id, isTesterMode); }} style={{
                        padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                        background: '#16A34A', color: 'white', fontSize: '15px', fontWeight: 700,
                      }}>👍 Còn ({obs.upvotes})</button>
                      <button onClick={(e) => { e.stopPropagation(); onDownvote?.(obs.id, isTesterMode); }} style={{
                        padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                        background: '#DC2626', color: 'white', fontSize: '15px', fontWeight: 700,
                      }}>👎 Hết ({obs.downvotes})</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input 
                        type="checkbox" id={`tester-area-${obs.id}`}
                        checked={isTesterMode} onChange={e => setIsTesterMode(e.target.checked)}
                        style={{ accentColor: '#EA580C', cursor: 'pointer' }}
                      />
                      <label htmlFor={`tester-area-${obs.id}`} style={{ fontSize: '12px', color: '#D1D5DB', cursor: 'pointer', fontWeight: 600 }}>
                        Tester Mode (Bỏ chặn vote)
                      </label>
                    </div>
                  </div>
                </foreignObject>
              )}
            </g>
          );
        }
      })}
    </g>
  );
};

export default ObstacleMarkers;
