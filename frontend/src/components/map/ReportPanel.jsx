/**
 * ReportPanel.jsx — Form Báo Cáo Sự Cố (Crowdsourcing Report)
 *
 * 2 bước:
 *  1. select_type  → Chọn loại vật cản (targeted hoặc area)
 *  2. confirm      → Xác nhận thông tin + mô tả → Submit
 *
 * Bước chọn target/area trên map xảy ra ở DraftImageMap (handleSvgClick + item onClick)
 */
import React, { useState } from 'react';
import useAppStore from '../../stores/useAppStore';
import { submitReport } from '../../services/api';
import { AlertTriangle, X, Send, ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';

const TARGETED_TYPES = [
  { value: 'elevator_broken', label: 'Thang máy hỏng',      icon: '🛗', color: '#7C3AED' },
  { value: 'stairs_locked',   label: 'Cầu thang bị khóa',   icon: '🚫', color: '#DC2626' },
  { value: 'room_locked',     label: 'Phòng bị khóa / sửa', icon: '🔒', color: '#F59E0B' },
];

const AREA_TYPES = [
  { value: 'wet_floor',     label: 'Sàn ướt',             icon: '💧', color: '#2563EB' },
  { value: 'construction',  label: 'Đang thi công',       icon: '🔧', color: '#EA580C' },
  { value: 'debris',        label: 'Vật cản chắn lối',    icon: '📦', color: '#78716C' },
  { value: 'other',         label: 'Khác',                icon: '⚠️', color: '#6B7280' },
];

const panelWrapperStyle = {
  position: 'absolute',
  bottom: '80px',
  left: 0,
  right: 0,
  zIndex: 1300,
  pointerEvents: 'none',
  display: 'flex',
  justifyContent: 'center',
};

const panelStyle = {
  pointerEvents: 'auto',
  width: '360px',
  maxWidth: '90vw',
  background: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: '16px',
  border: '1px solid rgba(255, 255, 255, 0.6)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0,0,0,0.05)',
  padding: '20px',
  fontFamily: 'var(--font-sans)',
  animation: 'slideUpIn 0.25s ease',
};

const ReportPanel = () => {
  const {
    reportStep, pendingReport,
    setPendingReport, setReportStep, setReportMode, clearPendingReport,
    currentFloorId
  } = useAppStore();

  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Chỉ hiện ở bước select_type hoặc confirm
  if (!reportStep || reportStep === 'select_target') return null;

  const handleSelectType = (typeValue) => {
    setPendingReport({ obstacle_type: typeValue, floor: currentFloorId });
    setReportStep('select_target');
  };

  const handleSubmit = async () => {
    if (!pendingReport) return;
    setIsSubmitting(true);
    try {
      await submitReport({
        building_code: 'DELTA',
        floor: pendingReport.floor || currentFloorId,
        obstacle_type: pendingReport.obstacle_type,
        target_item_id: pendingReport.target_item_id || null,
        x: pendingReport.x || null,
        y: pendingReport.y || null,
        radius: pendingReport.radius || null,
        description: description.trim(),
      });
      setSubmitSuccess(true);
      setTimeout(() => {
        clearPendingReport();
        setDescription('');
        setSubmitSuccess(false);
      }, 1500);
    } catch (err) {
      console.error('Report failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const allTypes = [...TARGETED_TYPES, ...AREA_TYPES];
  const selectedTypeInfo = allTypes.find(t => t.value === pendingReport?.obstacle_type);

  // ── Bước 1: Chọn loại ──
  if (reportStep === 'select_type') {
    return (
      <div style={panelWrapperStyle}>
        <motion.div
          style={panelStyle}
          drag
          dragMomentum={false}
          whileDrag={{ cursor: 'grabbing' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', cursor: 'grab' }} className="drag-handle">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={20} color="#DC2626" />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Báo Cáo Sự Cố</h3>
            </div>
            <button onPointerDown={(e) => e.stopPropagation()} onClick={clearPendingReport} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
              <X size={18} color="#6B7280" />
            </button>
          </div>

          {/* Targeted */}
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#6B7280', letterSpacing: '0.5px', marginBottom: '8px', textTransform: 'uppercase' }}>
            Chọn đối tượng cụ thể
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }} onPointerDown={(e) => e.stopPropagation()}>
            {TARGETED_TYPES.map(t => (
              <button key={t.value} onClick={() => handleSelectType(t.value)} style={{
                padding: '12px 14px', borderRadius: '12px', cursor: 'pointer',
                border: '1px solid rgba(0,0,0,0.08)', background: 'rgba(255,255,255,0.7)',
                display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 500,
                transition: 'all 0.15s ease', textAlign: 'left',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = `${t.color}10`; e.currentTarget.style.borderColor = `${t.color}40`; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; }}
              >
                <span style={{ fontSize: '20px' }}>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Area */}
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#6B7280', letterSpacing: '0.5px', marginBottom: '8px', textTransform: 'uppercase' }}>
            Chọn vùng ảnh hưởng
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }} onPointerDown={(e) => e.stopPropagation()}>
            {AREA_TYPES.map(t => (
              <button key={t.value} onClick={() => handleSelectType(t.value)} style={{
                padding: '12px 14px', borderRadius: '12px', cursor: 'pointer',
                border: '1px solid rgba(0,0,0,0.08)', background: 'rgba(255,255,255,0.7)',
                display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 500,
                transition: 'all 0.15s ease', textAlign: 'left',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = `${t.color}10`; e.currentTarget.style.borderColor = `${t.color}40`; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; }}
              >
                <span style={{ fontSize: '20px' }}>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Bước 2: Xác nhận ──
  if (reportStep === 'confirm' && pendingReport) {
    return (
      <div style={panelWrapperStyle}>
        <motion.div
          style={panelStyle}
          drag
          dragMomentum={false}
          whileDrag={{ cursor: 'grabbing' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', cursor: 'grab' }} className="drag-handle">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setReportStep('select_type')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}>
                <ChevronLeft size={20} color="#6B7280" />
              </button>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Xác Nhận Báo Cáo</h3>
            </div>
            <button onPointerDown={(e) => e.stopPropagation()} onClick={clearPendingReport} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
              <X size={18} color="#6B7280" />
            </button>
          </div>

          {/* Info */}
          <div onPointerDown={(e) => e.stopPropagation()} style={{
            background: 'rgba(245, 158, 11, 0.08)', borderRadius: '10px', padding: '12px 14px',
            marginBottom: '14px', fontSize: '13px', color: '#92400E', display: 'flex', flexDirection: 'column', gap: '4px'
          }}>
            <div style={{ fontWeight: 600 }}>
              {selectedTypeInfo?.icon} {selectedTypeInfo?.label}
            </div>
            <div>
              📍 Tầng {pendingReport.floor}
              {pendingReport.target_item_id && ` — ${pendingReport.target_item_id}`}
              {pendingReport.x != null && ` — (${Math.round(pendingReport.x)}, ${Math.round(pendingReport.y)})`}
            </div>
          </div>

          {/* Mô tả */}
          <div style={{ marginBottom: '14px' }} onPointerDown={(e) => e.stopPropagation()}>
            <label style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Mô tả (tùy chọn):</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="VD: Thang máy tầng 1 đang bảo trì từ sáng..."
              maxLength={500} rows={2}
              style={{
                width: '100%', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)',
                padding: '10px 12px', fontSize: '13px', resize: 'none', fontFamily: 'var(--font-sans)',
                background: 'rgba(255,255,255,0.6)', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Submit */}
          <div onPointerDown={(e) => e.stopPropagation()}>
            {submitSuccess ? (
              <div style={{
                textAlign: 'center', padding: '12px', borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.1)', color: '#065F46', fontWeight: 600, fontSize: '14px'
              }}>
                ✅ Đã gửi báo cáo thành công!
              </div>
            ) : (
              <button onClick={handleSubmit} disabled={isSubmitting}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
                  background: 'linear-gradient(135deg, #DC2626, #F97316)', color: '#fff',
                  fontWeight: 700, fontSize: '14px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  transition: 'all 0.3s ease', opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                <Send size={16} />
                {isSubmitting ? 'Đang gửi...' : 'Gửi Báo Cáo'}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
};

export default ReportPanel;
