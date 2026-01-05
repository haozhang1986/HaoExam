/**
 * ImagePasteBox 组件 - 像素风格
 * 支持多张图片上传、粘贴、拖放，最终拼接成一张图片
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { uploadImages, getImageUrl } from '../services/api'

interface ImagePasteBoxProps {
  label: string
  currentImage: string | null
  onImageUploaded: (path: string) => void
  disabled?: boolean
}

interface PendingImage {
  id: string
  file: File
  previewUrl: string
}

export default function ImagePasteBox({
  label,
  currentImage,
  onImageUploaded,
  disabled = false
}: ImagePasteBoxProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 获取 token
  const getToken = useCallback(() => {
    return localStorage.getItem('auth_token') || ''
  }, [])

  // 清理预览 URL
  useEffect(() => {
    return () => {
      pendingImages.forEach(img => URL.revokeObjectURL(img.previewUrl))
    }
  }, [pendingImages])

  // 添加图片到待上传列表
  const addImage = useCallback((file: File) => {
    if (disabled) return

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      setError('INVALID FILE TYPE')
      return
    }

    // 验证文件大小 (最大 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('FILE TOO LARGE (MAX 5MB)')
      return
    }

    setError(null)
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
    const previewUrl = URL.createObjectURL(file)
    setPendingImages(prev => [...prev, { id, file, previewUrl }])
  }, [disabled])

  // 添加多张图片
  const addImages = useCallback((files: File[]) => {
    files.forEach(file => addImage(file))
  }, [addImage])

  // 移除待上传图片
  const removeImage = useCallback((id: string) => {
    setPendingImages(prev => {
      const img = prev.find(i => i.id === id)
      if (img) {
        URL.revokeObjectURL(img.previewUrl)
      }
      return prev.filter(i => i.id !== id)
    })
  }, [])

  // 清空所有待上传图片
  const clearPendingImages = useCallback(() => {
    pendingImages.forEach(img => URL.revokeObjectURL(img.previewUrl))
    setPendingImages([])
  }, [pendingImages])

  // 上传并拼接图片
  const handleUpload = useCallback(async () => {
    if (disabled || pendingImages.length === 0) return

    setUploading(true)
    setError(null)

    try {
      const token = getToken()
      if (!token) {
        setError('LOGIN REQUIRED')
        return
      }

      const files = pendingImages.map(img => img.file)
      const result = await uploadImages(files, token)
      onImageUploaded(result.path)
      clearPendingImages()
    } catch (err: unknown) {
      console.error('Upload failed:', err)
      const errorMessage = err instanceof Error ? err.message : 'UPLOAD FAILED'
      setError(errorMessage)
    } finally {
      setUploading(false)
    }
  }, [disabled, pendingImages, getToken, onImageUploaded, clearPendingImages])

  // 处理文件选择
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      addImages(files)
    }
    e.target.value = ''
  }, [addImages])

  // 处理点击
  const handleClick = useCallback(() => {
    if (!disabled && !uploading) {
      fileInputRef.current?.click()
    }
  }, [disabled, uploading])

  // 处理粘贴事件
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handlePaste = async (e: ClipboardEvent) => {
      if (disabled || uploading) return

      const items = e.clipboardData?.items
      if (!items) return

      const imageFiles: File[] = []
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            imageFiles.push(file)
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault()
        addImages(imageFiles)
      }
    }

    container.addEventListener('paste', handlePaste)
    return () => container.removeEventListener('paste', handlePaste)
  }, [disabled, uploading, addImages])

  // 处理拖放
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled && !uploading) {
      setDragOver(true)
    }
  }, [disabled, uploading])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)

    if (disabled || uploading) return

    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (files.length > 0) {
      addImages(files)
    }
  }, [disabled, uploading, addImages])

  // 有待上传图片时的渲染
  const hasPendingImages = pendingImages.length > 0

  return (
    <div className="space-y-2">
      {/* 标签 */}
      {label && <label className="block font-pixel text-sm text-pixel-dark">{label}</label>}

      {/* 上传区域 - 像素风格 */}
      <div
        ref={containerRef}
        tabIndex={0}
        onClick={hasPendingImages ? undefined : handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-4 border-dashed p-4 text-center
          transition-all duration-200 outline-none
          ${disabled ? 'bg-pixel-gray-200 cursor-not-allowed border-pixel-gray-300' : ''}
          ${dragOver ? 'border-pixel-primary bg-blue-50' : 'border-pixel-dark hover:border-pixel-primary'}
          ${uploading ? 'animate-pulse' : ''}
          ${hasPendingImages ? '' : 'cursor-pointer'}
          focus:border-pixel-primary focus:bg-blue-50
        `}
      >
        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />

        {/* 内容区域 */}
        {hasPendingImages ? (
          // 显示待上传图片列表
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-pixel text-sm text-pixel-dark">
                {pendingImages.length} IMAGE(S) READY
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  fileInputRef.current?.click()
                }}
                className="font-pixel text-xs bg-pixel-gray-200 text-pixel-dark px-2 py-1 border-2 border-pixel-dark hover:bg-pixel-gray-300"
              >
                + ADD MORE
              </button>
            </div>

            {/* 图片预览列表 */}
            <div className="flex flex-wrap gap-2 justify-center">
              {pendingImages.map((img, index) => (
                <div key={img.id} className="relative group">
                  <div className="border-2 border-pixel-dark bg-white p-1 w-20 h-20 flex items-center justify-center">
                    <img
                      src={img.previewUrl}
                      alt={`Preview ${index + 1}`}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeImage(img.id)
                    }}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-pixel-red text-white font-pixel text-xs border-2 border-pixel-dark flex items-center justify-center hover:bg-red-600"
                  >
                    X
                  </button>
                  <span className="absolute bottom-0 left-0 bg-pixel-dark text-white font-pixel text-xs px-1">
                    {index + 1}
                  </span>
                </div>
              ))}
            </div>

            {/* 拼接提示 */}
            <p className="font-pixel text-xs text-pixel-gray-500">
              IMAGES WILL BE STITCHED VERTICALLY (RIGHT-ALIGNED)
            </p>

            {/* 操作按钮 */}
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  clearPendingImages()
                }}
                className="font-pixel text-sm bg-pixel-gray-200 text-pixel-dark px-3 py-1 border-2 border-pixel-dark hover:bg-pixel-gray-300"
                disabled={uploading}
              >
                CLEAR
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleUpload()
                }}
                className="font-pixel text-sm bg-pixel-green text-white px-3 py-1 border-2 border-pixel-dark hover:bg-green-600"
                disabled={uploading}
              >
                {uploading ? 'UPLOADING...' : 'UPLOAD & STITCH'}
              </button>
            </div>
          </div>
        ) : currentImage ? (
          // 显示已上传的图片预览
          <div className="space-y-2">
            <div className="border-4 border-pixel-dark inline-block bg-pixel-white p-1">
              <img
                src={getImageUrl(currentImage)}
                alt={label}
                className="max-h-40 mx-auto object-contain"
              />
            </div>
            <p className="font-pixel text-xs text-pixel-gray-500">
              CLICK OR PASTE (CTRL+V) TO REPLACE
            </p>
            <p className="font-pixel text-xs text-pixel-gray-400">
              SUPPORTS MULTIPLE IMAGES
            </p>
          </div>
        ) : uploading ? (
          // 上传中状态
          <div className="py-8">
            <i className="fa-solid fa-spinner text-4xl text-pixel-primary animate-spin block mb-2"></i>
            <p className="font-pixel text-sm text-pixel-gray-500">UPLOADING...</p>
          </div>
        ) : (
          // 空状态
          <div className="py-8">
            <i className="fa-solid fa-images text-4xl text-pixel-gray-400 block mb-2"></i>
            <p className="font-pixel text-sm text-pixel-gray-600">
              CLICK OR PASTE IMAGE(S) (CTRL+V)
            </p>
            <p className="font-pixel text-xs text-pixel-gray-400 mt-1">
              SUPPORTS MULTIPLE IMAGES - WILL BE STITCHED
            </p>
            <p className="font-pixel text-xs text-pixel-gray-400">
              JPG / PNG / WEBP - MAX 5MB EACH
            </p>
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="font-pixel text-sm text-pixel-red border-2 border-pixel-red bg-red-50 px-3 py-2">
          <i className="fa-solid fa-exclamation-triangle mr-2"></i>
          {error}
        </div>
      )}
    </div>
  )
}
