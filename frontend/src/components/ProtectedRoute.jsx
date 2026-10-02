import { Navigate } from 'react-router-dom'
import { getToken } from '../api/authStorage'

function ProtectedRoute({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />
}

export default ProtectedRoute