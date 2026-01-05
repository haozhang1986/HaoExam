import type { Question } from '../types/question'
import QuestionCard from './QuestionCard'

interface QuestionGridProps {
  questions: Question[]
  loading?: boolean
  onQuestionClick?: (question: Question) => void
}

export default function QuestionGrid({ questions, loading, onQuestionClick }: QuestionGridProps) {
  // 加载骨架屏 - 像素风格
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="pixel-card overflow-hidden">
            <div className="aspect-[4/3] bg-pixel-gray-200 border-b-4 border-pixel-dark animate-pulse" />
            <div className="p-4 space-y-3">
              <div className="h-4 bg-pixel-gray-200 w-3/4" />
              <div className="flex gap-2">
                <div className="h-6 bg-pixel-gray-200 w-16" />
                <div className="h-6 bg-pixel-gray-200 w-12" />
              </div>
              <div className="h-10 bg-pixel-gray-200 w-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // 空状态 - 像素风格
  if (questions.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="pixel-card inline-block p-8 shadow-pixel-lg">
          <i className="fa-solid fa-ghost text-6xl text-pixel-gray-400 mb-4 block"></i>
          <h3 className="font-pixel text-2xl text-pixel-dark mb-2">NO DATA FOUND</h3>
          <p className="font-pixel text-sm text-pixel-gray-500">TRY ADJUSTING YOUR FILTERS</p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {questions.map(question => (
        <QuestionCard
          key={question.id}
          question={question}
          onClick={onQuestionClick}
        />
      ))}
    </div>
  )
}
