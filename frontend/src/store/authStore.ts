import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { login as apiLogin } from '../services/api'

// 用户角色类型
export type UserRole = 'admin' | 'teacher' | 'student' | null

interface AuthState {
  // 认证状态
  isLoggedIn: boolean
  token: string | null
  username: string | null
  role: UserRole

  // 登录模态框状态
  isLoginModalOpen: boolean
  openLoginModal: () => void
  closeLoginModal: () => void

  // 登录/登出操作
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void

  // 权限检查
  hasRole: (allowedRoles: UserRole[]) => boolean
  canAccess: (feature: 'gallery' | 'generator' | 'studio' | 'upload') => boolean
}

// 功能权限映射
const featureRoles: Record<string, UserRole[]> = {
  gallery: ['student', 'teacher', 'admin', null], // null 表示游客也可以访问
  generator: ['teacher', 'admin'],
  studio: ['admin'],
  upload: ['admin'],
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // 初始状态
      isLoggedIn: false,
      token: null,
      username: null,
      role: null,

      // 登录模态框状态
      isLoginModalOpen: false,
      openLoginModal: () => set({ isLoginModalOpen: true }),
      closeLoginModal: () => set({ isLoginModalOpen: false }),

      // 登录操作
      login: async (username: string, password: string) => {
        try {
          const result = await apiLogin(username, password)

          // 更新状态
          set({
            isLoggedIn: true,
            token: result.access_token,
            username: username,
            role: result.role as UserRole,
            isLoginModalOpen: false,
          })

          return { success: true }
        } catch (error) {
          console.error('Login failed:', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : '登录失败',
          }
        }
      },

      // 登出操作
      logout: () => {
        set({
          isLoggedIn: false,
          token: null,
          username: null,
          role: null,
        })
      },

      // 检查用户是否具有指定角色
      hasRole: (allowedRoles: UserRole[]) => {
        const { role } = get()
        return allowedRoles.includes(role)
      },

      // 检查用户是否可以访问指定功能
      canAccess: (feature: 'gallery' | 'generator' | 'studio' | 'upload') => {
        const { role } = get()
        const allowedRoles = featureRoles[feature]
        return allowedRoles.includes(role)
      },
    }),
    {
      name: 'haoexam-auth-storage',
      // 只持久化认证相关数据，不持久化 modal 状态
      partialize: (state) => ({
        isLoggedIn: state.isLoggedIn,
        token: state.token,
        username: state.username,
        role: state.role,
      }),
    }
  )
)
