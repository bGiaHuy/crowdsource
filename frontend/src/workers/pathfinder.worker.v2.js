
// MIN HEAP IMPLEMENTATION
class MinHeap {
  constructor(compareFunc) {
    this.heap = [];
    this.compare = compareFunc;
  }
  push(val) {
    this.heap.push(val);
    this.bubbleUp(this.heap.length - 1);
  }
  pop() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const bottom = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this.sinkDown(0);
    }
    return top;
  }
  bubbleUp(n) {
    let element = this.heap[n];
    while (n > 0) {
      let parentN = Math.floor((n + 1) / 2) - 1;
      let parent = this.heap[parentN];
      if (this.compare(element, parent) >= 0) break;
      this.heap[parentN] = element;
      this.heap[n] = parent;
      n = parentN;
    }
  }
  sinkDown(n) {
    let length = this.heap.length;
    let element = this.heap[n];
    while (true) {
      let child2N = (n + 1) * 2;
      let child1N = child2N - 1;
      let swap = null;
      if (child1N < length) {
        let child1 = this.heap[child1N];
        if (this.compare(child1, element) < 0) swap = child1N;
      }
      if (child2N < length) {
        let child2 = this.heap[child2N];
        if (this.compare(child2, (swap === null ? element : this.heap[child1N])) < 0) swap = child2N;
      }
      if (swap === null) break;
      this.heap[n] = this.heap[swap];
      this.heap[swap] = element;
      n = swap;
    }
  }
}

let cachedGridMap = new Map(); // floorId -> { grid: Uint8Array, width, height, cell_size, access_points: Map }
const PENALTY_COST = 2;
let lastGridData = null;
let disabledAccessPoints = new Set();
let currentObstaclesList = [];
let currentAvoidObstacles = true;

function loadGrid(gridData) {
  lastGridData = gridData;
  cachedGridMap.clear();
  const cellSize = gridData.cell_size;
  
  for (const [floorIdStr, floor] of Object.entries(gridData.floors)) {
    const floorId = parseInt(floorIdStr, 10);
    const width = floor.width;
    const height = floor.height;
    const size = width * height;
    
    // 1. Decompress RLE
    const grid = new Uint8Array(size);
    let isWalkable = true;
    let idx = 0;
    
    for (let i = 0; i < floor.rle.length; i++) {
      const count = floor.rle[i];
      if (!isWalkable) {
        const end = idx + count;
        for (let j = idx; j < end; j++) {
          grid[j] = 1; // 1 = wall
        }
      }
      idx += count;
      isWalkable = !isWalkable;
    }
    
    // 2. Inflation / Clearance    // Removed wall penalty inflation
    
    // 3. Map Access Points
    const accessPointsMap = new Map();
    if (floor.access_points) {
      for (const [itemId, apData] of Object.entries(floor.access_points)) {
        if (apData.points && apData.points.length > 0) {
          accessPointsMap.set(itemId, {
            item_type: apData.type,
            points: apData.points, // Store all access points
            visual_x: apData.center_x,
            visual_y: apData.center_y
          });
        }
      }
    }
    
    cachedGridMap.set(floorId, {
      floor_id: floorId,
      grid,
      width,
      height,
      cell_size: cellSize,
      access_points: accessPointsMap
    });
  }
}

function getNearestWalkable(cx, cy, floorData) {

  const { grid, width, height } = floorData;
  if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
    if (grid[cy * width + cx] !== 1) return { x: cx, y: cy };
  }
  
  let bestCell = null;
  let minDist = Infinity;
  
  // Search radius up to 100 cells
  for (let r = 1; r <= 100; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          if (grid[ny * width + nx] !== 1) {
            const dist = Math.abs(dx) + Math.abs(dy);
            if (dist < minDist) {
                minDist = dist;
                bestCell = { x: nx, y: ny };
            }
          }
        }
      }
    }
    if (bestCell && minDist <= r * 1.5) return bestCell;
  }
  return bestCell;
}

// Supercover Line of Sight (Bresenham based)
function supercoverLineOfSight(x0, y0, x1, y1, grid, width, height) {
  let dx = x1 - x0;
  let dy = y1 - y0;
  let nx = Math.abs(dx);
  let ny = Math.abs(dy);
  let sign_x = dx > 0 ? 1 : -1;
  let sign_y = dy > 0 ? 1 : -1;

  let p = { x: x0, y: y0 };
  let points = [{ x: p.x, y: p.y }];
  
  for (let ix = 0, iy = 0; ix < nx || iy < ny;) {
    if ((0.5 + ix) / nx === (0.5 + iy) / ny) {
      p.x += sign_x;
      p.y += sign_y;
      ix++;
      iy++;
    } else if ((0.5 + ix) / nx < (0.5 + iy) / ny) {
      p.x += sign_x;
      ix++;
    } else {
      p.y += sign_y;
      iy++;
    }
    points.push({ x: p.x, y: p.y });
  }

  for (const pt of points) {
    if (pt.x < 0 || pt.x >= width || pt.y < 0 || pt.y >= height) return false;
    if (grid[pt.y * width + pt.x] === 1) return false;
  }
  return true;
}

function heuristic(x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  return Math.sqrt(dx * dx + dy * dy);
}

// THETA* ALGORITHM
function thetaStar(startGridX, startGridY, endGridX, endGridY, floorData, startItemId, endItemId) {
  const { grid, width, height } = floorData;
  let startPts = [];
  if (startItemId && floorData.access_points.has(startItemId)) {
    const ap = floorData.access_points.get(startItemId);
    startPts = ap.points;
  } else {
    startPts = [getNearestWalkable(startGridX, startGridY, floorData)];
  }

  let endPts = [];
  let endPtsSet = new Set();
  if (endItemId && floorData.access_points.has(endItemId)) {
    const ap = floorData.access_points.get(endItemId);
    endPts = ap.points;
  } else {
    endPts = [getNearestWalkable(endGridX, endGridY, floorData)];
  }
  
  if (!startPts || startPts.length === 0 || !startPts[0] || !endPts || endPts.length === 0 || !endPts[0]) return null;

  for (const pt of endPts) {
    endPtsSet.add(`${pt.x},${pt.y}`);
  }

  // Check if any start point is already an end point
  for (const pt of startPts) {
    if (endPtsSet.has(`${pt.x},${pt.y}`)) {
      return [{x: pt.x, y: pt.y}];
    }
  }

  const openSet = new MinHeap((a, b) => a.f - b.f);
  const closedSet = new Set();
  const gCosts = new Map();
  
  const getHeuristic = (x, y) => {
    let minH = Infinity;
    for (let i = 0; i < endPts.length; i++) {
      let d = heuristic(x, y, endPts[i].x, endPts[i].y);
      if (d < minH) minH = d;
    }
    return minH;
  };

  for (const pt of startPts) {
    const startNode = {
      x: pt.x, y: pt.y,
      g: 0,
      f: getHeuristic(pt.x, pt.y),
      parent: null
    };
    openSet.push(startNode);
    gCosts.set(`${pt.x},${pt.y}`, 0);
  }
  
  let endNode = null;
  
  // 8-way movement
  const DIRS = [
    {dx: 0, dy: -1, cost: 1},
    {dx: 0, dy: 1, cost: 1},
    {dx: -1, dy: 0, cost: 1},
    {dx: 1, dy: 0, cost: 1},
    {dx: -1, dy: -1, cost: 1.414},
    {dx: 1, dy: -1, cost: 1.414},
    {dx: -1, dy: 1, cost: 1.414},
    {dx: 1, dy: 1, cost: 1.414}
  ];
  
  while (openSet.heap.length > 0) {
    const current = openSet.pop();
    
    if (endPtsSet.has(`${current.x},${current.y}`)) {
      endNode = current;
      break;
    }
    
    const stateKey = `${current.x},${current.y}`;
    if (closedSet.has(stateKey)) continue;
    closedSet.add(stateKey);
    
    for (const d of DIRS) {
      const nx = current.x + d.dx;
      const ny = current.y + d.dy;
      
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        if (grid[ny * width + nx] === 1) continue;
        
        let moveCost = d.cost;
        
        const nextStateKey = `${nx},${ny}`;
        if (closedSet.has(nextStateKey)) continue;
        
        let parent = current;
        let newG = current.g + moveCost;
        
        // Theta* optimization: Check Line of Sight from current's parent to neighbor
        if (current.parent) {
          const px = current.parent.x;
          const py = current.parent.y;
          if (supercoverLineOfSight(px, py, nx, ny, grid, width, height)) {
            const dist = heuristic(px, py, nx, ny);
            let losCost = dist;
            
            if (current.parent.g + losCost < newG) {
              parent = current.parent;
              newG = current.parent.g + losCost;
            }
          }
        }
        
        const existingG = gCosts.get(nextStateKey);
        if (existingG === undefined || newG < existingG) {
          gCosts.set(nextStateKey, newG);
          const h = getHeuristic(nx, ny);
          openSet.push({
            x: nx, y: ny,
            g: newG,
            f: newG + h,
            parent: parent
          });
        }
      }
    }
  }
  
  if (!endNode) return null;
  
  const path = [];
  let curr = endNode;
  while (curr) {
    path.push({x: curr.x, y: curr.y});
    curr = curr.parent;
  }
  path.reverse();
  
  // Simplify path by removing collinear points
  if (path.length <= 2) return path;
  const simplified = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    const next = path[i + 1];
    
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    
    // Cross product to check collinearity
    if ((dx1 * dy2 - dy1 * dx2) !== 0) {
      simplified.push(curr);
    }
  }
  simplified.push(path[path.length - 1]);
  return simplified;
}

const FLOOR_CHANGE_COST = 50; // Cost of changing floors

// Hierarchical Routing
function findHierarchicalPath(startPt, endPt, preferElevator = false, startItemId = null, endItemId = null) {
  const startFloor = cachedGridMap.get(startPt.floor);
  const endFloor = cachedGridMap.get(endPt.floor);
  
  if (!startFloor || !endFloor) throw new Error(`Dữ liệu tầng không tồn tại: ${startPt.floor} -> ${endPt.floor}`);
  
  const cs = startFloor.cell_size;
  const sx = (startPt.x / cs) | 0;
  const sy = (startPt.y / cs) | 0;
  const ex = (endPt.x / cs) | 0;
  const ey = (endPt.y / cs) | 0;
  
  if (startPt.floor === endPt.floor) {
    let path = null;

    // CUSTOM RULE: If both points are on Floor 1 and AT LEAST ONE is NOT a specific item (custom click),
    // ignore static walls (grass/buildings) and ONLY avoid dynamic obstacles.
    if (startPt.floor === 1 && (!startItemId || !endItemId)) {
      const openGrid = new Uint8Array(startFloor.width * startFloor.height);
      if (currentAvoidObstacles !== false && currentObstaclesList.length > 0) {
        for (const obs of currentObstaclesList) {
          if (obs.type === 'area' && obs.floor === 1) {
            const gx = Math.floor(obs.x / cs);
            const gy = Math.floor(obs.y / cs);
            const gr = Math.max(1, Math.ceil(obs.radius / cs));
            for (let dy = -gr; dy <= gr; dy++) {
              for (let dx = -gr; dx <= gr; dx++) {
                const nx = gx + dx, ny = gy + dy;
                if (nx >= 0 && nx < startFloor.width && ny >= 0 && ny < startFloor.height) {
                  openGrid[ny * startFloor.width + nx] = 1;
                }
              }
            }
          }
        }
      }
      const customFloor = { ...startFloor, grid: openGrid };
      path = thetaStar(sx, sy, ex, ey, customFloor, null, null);
    } else {
      path = thetaStar(sx, sy, ex, ey, startFloor, startItemId, endItemId);
    }
    
    if (!path) return null;
    
    const finalNodes = [];
    finalNodes.push({ x: startPt.x, y: startPt.y, floor: startPt.floor, type: 'click' });
    path.forEach(p => finalNodes.push({ x: (p.x * cs) + (cs/2), y: (p.y * cs) + (cs/2), floor: startPt.floor }));
    finalNodes.push({ x: endPt.x, y: endPt.y, floor: endPt.floor, type: 'click' });
    
    // Simplify final pixel nodes
    const simpleFinal = [finalNodes[0]];
    for (let i = 1; i < finalNodes.length - 1; i++) {
        const prev = finalNodes[i - 1];
        const curr = finalNodes[i];
        const next = finalNodes[i + 1];
        const dx1 = curr.x - prev.x; const dy1 = curr.y - prev.y;
        const dx2 = next.x - curr.x; const dy2 = next.y - curr.y;
        if ((dx1 * dy2 - dy1 * dx2) !== 0) {
            simpleFinal.push(curr);
        }
    }
    simpleFinal.push(finalNodes[finalNodes.length - 1]);
    
    let totalCost = 0;
    for (let i = 1; i < simpleFinal.length; i++) {
        const dx = simpleFinal[i].x - simpleFinal[i-1].x;
        const dy = simpleFinal[i].y - simpleFinal[i-1].y;
        totalCost += Math.sqrt(dx*dx + dy*dy);
    }
    
    return {
      nodes: simpleFinal,
      distance: totalCost,
      floors: [startPt.floor]
    };
  } else {
    // Phase 1
    let bestTotalCost = Infinity;
    let bestStairId = null;
    let bestPhase1Path = null;
    
    for (const [stairId, stair] of startFloor.access_points.entries()) {
      if (stair.item_type !== 'stair' && stair.item_type !== 'elevator') continue;
      if (disabledAccessPoints.has(stairId)) continue;
      const stx = stair.points[0].x;
      const sty = stair.points[0].y;
      
      const p1 = thetaStar(sx, sy, stx, sty, startFloor, startItemId, stairId);
      if (!p1) continue;
      
      let cost1 = 0;
      for(let i=1; i<p1.length; i++){
          cost1 += heuristic(p1[i-1].x, p1[i-1].y, p1[i].x, p1[i].y);
      }
      
      let endStair = null;
      let minDist = Infinity;
      for (const [eStairId, eStair] of endFloor.access_points.entries()) {
        if (eStair.item_type !== stair.item_type) continue;
        if (disabledAccessPoints.has(eStairId)) continue;
        const dist = heuristic(stair.points[0].x, stair.points[0].y, eStair.points[0].x, eStair.points[0].y);
        if (dist < minDist && dist < 1600) {
          minDist = dist;
          endStair = eStair;
        }
      }
      if (!endStair) continue;
      
      const estx = endStair.points[0].x;
      const esty = endStair.points[0].y;
      const cost2 = heuristic(estx, esty, ex, ey);
      
      const stairPenalty = (preferElevator && stair.item_type === 'stair') ? 100000 : 0;
      const totalCost = cost1 + cost2 + FLOOR_CHANGE_COST * Math.abs(endFloor.floor_id - startFloor.floor_id) + stairPenalty;
      
      if (totalCost < bestTotalCost) {
        bestTotalCost = totalCost;
        bestStairId = stairId;
        bestPhase1Path = p1;
      }
    }
    
    if (!bestStairId) return null;
    
    // Phase 3
    let bestEndStair = null;
    let bestEndStairId = null;
    let bestMinDist = Infinity;
    const startStair = startFloor.access_points.get(bestStairId);
    
    for (const [eStairId, eStair] of endFloor.access_points.entries()) {
      if (eStair.item_type !== startStair.item_type) continue;
      if (disabledAccessPoints.has(eStairId)) continue;
      const dist = heuristic(startStair.points[0].x, startStair.points[0].y, eStair.points[0].x, eStair.points[0].y);
      if (dist < bestMinDist && dist < 1600) { // match Phase 1 threshold
        bestMinDist = dist;
        bestEndStair = eStair;
        bestEndStairId = eStairId;
      }
    }
    if (!bestEndStair) return null;
    
    const estx = bestEndStair.points[0].x;
    const esty = bestEndStair.points[0].y;
    
    const bestPhase3Path = thetaStar(estx, esty, ex, ey, endFloor, bestEndStairId, endItemId);
    if (!bestPhase3Path) return null;
    
    const finalNodes = [];
    finalNodes.push({ x: startPt.x, y: startPt.y, floor: startPt.floor, type: 'click' });
    bestPhase1Path.forEach(p => finalNodes.push({ x: (p.x * cs) + (cs/2), y: (p.y * cs) + (cs/2), floor: startPt.floor }));
    finalNodes.push({ x: startStair.visual_x || (startStair.points[0].x*cs + cs/2), y: startStair.visual_y || (startStair.points[0].y*cs + cs/2), floor: startPt.floor, type: 'stair' });
    
    const step = startPt.floor < endPt.floor ? 1 : -1;
    let currFloor = startPt.floor + step;
    while(currFloor !== endPt.floor) {
        let intermStair = null;
        let minDist = Infinity;
        const currFloorData = cachedGridMap.get(currFloor);
        if (currFloorData) {
            for (const [id, ap] of currFloorData.access_points.entries()) {
                if (ap.item_type !== startStair.item_type) continue;
                if (disabledAccessPoints.has(id)) continue;
                const dist = heuristic(startStair.points[0].x, startStair.points[0].y, ap.points[0].x, ap.points[0].y);
                if (dist < minDist && dist < 1600) { // match Phase 1 threshold
                    minDist = dist;
                    intermStair = ap;
                }
            }
        }
        const cx = intermStair ? (intermStair.visual_x || (intermStair.points[0].x * cs + cs/2)) : finalNodes[finalNodes.length-1].x;
        const cy = intermStair ? (intermStair.visual_y || (intermStair.points[0].y * cs + cs/2)) : finalNodes[finalNodes.length-1].y;
        finalNodes.push({ x: cx, y: cy, floor: currFloor, type: 'stair_transit' });
        currFloor += step;
    }
    
    finalNodes.push({ x: bestEndStair.visual_x || (bestEndStair.points[0].x*cs + cs/2), y: bestEndStair.visual_y || (bestEndStair.points[0].y*cs + cs/2), floor: endPt.floor, type: 'stair_transit' });
    bestPhase3Path.forEach(p => finalNodes.push({ x: (p.x * cs) + (cs/2), y: (p.y * cs) + (cs/2), floor: endPt.floor }));
    finalNodes.push({ x: endPt.x, y: endPt.y, floor: endPt.floor, type: 'click' });
    
    return {
      nodes: finalNodes,
      distance: (bestTotalCost * cs) | 0,
      floors: [startPt.floor, endPt.floor].sort((a,b)=>a-b)
    };
  }
}

function generateInstructions(nodes) {
  if (!nodes || nodes.length === 0) return [];
  const instructions = [];
  let currentFloor = nodes[0]?.floor;
  instructions.push({ text: `Bắt đầu từ Tầng ${currentFloor}` });
  
  for (let i = 1; i < nodes.length; i++) {
    if (nodes[i].floor !== currentFloor) {
      const direction = nodes[i].floor > currentFloor ? 'Lên' : 'Xuống';
      instructions.push({ text: `${direction} Tầng ${nodes[i].floor} qua Cầu thang/Thang máy` });
      currentFloor = nodes[i].floor;
    }
  }
  instructions.push({ text: `Đi đến điểm đích (Tầng ${currentFloor})` });
  return instructions;
}

self.onmessage = function (e) {
  const { type, payload } = e.data;

  if (type === 'UPDATE_OBSTACLES') {
    if (lastGridData) {
      loadGrid(lastGridData);
      applyObstacles(payload.obstacles);
    }
    return;
  }

  if (type === 'CALCULATE_ROUTE') {
    const { gridData, startBboxCenter, endBboxCenter, startItemId, endItemId, preferElevator, obstacles, avoidObstacles } = payload;
    if (!startBboxCenter || !endBboxCenter) {
      self.postMessage({ type: 'ROUTE_ERROR', payload: 'Thiếu điểm xuất phát hoặc điểm đích' });
      return;
    }
    if (cachedGridMap.size === 0 || gridData !== undefined) {
      if (gridData) loadGrid(gridData);
      else {
        self.postMessage({ type: 'ROUTE_ERROR', payload: 'Chưa có dữ liệu lưới' });
        return;
      }
    }
    if (avoidObstacles !== false && obstacles && obstacles.length > 0 && lastGridData) {
      loadGrid(lastGridData);
      applyObstacles(obstacles);
    } else if (lastGridData) {
      loadGrid(lastGridData); // Ensure clean grid
      disabledAccessPoints.clear(); // Ensure disabled access points are also cleared
    }
    currentAvoidObstacles = avoidObstacles;
    currentObstaclesList = obstacles || [];

    try {
      const t0 = performance.now();
      const result = findHierarchicalPath(startBboxCenter, endBboxCenter, preferElevator, startItemId, endItemId);
      const t1 = performance.now();
      if (result) {
        let totalPixelDist = 0;
        for (let i = 1; i < result.nodes.length; i++) {
          const dx = result.nodes[i].x - result.nodes[i-1].x;
          const dy = result.nodes[i].y - result.nodes[i-1].y;
          if (result.nodes[i].floor === result.nodes[i-1].floor) {
              totalPixelDist += Math.sqrt(dx*dx + dy*dy);
          } else {
              totalPixelDist += Math.abs(result.nodes[i].floor - result.nodes[i-1].floor) * 130;
          }
        }
        const PIXELS_PER_METER = 32.5;
        const distanceInMeters = Math.round(totalPixelDist / PIXELS_PER_METER);
        const estTime = Math.round(distanceInMeters / 1.2);
        
        self.postMessage({
          type: 'ROUTE_RESULT',
          payload: {
            path: result.nodes,
            distance: distanceInMeters,
            floors_traversed: result.floors,
            estimated_time_seconds: estTime,
            instructions: generateInstructions(result.nodes),
            compute_time_ms: (t1 - t0).toFixed(2)
          }
        });
      } else {
        self.postMessage({
          type: 'ROUTE_ERROR',
          payload: (obstacles && obstacles.length > 0)
            ? 'Không tìm được đường đi do vật cản. Vui lòng thử lộ trình khác.'
            : 'Không tìm thấy đường đi an toàn'
        });
      }
    } catch (error) {
      self.postMessage({ type: 'ROUTE_ERROR', payload: error.message });
    }
  }
};

function applyObstacles(obstacles) {
  disabledAccessPoints.clear();
  if (!obstacles || obstacles.length === 0) return;
  for (const obs of obstacles) {
    if (obs.type === 'targeted') {
      disabledAccessPoints.add(obs.target_item_id);
    } else if (obs.type === 'area') {
      const floorData = cachedGridMap.get(obs.floor);
      if (!floorData) continue;
      const cs = floorData.cell_size;
      const gx = Math.floor(obs.x / cs);
      const gy = Math.floor(obs.y / cs);
      const gr = Math.max(1, Math.ceil(obs.radius / cs));
      for (let dy = -gr; dy <= gr; dy++) {
        for (let dx = -gr; dx <= gr; dx++) {
          const nx = gx + dx, ny = gy + dy;
          if (nx >= 0 && nx < floorData.width && ny >= 0 && ny < floorData.height) {
            floorData.grid[ny * floorData.width + nx] = 1;
          }
        }
      }
    }
  }
}
