/**
 * Question Studio (题目工坊) 页面 - 像素风格
 * 用于手动创建和编辑题目
 */
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import ImagePasteBox from '../components/ImagePasteBox'
import MultiSelectFilter from '../components/MultiSelectFilter'
import Navbar from '../components/Navbar'
import { useAuthStore } from '../store/authStore'
import {
  fetchQuestionByIdDirect,
  createStudioQuestion,
  updateQuestion,
  type StudioQuestionPayload
} from '../services/api'
import {
  getAvailableSubjectCodes,
  getPaperCodes,
  getTopicNamesByPaper,
  getSubtopicsByTopics,
  getQuestionTypesByPaper,
  subjectCodeToName,
} from '../utils/syllabus'

type Mode = 'create' | 'edit'

// 难度选项
const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard']

// 课程体系选项
const CURRICULUM_OPTIONS = ['CIE', 'Edexcel', 'AP']

export default function StudioPage() {
  // 从全局 store 获取 token
  const { token } = useAuthStore()

  // ==================== 模式和题目状态 ====================
  const [mode, setMode] = useState<Mode>('create')
  const [questionId, setQuestionId] = useState<number | null>(null)

  // ==================== 搜索状态 ====================
  const [searchId, setSearchId] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // ==================== 图片状态 ====================
  const [questionImagePath, setQuestionImagePath] = useState<string | null>(null)
  const [answerImagePath, setAnswerImagePath] = useState<string | null>(null)

  // ==================== 答案模式状态 ====================
  const [answerMode, setAnswerMode] = useState<'image' | 'text'>('image')
  const [answerText, setAnswerText] = useState<string>('')

  // ==================== 元数据状态 ====================
  const [curriculum, setCurriculum] = useState('CIE')
  const [subjectCode, setSubjectCode] = useState('')
  const [paper, setPaper] = useState('')
  const [topic, setTopic] = useState('')
  const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([])
  const [questionType, setQuestionType] = useState('')
  const [difficulty, setDifficulty] = useState('Medium')

  // ==================== 选项列表 ====================
  const [subjectOptions] = useState(getAvailableSubjectCodes())
  const [paperOptions, setPaperOptions] = useState<string[]>([])
  const [topicOptions, setTopicOptions] = useState<string[]>([])
  const [subtopicOptions, setSubtopicOptions] = useState<string[]>([])
  const [questionTypeOptions, setQuestionTypeOptions] = useState<string[]>([])

  // ==================== 来源信息状态 (只读显示) ====================
  const [sourceFilename, setSourceFilename] = useState<string | null>(null)
  const [sourceYear, setSourceYear] = useState<number | null>(null)
  const [sourceSeason, setSourceSeason] = useState<string | null>(null)

  // ==================== 保存状态 ====================
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // ==================== 级联更新：Subject 变化 ====================
  useEffect(() => {
    if (subjectCode) {
      const papers = getPaperCodes(subjectCode)
      setPaperOptions(papers)
    } else {
      setPaperOptions([])
    }
    setPaper('')
    setTopic('')
    setSelectedSubtopics([])
    setQuestionType('')
    setTopicOptions([])
    setSubtopicOptions([])
    setQuestionTypeOptions([])
  }, [subjectCode])

  // ==================== 级联更新：Paper 变化 ====================
  useEffect(() => {
    if (subjectCode && paper) {
      const topics = getTopicNamesByPaper(subjectCode, paper)
      const types = getQuestionTypesByPaper(subjectCode, paper)
      setTopicOptions(topics)
      setQuestionTypeOptions(types)
    } else {
      setTopicOptions([])
      setQuestionTypeOptions([])
    }
    setTopic('')
    setSelectedSubtopics([])
    setSubtopicOptions([])
  }, [subjectCode, paper])

  // ==================== 级联更新：Topic 变化 ====================
  useEffect(() => {
    if (subjectCode && paper && topic) {
      const subtopics = getSubtopicsByTopics(subjectCode, paper, [topic])
      setSubtopicOptions(subtopics)
      setSelectedSubtopics(prev => prev.filter(s => subtopics.includes(s)))
    } else {
      setSubtopicOptions([])
      setSelectedSubtopics([])
    }
  }, [subjectCode, paper, topic])

  // ==================== 加载题目 ====================
  const handleLoadQuestion = async () => {
    if (!searchId.trim()) {
      setSearchError('ENTER QUESTION ID')
      return
    }

    const id = parseInt(searchId)
    if (isNaN(id)) {
      setSearchError('INVALID ID FORMAT')
      return
    }

    setSearchLoading(true)
    setSearchError(null)

    try {
      const question = await fetchQuestionByIdDirect(id)

      setMode('edit')
      setQuestionId(question.id)
      setQuestionImagePath(question.question_image_path)
      setAnswerImagePath(question.answer_image_path)

      // 保存来源信息 (只读显示)
      setSourceFilename(question.source_filename || null)
      setSourceYear(question.year || null)
      setSourceSeason(question.season || null)

      // 检测答案模式：如果有 answer_text 且非空，使用文本模式
      if (question.answer_text && question.answer_text.trim()) {
        setAnswerMode('text')
        setAnswerText(question.answer_text.trim().toUpperCase())
      } else {
        setAnswerMode('image')
        setAnswerText('')
      }

      if (question.curriculum) {
        setCurriculum(question.curriculum)
      }
      if (question.subject_code) {
        setSubjectCode(question.subject_code)
      }

      setTimeout(() => {
        if (question.paper) setPaper(question.paper)

        setTimeout(() => {
          if (question.topic) setTopic(question.topic)
          if (question.question_type) setQuestionType(question.question_type)
          if (question.difficulty) setDifficulty(question.difficulty)

          setTimeout(() => {
            if (question.subtopic) {
              if (Array.isArray(question.subtopic)) {
                setSelectedSubtopics(question.subtopic)
              } else if (typeof question.subtopic === 'string') {
                try {
                  const parsed = JSON.parse(question.subtopic)
                  if (Array.isArray(parsed)) {
                    setSelectedSubtopics(parsed)
                  } else {
                    setSelectedSubtopics([question.subtopic])
                  }
                } catch {
                  setSelectedSubtopics([question.subtopic])
                }
              }
            }
          }, 100)
        }, 100)
      }, 100)

      setSaveMessage({ type: 'success', text: `LOADED Q#${question.id}` })
    } catch (err) {
      console.error('Load question failed:', err)
      setSearchError('QUESTION NOT FOUND')
    } finally {
      setSearchLoading(false)
    }
  }

  // ==================== 重置表单 ====================
  const handleReset = useCallback(() => {
    setMode('create')
    setQuestionId(null)
    setSearchId('')
    setSearchError(null)
    setQuestionImagePath(null)
    setAnswerImagePath(null)
    setAnswerMode('image')
    setAnswerText('')
    setCurriculum('CIE')
    setSubjectCode('')
    setPaper('')
    setTopic('')
    setSelectedSubtopics([])
    setQuestionType('')
    setDifficulty('Medium')
    setSaveMessage(null)
    // 清除来源信息
    setSourceFilename(null)
    setSourceYear(null)
    setSourceSeason(null)
  }, [])

  // ==================== 保存题目 ====================
  const handleSave = async () => {
    if (!questionImagePath) {
      setSaveMessage({ type: 'error', text: 'QUESTION IMAGE REQUIRED' })
      return
    }
    // 根据模式验证答案
    if (answerMode === 'image' && !answerImagePath) {
      setSaveMessage({ type: 'error', text: 'ANSWER IMAGE REQUIRED' })
      return
    }
    if (answerMode === 'text' && !answerText) {
      setSaveMessage({ type: 'error', text: 'SELECT ANSWER (A/B/C/D)' })
      return
    }
    if (!subjectCode) {
      setSaveMessage({ type: 'error', text: 'SELECT SUBJECT' })
      return
    }

    setSaving(true)
    setSaveMessage(null)

    try {
      if (mode === 'edit' && questionId) {
        const updateData = {
          curriculum,
          subject_code: subjectCode,
          subject: subjectCodeToName[subjectCode] || subjectCode,
          paper,
          topic,
          subtopic: selectedSubtopics.length > 0 ? JSON.stringify(selectedSubtopics) : undefined,
          question_type: questionType,
          difficulty,
          question_image_path: questionImagePath,
          // 根据模式设置答案字段
          answer_image_path: answerMode === 'image' ? answerImagePath : null,
          answer_text: answerMode === 'text' ? answerText : null,
        }

        await updateQuestion(questionId, updateData, token || '')
        setSaveMessage({ type: 'success', text: `Q#${questionId} UPDATED!` })
      } else {
        const payload: StudioQuestionPayload = {
          question_image_path: questionImagePath,
          // 根据模式设置答案字段
          answer_image_path: answerMode === 'image' ? (answerImagePath || undefined) : undefined,
          answer_text: answerMode === 'text' ? answerText : undefined,
          curriculum,
          subject: subjectCodeToName[subjectCode] || subjectCode,
          subject_code: subjectCode,
          paper,
          topic,
          subtopic: selectedSubtopics.length > 0 ? JSON.stringify(selectedSubtopics) : undefined,
          question_type: questionType,
          difficulty,
        }

        const newQuestion = await createStudioQuestion(payload, token || '')
        setSaveMessage({ type: 'success', text: `CREATED Q#${newQuestion.id}` })

        setMode('edit')
        setQuestionId(newQuestion.id)
        setSearchId(String(newQuestion.id))
      }
    } catch (err) {
      console.error('Save failed:', err)
      setSaveMessage({ type: 'error', text: 'SAVE FAILED' })
    } finally {
      setSaving(false)
    }
  }

  // ==================== 主界面 - 像素风格 ====================
  return (
    <div className="min-h-screen bg-pixel-bg">
      {/* 全局导航栏 */}
      <Navbar currentPage="STUDIO" />

      {/* 主内容区域 */}
      <main className="max-w-7xl mx-auto px-4 py-6 pt-24 pb-20">
        {/* 搜索栏 */}
        <div className="pixel-card mb-6">
          <div className="pixel-card-header bg-pixel-primary flex items-center justify-between">
            <span className="font-pixel text-xl text-white">
              <i className="fa-solid fa-search mr-2"></i>
              LOAD QUESTION
            </span>
            {mode === 'edit' && questionId && (
              <span className="font-pixel text-sm text-white bg-pixel-dark px-2 py-1">
                EDITING Q#{questionId}
              </span>
            )}
          </div>
          <div className="p-4">
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="block font-pixel text-sm text-pixel-dark mb-1">
                  QUESTION ID
                </label>
                <input
                  type="text"
                  value={searchId}
                  onChange={e => setSearchId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLoadQuestion()}
                  placeholder="123"
                  className="pixel-input"
                />
              </div>
              <button
                onClick={handleLoadQuestion}
                disabled={searchLoading}
                className="pixel-btn-primary"
              >
                {searchLoading ? 'LOADING...' : '[ LOAD ]'}
              </button>
              <button
                onClick={handleReset}
                className="pixel-btn"
              >
                [ NEW ]
              </button>
            </div>
            {searchError && (
              <p className="mt-2 font-pixel text-sm text-pixel-red">
                <i className="fa-solid fa-exclamation-triangle mr-1"></i>
                {searchError}
              </p>
            )}
          </div>
        </div>

        {/* 来源信息栏 - 仅编辑模式显示 */}
        {mode === 'edit' && sourceFilename && (
          <div className="pixel-card mb-6">
            <div className="pixel-card-header bg-pixel-gray-600">
              <span className="font-pixel text-sm text-white">
                <i className="fa-solid fa-file-lines mr-2"></i>
                SOURCE INFO
              </span>
            </div>
            <div className="p-3 bg-pixel-gray-100">
              <div className="flex flex-wrap items-center gap-3 font-pixel text-sm">
                {/* 来源文件名 */}
                <div className="flex items-center gap-1">
                  <span className="text-pixel-gray-500">FILE:</span>
                  <span className="text-pixel-dark font-bold">{sourceFilename}</span>
                </div>

                {/* 分隔符 */}
                {(sourceYear || sourceSeason) && (
                  <span className="text-pixel-gray-400">|</span>
                )}

                {/* 年份 */}
                {sourceYear && (
                  <div className="flex items-center gap-1">
                    <span className="text-pixel-gray-500">YEAR:</span>
                    <span className="text-pixel-primary font-bold">{sourceYear}</span>
                  </div>
                )}

                {/* 考季 */}
                {sourceSeason && (
                  <div className="flex items-center gap-1">
                    <span className="text-pixel-gray-500">SEASON:</span>
                    <span className="text-pixel-green font-bold">
                      {sourceSeason === 's' ? 'Summer' :
                       sourceSeason === 'w' ? 'Winter' :
                       sourceSeason === 'm' ? 'March' : sourceSeason.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 主体区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* 左侧：图片区域 */}
          <div className="lg:col-span-2 space-y-6">
            <div className="pixel-card">
              <div className="pixel-card-header bg-pixel-green">
                <span className="font-pixel text-white">QUESTION IMAGE</span>
              </div>
              <div className="p-4">
                <ImagePasteBox
                  label=""
                  currentImage={questionImagePath}
                  onImageUploaded={setQuestionImagePath}
                />
              </div>
            </div>

            <div className="pixel-card">
              <div className="pixel-card-header bg-pixel-pink flex items-center justify-between">
                <span className="font-pixel text-white">ANSWER</span>
                {/* 模式切换按钮 */}
                <div className="flex gap-1">
                  <button
                    onClick={() => setAnswerMode('image')}
                    className={`font-pixel text-xs px-2 py-1 border-2 border-white transition-all ${
                      answerMode === 'image'
                        ? 'bg-white text-pixel-pink'
                        : 'bg-transparent text-white hover:bg-white/20'
                    }`}
                  >
                    IMAGE
                  </button>
                  <button
                    onClick={() => setAnswerMode('text')}
                    className={`font-pixel text-xs px-2 py-1 border-2 border-white transition-all ${
                      answerMode === 'text'
                        ? 'bg-white text-pixel-pink'
                        : 'bg-transparent text-white hover:bg-white/20'
                    }`}
                  >
                    TEXT
                  </button>
                </div>
              </div>
              <div className="p-4">
                {answerMode === 'image' ? (
                  <ImagePasteBox
                    label=""
                    currentImage={answerImagePath}
                    onImageUploaded={setAnswerImagePath}
                  />
                ) : (
                  /* 文本答案选择 - A/B/C/D 按钮组 */
                  <div className="flex flex-col items-center py-4">
                    <p className="font-pixel text-sm text-pixel-gray-600 mb-4">
                      SELECT MCQ ANSWER
                    </p>
                    <div className="flex gap-3">
                      {['A', 'B', 'C', 'D'].map((letter) => (
                        <button
                          key={letter}
                          onClick={() => setAnswerText(letter)}
                          className={`
                            w-16 h-16 font-pixel text-2xl font-bold
                            border-4 border-pixel-dark
                            transition-all duration-100
                            ${answerText === letter
                              ? 'bg-pixel-yellow text-pixel-dark translate-x-1 translate-y-1 shadow-none'
                              : 'bg-white text-pixel-dark hover:bg-pixel-gray-100 shadow-pixel'
                            }
                          `}
                        >
                          {letter}
                        </button>
                      ))}
                    </div>
                    {answerText && (
                      <p className="font-pixel text-lg text-pixel-green mt-4">
                        SELECTED: {answerText}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 右侧：元数据区域 */}
          <div className="lg:col-span-3">
            <div className="pixel-card">
              <div className="pixel-card-header bg-pixel-primary">
                <span className="font-pixel text-white text-xl">METADATA</span>
              </div>
              <div className="p-4 space-y-4">
                {/* Curriculum */}
                <div>
                  <label className="block font-pixel text-sm text-pixel-dark mb-1">
                    CURRICULUM
                  </label>
                  <select
                    value={curriculum}
                    onChange={e => setCurriculum(e.target.value)}
                    className="pixel-select"
                  >
                    {CURRICULUM_OPTIONS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Subject */}
                <div>
                  <label className="block font-pixel text-sm text-pixel-dark mb-1">
                    SUBJECT
                  </label>
                  <select
                    value={subjectCode}
                    onChange={e => setSubjectCode(e.target.value)}
                    className="pixel-select"
                  >
                    <option value="">-- SELECT --</option>
                    {subjectOptions.map(code => (
                      <option key={code} value={code}>
                        {subjectCodeToName[code] || code} ({code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Paper */}
                <div>
                  <label className="block font-pixel text-sm text-pixel-dark mb-1">
                    PAPER
                  </label>
                  <select
                    value={paper}
                    onChange={e => setPaper(e.target.value)}
                    disabled={!subjectCode}
                    className={`pixel-select ${!subjectCode ? 'bg-pixel-gray-200' : ''}`}
                  >
                    <option value="">-- SELECT --</option>
                    {paperOptions.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* Topic */}
                <div>
                  <label className="block font-pixel text-sm text-pixel-dark mb-1">
                    TOPIC
                  </label>
                  <select
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    disabled={!paper}
                    className={`pixel-select ${!paper ? 'bg-pixel-gray-200' : ''}`}
                  >
                    <option value="">-- SELECT --</option>
                    {topicOptions.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Subtopics */}
                <MultiSelectFilter
                  label="SUBTOPICS"
                  options={subtopicOptions}
                  selectedValues={selectedSubtopics}
                  onChange={setSelectedSubtopics}
                  placeholder="SELECT..."
                  disabled={!topic}
                />

                {/* Question Type */}
                <div>
                  <label className="block font-pixel text-sm text-pixel-dark mb-1">
                    QUESTION TYPE
                  </label>
                  <select
                    value={questionType}
                    onChange={e => setQuestionType(e.target.value)}
                    disabled={!paper}
                    className={`pixel-select ${!paper ? 'bg-pixel-gray-200' : ''}`}
                  >
                    <option value="">-- SELECT --</option>
                    {questionTypeOptions.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Difficulty */}
                <div>
                  <label className="block font-pixel text-sm text-pixel-dark mb-1">
                    DIFFICULTY
                  </label>
                  <select
                    value={difficulty}
                    onChange={e => setDifficulty(e.target.value)}
                    className="pixel-select"
                  >
                    {DIFFICULTY_OPTIONS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* 保存按钮 */}
                <div className="pt-4 border-t-4 border-pixel-dark">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="pixel-btn-success w-full text-xl"
                  >
                    {saving ? 'SAVING...' : mode === 'edit' ? '[ UPDATE ]' : '[ CREATE ]'}
                  </button>

                  {saveMessage && (
                    <div className={`mt-3 font-pixel text-sm text-center py-2 px-3 border-2 border-pixel-dark ${
                      saveMessage.type === 'success' ? 'bg-pixel-green text-white' : 'bg-pixel-red text-white'
                    }`}>
                      {saveMessage.text}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 底部状态栏 */}
      <footer className="pixel-statusbar">
        <span>MODE: {mode.toUpperCase()}</span>
        <span>ID: {questionId || 'NEW'}</span>
        <span>STATUS: {saving ? 'SAVING' : 'READY'}</span>
      </footer>
    </div>
  )
}
