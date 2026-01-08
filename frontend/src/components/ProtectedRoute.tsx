import { Link } from 'react-router-dom'
import { useAuthStore, UserRole } from '../store/authStore'
import LoginModal from './LoginModal'
import Navbar from './Navbar'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isLoggedIn, role, hasRole } = useAuthStore()

  // 检查用户是否有权限
  const hasPermission = hasRole(allowedRoles)

  // 情况1：未登录 - 显示登录界面
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-pixel-bg">
        <Navbar />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4">
          <div className="pixel-card w-full max-w-md shadow-pixel-lg">
            <div className="pixel-card-header bg-pixel-yellow">
              <h1 className="font-pixel text-2xl text-pixel-dark flex items-center gap-2">
                <i className="fa-solid fa-lock"></i>
                ACCESS DENIED
              </h1>
            </div>
            <div className="p-6 text-center">
              <div className="mb-4">
                <i className="fa-solid fa-user-lock text-6xl text-pixel-gray-400"></i>
              </div>
              <p className="font-pixel text-lg text-pixel-dark mb-2">
                LOGIN REQUIRED
              </p>
              <p className="font-pixel text-sm text-pixel-gray-500 mb-6">
                Please login to access this feature
              </p>
              <p className="font-pixel text-xs text-pixel-gray-400 mb-4">
                Required: {allowedRoles.filter(r => r !== null).map(r => r?.toUpperCase()).join(' / ')}
              </p>

              {/* 全屏登录表单 */}
              <LoginModal fullscreen={false} />

              <Link
                to="/"
                className="inline-block mt-4 font-pixel text-sm text-pixel-primary hover:text-pixel-secondary"
              >
                [ BACK TO HOME ]
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 情况2：已登录但权限不足 - 显示权限不足提示
  if (!hasPermission) {
    return (
      <div className="min-h-screen bg-pixel-bg">
        <Navbar />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4">
          <div className="pixel-card w-full max-w-md shadow-pixel-lg">
            <div className="pixel-card-header bg-pixel-red">
              <h1 className="font-pixel text-2xl text-white flex items-center gap-2">
                <i className="fa-solid fa-ban"></i>
                FORBIDDEN
              </h1>
            </div>
            <div className="p-6 text-center">
              <div className="mb-4">
                <i className="fa-solid fa-shield-halved text-6xl text-pixel-red"></i>
              </div>
              <p className="font-pixel text-lg text-pixel-dark mb-2">
                INSUFFICIENT PERMISSIONS
              </p>
              <p className="font-pixel text-sm text-pixel-gray-500 mb-4">
                Your role: <span className="text-pixel-primary">{role?.toUpperCase()}</span>
              </p>
              <p className="font-pixel text-xs text-pixel-gray-400 mb-6">
                Required: {allowedRoles.filter(r => r !== null).map(r => r?.toUpperCase()).join(' / ')}
              </p>
              <Link
                to="/"
                className="pixel-btn-primary inline-block"
              >
                [ BACK TO HOME ]
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 情况3：有权限 - 渲染子组件
  return <>{children}</>
}
