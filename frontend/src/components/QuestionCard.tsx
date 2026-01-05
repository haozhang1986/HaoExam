import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Question } from '../types/question'
import { getImageUrl } from '../services/api'
import { usePaperStore } from '../store/paperStore'

interface QuestionCardProps {
  question: Question
  onClick?: (question: Question) => void
}

export default function QuestionCard({ question, onClick }: QuestionCardProps) {
  const [showAnswer, setShowAnswer] = useState(false)
  const [imageError, setImageError] = useState(false)

  // Lightbox 全屏预览状态
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // 打开预览
  const handlePreview = (imgUrl: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setPreviewImage(imgUrl)
    document.body.style.overflow = 'hidden'
  }

  // 关闭预览
  const closePreview = () => {
    setPreviewImage(null)
    document.body.style.overflow = 'auto'
  }

  // 试卷篮状态
  const { toggleQuestion, isSelected } = usePaperStore()
  const inPaper = isSelected(question.id)

  // 添加/移除试卷篮
  const handleTogglePaper = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleQuestion(question.id)
  }

  // 检查答案是否可用 (文本答案或图片答案)
  const hasTextAnswer = !!question.answer_text
  const hasImageAnswer = question.answer_image_path &&
    question.answer_image_path !== 'hidden' &&
    question.answer_image_path !== 'text_answer'
  const isAnswerAvailable = hasTextAnswer || hasImageAnswer

  const handleClick = () => {
    if (onClick) {
      onClick(question)
    }
  }

  const toggleAnswer = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isAnswerAvailable && !showAnswer) {
      return
    }
    setShowAnswer(!showAnswer)
  }

  // 构建题目标识信息
  const getQuestionLabel = () => {
    const parts: string[] = []
    if (question.curriculum) parts.push(question.curriculum)
    if (question.subject) parts.push(question.subject)
    if (question.year) parts.push(String(question.year))
    if (question.season) parts.push(question.season)
    if (question.paper_number) parts.push(`P${question.paper_number}`)
    if (question.question_number) parts.push(`Q${question.question_number}`)
    return parts.join(' / ')
  }

  // 解析 subtopic
  const getSubtopics = (): string[] => {
    if (!question.subtopic) return []
    const subtopicStr = String(question.subtopic)
    if (subtopicStr.startsWith('[')) {
      try {
        const parsed = JSON.parse(subtopicStr)
        if (Array.isArray(parsed)) return parsed
      } catch {
        // 解析失败，当作普通字符串
      }
    }
    return [subtopicStr]
  }

  // Lightbox 组件 - 使用 Portal 渲染到 body
  const Lightbox = () => {
    if (!previewImage) return null

    return createPortal(
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-pixel-dark/95"
        onClick={closePreview}
      >
        {/* 关闭按钮 - 像素风格 */}
        <button
          className="absolute top-4 right-4 bg-pixel-red text-white font-pixel text-2xl px-4 py-2 border-4 border-pixel-dark shadow-pixel hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all z-10"
          onClick={closePreview}
        >
          [ X ]
        </button>

        {/* 图片容器 */}
        <div className="relative max-w-7xl max-h-screen p-4">
          <div className="border-4 border-pixel-dark bg-pixel-white p-2 shadow-pixel-lg">
            <img
              src={previewImage}
              alt="Full Preview"
              className="max-w-full max-h-[85vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        {/* 底部提示 */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 font-pixel text-pixel-green text-lg">
          CLICK ANYWHERE TO CLOSE
        </div>
      </div>,
      document.body
    )
  }

  return (
    <>
      <div
        className="pixel-card overflow-hidden hover:-translate-y-1 hover:shadow-pixel-lg transition-all duration-200 cursor-pointer relative group"
        onClick={handleClick}
      >
        {/* 悬浮显示 ID 标签 - 像素风格 */}
        <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <span className="px-2 py-1 bg-pixel-dark text-pixel-green text-xs font-mono border-2 border-pixel-green">
            ID: {question.id}
          </span>
        </div>

        {/* 题目图片区域 */}
        <div className="relative aspect-[4/3] bg-pixel-gray-200 border-b-4 border-pixel-dark">
          {showAnswer && !isAnswerAvailable ? (
            // 答案不可用时显示锁定状态
            <div className="w-full h-full flex items-center justify-center text-pixel-gray-500">
              <div className="text-center">
                <i className="fa-solid fa-lock text-4xl mb-2 block"></i>
                <span className="font-pixel text-lg">LOCKED</span>
              </div>
            </div>
          ) : showAnswer && hasTextAnswer ? (
            // 优先显示文本答案 (像素风大字母)
            <div className="w-full h-full flex items-center justify-center bg-pixel-gray-100">
              <div className="flex flex-col items-center justify-center p-8 bg-pixel-white border-4 border-pixel-dark shadow-pixel">
                <span className="font-pixel text-sm text-pixel-gray-500 mb-2 uppercase tracking-widest">Answer</span>
                <span
                  className="text-8xl font-bold font-pixel text-pixel-primary leading-none"
                  style={{
                    textShadow: '4px 4px 0px #1a1a2e, -2px -2px 0px #fff',
                    letterSpacing: '0.1em'
                  }}
                >
                  {question.answer_text}
                </span>
              </div>
            </div>
          ) : !imageError ? (
            // 显示图片 (题目或答案图片)
            <img
              src={getImageUrl(showAnswer ? question.answer_image_path : question.question_image_path)}
              alt={showAnswer ? '答案' : '题目'}
              className="w-full h-full object-contain cursor-zoom-in hover:opacity-90 transition-opacity"
              onError={() => setImageError(true)}
              onClick={(e) => handlePreview(
                getImageUrl(showAnswer ? question.answer_image_path : question.question_image_path),
                e
              )}
            />
          ) : (
            // 图片加载错误
            <div className="w-full h-full flex items-center justify-center text-pixel-gray-500">
              <div className="text-center">
                <i className="fa-solid fa-image-slash text-4xl mb-2 block"></i>
                <span className="font-pixel text-sm">LOAD ERROR</span>
              </div>
            </div>
          )}

          {/* 显示/隐藏答案按钮 - 像素按钮风格 */}
          <button
            onClick={toggleAnswer}
            className={`absolute bottom-2 right-2 px-3 py-1 text-sm font-pixel uppercase border-2 border-pixel-dark transition-all duration-100 ${
              showAnswer
                ? 'bg-pixel-primary text-white shadow-pixel-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none'
                : isAnswerAvailable
                ? 'bg-pixel-white text-pixel-dark shadow-pixel-sm hover:bg-pixel-yellow hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none'
                : 'bg-pixel-gray-300 text-pixel-gray-500 cursor-not-allowed'
            }`}
            disabled={!isAnswerAvailable && !showAnswer}
          >
            {showAnswer ? '[ QUEST ]' : isAnswerAvailable ? '[ ANSWER ]' : '[ LOCKED ]'}
          </button>
        </div>

        {/* 题目信息区域 */}
        <div className="p-4 bg-pixel-white">
          {/* 题目标签 */}
          <p className="text-sm font-mono text-pixel-gray-600 mb-2 truncate border-b-2 border-dashed border-pixel-gray-300 pb-2" title={getQuestionLabel()}>
            {getQuestionLabel() || `#${question.id}`}
          </p>

          {/* 主题和子主题标签 - 像素标签风格 */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {question.topic && (
              <span className="pixel-tag-blue">
                {question.topic}
              </span>
            )}
            {getSubtopics().map((subtopic, index) => (
              <span
                key={index}
                className="pixel-tag bg-indigo-100 text-indigo-800"
              >
                {subtopic}
              </span>
            ))}
          </div>

          {/* 其他标签 */}
          {question.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap mb-3">
              {question.tags.slice(0, 3).map(tag => (
                <span
                  key={tag.id}
                  className="px-2 py-0.5 bg-pixel-gray-100 text-pixel-gray-600 border border-pixel-gray-300 text-xs font-mono"
                >
                  {tag.name}
                </span>
              ))}
              {question.tags.length > 3 && (
                <span className="text-xs text-pixel-gray-400 font-pixel">+{question.tags.length - 3}</span>
              )}
            </div>
          )}

          {/* 添加到试卷篮按钮 - 像素按钮风格 */}
          <button
            onClick={handleTogglePaper}
            className={`w-full py-2 px-4 text-sm font-pixel uppercase border-4 border-pixel-dark transition-all duration-100 flex items-center justify-center gap-2 ${
              inPaper
                ? 'bg-pixel-red text-white shadow-pixel hover:translate-x-1 hover:translate-y-1 hover:shadow-none'
                : 'bg-pixel-primary text-white shadow-pixel hover:translate-x-1 hover:translate-y-1 hover:shadow-none'
            }`}
          >
            {inPaper ? (
              <>
                <i className="fa-solid fa-check"></i>
                REMOVE
              </>
            ) : (
              <>
                <i className="fa-solid fa-plus"></i>
                ADD TO PAPER
              </>
            )}
          </button>
        </div>
      </div>

      {/* Lightbox - 通过 Portal 渲染到 body */}
      <Lightbox />
    </>
  )
}
