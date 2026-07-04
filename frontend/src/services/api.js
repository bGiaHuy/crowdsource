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
export const upvoteObstacle = (id) => api.post(`/obstacles/${id}/upvote`);
export const downvoteObstacle = (id) => api.post(`/obstacles/${id}/downvote`);

export default api;
