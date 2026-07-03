import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Sparkles, Trash2, Paperclip, ChevronRight, Menu, Plus, MessageSquare, X, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { sendChatMessage } from '../../services/api';
import useAppStore from '../../stores/useAppStore';

const SUGGESTED_PROMPTS = [
  { text: "Tìm phòng học DE-201", icon: "🗺️" },
  { text: "Thủ tục phúc khảo điểm", icon: "📋" },
  { text: "Lịch thi tiếng Anh kỳ này", icon: "📅" },
];



/* Design tokens */
const C = {
  primary:     '#F26D21',
  userBg:      'linear-gradient(135deg,#1E293B 0%,#334155 100%)',
  botBg:       'rgba(255,255,255,0.82)',
  text:        '#1E293B',
  muted:       '#64748B',
  subtle:      '#94A3B8',
};

const ChatPanel = ({ embedded = false }) => {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const { 
    chatMessages, 
    addChatMessage, 
    clearChatMessages, 
    setHighlightedRoomCode, 
    user,
    isDeltaDraftMode,
    draftDeltaData,
    mapItems,
    setCurrentFloorId,
    incrementRouteTrigger
  } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, isLoading]);

  useEffect(() => {
    const pendingQuery = sessionStorage.getItem('pending_ai_query');
    if (pendingQuery) {
      sessionStorage.removeItem('pending_ai_query');
      submitMessage(pendingQuery);
    }
  }, []);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  useEffect(() => {
    if (input === '' && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input]);

  const submitMessage = async (text) => {
    if (!text.trim() || isLoading) return;

    const userMessage = { role: 'user', content: text };
    addChatMessage(userMessage);
    setInput('');
    setIsLoading(true);

    try {
      const currentMessages = [...chatMessages, userMessage];
      const response = await sendChatMessage(currentMessages, user?.id || 'anonymous');
      
      const { answer, room_codes } = response.data;
      
      addChatMessage({ role: 'assistant', content: answer });
      
      if (room_codes && room_codes.length === 1) {
        setHighlightedRoomCode(room_codes[0]);
      } else if (room_codes && room_codes.length === 2) {
        // Resolve start and destination rooms
        let startItem = null;
        let endItem = null;
        const codeStart = room_codes[0].toUpperCase().trim();
        const codeEnd = room_codes[1].toUpperCase().trim();

        if (isDeltaDraftMode && draftDeltaData && draftDeltaData.floors) {
          const allItems = draftDeltaData.floors.flatMap(f => 
            (f.items || []).filter(item => item.is_clickable && item.item_type !== 'wall').map(item => ({
              ...item,
              floor_name: f.floor_name || `Tầng ${f.floor}`,
              floor_id: f.floor,
              name: item.display_name
            }))
          );
          startItem = allItems.find(item => item.room_code?.toUpperCase().trim() === codeStart);
          endItem = allItems.find(item => item.room_code?.toUpperCase().trim() === codeEnd);
        } else {
          startItem = mapItems.find(item => item.room_code?.toUpperCase().trim() === codeStart);
          endItem = mapItems.find(item => item.room_code?.toUpperCase().trim() === codeEnd);
        }

        if (startItem && endItem) {
          const buildRoutePoint = (item) => ({
            type: 'room',
            roomCode: item.room_code,
            label: `${item.room_code || item.name} - ${item.floor_name || `Tầng ${item.floor_id}`}`,
            itemId: item.item_id || item.id,
            bboxCenter: item.bbox ? {
              x: item.bbox.min_x + (item.bbox.max_x - item.bbox.min_x) / 2,
              y: item.bbox.min_y + (item.bbox.max_y - item.bbox.min_y) / 2,
              floor: item.floor_id
            } : {
              x: item.center_x,
              y: item.center_y,
              floor: item.floor_id
            }
          });

          const newStart = buildRoutePoint(startItem);
          const newEnd = buildRoutePoint(endItem);

          useAppStore.setState({
            routeStart: newStart,
            routeEnd: newEnd,
            routePath: [],
            routeMetadata: null,
            routeError: null,
            isCalculatingRoute: true,
            selectedMapItem: null,
            highlightedRoomCode: null
          });

          if (newStart.bboxCenter.floor != null) {
            setCurrentFloorId(newStart.bboxCenter.floor);
          }

          incrementRouteTrigger();
          
          // Switch page context to Map
          navigate('/map');
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      addChatMessage({ 
        role: 'assistant', 
        content: error.response?.status === 429 
          ? 'Máy chủ AI hiện đang bận do có quá nhiều truy cập. Vui lòng thử lại sau.'
          : 'Xin lỗi, đã xảy ra lỗi kết nối. Vui lòng thử lại sau.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submitMessage(input);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const SidebarContent = () => (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
      <motion.button
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
        onClick={() => clearChatMessages()}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '11px 16px',
          background: 'rgba(255,255,255,0.9)',
          border: '1px solid rgba(255,255,255,0.6)',
          borderRadius: '999px', cursor: 'pointer',
          fontWeight: 600, fontSize: '13.5px', color: C.text,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          width: '100%', fontFamily: 'inherit'
        }}
      >
        <Plus size={16} color={C.primary} />
        Cuộc trò chuyện mới
      </motion.button>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }} className="no-scrollbar">
        {chatMessages.length > 0 && (
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: C.subtle, marginBottom: '6px', paddingLeft: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Hiện tại
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <button
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px 12px',
                  background: 'rgba(242,109,33,0.08)',
                  border: '1px solid rgba(242,109,33,0.15)',
                  borderRadius: '12px', cursor: 'pointer',
                  color: C.primary,
                  fontWeight: 600,
                  textAlign: 'left', width: '100%', fontFamily: 'inherit', transition: 'all 0.15s',
                }}
              >
                <MessageSquare size={14} style={{ flexShrink: 0 }} />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '13.5px' }}>
                  {chatMessages[0].content.substring(0, 30)}{chatMessages[0].content.length > 30 ? '...' : ''}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 4px', opacity: 0.45 }}>
        <Zap size={13} color={C.primary} />
        <span style={{ fontSize: '11px', fontWeight: 700, color: C.muted, letterSpacing: '0.06em' }}>CÓC AI · FPTU</span>
      </div>
    </div>
  );

  return (
    <div style={{
      display: 'flex', height: '100%', width: '100%',
      background: 'linear-gradient(135deg, #EFF6FF 0%, #F8FAFC 40%, #ECFEFF 100%)',
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
      position: 'relative', overflow: 'hidden',
      borderLeft: embedded ? '1px solid rgba(0,0,0,0.05)' : 'none',
    }}>
      {/* Mesh gradient blobs */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: '50vw', height: '50vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,165,233,0.08) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '-15%', left: '-10%', width: '60vw', height: '60vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(242,109,33,0.06) 0%, transparent 65%)' }} />
        <div style={{ position: 'absolute', top: '30%', left: '20%', width: '30vw', height: '30vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.04) 0%, transparent 70%)' }} />
      </div>

      {/* Sidebar Desktop */}
      <AnimatePresence>
        {!isMobile && isSidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 264, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            style={{
              background: 'rgba(255,255,255,0.55)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRight: '1px solid rgba(255,255,255,0.45)',
              overflow: 'hidden', flexShrink: 0, zIndex: 1,
              boxShadow: '2px 0 24px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ width: 264, height: '100%' }}>
              <SidebarContent />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar Mobile Overlay */}
      <AnimatePresence>
        {isMobile && isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.25)', backdropFilter: 'blur(6px)', zIndex: 40 }}
            />
            <motion.div
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{
                position: 'absolute', top: 0, left: 0, bottom: 0,
                width: '80%', maxWidth: '300px',
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                zIndex: 50, boxShadow: '8px 0 40px rgba(0,0,0,0.12)',
                borderRight: '1px solid rgba(255,255,255,0.5)'
              }}
            >
              <SidebarContent />
              <button onClick={() => setIsSidebarOpen(false)}
                style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.04)', border: 'none', color: C.muted, cursor: 'pointer', borderRadius: '8px', padding: '6px', display: 'flex' }}>
                <X size={18} />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Chat Canvas */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{
          padding: '14px 20px',
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 10,
          boxShadow: '0 1px 24px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', padding: '6px', display: 'flex', borderRadius: '8px', transition: 'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <Menu size={20} />
            </button>
            <motion.div
              animate={{ y: [-2, 2, -2] }}
              transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
              style={{ width: 36, height: 36, borderRadius: '12px', background: 'linear-gradient(135deg, #F26D21 0%, #FB923C 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(242,109,33,0.35)' }}
            >
              <Sparkles size={18} />
            </motion.div>
            <div style={{ padding: '6px 16px', background: 'linear-gradient(135deg, #F26D21, #FB923C)', borderRadius: '999px', color: 'white', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', boxShadow: '0 4px 14px rgba(242,109,33,0.35)' }}>
              Cóc AI
            </div>
          </div>

          {chatMessages.length > 0 && (
            <button
              onClick={() => { if (window.confirm('Bạn có chắc chắn muốn xoá lịch sử trò chuyện?')) clearChatMessages(); }}
              title="Xoá lịch sử chat"
              style={{ background: 'transparent', border: 'none', color: C.subtle, cursor: 'pointer', padding: '8px', borderRadius: '10px', display: 'flex', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = C.subtle; e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <Trash2 size={17} />
            </button>
          )}
        </div>

        {/* Messages Area */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '28px 20px',
          display: 'flex', flexDirection: 'column', gap: '20px',
          scrollBehavior: 'smooth',
        }} className="no-scrollbar">
          {chatMessages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', paddingTop: '6vh' }}
            >
              <motion.div
                animate={{ y: [-5, 5, -5] }}
                transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
                style={{
                  width: 80, height: 80, borderRadius: '28px',
                  background: 'rgba(255,255,255,0.85)',
                  backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 16px 48px rgba(242,109,33,0.14), 0 4px 16px rgba(0,0,0,0.04)',
                  border: '1px solid rgba(255,255,255,0.7)',
                  marginBottom: '28px',
                }}
              >
                <Bot size={38} color={C.primary} />
              </motion.div>
              <h2 style={{ fontWeight: 700, margin: '0 0 10px 0', color: C.text, fontSize: '26px', letterSpacing: '-0.03em' }}>
                Xin chào! Mình là Cóc AI 🐸
              </h2>
              <p style={{ margin: 0, fontSize: '15px', maxWidth: '340px', lineHeight: 1.7, color: C.muted }}>
                Trợ lý học vụ thông minh dành riêng cho sinh viên FPTU.<br />
                Bạn muốn mình giúp gì hôm nay?
              </p>
            </motion.div>
          )}
          
          <AnimatePresence initial={false}>
            {chatMessages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 18, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 26 }}
                  style={{ display: 'flex', gap: '10px', flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-end' }}
                >
                  {!isUser && (
                    <div style={{ width: 30, height: 30, borderRadius: '10px', flexShrink: 0, background: 'linear-gradient(135deg,#F26D21,#FB923C)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(242,109,33,0.3)' }}>
                      <Bot size={15} />
                    </div>
                  )}
                  <div style={{
                    background: isUser ? C.userBg : C.botBg,
                    color: isUser ? 'white' : C.text,
                    padding: '13px 18px',
                    borderRadius: '20px',
                    borderBottomRightRadius: isUser ? '5px' : '20px',
                    borderBottomLeftRadius: !isUser ? '5px' : '20px',
                    maxWidth: '80%',
                    boxShadow: isUser ? '0 6px 24px rgba(15,23,42,0.18)' : '0 2px 16px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.8)',
                    backdropFilter: isUser ? 'none' : 'blur(12px)',
                    WebkitBackdropFilter: isUser ? 'none' : 'blur(12px)',
                    lineHeight: 1.65, fontSize: '14.5px',
                    border: isUser ? 'none' : '1px solid rgba(255,255,255,0.6)',
                    whiteSpace: 'pre-wrap', letterSpacing: '-0.005em',
                  }}>
                    {msg.content}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}
            >
              <div style={{ width: 30, height: 30, borderRadius: '10px', flexShrink: 0, background: 'linear-gradient(135deg,#F26D21,#FB923C)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(242,109,33,0.3)' }}>
                <Sparkles size={14} />
              </div>
              <div style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', padding: '16px 20px', borderRadius: '20px', borderBottomLeftRadius: '5px', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 2px 16px rgba(0,0,0,0.05)', display: 'flex', gap: '5px', alignItems: 'center' }}>
                {[0, 0.18, 0.36].map((delay, i) => (
                  <motion.div key={i}
                    animate={{ y: [0, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 0.9, ease: 'easeInOut', delay }}
                    style={{ width: 7, height: 7, borderRadius: '50%', background: C.primary }}
                  />
                ))}
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} style={{ height: '8px' }} />
        </div>

        {/* Input Area */}
        <div style={{
          padding: '0 16px 20px',
          background: 'linear-gradient(to top, rgba(239,246,255,0.95) 60%, transparent)',
          zIndex: 10, display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          <AnimatePresence>
            {chatMessages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', justifyContent: 'center' }}
                className="no-scrollbar"
              >
                {SUGGESTED_PROMPTS.map((p, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                    whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}
                    onClick={() => submitMessage(p.text)}
                    style={{
                      padding: '9px 16px',
                      background: 'rgba(255,255,255,0.88)',
                      backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255,255,255,0.7)',
                      borderRadius: '999px', fontSize: '13px', color: C.muted,
                      whiteSpace: 'nowrap', cursor: 'pointer',
                      boxShadow: '0 3px 12px rgba(0,0,0,0.06)',
                      display: 'flex', alignItems: 'center', gap: '7px',
                      fontFamily: 'inherit', fontWeight: 500,
                    }}
                  >
                    <span style={{ fontSize: '14px' }}>{p.icon}</span>
                    {p.text}
                    <ChevronRight size={12} color={C.subtle} />
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.form
            onSubmit={handleSubmit}
            animate={{
              boxShadow: isFocused ? '0 8px 40px rgba(14,165,233,0.15), 0 2px 12px rgba(0,0,0,0.06)' : '0 4px 20px rgba(0,0,0,0.06)',
              y: isFocused ? -2 : 0,
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            style={{
              maxWidth: '760px', width: '100%', margin: '0 auto',
              display: 'flex', gap: '10px',
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              padding: '10px 10px 10px 18px',
              borderRadius: '999px',
              border: isFocused ? '1.5px solid rgba(14,165,233,0.35)' : '1.5px solid rgba(255,255,255,0.7)',
              alignItems: 'flex-end',
            }}
          >
            <button type="button" title="Đính kèm (Chưa khả dụng)"
              style={{ background: 'transparent', border: 'none', color: C.subtle, padding: '7px', cursor: 'not-allowed', display: 'flex', alignItems: 'center', marginBottom: '2px', borderRadius: '8px' }}>
              <Paperclip size={19} />
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Hỏi Cóc AI về học vụ, phòng học..."
              disabled={isLoading}
              rows={1}
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '14.5px', color: C.text, fontWeight: 400, resize: 'none', padding: '8px 0', maxHeight: '120px', fontFamily: 'inherit', lineHeight: 1.55 }}
            />
            <motion.button
              type="submit"
              disabled={!input.trim() || isLoading}
              whileHover={{ scale: (!input.trim() || isLoading) ? 1 : 1.08 }}
              whileTap={{ scale: (!input.trim() || isLoading) ? 1 : 0.92 }}
              style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0, marginBottom: '2px',
                background: !input.trim() || isLoading ? 'rgba(0,0,0,0.06)' : 'linear-gradient(135deg, #F26D21, #FB923C)',
                color: !input.trim() || isLoading ? C.subtle : 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', cursor: !input.trim() || isLoading ? 'not-allowed' : 'pointer',
                boxShadow: !input.trim() || isLoading ? 'none' : '0 4px 16px rgba(242,109,33,0.38)',
                transition: 'all 0.2s',
              }}
            >
              <Send size={16} style={{ marginLeft: '2px' }} />
            </motion.button>
          </motion.form>
          <p style={{ textAlign: 'center', fontSize: '11px', color: C.subtle, margin: 0, opacity: 0.65 }}>
            Cóc AI có thể mắc lỗi. Kiểm tra thông tin quan trọng.
          </p>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        textarea::placeholder { color: #94A3B8; }
      `}} />
    </div>
  );
};

export default ChatPanel;
