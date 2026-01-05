import { useState } from 'react'
import { usePaperStore } from '../store/paperStore'
import { downloadPdf } from '../services/api'

export default function PaperFloatingCart() {
  const [isOpen, setIsOpen] = useState(false)
  const [includeAnswers, setIncludeAnswers] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const { selectedQuestionIds, removeQuestion, clearAll } = usePaperStore()

  const count = selectedQuestionIds.length

  // 生成 PDF
  const handleGeneratePDF = async () => {
    if (count === 0) return

    setIsGenerating(true)
    setStatus(null)

    try {
      await downloadPdf(selectedQuestionIds, includeAnswers)
      setStatus({ type: 'success', message: 'DOWNLOAD STARTED!' })
    } catch (error) {
      console.error('PDF generation failed:', error)
      setStatus({ type: 'error', message: 'GENERATION FAILED' })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <>
      {/* 悬浮按钮 - 像素风格 */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-6 w-16 h-16 bg-pixel-primary border-4 border-pixel-dark shadow-pixel hover:translate-x-1 hover:translate-y-1 hover:shadow-none text-white flex items-center justify-center z-40 transition-all"
        aria-label="Open paper cart"
      >
        <i className="fa-solid fa-file-lines text-2xl"></i>

        {/* 数量徽章 */}
        {count > 0 && (
          <span className="absolute -top-2 -right-2 w-7 h-7 bg-pixel-red text-white text-xs font-pixel border-2 border-pixel-dark flex items-center justify-center animate-pulse">
            {count > 99 ? '99' : count}
          </span>
        )}
      </button>

      {/* 遮罩层 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-pixel-dark/80 z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 侧边抽屉 - 像素风格 */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-pixel-white border-l-4 border-pixel-dark z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* 抽屉头部 */}
        <div className="flex items-center justify-between p-4 border-b-4 border-pixel-dark bg-pixel-primary text-white">
          <h2 className="font-pixel text-xl flex items-center gap-2">
            <i className="fa-solid fa-file-lines"></i>
            PAPER CART
            <span className="bg-pixel-dark px-2 py-0.5 text-sm">
              {count}
            </span>
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="font-pixel text-xl hover:text-pixel-yellow transition-colors"
            aria-label="Close cart"
          >
            [ X ]
          </button>
        </div>

        {/* 抽屉内容 */}
        <div className="flex flex-col h-[calc(100%-240px)] overflow-hidden">
          {count === 0 ? (
            // 空状态
            <div className="flex-1 flex flex-col items-center justify-center text-pixel-gray-400 p-8">
              <i className="fa-solid fa-inbox text-6xl mb-4"></i>
              <p className="font-pixel text-lg">EMPTY CART</p>
              <p className="font-pixel text-sm mt-1">ADD QUESTIONS TO START</p>
            </div>
          ) : (
            // 题目列表
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {selectedQuestionIds.map((id, index) => (
                <div
                  key={id}
                  className="flex items-center justify-between bg-pixel-gray-100 border-2 border-pixel-dark p-3 hover:bg-pixel-gray-200 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 bg-pixel-primary text-white border-2 border-pixel-dark font-pixel text-sm flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="font-pixel text-pixel-dark">Q#{id}</span>
                  </div>
                  <button
                    onClick={() => removeQuestion(id)}
                    className="p-2 text-pixel-gray-400 hover:text-pixel-red hover:bg-pixel-red/10 transition-colors font-pixel"
                    aria-label={`Remove question ${id}`}
                  >
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 抽屉底部操作区 */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-pixel-white border-t-4 border-pixel-dark space-y-3">
          {/* Include Answers 复选框 */}
          {count > 0 && (
            <label className="flex items-center gap-3 cursor-pointer select-none p-2 border-2 border-pixel-dark hover:bg-pixel-gray-100 transition-colors">
              <input
                type="checkbox"
                checked={includeAnswers}
                onChange={(e) => setIncludeAnswers(e.target.checked)}
                className="w-5 h-5 border-2 border-pixel-dark accent-pixel-primary cursor-pointer"
              />
              <span className="font-pixel text-pixel-dark">INCLUDE ANSWERS</span>
            </label>
          )}

          {/* 状态提示 */}
          {status && (
            <div
              className={`font-pixel text-sm text-center py-2 px-3 border-2 border-pixel-dark ${
                status.type === 'success'
                  ? 'bg-pixel-green text-white'
                  : 'bg-pixel-red text-white'
              }`}
            >
              {status.message}
            </div>
          )}

          {/* Clear All 按钮 */}
          {count > 0 && (
            <button
              onClick={clearAll}
              className="w-full py-2 px-4 font-pixel text-pixel-gray-600 hover:text-pixel-red border-2 border-pixel-gray-300 hover:border-pixel-red transition-colors text-sm"
            >
              [ CLEAR ALL ]
            </button>
          )}

          {/* Generate PDF 按钮 */}
          <button
            onClick={handleGeneratePDF}
            disabled={count === 0 || isGenerating}
            className={`w-full py-3 px-4 font-pixel text-lg border-4 border-pixel-dark transition-all duration-100 flex items-center justify-center gap-2 ${
              count > 0 && !isGenerating
                ? 'bg-pixel-green text-white shadow-pixel hover:translate-x-1 hover:translate-y-1 hover:shadow-none'
                : 'bg-pixel-gray-200 text-pixel-gray-400 cursor-not-allowed'
            }`}
          >
            {isGenerating ? (
              <>
                <span className="animate-blink">GENERATING...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-download"></i>
                GENERATE PDF
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
