import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const useAppStore = create(
  persist(
    (set, get) => ({
      // User Auth State
      user: null,
      setUser: (user) => set({ user }),

      // Map State
      currentCampus: 'HN',
      setCurrentCampus: (campus) => set({ currentCampus: campus }),
      currentBuilding: 'DELTA',
      currentFloorId: null,
      mapError: null,
      setMapError: (errorMsg) => set({ mapError: errorMsg }),
      floors: [],
      setFloors: (floors) => set({ floors, currentFloorId: floors.length > 0 ? floors[0].id : null, mapError: null }),
      setCurrentFloorId: (id) => set({ currentFloorId: id }),

      // Draft Delta Mode State
      isDeltaDraftMode: false,
      setDeltaDraftMode: (isDraft) => set({ isDeltaDraftMode: isDraft }),
      draftDeltaData: null,
      setDraftDeltaData: (data) => set({ draftDeltaData: data }),

      graphData: null,
      setGraphData: (data) => set({ graphData: data }),

      navGridData: null,
      setNavGridData: (data) => set({ navGridData: data }),

      mapItems: [],
      setMapItems: (items) => set({ mapItems: items }),

      selectedRoom: null,
      setSelectedRoom: (room) => set({ selectedRoom: room }),

      selectedMapItem: null,
      setSelectedMapItem: (item) => set({ selectedMapItem: item }),

      highlightedRoomCode: null,
      setHighlightedRoomCode: (code) => set({ highlightedRoomCode: code }),

      routeStart: null,
      routeEnd: null,
      routePath: [],
      isCalculatingRoute: false,
      routeMetadata: null,
      routeError: null,
      routingSelectionMode: null, // 'start' or 'end' or null
      routeTriggerKey: 0, // incremented to force re-trigger worker with same points
      
      setRoutingSelectionMode: (mode) => set({ routingSelectionMode: mode }),
      
      preferElevator: false,
      setPreferElevator: (val) => set({ preferElevator: val }),

      avoidObstacles: true,
      setAvoidObstacles: (val) => set({ avoidObstacles: val }),

      mockObstacles: [],
      setMockObstacles: (obstacles) => set({ mockObstacles: obstacles }),

      incrementRouteTrigger: () => set(state => ({ routeTriggerKey: state.routeTriggerKey + 1 })),
      
      setRoutePoints: (start, end) => set({ routeStart: start, routeEnd: end }),
      setRouteStart: (start) => set({ routeStart: start }),
      setRouteEnd: (end) => set({ routeEnd: end }),
      
      setRoutePath: (path) => set({ routePath: path, isCalculatingRoute: false }),
      setIsCalculatingRoute: (status) => set({ isCalculatingRoute: status }),
      setRouteMetadata: (meta) => set({ routeMetadata: meta }),
      setRouteError: (error) => set({ routeError: error }),
      clickPoint: null,
      setClickPoint: (point) => set({ clickPoint: point }),
      clearRoute: () => set({ routeStart: null, routeEnd: null, routePath: [], routeMetadata: null, routeError: null, isCalculatingRoute: false, routingSelectionMode: null }),

      handleMapClick: (x, y, floor) => set((state) => {
        const point = {
          type: 'click',
          roomCode: null,
          bboxCenter: { x, y, floor },
          label: `Điểm chọn (Tầng ${floor})`
        };

        const updates = { clickPoint: { x, y, floor } };

        if (state.routingSelectionMode === 'start') {
          updates.routeStart = point;
          updates.routingSelectionMode = null;
        } else if (state.routingSelectionMode === 'end') {
          updates.routeEnd = point;
          updates.routingSelectionMode = null;
        }

        return updates;
      }),


      // Chat State
      chatMessages: [],
      addChatMessage: (msg) => set((state) => ({ chatMessages: [...state.chatMessages, msg] })),
      setChatMessages: (msgs) => set({ chatMessages: msgs }),
      clearChatMessages: () => set({ chatMessages: [] }),
      isChatOpen: false,
      toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),

      // ── Crowdsourcing Report ──
      activeObstacles: [],
      setActiveObstacles: (list) => set({ activeObstacles: list }),

      isReportMode: false,
      setReportMode: (val) => set({ isReportMode: val }),

      reportStep: null,  // 'select_type' | 'select_target' | 'confirm'
      setReportStep: (step) => set({ reportStep: step }),

      pendingReport: null,  // { obstacle_type, target_item_id?, x?, y?, radius?, floor }
      setPendingReport: (data) => set({ pendingReport: data }),
      clearPendingReport: () => set({ pendingReport: null, reportStep: null, isReportMode: false }),
    }),
    {
      name: 'fptu-student-guide-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ chatMessages: state.chatMessages, currentCampus: state.currentCampus }), // Persist chat and campus
    }
  )
);

export default useAppStore;
