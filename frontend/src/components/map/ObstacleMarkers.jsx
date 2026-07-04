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

const ObstacleMarkers = ({ obstacles = [], draftFloorData, currentFloor, onUpvote, onDownvote }) => {
  const [selectedId, setSelectedId] = useState(null);

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
              <g transform={`translate(${cx}, ${cy})`}>
                <rect x="-40" y="-14" width="80" height="28" rx="6"
                  fill={style.stroke} opacity="0.95" />
                <text x="0" y="5" textAnchor="middle" fontSize="12"
                  fill="white" fontWeight="bold" fontFamily="var(--font-sans)">
                  {style.icon} {style.label}
                </text>
              </g>

              {/* Vote popup */}
              {isSelected && (
                <foreignObject x={cx - 90} y={bbox.min_y - 80} width="180" height="70">
                  <div xmlns="http://www.w3.org/1999/xhtml" style={{
                    background: 'rgba(0,0,0,0.9)', borderRadius: '12px', padding: '10px 14px',
                    display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <button onClick={(e) => { e.stopPropagation(); onUpvote?.(obs.id); }} style={{
                      padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                      background: '#16A34A', color: 'white', fontSize: '12px', fontWeight: 700,
                    }}>👍 Còn ({obs.upvotes})</button>
                    <button onClick={(e) => { e.stopPropagation(); onDownvote?.(obs.id); }} style={{
                      padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                      background: '#DC2626', color: 'white', fontSize: '12px', fontWeight: 700,
                    }}>👎 Hết ({obs.downvotes})</button>
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
              <circle cx={obs.x} cy={obs.y} r={r + 10}
                fill="none" stroke={style.stroke} strokeWidth="2" opacity="0.3"
                className="obstacle-pulse" />
              {/* Main zone */}
              <circle cx={obs.x} cy={obs.y} r={r}
                fill={style.fill} stroke={style.stroke}
                strokeWidth="2.5" strokeDasharray="8 4" />
              {/* Center icon + label */}
              <text x={obs.x} y={obs.y - 4} textAnchor="middle" fontSize="24"
                style={{ pointerEvents: 'none' }}>{style.icon}</text>
              <text x={obs.x} y={obs.y + 18} textAnchor="middle" fontSize="10"
                fill={style.stroke} fontWeight="bold" fontFamily="var(--font-sans)"
                style={{ pointerEvents: 'none' }}>{style.label}</text>

              {/* Vote popup */}
              {isSelected && (
                <foreignObject x={obs.x - 90} y={obs.y - r - 75} width="180" height="70">
                  <div xmlns="http://www.w3.org/1999/xhtml" style={{
                    background: 'rgba(0,0,0,0.9)', borderRadius: '12px', padding: '10px 14px',
                    display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <button onClick={(e) => { e.stopPropagation(); onUpvote?.(obs.id); }} style={{
                      padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                      background: '#16A34A', color: 'white', fontSize: '12px', fontWeight: 700,
                    }}>👍 Còn ({obs.upvotes})</button>
                    <button onClick={(e) => { e.stopPropagation(); onDownvote?.(obs.id); }} style={{
                      padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                      background: '#DC2626', color: 'white', fontSize: '12px', fontWeight: 700,
                    }}>👎 Hết ({obs.downvotes})</button>
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
