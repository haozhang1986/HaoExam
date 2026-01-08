import { useState } from 'react'
import { useAuthStore } from '../store/authStore'

interface LoginModalProps {
  // 可选：全屏模式（用于 ProtectedRoute）
  fullscreen?: boolean
  // 可选：自定义关闭回调
  onClose?: () => void
  // 可选：登录成功后回调
  onSuccess?: () => void
}

export default function LoginModal({ fullscreen = false, onClose, onSuccess }: LoginModalProps) {
  const { login, closeLoginModal, isLoginModalOpen } = useAuthStore()

  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // 如果不是全屏模式且模态框未打开，不渲染
  if (!fullscreen && !isLoginModalOpen) {
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await login(form.username, form.password)

    setLoading(false)

    if (result.success) {
      onSuccess?.()
    } else {
      setError(result.error || 'LOGIN FAILED')
    }
  }

  const handleClose = () => {
    if (onClose) {
      onClose()
    } else {
      closeLoginModal()
    }
  }

  const content = (
    <div className="pixel-card w-full max-w-md shadow-pixel-lg">
      <div className="pixel-card-header bg-pixel-primary">
        <h1 className="font-pixel text-2xl text-white flex items-center gap-2">
          <i className="fa-solid fa-user-lock"></i>
          LOGIN
        </h1>
      </div>
      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-pixel text-sm text-pixel-dark mb-1">
              USERNAME
            </label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="pixel-input"
              placeholder="Enter username"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block font-pixel text-sm text-pixel-dark mb-1">
              PASSWORD
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="pixel-input"
              placeholder="********"
              required
            />
          </div>

          {error && (
            <div className="font-pixel text-sm text-pixel-red border-2 border-pixel-red bg-red-50 px-3 py-2">
              <i className="fa-solid fa-exclamation-triangle mr-2"></i>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="pixel-btn-primary w-full"
          >
            {loading ? (
              <span className="animate-blink">LOADING...</span>
            ) : (
              '[ LOGIN ]'
            )}
          </button>
        </form>

        {/* 关闭按钮（仅在非全屏模式显示） */}
        {!fullscreen && (
          <button
            onClick={handleClose}
            className="mt-4 font-pixel text-sm text-pixel-gray-500 hover:text-pixel-dark w-full text-center"
          >
            [ CANCEL ]
          </button>
        )}
      </div>
    </div>
  )

  // 全屏模式：直接渲染内容
  if (fullscreen) {
    return (
      <div className="min-h-screen bg-pixel-bg flex items-center justify-center p-4">
        {content}
      </div>
    )
  }

  // 模态框模式：渲染遮罩层
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        // 点击遮罩层关闭
        if (e.target === e.currentTarget) {
          handleClose()
        }
      }}
    >
      {content}
    </div>
  )
}
