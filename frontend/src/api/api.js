import axios from 'axios'

const apiOrigin = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '')

const api = axios.create({
  baseURL: `${apiOrigin}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('taskManagerToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api