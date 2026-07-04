import axios from 'axios';
import { supabase } from './supabase';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getCampuses = () => api.get('/map/campuses');
export const getFloors = (buildingId) => api.get(`/map/buildings/${buildingId}/floors`);
export const getFullGraph = (buildingId) => api.get(`/map/buildings/${buildingId}/full-graph`);
export const getMapItems = (floorId) => api.get(`/map/floors/${floorId}/map-items`);
export const searchRooms = (query) => api.get(`/search?q=${query}`);

export const sendChatMessage = async (messages, userId) => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  
  return api.post('/chat', { messages, user_id: userId }, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
};

// ── Crowdsourcing Report ──
export const submitReport = (data) => api.post('/reports', data);
export const getActiveObstacles = (buildingCode) =>
  api.get(`/obstacles?building=${buildingCode}&status=active`);
export const upvoteObstacle = (id, data) => api.post(`/obstacles/${id}/upvote`, data);
export const downvoteObstacle = (id, data) => api.post(`/obstacles/${id}/downvote`, data);

// ── Admin ──
export const adminLogin = (email, password) => api.post('/admin/login', { email, password });
export const getAdminReports = () => api.get('/admin/reports');
export const updateReportStatus = (id, status) => api.patch(`/admin/reports/${id}/status?status=${status}`);
export const getAdminObstacles = () => api.get('/admin/obstacles');
export const updateObstacleStatus = (id, status) => api.patch(`/obstacles/${id}`, { status });
export const createObstacleDirectly = (data) => api.post('/admin/obstacles/direct', data);

export default api;
