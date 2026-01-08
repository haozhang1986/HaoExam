import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import LoginModal from './LoginModal'

// 导航菜单项配置
interface NavItem {
  label: string
  path: string
  allowedRoles: ('admin' | 'teacher' | 'student' | null)[]
}

const navItems: NavItem[] = [
  { label: 'GALLERY', path: '/gallery', allowedRoles: ['admin', 'teacher', 'student', null] },
  { label: 'GENERATOR', path: '/generator', allowedRoles: ['admin', 'teacher'] },
  { label: 'STUDIO', path: '/studio', allowedRoles: ['admin'] },
  { label: 'UPLOAD', path: '/admin/upload', allowedRoles: ['admin'] },
]

interface NavbarProps {
  // 当前页面标题（可选，默认根据路由自动检测）
  currentPage?: string
}

export default function Navbar({ currentPage }: NavbarProps) {
  const location = useLocation()
  const { isLoggedIn, username, role, logout, openLoginModal, canAccess } = useAuthStore()

  // 自动检测当前页面
  const detectCurrentPage = () => {
    if (currentPage) return currentPage
    const path = location.pathname
    if (path === '/gallery') return 'GALLERY'
    if (path === '/generator') return 'GENERATOR'
    if (path === '/studio') return 'STUDIO'
    if (path === '/admin/upload') return 'UPLOAD'
    return null
  }

  const activePageLabel = detectCurrentPage()

  // 过滤出当前用户可以看到的菜单项
  const visibleNavItems = navItems.filter((item) => item.allowedRoles.includes(role))

  return (
    <>
      <nav className="pixel-navbar">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* 左侧：Logo + 当前页面 */}
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <i className="fa-solid fa-gamepad text-2xl"></i>
                <span className="font-pixel text-2xl tracking-widest">HAOEXAM</span>
              </Link>

              {activePageLabel && (
                <>
                  <span className="font-pixel text-lg text-pixel-gray-500">/</span>
                  <span className="font-pixel text-lg">{activePageLabel}</span>
                </>
              )}
            </div>

            {/* 中间：导航菜单 */}
            <div className="hidden md:flex items-center gap-2">
              {visibleNavItems.map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`font-pixel text-sm px-3 py-1 border-2 transition-all ${
                      isActive
                        ? 'bg-pixel-dark text-white border-pixel-dark'
                        : 'border-transparent hover:border-pixel-dark hover:bg-pixel-gray-100'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>

            {/* 右侧：登录状态 */}
            <div className="flex items-center gap-4">
              {isLoggedIn ? (
                <>
                  <span className="font-pixel text-sm text-pixel-gray-600">
                    {username}
                    <span className="ml-1 text-pixel-primary">
                      ({role?.toUpperCase()})
                    </span>
                  </span>
                  <button
                    onClick={logout}
                    className="font-pixel text-sm bg-pixel-dark text-white px-3 py-1 border-2 border-pixel-dark hover:bg-pixel-red transition-colors"
                  >
                    [ LOGOUT ]
                  </button>
                </>
              ) : (
                <button
                  onClick={openLoginModal}
                  className="font-pixel text-sm bg-pixel-primary text-white px-3 py-1 border-2 border-pixel-dark hover:bg-pixel-secondary transition-colors"
                >
                  [ LOGIN ]
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* 全局登录模态框 */}
      <LoginModal />
    </>
  )
}
