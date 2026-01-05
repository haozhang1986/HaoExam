/**
 * GeneratedResults - 生成结果组件
 *
 * 显示生成的题目网格，支持 Reroll 和添加到购物车
 */
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { getImageUrl } from '../../services/api'
import type { Question } from '../../types/question'

interface GeneratedQuestion {
  id: number
  question: Question | null
  topic: string
  subtopic: string
  difficulty: string
}

interface Props {
  questions: GeneratedQuestion[]
  onReroll: (id: number, topic: string, subtopic: string) => void
  onAddAllToCart: () => void
  isRerolling?: number | null // 正在 reroll 的题目 ID
}

// 难度颜色映射
const difficultyColors: Record<string, { bg: string; text: string }> = {
  Easy: { bg: 'bg-pixel-green', text: 'E' },
  Medium: { bg: 'bg-pixel-yellow', text: 'M' },
  Hard: { bg: 'bg-pixel-red', text: 'H' },
}

export default function GeneratedResults({
  questions,
  onReroll,
  onAddAllToCart,
  isRerolling,
}: Props) {
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // Lightbox Component
  const Lightbox = () => {
    if (!previewImage) return null

    return createPortal(
      <div
        className="fixed inset-0 z-[9999] bg-pixel-dark/95 flex items-center justify-center p-4"
        onClick={() => setPreviewImage(null)}
      >
        {/* Close Button */}
        <button
          className="absolute top-4 right-4 w-12 h-12 bg-pixel-red border-4 border-pixel-dark text-white font-pixel text-xl flex items-center justify-center hover:bg-red-600 transition-colors z-10"
          onClick={() => setPreviewImage(null)}
        >
          X
        </button>

        {/* Image */}
        <img
          src={previewImage}
          alt="Preview"
          className="max-w-full max-h-full object-contain"
          style={{ imageRendering: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>,
      document.body
    )
  }

  if (questions.length === 0) {
    return null
  }

  return (
    <>
      <Lightbox />

      <div className="pixel-card">
        {/* Header */}
        <div className="bg-pixel-cyan border-b-4 border-pixel-dark px-4 py-2 flex items-center justify-between">
          <h2 className="font-pixel text-xl text-white flex items-center gap-2">
            <i className="fa-solid fa-list-check"></i>
            RESULTS ({questions.length})
          </h2>
          <button
            onClick={onAddAllToCart}
            className="px-3 py-1 bg-pixel-white text-pixel-cyan border-2 border-pixel-dark font-pixel text-xs hover:bg-pixel-gray-100 transition-colors"
          >
            <i className="fa-solid fa-cart-plus mr-1"></i>
            ADD ALL
          </button>
        </div>

        {/* Question Grid */}
        <div className="max-h-[500px] overflow-y-auto p-3">
          <div className="grid grid-cols-2 gap-3">
            {questions.map((gq, idx) => {
              const diffStyle = difficultyColors[gq.question?.difficulty || gq.difficulty] ||
                difficultyColors.Medium

              return (
                <div
                  key={gq.id}
                  className={`relative border-4 border-pixel-dark bg-pixel-white overflow-hidden group ${
                    isRerolling === gq.id ? 'opacity-50' : ''
                  }`}
                >
                  {/* Question Number Badge */}
                  <div className="absolute top-0 left-0 z-10 w-7 h-7 bg-pixel-dark text-white font-pixel text-xs flex items-center justify-center">
                    {idx + 1}
                  </div>

                  {/* Difficulty Badge */}
                  <div
                    className={`absolute top-0 right-0 z-10 px-2 py-1 ${diffStyle.bg} border-l-2 border-b-2 border-pixel-dark`}
                  >
                    <span className="font-pixel text-xs text-white">{diffStyle.text}</span>
                  </div>

                  {/* Image Container */}
                  <div
                    className="aspect-[4/3] bg-pixel-gray-100 cursor-pointer relative overflow-hidden"
                    onClick={() => {
                      if (gq.question?.question_image_path) {
                        setPreviewImage(getImageUrl(gq.question.question_image_path))
                      }
                    }}
                  >
                    {gq.question?.question_image_path ? (
                      <img
                        src={getImageUrl(gq.question.question_image_path)}
                        alt={`Question ${gq.id}`}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-pixel-gray-300">
                        <i className="fa-solid fa-image text-3xl"></i>
                      </div>
                    )}

                    {/* Rerolling Spinner */}
                    {isRerolling === gq.id && (
                      <div className="absolute inset-0 bg-pixel-dark/50 flex items-center justify-center">
                        <i className="fa-solid fa-dice text-3xl text-white animate-spin"></i>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="p-2 bg-pixel-gray-100 border-t-2 border-pixel-gray-200">
                    <div className="flex items-center justify-between gap-1">
                      {/* Topic/Subtopic */}
                      <div className="flex-1 min-w-0">
                        <p
                          className="font-pixel text-[9px] text-pixel-gray-500 truncate"
                          title={gq.question?.topic || gq.topic || 'Unknown'}
                        >
                          {gq.question?.topic || gq.topic || 'Unknown'}
                        </p>
                      </div>

                      {/* Reroll Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onReroll(
                            gq.id,
                            gq.question?.topic || gq.topic || '',
                            gq.question?.subtopic?.toString() || gq.subtopic || ''
                          )
                        }}
                        disabled={isRerolling === gq.id}
                        className="w-7 h-7 bg-pixel-orange border-2 border-pixel-dark text-white flex items-center justify-center hover:bg-pixel-yellow transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                        title="Reroll this question"
                      >
                        <i className="fa-solid fa-dice text-xs"></i>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Stats Footer */}
        <div className="px-4 py-2 bg-pixel-gray-100 border-t-4 border-pixel-gray-200">
          <div className="flex justify-between font-pixel text-[10px] text-pixel-gray-500">
            <span>
              <i className="fa-solid fa-check-circle text-pixel-green mr-1"></i>
              {questions.filter((q) => q.question).length} LOADED
            </span>
            <span>
              <i className="fa-solid fa-dice mr-1"></i>
              CLICK DICE TO REROLL
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
