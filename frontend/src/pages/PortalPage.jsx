import React, { useState, useMemo, useEffect } from 'react';
import { Monitor, ChevronDown, ChevronUp, Info, Search } from 'lucide-react';
import Highlighter from 'react-highlight-words';
import websiteGuidesData from '../../../data/content/website_guides.todo.json';

const ALL_SYSTEMS = ['FAP', 'FLM', 'CMS', 'Edunext', 'Hướng dẫn thi cử'];

const PortalPage = () => {
  const [activeWebsite, setActiveWebsite] = useState('FAP');
  const [activeGroup, setActiveGroup] = useState('');
  const [expandedItemTitle, setExpandedItemTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [showStickySearch, setShowStickySearch] = useState(false);
  const rootRef = React.useRef(null);
  const contentRef = React.useRef(null);
  const lastScrollY = React.useRef(0);

  const availableWebsites = useMemo(() => {
    return Array.from(new Set(websiteGuidesData.map(g => g.website))).filter(Boolean);
  }, []);

  useEffect(() => {
    if (!activeWebsite && availableWebsites.length > 0) {
      setActiveWebsite(availableWebsites[0]);
    }
  }, [availableWebsites, activeWebsite]);

  const groupsForWebsite = useMemo(() => {
    if (!activeWebsite) return [];
    return Array.from(new Set(websiteGuidesData.filter(g => g.website === activeWebsite).map(g => g.group))).filter(Boolean);
  }, [activeWebsite]);

  useEffect(() => {
    if (groupsForWebsite.length > 0 && !groupsForWebsite.includes(activeGroup)) {
      setActiveGroup(groupsForWebsite[0]);
    }
  }, [groupsForWebsite, activeGroup]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    
    const query = searchQuery.toLowerCase().trim();
    return websiteGuidesData.filter(item => {
      const titleMatch = item.title?.toLowerCase().includes(query);
      const contentMatch = item.instructions?.toLowerCase().includes(query);
      return titleMatch || contentMatch;
    });
  }, [searchQuery]);

  useEffect(() => {
    const handleScroll = (e) => {
      const currentScrollY = e.target.scrollTop;
      
      if (currentScrollY > 180) {
        if (currentScrollY < lastScrollY.current - 5) {
          setShowStickySearch(true);
        } else if (currentScrollY > lastScrollY.current + 5) {
          setShowStickySearch(false);
        }
      } else {
        setShowStickySearch(false);
      }
      lastScrollY.current = currentScrollY;
    };

    const rootEl = rootRef.current;
    const contentEl = contentRef.current;

    if (rootEl) rootEl.addEventListener('scroll', handleScroll, { passive: true });
    if (contentEl) contentEl.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (rootEl) rootEl.removeEventListener('scroll', handleScroll);
      if (contentEl) contentEl.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const currentItems = useMemo(() => {
    if (searchResults) return searchResults;
    return websiteGuidesData.filter(g => g.website === activeWebsite && g.group === activeGroup);
  }, [activeWebsite, activeGroup, searchResults]);

  const toggleItem = (title) => {
    setExpandedItemTitle(prev => prev === title ? '' : title);
  };

  const renderGuideItem = (item, idx) => {
    let isExpanded = expandedItemTitle === item.title;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const isMatchInBody = item.instructions?.toLowerCase().includes(query);
      
      if (isMatchInBody) {
        isExpanded = true;
      }
    }

    const searchWords = searchQuery.trim() ? [searchQuery.trim()] : [];

    return (
      <div key={`${item.website}-${item.group}-${idx}`} className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <button 
          onClick={() => toggleItem(item.title)}
          style={{
            width: '100%',
            padding: 'var(--space-4)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: isExpanded ? 'var(--color-muted)' : 'var(--color-surface)',
            textAlign: 'left',
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
        >
          <div style={{ flex: 1, paddingRight: 'var(--space-4)' }}>
            {searchResults && (
              <div style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase' }}>
                {item.website} • {item.group}
              </div>
            )}
            <h4 className="text-base" style={{ margin: 0, fontWeight: 600, color: 'var(--color-foreground)' }}>
              <Highlighter
                highlightStyle={{ backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary-hover)', fontWeight: 700, padding: '0 2px', borderRadius: '4px' }}
                searchWords={searchWords}
                autoEscape={true}
                textToHighlight={item.title || ""}
              />
            </h4>
          </div>
          <div style={{ flexShrink: 0 }}>
            {isExpanded ? <ChevronUp size={20} className="text-muted" /> : <ChevronDown size={20} className="text-muted" />}
          </div>
        </button>
        
        {isExpanded && (
          <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--color-border)', fontSize: 'var(--text-sm)', lineHeight: 1.6 }}>
            <div style={{ whiteSpace: 'pre-wrap', marginBottom: item.images && item.images.length > 0 ? 'var(--space-4)' : 0 }}>
              {(() => {
                if (!item.instructions) return null;
                const parts = item.instructions.split(/!\[.*?\]\((.*?)\)/);
                return parts.map((part, index) => {
                  if (index % 2 === 1) {
                    return (
                      <div key={index} style={{ margin: 'var(--space-4) 0' }}>
                        <img 
                          src={part} 
                          alt="inline hướng dẫn"
                          style={{ maxWidth: '100%', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-soft)' }}
                        />
                      </div>
                    );
                  }
                  return part ? (
                    <Highlighter
                      key={index}
                      highlightStyle={{ backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary-hover)', fontWeight: 700, padding: '0 2px', borderRadius: '4px' }}
                      searchWords={searchWords}
                      autoEscape={true}
                      textToHighlight={part}
                    />
                  ) : null;
                });
              })()}
            </div>
            
            {item.images && item.images.length > 0 && !item.instructions?.includes('![') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                {item.images.map((imgPath, i) => (
                  <img 
                    key={i} 
                    src={imgPath} 
                    alt={`${item.title} hướng dẫn ${i+1}`}
                    style={{ maxWidth: '100%', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-soft)' }}
                  />
                ))}
              </div>
            )}
            
            {item.review_status !== 'verified' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-4)', padding: 'var(--space-2) var(--space-3)', backgroundColor: 'var(--color-muted)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', color: 'var(--color-muted-foreground)' }}>
                <Info size={14} />
                <span>Nội dung này đang ở trạng thái bản nháp (draft), chưa được kiểm duyệt chính thức.</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="portal-page-root" ref={rootRef}>

      {/* Sticky Search Bar */}
      <div className={`sticky-search-container ${showStickySearch ? 'visible' : ''}`}>
        <div style={{ maxWidth: '600px', width: '100%', margin: '0 auto', position: 'relative' }}>
          <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted-foreground)' }}>
            <Search size={18} />
          </div>
          <input 
            type="text" 
            placeholder="Tìm kiếm hướng dẫn (vd: điểm danh, chuyển lớp)..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ 
              paddingLeft: '44px', 
              borderRadius: 'var(--radius-pill)', 
              boxShadow: 'var(--shadow-sm)',
              fontSize: '15px',
              paddingTop: '12px',
              paddingBottom: '12px',
              backgroundColor: 'var(--color-background)'
            }} 
          />
        </div>
      </div>

      {/* Hero Section - Always visible at top */}
      <div style={{ flexShrink: 0, background: 'linear-gradient(135deg, var(--color-primary-soft) 0%, var(--color-background) 100%)', padding: 'var(--space-8) var(--space-4)', textAlign: 'center', borderBottom: '1px solid var(--color-border)' }}>
        <h2 className="text-2xl text-primary" style={{ margin: '0 0 var(--space-2) 0' }}>Hướng dẫn sử dụng website nhà trường</h2>
        <p className="text-sm text-muted" style={{ margin: '0 0 var(--space-6) 0' }}>Cẩm nang giải đáp cách sử dụng các hệ thống FAP, FLM, CMS, Edunext</p>
        
        {/* Search Bar */}
        <div style={{ maxWidth: '600px', margin: '0 auto', position: 'relative' }}>
          <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted-foreground)' }}>
            <Search size={20} />
          </div>
          <input 
            type="text" 
            placeholder="Tìm kiếm hướng dẫn (vd: điểm danh, chuyển lớp)..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ 
              paddingLeft: '48px', 
              borderRadius: 'var(--radius-pill)', 
              boxShadow: 'var(--shadow-soft)',
              fontSize: '16px',
              paddingTop: '16px',
              paddingBottom: '16px',
              backgroundColor: 'var(--color-surface)'
            }} 
          />
        </div>
      </div>

      <div className="portal-container">
        
        {!searchQuery ? (
          <>
            {/* Step 1: Select Website */}
            <div style={{ flexShrink: 0, marginBottom: 'var(--space-6)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-2)', overflowX: 'auto', paddingBottom: 'var(--space-2)', scrollbarWidth: 'none' }}>
                {ALL_SYSTEMS.map(site => {
                  const isAvailable = availableWebsites.includes(site);
                  const isActive = activeWebsite === site;
                  return (
                    <button
                      key={site}
                      onClick={() => isAvailable && setActiveWebsite(site)}
                      disabled={!isAvailable}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        padding: 'var(--space-2) var(--space-4)',
                        backgroundColor: isActive ? 'var(--color-primary)' : 'var(--color-surface)',
                        border: isActive ? 'none' : '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-pill)',
                        color: isActive ? 'var(--color-primary-foreground)' : (isAvailable ? 'var(--color-foreground)' : 'var(--color-muted-foreground)'),
                        fontWeight: isActive ? 600 : 500,
                        whiteSpace: 'nowrap',
                        transition: 'all 0.2s',
                        boxShadow: isActive ? 'var(--shadow-soft)' : 'none',
                        opacity: isAvailable ? 1 : 0.6,
                        cursor: isAvailable ? 'pointer' : 'not-allowed'
                      }}
                    >
                      <Monitor size={18} />
                      <span>{site}</span>
                      {!isAvailable && (
                        <span style={{ 
                          fontSize: '10px', 
                          padding: '2px 6px', 
                          backgroundColor: 'var(--color-background)', 
                          borderRadius: 'var(--radius-pill)', 
                          marginLeft: '4px',
                          color: 'var(--color-muted-foreground)',
                          border: '1px solid var(--color-border)',
                          fontWeight: 500
                        }}>
                          Sắp ra mắt
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Layout Desktop vs Mobile */}
            <div className="portal-layout">
              {/* Sidebar: Group selection */}
              <div className="portal-sidebar">
                <h3 className="text-sm text-muted" style={{ marginBottom: 'var(--space-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Danh mục</h3>
                <div className="portal-sidebar-scroll">
                  {groupsForWebsite.map(group => {
                    const isActive = activeGroup === group;
                    return (
                      <button
                        key={group}
                        onClick={() => setActiveGroup(group)}
                        style={{
                          padding: 'var(--space-3) var(--space-4)',
                          backgroundColor: isActive ? 'var(--color-primary-soft)' : 'transparent',
                          borderLeft: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                          color: isActive ? 'var(--color-primary-hover)' : 'var(--color-foreground)',
                          fontSize: 'var(--text-sm)',
                          fontWeight: isActive ? 600 : 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          textAlign: 'left',
                          borderRadius: '0 var(--radius-md) var(--radius-md) 0'
                        }}
                      >
                        {group}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Guide Items */}
              <div className="portal-content" ref={contentRef}>
                {currentItems.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {currentItems.map(renderGuideItem)}
                  </div>
                ) : (
                  <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-muted-foreground)' }}>
                    <Info size={32} style={{ margin: '0 auto var(--space-2) auto', opacity: 0.5 }} />
                    <p>Chưa có dữ liệu hướng dẫn chi tiết cho phần này.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Search Results View */
          <div className="portal-content" ref={contentRef} style={{ paddingRight: '8px' }}>
            <div style={{ marginBottom: 'var(--space-4)', color: 'var(--color-muted-foreground)', fontWeight: 500 }}>
              Tìm thấy {searchResults.length} kết quả cho "{searchQuery}"
            </div>
            
            {searchResults.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {searchResults.map(renderGuideItem)}
              </div>
            ) : (
              <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-muted-foreground)' }}>
                <Search size={32} style={{ margin: '0 auto var(--space-2) auto', opacity: 0.5 }} />
                <p>Không tìm thấy kết quả nào phù hợp.</p>
                <p className="text-sm">Hãy thử với một từ khóa khác nhé.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .portal-page-root {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          position: relative;
        }

        .sticky-search-container {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          padding: var(--space-3) var(--space-4);
          background-color: var(--color-surface);
          border-bottom: 1px solid var(--color-border);
          box-shadow: var(--shadow-md);
          z-index: 40;
          transform: translateY(-100%);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
          opacity: 0;
          pointer-events: none;
        }
        .sticky-search-container.visible {
          transform: translateY(0);
          opacity: 1;
          pointer-events: auto;
        }
        
        .portal-container {
          padding: var(--space-6) var(--space-4);
          max-width: 1000px;
          margin: 0 auto;
          width: 100%;
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden; /* Contains the scrollable panes */
        }

        .portal-layout {
          display: flex;
          flex-direction: row;
          gap: var(--space-6);
          flex: 1;
          overflow: hidden; /* Critical for 2-pane fixed layout */
        }

        .portal-sidebar {
          width: 250px;
          min-width: 250px;
          max-width: 250px;
          flex-shrink: 0;
          height: 100%;
          overflow-y: auto;
          padding-right: 8px; /* Room for scrollbar */
        }
        
        /* Custom scrollbar for desktop sidebar */
        .portal-sidebar::-webkit-scrollbar { width: 4px; }
        .portal-sidebar::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 4px; }

        .portal-sidebar-scroll {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding-bottom: var(--space-4); /* Bottom padding */
        }

        .portal-content {
          flex: 1;
          min-width: 0;
          height: 100%;
          overflow-y: auto;
          padding-right: 8px;
          padding-bottom: var(--space-4); /* Bottom padding */
        }
        
        /* Custom scrollbar for desktop content */
        .portal-content::-webkit-scrollbar { width: 6px; }
        .portal-content::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 4px; }

        /* Mobile specific overrides */
        @media (max-width: 768px) {
          .portal-page-root {
            overflow-y: auto; /* Let the whole page scroll on mobile */
          }
          .portal-container {
            overflow: visible; /* Remove height constraints */
          }
          .portal-layout {
            flex-direction: column;
            gap: var(--space-4);
            overflow: visible;
          }
          .portal-sidebar {
            width: 100%;
            height: auto;
            max-width: none;
            min-width: 0;
            overflow-x: auto;
            overflow-y: hidden;
            padding-right: 0;
          }
          .portal-sidebar-scroll {
            flex-direction: row;
            padding-bottom: var(--space-2);
            gap: var(--space-2);
          }
          .portal-sidebar-scroll button {
            border-left: none !important;
            border-bottom: 2px solid transparent;
            border-radius: var(--radius-pill) !important;
            white-space: nowrap;
            background-color: var(--color-surface) !important;
            border: 1px solid var(--color-border);
            padding: var(--space-2) var(--space-4) !important;
          }
          .portal-sidebar-scroll button[style*="var(--color-primary-soft)"] {
            background-color: var(--color-primary-soft) !important;
            border-color: var(--color-primary-soft) !important;
            color: var(--color-primary-hover) !important;
          }
          .portal-sidebar::-webkit-scrollbar { display: none; }
          
          .portal-content {
            height: auto;
            overflow: visible;
            padding-right: 0;
          }

          .sticky-search-container {
            position: fixed;
            top: 52px; /* --header-height-mobile */
          }
        }
      `}} />
    </div>
  );
};

export default PortalPage;
