import axios from 'axios';

// Automatically uses relative /api (proxied by Vite to port 3002) for localhost, LAN, and Localtunnel
const apiClient = axios.create({
  baseURL:
import.meta.env.VITE_API_URL || "/api",   
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;
