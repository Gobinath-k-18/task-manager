import axios from 'axios'

const apiOrigin = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '')

const api = axios.create({
  baseURL: `${apiOrigin}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
})

export function getRoadmaps(config) {
  return api.get('/roadmaps', config)
}

export function deleteRoadmap(roadmapId) {
  return api.delete(`/roadmaps/${roadmapId}`)
}

export function uploadRoadmap(document, config) {
  return api.post('/roadmaps', document, {
    ...config,
    headers: {
      ...config?.headers,
      'Content-Type': 'multipart/form-data',
    },
  })
}

export function completeRoadmapDay(roadmapId, dayNumber) {
  return api.patch(`/roadmaps/${roadmapId}/days/${dayNumber}/complete`)
}

export function chatWithRoadmap(roadmapId, message) {
  return api.post(`/roadmaps/${roadmapId}/chat`, { message })
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('taskManagerToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api