/**
 * GeneratorPage - 智能组卷页面
 *
 * 三段式控制台：
 * - Area A: 难度均衡器 (DifficultyEqualizer)
 * - Area B: 知识点混合器 (TopicMixer)
 * - Area C: 生成与预览 (GeneratedResults)
 */
import { useState, useEffect, useCallback } from 'react'
import { useGeneratorStore } from '../store/generatorStore'
import { usePaperStore } from '../store/paperStore'
import { useAuthStore } from '../store/authStore'
import {
  getPaperCodes,
  getTopicsByPaper,
  subjectCodeToName,
} from '../utils/syllabus'
import {
  generateSmartExam,
  rerollQuestion,
  fetchQuestionsByIds,
  type SmartGeneratorPayload,
} from '../services/api'
import DifficultyEqualizer from '../components/generator/DifficultyEqualizer'
import TopicMixer from '../components/generator/TopicMixer'
import GeneratedResults from '../components/generator/GeneratedResults'
import Navbar from '../components/Navbar'

// 可用科目列表
const availableSubjects = ['9709', '9701', '9702', '9708']

export default function GeneratorPage() {
  const {
    subjectCode,
    paper,
    totalQuestions,
    topicWeights,
    difficultyRatio,
    generatedQuestions,
    isGenerating,
    error,
    setSubjectCode,
    setPaper,
    setTotalQuestions,
    initializeTopics,
    setGeneratedQuestions,
    setIsGenerating,
    setError,
    replaceQuestion,
    reorderQuestions,
  } = useGeneratorStore()

  const { addQuestions } = usePaperStore()
  const { token } = useAuthStore()

  const [availablePapers, setAvailablePapers] = useState<string[]>([])
  const [rerollingId, setRerollingId] = useState<number | null>(null)

  // 当科目变化时，加载 Papers
  useEffect(() => {
    if (subjectCode) {
      const papers = getPaperCodes(subjectCode)
      setAvailablePapers(papers)
    } else {
      setAvailablePapers([])
    }
  }, [subjectCode])

  // 当 Paper 变化时，加载 Topics
  useEffect(() => {
    if (subjectCode && paper) {
      const topics = getTopicsByPaper(subjectCode, paper)
      initializeTopics(topics)
    }
  }, [subjectCode, paper, initializeTopics])

  // 生成试卷
  const handleGenerate = useCallback(async () => {
    if (!subjectCode || !paper || topicWeights.length === 0) {
      setError('Please select subject, paper, and configure topics')
      return
    }

    // 前端预验证: 检查 Topic 权重总和
    const totalTopicWeight = topicWeights.reduce((sum, tw) => sum + tw.weight, 0)
    if (totalTopicWeight === 0) {
      setError('Topic weights cannot all be 0%. Please set at least one topic weight.')
      return
    }
    if (totalTopicWeight !== 100) {
      setError(`Topic weights must sum to 100% (currently ${totalTopicWeight}%). Use FIX button to normalize.`)
      return
    }

    // 前端预验证: 检查难度比例总和
    const totalDifficulty = difficultyRatio.Easy + difficultyRatio.Medium + difficultyRatio.Hard
    if (totalDifficulty !== 100) {
      setError(`Difficulty ratio must sum to 100% (currently ${totalDifficulty}%).`)
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const payload: SmartGeneratorPayload = {
        subject_code: subjectCode,
        paper: paper,
        total_questions: totalQuestions,
        topic_weights: topicWeights.map((tw) => ({
          topic: tw.topic,
          weight: tw.weight,
          subtopics: tw.subtopics.map((sw) => ({
            subtopic: sw.subtopic,
            weight: sw.weight,
          })),
        })),
        difficulty_ratio: difficultyRatio,
      }

      const result = await generateSmartExam(payload, token || '')

      if (result.success && result.question_ids.length > 0) {
        // 获取完整的题目数据
        const questions = await fetchQuestionsByIds(result.question_ids)

        const generated = result.question_ids.map((id) => {
          const q = questions.find((q) => q.id === id)
          return {
            id,
            question: q || null,
            topic: q?.topic || '',
            subtopic: q?.subtopic?.toString() || '',
            difficulty: q?.difficulty || 'Medium',
          }
        })

        setGeneratedQuestions(generated)

        if (result.unfilled_slots.length > 0) {
          setError(`Warning: ${result.unfilled_slots.length} slots could not be filled`)
        }
      } else {
        setError(result.message || 'Generation failed - no questions found')
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Generation failed'
      setError(errorMessage)
    } finally {
      setIsGenerating(false)
    }
  }, [
    subjectCode,
    paper,
    totalQuestions,
    topicWeights,
    difficultyRatio,
    token,
    setIsGenerating,
    setError,
    setGeneratedQuestions,
  ])

  // 重新抽取单题
  const handleReroll = useCallback(
    async (questionId: number, topic: string, subtopic: string) => {
      setRerollingId(questionId)

      try {
        const excludeIds = generatedQuestions.map((gq) => gq.id)

        const result = await rerollQuestion({
          question_id: questionId,
          subject_code: subjectCode,
          paper: paper,
          topic,
          subtopic,
          exclude_ids: excludeIds,
        }, token || '')

        if (result.success && result.new_question_id) {
          const [newQuestion] = await fetchQuestionsByIds([result.new_question_id])
          if (newQuestion) {
            replaceQuestion(questionId, result.new_question_id, newQuestion)
          }
        } else {
          setError(result.message || 'No alternative questions available')
        }
      } catch (e) {
        console.error('Reroll failed:', e)
        setError('Reroll failed')
      } finally {
        setRerollingId(null)
      }
    },
    [subjectCode, paper, generatedQuestions, replaceQuestion, setError, token]
  )

  // 添加所有到购物车
  const handleAddAllToCart = useCallback(() => {
    const ids = generatedQuestions.map((gq) => gq.id)
    addQuestions(ids)
  }, [generatedQuestions, addQuestions])

  return (
    <div className="min-h-screen bg-pixel-bg">
      {/* Global Navbar */}
      <Navbar currentPage="GENERATOR" />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 pt-24 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Configuration */}
          <div className="lg:col-span-2 space-y-6">
            {/* Exam Setup Card */}
            <div className="pixel-card">
              <div className="bg-pixel-primary border-b-4 border-pixel-dark px-4 py-2">
                <h2 className="font-pixel text-xl text-white flex items-center gap-2">
                  <i className="fa-solid fa-cog"></i>
                  EXAM SETUP
                </h2>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Subject */}
                <div>
                  <label className="block font-pixel text-xs text-pixel-gray-500 mb-1">
                    SUBJECT
                  </label>
                  <select
                    value={subjectCode}
                    onChange={(e) => setSubjectCode(e.target.value)}
                    className="pixel-select w-full"
                  >
                    <option value="">SELECT...</option>
                    {availableSubjects.map((code) => (
                      <option key={code} value={code}>
                        {subjectCodeToName[code] || code}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Paper */}
                <div>
                  <label className="block font-pixel text-xs text-pixel-gray-500 mb-1">
                    PAPER
                  </label>
                  <select
                    value={paper}
                    onChange={(e) => setPaper(e.target.value)}
                    className="pixel-select w-full"
                    disabled={!subjectCode}
                  >
                    <option value="">SELECT...</option>
                    {availablePapers.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Total Questions */}
                <div>
                  <label className="block font-pixel text-xs text-pixel-gray-500 mb-1">
                    QUESTIONS
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={totalQuestions}
                    onChange={(e) => setTotalQuestions(parseInt(e.target.value) || 10)}
                    className="pixel-input w-full text-center"
                  />
                </div>
              </div>
            </div>

            {/* Difficulty Equalizer */}
            <DifficultyEqualizer />

            {/* Topic Mixer */}
            <TopicMixer />
          </div>

          {/* Right Column: Generate & Results */}
          <div className="space-y-6">
            {/* Generate Button Card */}
            <div className="pixel-card p-4">
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !subjectCode || !paper || topicWeights.length === 0}
                className={`w-full py-5 font-pixel text-xl border-4 border-pixel-dark transition-all duration-100 ${
                  isGenerating || !subjectCode || !paper || topicWeights.length === 0
                    ? 'bg-pixel-gray-200 text-pixel-gray-400 cursor-not-allowed'
                    : 'bg-pixel-green text-white shadow-pixel-lg hover:translate-x-1 hover:translate-y-1 hover:shadow-pixel'
                }`}
              >
                {isGenerating ? (
                  <span className="animate-pulse">
                    <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                    GENERATING...
                  </span>
                ) : (
                  <>
                    <i className="fa-solid fa-wand-magic-sparkles mr-2"></i>
                    GENERATE EXAM
                  </>
                )}
              </button>

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-3 bg-pixel-red/10 border-2 border-pixel-red">
                  <p className="font-pixel text-xs text-pixel-red flex items-start gap-2">
                    <i className="fa-solid fa-exclamation-triangle mt-0.5"></i>
                    <span>{error}</span>
                  </p>
                </div>
              )}

              {/* Quick Stats */}
              {!isGenerating && subjectCode && paper && topicWeights.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-pixel-gray-100 border border-pixel-gray-200">
                    <p className="font-pixel text-[10px] text-pixel-gray-500">TOPICS</p>
                    <p className="font-pixel text-lg text-pixel-dark">
                      {topicWeights.filter((t) => t.weight > 0).length}
                    </p>
                  </div>
                  <div className="p-2 bg-pixel-gray-100 border border-pixel-gray-200">
                    <p className="font-pixel text-[10px] text-pixel-gray-500">QUESTIONS</p>
                    <p className="font-pixel text-lg text-pixel-dark">{totalQuestions}</p>
                  </div>
                  <div className="p-2 bg-pixel-gray-100 border border-pixel-gray-200">
                    <p className="font-pixel text-[10px] text-pixel-gray-500">MIX</p>
                    <p className="font-pixel text-lg text-pixel-dark">
                      {difficultyRatio.Easy}/{difficultyRatio.Medium}/{difficultyRatio.Hard}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Results */}
            <GeneratedResults
              questions={generatedQuestions}
              onReroll={handleReroll}
              onAddAllToCart={handleAddAllToCart}
              onReorder={reorderQuestions}
              isRerolling={rerollingId}
            />
          </div>
        </div>
      </main>

      {/* Status Bar */}
      <footer className="pixel-statusbar">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center">
          <span className="flex items-center gap-2">
            <i className="fa-solid fa-wand-magic-sparkles"></i>
            MODE: GENERATOR
          </span>
          <span>
            SUBJECT: {subjectCode ? subjectCodeToName[subjectCode] || subjectCode : '---'}
          </span>
          <span>PAPER: {paper || '---'}</span>
          <span>
            <i className="fa-solid fa-list-ol mr-1"></i>
            {generatedQuestions.length} GENERATED
          </span>
        </div>
      </footer>
    </div>
  )
}
