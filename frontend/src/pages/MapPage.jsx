import React, { useEffect, useRef } from 'react';
import MapContainer from '../components/map/MapContainer';
import FloorSelector from '../components/map/FloorSelector';
import SearchBar from '../components/map/SearchBar';
import PathfindingPanel from '../components/map/PathfindingPanel';
import useAppStore from '../stores/useAppStore';
import DraftImageMap from '../components/map/DraftImageMap';
import TestObstaclesPanel from '../components/map/TestObstaclesPanel';
import { getActiveObstacles } from '../services/api';

const MapPage = () => {
  const {
    currentBuilding, setFloors, setGraphData, graphData,
    routeStart, routeEnd, setRoutePath,
    currentFloorId, setCurrentFloorId,
    setMapItems, setMapError,
    isDeltaDraftMode, setDeltaDraftMode, setDraftDeltaData,
    navGridData, setNavGridData,
    setRouteMetadata, setRouteError,
    routeTriggerKey, setIsCalculatingRoute, preferElevator,
    activeObstacles, setActiveObstacles, avoidObstacles
  } = useAppStore();
  const workerRef = useRef(null);

  // ── Worker setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/pathfinder.worker.v2.js', import.meta.url));
    workerRef.current.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'ROUTE_RESULT') {
        setRoutePath(payload.path);
        setRouteMetadata({
          distance: payload.distance,
          floors_traversed: payload.floors_traversed,
          estimated_time_seconds: payload.estimated_time_seconds,
          instructions: payload.instructions
        });
        setRouteError(null);
        const state = useAppStore.getState();
        if (state.routeStart?.bboxCenter?.floor != null) {
          state.setCurrentFloorId(state.routeStart.bboxCenter.floor);
        }
      } else if (type === 'ROUTE_ERROR') {
        console.error('Pathfinder Error:', payload);
        setRoutePath([]);
        setRouteMetadata(null);
        setRouteError(payload);
      }
    };
    return () => { workerRef.current.terminate(); };
  }, [setRoutePath, setRouteMetadata, setRouteError]);

  // ── Fire worker when user presses "Tìm đường" ─────────────────────────────
  useEffect(() => {
    if (routeTriggerKey === 0) return;
    const { routeStart: rs, routeEnd: re, activeObstacles: obs, mockObstacles: mocks, avoidObstacles } = useAppStore.getState();
    if (rs && re && navGridData && workerRef.current) {
      setIsCalculatingRoute(true);
      const combinedObs = [...(obs || []), ...(mocks || [])];
      const obstacles = combinedObs.filter(o => o.status === 'active').map(o => {
        if (o.target_item_id) return { type: 'targeted', obstacle_type: o.obstacle_type, target_item_id: o.target_item_id, floor: o.floor };
        return { type: 'area', floor: o.floor, x: o.x, y: o.y, radius: o.radius || 60 };
      });
      workerRef.current.postMessage({
        type: 'CALCULATE_ROUTE',
        payload: {
          gridData: navGridData,
          startRoomCode: rs.roomCode,
          startItemId: rs.itemId,
          startBboxCenter: rs.bboxCenter,
          endRoomCode: re.roomCode,
          endItemId: re.itemId,
          endBboxCenter: re.bboxCenter,
          preferElevator,
          avoidObstacles,
          obstacles
        }
      });
    } else if (rs && re && graphData && workerRef.current) {
      setIsCalculatingRoute(true);
      workerRef.current.postMessage({
        type: 'CALCULATE_ROUTE_LEGACY',
        payload: { graphData, startNodeId: rs, endNodeId: re }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeTriggerKey]);

  // ── Clear route when points removed ────────────────────────────────────────
  useEffect(() => {
    if (!routeStart || !routeEnd) {
      setRoutePath([]);
      setRouteMetadata(null);
      setRouteError(null);
    }
  }, [routeStart, routeEnd, navGridData, graphData, setRoutePath, setRouteMetadata, setRouteError, routeTriggerKey, preferElevator, avoidObstacles]);

  // ── Fetch building / map data ─────────────────────────────────────────────
  useEffect(() => {
    const fetchBuildingData = async () => {
      if (currentBuilding && currentBuilding.toUpperCase() === 'DELTA') {
        setDeltaDraftMode(true);
        try {
          const res = await fetch('/data/delta_draft.json');
          const routeRes = await fetch('/data/delta_nav_grid.json');
          if (res.ok) {
            const draftData = await res.json();
            setDraftDeltaData(draftData);
            if (routeRes.ok) {
              const gridData = await routeRes.json();
              setNavGridData(gridData);
            }
            const mappedFloors = draftData.floors.map(f => ({
              id: f.floor,
              name: `Tầng ${f.floor}`,
              floor_number: f.floor
            }));
            setFloors(mappedFloors);
            setMapError(null);
            return;
          }
        } catch (e) {
          console.error('Failed to fetch draft delta data', e);
        }
      } else {
        setDeltaDraftMode(false);
      }

      try {
        const { getCampuses, getFloors, getFullGraph } = await import('../services/api');
        const campusesRes = await getCampuses();
        const campuses = campusesRes.data;
        let targetBuildingId = null;
        for (const campus of campuses) {
          const targetBuilding = campus.buildings?.find(b => b.code === currentBuilding || b.name.includes(currentBuilding));
          if (targetBuilding) { targetBuildingId = targetBuilding.id; break; }
        }
        if (!targetBuildingId) return;
        const floorsRes = await getFloors(targetBuildingId);
        setFloors(floorsRes.data);
        const graphRes = await getFullGraph(targetBuildingId);
        setGraphData(graphRes.data);
      } catch (error) {
        console.error('Error fetching map data:', error);
      }
    };
    fetchBuildingData();
  }, [currentBuilding, setFloors, setGraphData, setMapError, setDeltaDraftMode, setDraftDeltaData]);

  useEffect(() => {
    const fetchItems = async () => {
      if (currentFloorId && !isDeltaDraftMode) {
        try {
          const { getMapItems } = await import('../services/api');
          const res = await getMapItems(currentFloorId);
          setMapItems(res.data);
        } catch (err) {
          console.error('Error fetching map items:', err);
        }
      }
    };
    fetchItems();
  }, [currentFloorId, setMapItems, isDeltaDraftMode]);

  // ── Fetch active obstacles + poll every 30s ──────────────────────────────
  useEffect(() => {
    if (!isDeltaDraftMode) return;
    const fetchObstacles = async () => {
      try {
        const res = await getActiveObstacles(currentBuilding || 'DELTA');
        if (res.data?.obstacles) {
          setActiveObstacles(res.data.obstacles);
          if (workerRef.current && navGridData) {
            const workerObstacles = res.data.obstacles.map(o => {
              if (o.target_item_id) {
                return { type: 'targeted', obstacle_type: o.obstacle_type, target_item_id: o.target_item_id, floor: o.floor };
              }
              return { type: 'area', floor: o.floor, x: o.x, y: o.y, radius: o.radius || 60 };
            });
            workerRef.current.postMessage({ type: 'UPDATE_OBSTACLES', payload: { obstacles: workerObstacles } });
          }
        }
      } catch (err) { console.warn('Obstacles fetch failed:', err.message); }
    };
    fetchObstacles();
    const interval = setInterval(fetchObstacles, 30000);
    return () => clearInterval(interval);
  }, [isDeltaDraftMode, currentBuilding, navGridData, setActiveObstacles]);

  return (
    <div style={{
      position: 'relative',
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--color-background)',
    }}>

      {/* ── Map fills all space ─────────────────────────────────────── */}
      <div className="map-area-wrap" style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        {isDeltaDraftMode ? <DraftImageMap /> : <MapContainer />}
      </div>

      {/* ── Floor Selector ─────────────────────────────────────────── */}
      {/* Desktop: inline bottom bar | Mobile: fixed above bottom-nav  */}
      <div className="floor-selector-bar" style={{
        flexShrink: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '8px 0',
        backgroundColor: 'var(--color-background)',
        borderTop: '1px solid var(--color-border)',
        zIndex: 100,
      }}>
        <FloorSelector />
      </div>

      {/* ── Search Bar — floats over map at top ─────────────────────── */}
      {/* Single SearchBar — internally handles desktop vs mobile display */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        padding: '14px 16px 0',
        zIndex: 2000,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'flex-start',
      }}>
        <div className="map-search-inner" style={{ flex: '1', maxWidth: '400px', pointerEvents: 'auto' }}>
          <SearchBar />
        </div>
      </div>

      {/* ── Pathfinding Panel ───────────────────────────────────────── */}
      {/* Desktop: absolute left panel | Mobile: handled inside PathfindingPanel as bottom sheet */}
      <div className="map-pathfinding-wrapper" style={{
        position: 'absolute',
        top: '80px',
        left: '16px',
        zIndex: 1500,
        pointerEvents: 'auto',
      }}>
        <PathfindingPanel />
      </div>

      {/* ── Test Simulator Panel ──────────────────────────────────────── */}
      {import.meta.env.DEV && (
        <TestObstaclesPanel />
      )}

      <style dangerouslySetInnerHTML={{__html: `
        /* Desktop: full search bar, left panel */
        .map-search-inner { max-width: 400px; }
        .map-pathfinding-wrapper { display: block; }
        .floor-selector-bar { position: static; border-top: 1px solid var(--color-border); }

        @media (max-width: 768px) {
          /* Full width search */
          .map-search-inner { max-width: 100%; }
          /* Reset desktop wrapper absolute styles so PathfindingPanel fixed sheet renders correctly */
          .map-pathfinding-wrapper {
            position: static;
            z-index: auto;
            pointer-events: none;
          }
          /* Remove from flow on mobile — becomes fixed below */
          .floor-selector-bar {
            position: fixed;
            left: 0;
            right: 0;
            bottom: calc(var(--bottom-nav-height) + var(--safe-bottom));
            z-index: 150;
            background: var(--color-background);
            border-top: 1px solid var(--color-border);
            padding: 6px 0;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          /* Map area: shrink to avoid being hidden behind fixed elements at bottom */
          .map-area-wrap {
            margin-bottom: var(--floor-selector-height);
          }
        }
      `}} />
    </div>
  );
};

export default MapPage;
