import React, { useState } from 'react';
import useAppStore from '../../stores/useAppStore';
import { Beaker, Trash2, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const TestObstaclesPanel = () => {
  const { mockObstacles, setMockObstacles, selectedMapItem, currentFloorId, clickPoint } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState('room_locked');
  const [radius, setRadius] = useState(60);

  const isAreaType = ['wet_floor', 'construction', 'debris', 'other'].includes(type);

  const handleAddMock = () => {
    const newMock = {
      id: `mock-${Date.now()}`,
      building_code: 'DELTA',
      floor: currentFloorId,
      obstacle_type: type,
      status: 'active',
      source: 'mock',
    };

    if (isAreaType) {
      if (!selectedMapItem?.bbox) {
        if (clickPoint && clickPoint.floor === currentFloorId) {
          newMock.x = clickPoint.x;
          newMock.y = clickPoint.y;
        } else {
          newMock.x = 300;
          newMock.y = 300;
          alert('Chưa có điểm click trên tầng này. Sẽ tạo tại tọa độ (300, 300). Vui lòng click lên bản đồ trước.');
        }
        newMock.radius = radius;
      } else {
        newMock.x = selectedMapItem.bbox.min_x + (selectedMapItem.bbox.max_x - selectedMapItem.bbox.min_x) / 2;
        newMock.y = selectedMapItem.bbox.min_y + (selectedMapItem.bbox.max_y - selectedMapItem.bbox.min_y) / 2;
        newMock.radius = radius;
      }
    } else {
      newMock.target_item_id = selectedMapItem?.item_id || selectedMapItem?.id || 'unknown';
    }

    setMockObstacles([...mockObstacles, newMock]);
  };

  const handleRemoveMock = (id) => {
    setMockObstacles(mockObstacles.filter(o => o.id !== id));
  };

  return (
    <div style={{ position: 'absolute', top: '80px', right: '20px', zIndex: 3000 }}>
      {/* Floating Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '48px', height: '48px', borderRadius: '24px',
          background: isOpen ? '#1F2937' : '#8B5CF6',
          color: 'white', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)'
        }}
        title="Test Simulator Panel"
      >
        {isOpen ? <X size={24} /> : <Beaker size={24} />}
      </button>

      {/* Panel Content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            style={{
              position: 'absolute', top: '60px', right: 0,
              width: '320px', background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)', borderRadius: '16px',
              padding: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1F2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Beaker size={18} color="#8B5CF6" />
              Simulator (Client-side)
            </h3>

            {/* Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4B5563', marginBottom: '4px' }}>
                  Loại chướng ngại vật:
                </label>
                <select 
                  value={type} 
                  onChange={e => setType(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #D1D5DB' }}
                >
                  <optgroup label="Targeted">
                    <option value="room_locked">Khóa Phòng</option>
                    <option value="stairs_locked">Khóa Cầu thang</option>
                    <option value="elevator_broken">Hỏng Thang máy</option>
                  </optgroup>
                  <optgroup label="Area">
                    <option value="wet_floor">Sàn ướt</option>
                    <option value="construction">Đang thi công</option>
                    <option value="debris">Vật cản</option>
                  </optgroup>
                </select>
              </div>

              {isAreaType && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4B5563', marginBottom: '4px' }}>
                    Bán kính (Radius): {radius}
                  </label>
                  <input 
                    type="range" min="20" max="200" step="10" 
                    value={radius} onChange={e => setRadius(parseInt(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              <div style={{ fontSize: '12px', color: '#6B7280', background: '#F3F4F6', padding: '8px', borderRadius: '8px' }}>
                <strong>Target:</strong> {selectedMapItem ? (selectedMapItem.item_id || selectedMapItem.id || 'Selected item') : 'Chưa chọn (Click trên map)'}
              </div>

              <button 
                onClick={handleAddMock}
                disabled={!isAreaType && !selectedMapItem}
                style={{
                  padding: '10px', background: '#8B5CF6', color: 'white', borderRadius: '8px', border: 'none',
                  fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer',
                  opacity: (!isAreaType && !selectedMapItem) ? 0.5 : 1
                }}
              >
                <Plus size={16} /> Thêm Mock Obstacle
              </button>
            </div>

            {/* List */}
            <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Active Mocks ({mockObstacles.length})</span>
                {mockObstacles.length > 0 && (
                  <button onClick={() => setMockObstacles([])} style={{ fontSize: '11px', color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Xóa tất cả
                  </button>
                )}
              </div>
              <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {mockObstacles.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#9CA3AF', fontStyle: 'italic', textAlign: 'center', padding: '10px' }}>
                    Chưa có chướng ngại vật giả lập nào.
                  </div>
                ) : mockObstacles.map(obs => (
                  <div key={obs.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: '#F9FAFB', borderRadius: '6px', fontSize: '12px' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{obs.obstacle_type}</div>
                      <div style={{ color: '#6B7280', fontSize: '11px' }}>
                        {obs.target_item_id ? `ID: ${obs.target_item_id}` : `(X: ${Math.round(obs.x)}, Y: ${Math.round(obs.y)})`}
                      </div>
                    </div>
                    <button onClick={() => handleRemoveMock(obs.id)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer' }}>
                      <Trash2 size={14} />
                    </button>
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

export default TestObstaclesPanel;
