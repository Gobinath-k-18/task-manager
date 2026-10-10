import { Outlet } from 'react-router-dom'
import FloatingAssistant from './FloatingAssistant'

function AuthenticatedLayout() {
  return (
    <>
      <Outlet />
      <FloatingAssistant />
    </>
  )
}

export default AuthenticatedLayout
