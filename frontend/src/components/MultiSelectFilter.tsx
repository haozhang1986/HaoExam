import { useState, useRef, useEffect } from 'react'

interface MultiSelectFilterProps {
  label: string
  options: string[]
  selectedValues: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  disabled?: boolean
}

export default function MultiSelectFilter({
  label,
  options,
  selectedValues,
  onChange,
  placeholder = 'ALL',
  disabled = false
}: MultiSelectFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭下拉
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleOption = (option: string) => {
    if (selectedValues.includes(option)) {
      onChange(selectedValues.filter(v => v !== option))
    } else {
      onChange([...selectedValues, option])
    }
  }

  const clearAll = () => {
    onChange([])
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block font-pixel text-sm text-pixel-dark mb-1">
          {label}
        </label>
      )}

      {/* 触发按钮 - 像素风格 */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-2 border-4 border-pixel-dark text-left font-pixel text-base flex justify-between items-center transition-all
          ${disabled
            ? 'bg-pixel-gray-200 cursor-not-allowed text-pixel-gray-400'
            : 'bg-pixel-white hover:bg-pixel-gray-100'}
          ${isOpen ? 'shadow-none translate-x-1 translate-y-1' : 'shadow-pixel-sm'}`}
      >
        <span className={selectedValues.length === 0 ? 'text-pixel-gray-400' : 'text-pixel-dark'}>
          {selectedValues.length === 0
            ? placeholder
            : `${selectedValues.length} SELECTED`}
        </span>
        <i className={`fa-solid fa-caret-down transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
      </button>

      {/* 下拉面板 - 像素风格 */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-pixel-white border-4 border-pixel-dark shadow-pixel max-h-60 overflow-auto">
          {/* 清除按钮 */}
          {selectedValues.length > 0 && (
            <button
              onClick={clearAll}
              className="w-full px-4 py-2 font-pixel text-sm text-pixel-primary hover:bg-pixel-gray-100 text-left border-b-2 border-pixel-gray-200"
            >
              [ CLEAR ALL ]
            </button>
          )}

          {/* 选项列表 */}
          {options.length > 0 ? (
            options.map(option => (
              <label
                key={option}
                className="flex items-center px-4 py-2 hover:bg-pixel-gray-100 cursor-pointer border-b border-pixel-gray-100 last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option)}
                  onChange={() => toggleOption(option)}
                  className="w-5 h-5 border-2 border-pixel-dark accent-pixel-primary cursor-pointer"
                />
                <span className="ml-3 font-pixel text-sm text-pixel-dark">{option}</span>
              </label>
            ))
          ) : (
            <div className="px-4 py-3 font-pixel text-sm text-pixel-gray-400 text-center">
              NO OPTIONS
            </div>
          )}
        </div>
      )}

      {/* 已选标签展示 - 像素风格 */}
      {selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedValues.map(value => (
            <span
              key={value}
              className="inline-flex items-center px-2 py-1 border-2 border-pixel-dark bg-pixel-primary text-white font-pixel text-xs"
            >
              <span className="max-w-[100px] truncate">{value}</span>
              <button
                onClick={() => toggleOption(value)}
                className="ml-1 hover:text-pixel-yellow"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
