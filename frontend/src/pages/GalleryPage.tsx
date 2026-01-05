import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import type { Question, QuestionQueryParams, FilterOptions } from '../types/question'
import { fetchQuestions, fetchFilterOptions } from '../services/api'
import QuestionGrid from '../components/QuestionGrid'
import MultiSelectFilter from '../components/MultiSelectFilter'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'
import {
  getPaperCodes,
  getTopicNamesByPaper,
  getSubtopicsByTopics,
  inferSubjectCode
} from '../utils/syllabus'

export default function GalleryPage() {
  // ========== 筛选选项状态 ==========
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    curriculums: [],
    subjects: [],
    papers: [],
    topics: [],
    subtopics: [],
    difficulties: [],
  })

  // ========== 单选筛选状态 ==========
  const [curriculum, setCurriculum] = useState<string>('')
  const [subject, setSubject] = useState<string>('')
  const [paper, setPaper] = useState<string>('')
  const [difficulty, setDifficulty] = useState<string>('')

  // ========== 多选筛选状态 ==========
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([])

  // ========== UI 状态 ==========
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // ========== 构建查询参数 ==========
  const buildQueryParams = useCallback((): QuestionQueryParams => {
    const params: QuestionQueryParams = {}
    if (curriculum) params.curriculum = curriculum
    if (subject) params.subject = subject
    if (paper) params.paper = paper
    if (difficulty) params.difficulty = difficulty
    if (selectedTopics.length > 0) params.topic = selectedTopics
    if (selectedSubtopics.length > 0) params.subtopic = selectedSubtopics
    return params
  }, [curriculum, subject, paper, difficulty, selectedTopics, selectedSubtopics])

  // ========== 无限滚动 ==========
  const fetchQuestionsWithFilters = useCallback(
    async (skip: number, limit: number) => {
      const params = buildQueryParams()
      return fetchQuestions({ ...params, skip, limit })
    },
    [buildQueryParams]
  )

  const {
    items: questions,
    loading,
    loadingMore,
    hasMore,
    reset: resetInfiniteScroll,
    sentinelRef
  } = useInfiniteScroll<Question>({
    fetchFn: fetchQuestionsWithFilters,
    limit: 20
  })

  // ========== 初始化：加载基础筛选选项 ==========
  useEffect(() => {
    fetchFilterOptions()
      .then(setFilterOptions)
      .catch(console.error)
  }, [])

  // ========== 级联 1: Subject 变化 → 从 Syllabus JSON 加载 Papers ==========
  // Schema-Driven: Paper 选项完全基于本地 Syllabus JSON，不依赖后端数据
  useEffect(() => {
    if (subject) {
      const subjectCode = inferSubjectCode(subject)
      if (subjectCode) {
        const papers = getPaperCodes(subjectCode)
        setFilterOptions(prev => ({ ...prev, papers }))
      } else {
        setFilterOptions(prev => ({ ...prev, papers: [] }))
      }
    } else {
      setFilterOptions(prev => ({ ...prev, papers: [] }))
    }
    setPaper('')
    setSelectedTopics([])
    setSelectedSubtopics([])
  }, [subject])

  // ========== 级联 2: Paper 变化 → 从 Syllabus JSON 加载 Topics ==========
  // Schema-Driven: Topic 选项完全基于本地 Syllabus JSON，不依赖后端数据
  useEffect(() => {
    if (subject && paper) {
      const subjectCode = inferSubjectCode(subject)
      if (subjectCode) {
        const topics = getTopicNamesByPaper(subjectCode, paper)
        setFilterOptions(prev => ({ ...prev, topics }))
      } else {
        setFilterOptions(prev => ({ ...prev, topics: [] }))
      }
    } else {
      setFilterOptions(prev => ({ ...prev, topics: [] }))
    }
    setSelectedTopics([])
    setSelectedSubtopics([])
  }, [subject, paper])

  // ========== 级联 3: Topics 变化 → 从 Syllabus JSON 查表获取 Subtopics ==========
  useEffect(() => {
    if (selectedTopics.length > 0 && paper) {
      const subjectCode = inferSubjectCode(subject || 'math')
      if (subjectCode) {
        const subtopics = getSubtopicsByTopics(subjectCode, paper, selectedTopics)
        setFilterOptions(prev => ({ ...prev, subtopics }))
        setSelectedSubtopics(prev => prev.filter(s => subtopics.includes(s)))
      } else {
        setFilterOptions(prev => ({ ...prev, subtopics: [] }))
      }
    } else {
      setFilterOptions(prev => ({ ...prev, subtopics: [] }))
      setSelectedSubtopics([])
    }
  }, [selectedTopics, paper, subject])

  // ========== 筛选条件变化 → 重置无限滚动 ==========
  // 注意: curriculum 从级联依赖中移除，现在主要使用 subject 作为起点
  useEffect(() => {
    resetInfiniteScroll()
  }, [curriculum, subject, paper, difficulty, selectedTopics, selectedSubtopics, resetInfiniteScroll])

  // ========== 清除所有筛选 ==========
  const clearFilters = () => {
    setCurriculum('')
    setSubject('')
    setPaper('')
    setDifficulty('')
    setSelectedTopics([])
    setSelectedSubtopics([])
  }

  // ========== 点击题目 ==========
  const handleQuestionClick = (question: Question) => {
    console.log('Question clicked:', question)
  }

  // ========== 筛选侧边栏 - 像素风格 ==========
  const FilterSidebar = () => (
    <div className="pixel-card">
      <div className="pixel-card-header bg-pixel-primary flex items-center justify-between">
        <h2 className="font-pixel text-xl text-white">FILTERS</h2>
        <button
          onClick={clearFilters}
          className="font-pixel text-sm text-white hover:text-pixel-yellow transition-colors"
        >
          [ CLEAR ]
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* 1. 课程体系 (单选) */}
        <FilterSelect
          label="CURRICULUM"
          value={curriculum}
          options={filterOptions.curriculums}
          onChange={setCurriculum}
        />

        {/* 2. 科目 (单选) */}
        <FilterSelect
          label="SUBJECT"
          value={subject}
          options={filterOptions.subjects}
          onChange={setSubject}
        />

        {/* 3. Paper (单选) */}
        <FilterSelect
          label="PAPER"
          value={paper}
          options={filterOptions.papers}
          onChange={setPaper}
          disabled={filterOptions.papers.length === 0}
          formatLabel={formatPaperLabel}
        />

        {/* 4. 主题 (多选) */}
        <MultiSelectFilter
          label="TOPIC"
          options={filterOptions.topics}
          selectedValues={selectedTopics}
          onChange={setSelectedTopics}
          placeholder="SELECT..."
          disabled={filterOptions.topics.length === 0}
        />

        {/* 5. 子主题 (多选) */}
        <MultiSelectFilter
          label="SUBTOPIC"
          options={filterOptions.subtopics}
          selectedValues={selectedSubtopics}
          onChange={setSelectedSubtopics}
          placeholder={selectedTopics.length === 0 ? 'SELECT TOPIC FIRST' : 'SELECT...'}
          disabled={selectedTopics.length === 0}
        />

        {/* 6. 难度 (单选) */}
        <FilterSelect
          label="DIFFICULTY"
          value={difficulty}
          options={filterOptions.difficulties}
          onChange={setDifficulty}
        />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-pixel-bg">
      {/* 像素风导航栏 */}
      <nav className="pixel-navbar">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <i className="fa-solid fa-gamepad text-2xl"></i>
                <span className="font-pixel text-2xl tracking-widest">HAOEXAM</span>
              </Link>
              <span className="font-pixel text-lg text-pixel-gray-500">/</span>
              <span className="font-pixel text-lg">GALLERY</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-pixel text-sm text-pixel-gray-600">
                {loading ? 'LOADING...' : `${questions.length} ITEMS${hasMore ? '+' : ''}`}
              </span>
              {/* 移动端筛选按钮 */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden pixel-btn text-sm py-1 px-3"
              >
                <i className="fa-solid fa-filter mr-2"></i>
                FILTER
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* 主内容区域 */}
      <main className="max-w-7xl mx-auto px-4 py-6 pt-24 pb-20">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* 侧边栏 */}
          <aside className={`lg:w-72 flex-shrink-0 ${sidebarOpen ? 'block' : 'hidden lg:block'}`}>
            <FilterSidebar />
          </aside>

          {/* 题目网格 + 无限滚动 */}
          <div className="flex-1">
            <QuestionGrid
              questions={questions}
              loading={loading}
              onQuestionClick={handleQuestionClick}
            />

            {/* 无限滚动哨兵 */}
            <div ref={sentinelRef} className="h-4" />

            {/* 加载更多指示器 - 像素风格 */}
            {loadingMore && (
              <div className="flex justify-center py-8">
                <div className="pixel-card px-6 py-3">
                  <span className="font-pixel text-lg animate-blink">LOADING...</span>
                </div>
              </div>
            )}

            {/* 没有更多数据 */}
            {!hasMore && questions.length > 0 && (
              <div className="text-center py-8">
                <div className="pixel-card inline-block px-6 py-3">
                  <span className="font-pixel text-pixel-gray-500">
                    END OF DATA - {questions.length} ITEMS LOADED
                  </span>
                </div>
              </div>
            )}

            {/* 空状态 */}
            {!loading && questions.length === 0 && (
              <div className="text-center py-16">
                <div className="pixel-card inline-block p-8 shadow-pixel-lg">
                  <i className="fa-solid fa-inbox text-6xl text-pixel-gray-400 mb-4 block"></i>
                  <p className="font-pixel text-xl text-pixel-gray-600 mb-2">NO DATA FOUND</p>
                  <p className="font-pixel text-sm text-pixel-gray-400">TRY DIFFERENT FILTERS</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 底部状态栏 */}
      <footer className="pixel-statusbar">
        <span>MODE: GALLERY</span>
        <span>ITEMS: {questions.length}</span>
        <span>STATUS: {loading ? 'LOADING' : 'READY'}</span>
      </footer>
    </div>
  )
}

// 格式化 Paper 显示
function formatPaperLabel(paper: string): string {
  if (/^\d+$/.test(paper)) {
    return `P${paper}`
  }
  return paper
}

// 单选下拉框组件 - 像素风格
function FilterSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
  formatLabel,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
  disabled?: boolean
  formatLabel?: (option: string) => string
}) {
  return (
    <div>
      <label className="block font-pixel text-sm text-pixel-dark mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`pixel-select ${disabled ? 'bg-pixel-gray-200 cursor-not-allowed text-pixel-gray-400' : ''}`}
      >
        <option value="">ALL</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {formatLabel ? formatLabel(option) : option}
          </option>
        ))}
      </select>
    </div>
  )
}
