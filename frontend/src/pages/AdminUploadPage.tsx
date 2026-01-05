import { useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { uploadZip, login, type UploadResult, type UploadError } from '../services/api'

// ============================================================================
// 类型定义
// ============================================================================
type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

interface AuthState {
  isLoggedIn: boolean
  token: string | null
  username: string | null
  role: string | null
}

// ============================================================================
// AdminUploadPage 组件 - 像素风格
// ============================================================================
export default function AdminUploadPage() {
  // 认证状态
  const [auth, setAuth] = useState<AuthState>(() => {
    const token = localStorage.getItem('auth_token')
    const username = localStorage.getItem('auth_username')
    const role = localStorage.getItem('auth_role')
    return {
      isLoggedIn: !!token,
      token,
      username,
      role,
    }
  })

  // 登录表单
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)

  // 上传状态
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [dragActive, setDragActive] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // --------------------------------------------------------------------------
  // 登录处理
  // --------------------------------------------------------------------------
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)
    setLoginLoading(true)

    try {
      const result = await login(loginForm.username, loginForm.password)

      if (result.role !== 'admin') {
        setLoginError('ADMIN ACCESS REQUIRED')
        return
      }

      localStorage.setItem('auth_token', result.access_token)
      localStorage.setItem('auth_username', loginForm.username)
      localStorage.setItem('auth_role', result.role)

      setAuth({
        isLoggedIn: true,
        token: result.access_token,
        username: loginForm.username,
        role: result.role,
      })
    } catch (error) {
      setLoginError('INVALID CREDENTIALS')
      console.error('Login failed:', error)
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_username')
    localStorage.removeItem('auth_role')
    setAuth({ isLoggedIn: false, token: null, username: null, role: null })
  }

  // --------------------------------------------------------------------------
  // 文件拖拽处理
  // --------------------------------------------------------------------------
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      if (file.name.endsWith('.zip')) {
        setSelectedFile(file)
        setUploadResult(null)
        setUploadStatus('idle')
      } else {
        alert('ZIP FILE REQUIRED')
      }
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      setSelectedFile(files[0])
      setUploadResult(null)
      setUploadStatus('idle')
    }
  }

  // --------------------------------------------------------------------------
  // 上传处理
  // --------------------------------------------------------------------------
  const handleUpload = async () => {
    if (!selectedFile || !auth.token) return

    setUploadStatus('uploading')
    setUploadResult(null)
    setUploadProgress(0)

    try {
      const result = await uploadZip(selectedFile, auth.token, (progress) => {
        setUploadProgress(progress)
      })
      setUploadResult(result)
      setUploadStatus(result.success ? 'success' : 'error')
    } catch (error) {
      console.error('Upload failed:', error)
      setUploadResult({
        success: false,
        processed_count: 0,
        skipped_count: 0,
        errors: [{ question: 'GLOBAL', reason: String(error) }],
      })
      setUploadStatus('error')
    }
  }

  const handleReset = () => {
    setSelectedFile(null)
    setUploadResult(null)
    setUploadStatus('idle')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // --------------------------------------------------------------------------
  // 登录界面 - 像素风格
  // --------------------------------------------------------------------------
  if (!auth.isLoggedIn) {
    return (
      <div className="min-h-screen bg-pixel-bg flex items-center justify-center p-4">
        <div className="pixel-card w-full max-w-md shadow-pixel-lg">
          <div className="pixel-card-header bg-pixel-green">
            <h1 className="font-pixel text-2xl text-white">ADMIN LOGIN</h1>
          </div>
          <div className="p-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block font-pixel text-sm text-pixel-dark mb-1">
                  USERNAME
                </label>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  className="pixel-input"
                  placeholder="admin"
                  required
                />
              </div>

              <div>
                <label className="block font-pixel text-sm text-pixel-dark mb-1">
                  PASSWORD
                </label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="pixel-input"
                  placeholder="********"
                  required
                />
              </div>

              {loginError && (
                <div className="font-pixel text-sm text-pixel-red border-2 border-pixel-red bg-red-50 px-3 py-2">
                  <i className="fa-solid fa-exclamation-triangle mr-2"></i>
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="pixel-btn-primary w-full"
              >
                {loginLoading ? 'LOADING...' : '[ LOGIN ]'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link to="/" className="font-pixel text-pixel-primary hover:text-pixel-secondary">
                [ BACK TO HOME ]
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --------------------------------------------------------------------------
  // 上传界面 - 像素风格
  // --------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-pixel-bg">
      {/* 像素风导航栏 */}
      <nav className="pixel-navbar">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <i className="fa-solid fa-gamepad text-2xl"></i>
                <span className="font-pixel text-2xl tracking-widest">HAOEXAM</span>
              </Link>
              <span className="font-pixel text-lg text-pixel-gray-500">/</span>
              <span className="font-pixel text-lg">UPLOAD</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-pixel text-sm text-pixel-gray-600">
                {auth.username} ({auth.role?.toUpperCase()})
              </span>
              <button
                onClick={handleLogout}
                className="font-pixel text-sm bg-pixel-dark text-white px-3 py-1 border-2 border-pixel-dark hover:bg-pixel-red transition-colors"
              >
                [ LOGOUT ]
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* 主内容区域 */}
      <main className="max-w-4xl mx-auto px-4 py-8 pt-24 pb-20">
        {/* 上传区域 */}
        <div className="pixel-card mb-6">
          <div className="pixel-card-header bg-pixel-primary">
            <span className="font-pixel text-xl text-white">
              <i className="fa-solid fa-upload mr-2"></i>
              SELECT FILE
            </span>
          </div>
          <div className="p-6">
            {/* Dropzone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-4 border-dashed p-8 text-center cursor-pointer transition-all
                ${dragActive
                  ? 'border-pixel-primary bg-blue-50'
                  : 'border-pixel-dark hover:border-pixel-primary hover:bg-pixel-gray-100'
                }
                ${uploadStatus === 'uploading' ? 'pointer-events-none opacity-50' : ''}
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                className="hidden"
              />

              {selectedFile ? (
                <div className="space-y-2">
                  <i className="fa-solid fa-box-archive text-5xl text-pixel-primary block"></i>
                  <p className="font-pixel text-xl text-pixel-dark">{selectedFile.name}</p>
                  <p className="font-pixel text-sm text-pixel-gray-500">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <i className="fa-solid fa-folder-open text-5xl text-pixel-gray-400 block"></i>
                  <p className="font-pixel text-lg text-pixel-gray-600">
                    CLICK OR DROP ZIP FILE
                  </p>
                  <p className="font-pixel text-xs text-pixel-gray-400">
                    EXAMSLICER EXPORT FORMAT
                  </p>
                </div>
              )}
            </div>

            {/* 上传按钮 */}
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleUpload}
                disabled={!selectedFile || uploadStatus === 'uploading'}
                className={`flex-1 py-3 font-pixel text-lg border-4 border-pixel-dark transition-all flex items-center justify-center gap-2 ${
                  selectedFile && uploadStatus !== 'uploading'
                    ? 'bg-pixel-primary text-white shadow-pixel hover:translate-x-1 hover:translate-y-1 hover:shadow-none'
                    : 'bg-pixel-gray-200 text-pixel-gray-400 cursor-not-allowed'
                }`}
              >
                {uploadStatus === 'uploading' ? (
                  <span className="animate-blink">UPLOADING...</span>
                ) : (
                  <>
                    <i className="fa-solid fa-upload"></i>
                    START UPLOAD
                  </>
                )}
              </button>

              {selectedFile && uploadStatus !== 'uploading' && (
                <button
                  onClick={handleReset}
                  className="pixel-btn"
                >
                  [ CLEAR ]
                </button>
              )}
            </div>

            {/* 上传进度条 */}
            {uploadStatus === 'uploading' && (
              <div className="mt-4">
                <div className="flex justify-between font-pixel text-sm text-pixel-dark mb-1">
                  <span>PROGRESS</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-pixel-gray-200 border-2 border-pixel-dark h-6 overflow-hidden">
                  <div
                    className="bg-pixel-primary h-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                {uploadProgress === 100 && (
                  <p className="font-pixel text-sm text-pixel-gray-500 mt-2 text-center animate-blink">
                    PROCESSING...
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 结果反馈 */}
        {uploadResult && (
          <div className="space-y-6">
            {/* 统计卡片 */}
            <div className="grid grid-cols-3 gap-4">
              <StatCard
                label="SUCCESS"
                value={uploadResult.processed_count}
                icon="fa-check"
                color="green"
              />
              <StatCard
                label="SKIPPED"
                value={uploadResult.skipped_count}
                icon="fa-forward"
                color={uploadResult.skipped_count > 0 ? 'yellow' : 'gray'}
              />
              <StatCard
                label="ERRORS"
                value={uploadResult.errors.length}
                icon="fa-xmark"
                color={uploadResult.errors.length > 0 ? 'red' : 'gray'}
              />
            </div>

            {/* 成功提示 */}
            {uploadResult.success && uploadResult.processed_count > 0 && (
              <div className="pixel-card border-pixel-green">
                <div className="p-4 bg-green-50">
                  <div className="flex items-center gap-2 font-pixel text-pixel-green text-lg">
                    <i className="fa-solid fa-trophy"></i>
                    <span>SUCCESS! {uploadResult.processed_count} QUESTIONS IMPORTED</span>
                  </div>
                  <p className="font-pixel text-sm text-green-600 mt-1">
                    DATA SAVED TO DATABASE
                  </p>
                </div>
              </div>
            )}

            {/* 错误详情 */}
            {uploadResult.errors.length > 0 && (
              <div className="pixel-card">
                <div className="pixel-card-header bg-pixel-red">
                  <span className="font-pixel text-white">
                    ERROR DETAILS ({uploadResult.errors.length})
                  </span>
                </div>
                <div className="divide-y-2 divide-pixel-gray-200 max-h-80 overflow-y-auto">
                  {uploadResult.errors.map((error, index) => (
                    <ErrorRow key={index} error={error} />
                  ))}
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-4">
              <button
                onClick={handleReset}
                className="pixel-btn-primary flex-1"
              >
                [ UPLOAD NEW ]
              </button>
              <Link
                to="/gallery"
                className="pixel-btn text-center flex-1"
              >
                [ GO TO GALLERY ]
              </Link>
            </div>
          </div>
        )}

        {/* 返回链接 */}
        <div className="mt-8 text-center">
          <Link to="/" className="font-pixel text-pixel-primary hover:text-pixel-secondary">
            [ BACK TO HOME ]
          </Link>
        </div>
      </main>

      {/* 底部状态栏 */}
      <footer className="pixel-statusbar">
        <span>MODE: UPLOAD</span>
        <span>FILE: {selectedFile?.name || 'NONE'}</span>
        <span>STATUS: {uploadStatus.toUpperCase()}</span>
      </footer>
    </div>
  )
}

// ============================================================================
// 子组件 - 像素风格
// ============================================================================

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: number
  icon: string
  color: 'green' | 'yellow' | 'red' | 'gray'
}) {
  const colorClasses = {
    green: 'bg-green-50 border-pixel-green text-pixel-green',
    yellow: 'bg-yellow-50 border-pixel-yellow text-yellow-700',
    red: 'bg-red-50 border-pixel-red text-pixel-red',
    gray: 'bg-pixel-gray-100 border-pixel-gray-300 text-pixel-gray-500',
  }

  return (
    <div className={`pixel-card p-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <i className={`fa-solid ${icon} text-2xl`}></i>
        <span className="font-pixel text-4xl">{value}</span>
      </div>
      <p className="font-pixel text-sm mt-2">{label}</p>
    </div>
  )
}

function ErrorRow({ error }: { error: UploadError }) {
  return (
    <div className="px-4 py-3 hover:bg-pixel-gray-100">
      <div className="flex items-start gap-3">
        <span className="bg-pixel-red text-white font-pixel text-xs px-2 py-1">
          {error.question}
        </span>
        <p className="font-pixel text-sm text-pixel-gray-600 flex-1 break-all">
          {error.reason}
        </p>
      </div>
    </div>
  )
}
