/**
 * Generator Store - 智能组卷状态管理
 *
 * 使用 Zustand 管理组卷页面的状态
 * 使用 shallow 选择器优化性能，避免不必要的重渲染
 */
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { Question } from '../types/question'

// =============================================================================
// 类型定义
// =============================================================================

export interface SubtopicWeight {
  subtopic: string
  weight: number // 0-100, 占该 Topic 内部的比例
}

export interface TopicWeight {
  topic: string
  weight: number // 0-100, 占全卷的比例
  subtopics: SubtopicWeight[]
  expanded: boolean // UI 状态：手风琴是否展开
}

export interface DifficultyRatio {
  Easy: number
  Medium: number
  Hard: number
}

export interface GeneratedQuestion {
  id: number
  question: Question | null
  topic: string
  subtopic: string
  difficulty: string
}

// =============================================================================
// Store 接口
// =============================================================================

interface GeneratorState {
  // 基础选择
  subjectCode: string
  paper: string
  totalQuestions: number

  // 权重配置
  topicWeights: TopicWeight[]
  difficultyRatio: DifficultyRatio

  // 生成结果
  generatedQuestions: GeneratedQuestion[]
  isGenerating: boolean
  error: string | null

  // 基础设置 Actions
  setSubjectCode: (code: string) => void
  setPaper: (paper: string) => void
  setTotalQuestions: (n: number) => void

  // Topic 权重 Actions
  setTopicWeight: (topic: string, weight: number) => void
  setSubtopicWeight: (topic: string, subtopic: string, weight: number) => void
  toggleTopicExpanded: (topic: string) => void
  initializeTopics: (topics: { name: string; subtopics: { name: string }[] }[]) => void
  resetTopicWeights: () => void       // 均匀分配所有 Topic 权重
  normalizeTopicWeights: () => void   // 归一化到 100%
  normalizeSubtopicWeights: (topic: string) => void  // 归一化单个 Topic 的 Subtopic 权重

  // 难度比例 Actions (联动滑块)
  setDifficultyRatio: (difficulty: 'Easy' | 'Medium' | 'Hard', value: number) => void

  // 生成结果 Actions
  setGeneratedQuestions: (questions: GeneratedQuestion[]) => void
  replaceQuestion: (oldId: number, newId: number, newQuestion: Question) => void
  reorderQuestions: (fromIndex: number, toIndex: number) => void
  setIsGenerating: (val: boolean) => void
  setError: (error: string | null) => void

  // 重置
  reset: () => void
}

// =============================================================================
// 初始状态
// =============================================================================

const initialState = {
  subjectCode: '',
  paper: '',
  totalQuestions: 10,
  topicWeights: [] as TopicWeight[],
  difficultyRatio: { Easy: 30, Medium: 50, Hard: 20 } as DifficultyRatio,
  generatedQuestions: [] as GeneratedQuestion[],
  isGenerating: false,
  error: null as string | null,
}

// =============================================================================
// Zustand Store
// =============================================================================

export const useGeneratorStore = create<GeneratorState>()((set, get) => ({
  ...initialState,

  // ---------------------------------------------------------------------------
  // 基础设置
  // ---------------------------------------------------------------------------
  setSubjectCode: (code) => set({
    subjectCode: code,
    paper: '',
    topicWeights: [],
    generatedQuestions: [],
    error: null
  }),

  setPaper: (paper) => set({
    paper,
    topicWeights: [],
    generatedQuestions: [],
    error: null
  }),

  setTotalQuestions: (n) => set({
    totalQuestions: Math.max(1, Math.min(100, n))
  }),

  // ---------------------------------------------------------------------------
  // Topic 权重管理
  // ---------------------------------------------------------------------------
  setTopicWeight: (topic, weight) => set((state) => ({
    topicWeights: state.topicWeights.map(tw =>
      tw.topic === topic ? { ...tw, weight: Math.max(0, Math.min(100, weight)) } : tw
    )
  })),

  setSubtopicWeight: (topic, subtopic, weight) => set((state) => ({
    topicWeights: state.topicWeights.map(tw =>
      tw.topic === topic
        ? {
            ...tw,
            subtopics: tw.subtopics.map(sw =>
              sw.subtopic === subtopic
                ? { ...sw, weight: Math.max(0, Math.min(100, weight)) }
                : sw
            )
          }
        : tw
    )
  })),

  toggleTopicExpanded: (topic) => set((state) => ({
    topicWeights: state.topicWeights.map(tw =>
      tw.topic === topic ? { ...tw, expanded: !tw.expanded } : tw
    )
  })),

  initializeTopics: (topics) => set({
    topicWeights: topics.map((t, i) => ({
      topic: t.name,
      weight: topics.length > 0 ? Math.floor(100 / topics.length) : 0,
      expanded: i === 0, // 默认展开第一个
      subtopics: t.subtopics.map((s) => ({
        subtopic: s.name,
        weight: t.subtopics.length > 0 ? Math.floor(100 / t.subtopics.length) : 0
      }))
    })),
    generatedQuestions: [],
    error: null
  }),

  // 重置所有 Topic 权重为 0%
  resetTopicWeights: () => set((state) => ({
    topicWeights: state.topicWeights.map((tw) => ({
      ...tw,
      weight: 0,
      subtopics: tw.subtopics.map((sw) => ({
        ...sw,
        weight: 0
      }))
    }))
  })),

  // 归一化到 100%
  normalizeTopicWeights: () => set((state) => {
    const total = state.topicWeights.reduce((sum, tw) => sum + tw.weight, 0)
    if (total === 0 || total === 100) return state

    // 按比例缩放
    const scale = 100 / total
    let newWeights = state.topicWeights.map(tw => ({
      ...tw,
      weight: Math.round(tw.weight * scale)
    }))

    // 修正舍入误差
    const newTotal = newWeights.reduce((sum, tw) => sum + tw.weight, 0)
    if (newTotal !== 100 && newWeights.length > 0) {
      // 找到权重最大的 topic 来调整差值
      const maxIndex = newWeights.reduce((maxI, tw, i, arr) =>
        tw.weight > arr[maxI].weight ? i : maxI, 0)
      newWeights = newWeights.map((tw, i) =>
        i === maxIndex ? { ...tw, weight: tw.weight + (100 - newTotal) } : tw
      )
    }

    return { topicWeights: newWeights }
  }),

  // 归一化单个 Topic 的 Subtopic 权重到 100%
  normalizeSubtopicWeights: (topicName: string) => set((state) => ({
    topicWeights: state.topicWeights.map(tw => {
      if (tw.topic !== topicName) return tw

      const total = tw.subtopics.reduce((sum, sw) => sum + sw.weight, 0)
      if (total === 0 || total === 100) return tw

      // 按比例缩放
      const scale = 100 / total
      let newSubtopics = tw.subtopics.map(sw => ({
        ...sw,
        weight: Math.round(sw.weight * scale)
      }))

      // 修正舍入误差
      const newTotal = newSubtopics.reduce((sum, sw) => sum + sw.weight, 0)
      if (newTotal !== 100 && newSubtopics.length > 0) {
        const maxIndex = newSubtopics.reduce((maxI, sw, i, arr) =>
          sw.weight > arr[maxI].weight ? i : maxI, 0)
        newSubtopics = newSubtopics.map((sw, i) =>
          i === maxIndex ? { ...sw, weight: sw.weight + (100 - newTotal) } : sw
        )
      }

      return { ...tw, subtopics: newSubtopics }
    })
  })),

  // ---------------------------------------------------------------------------
  // 难度比例管理 (联动滑块)
  // ---------------------------------------------------------------------------
  setDifficultyRatio: (difficulty, value) => {
    const { difficultyRatio } = get()

    // 限制范围
    const clampedValue = Math.max(0, Math.min(100, value))

    // 获取其他两个难度
    const others = (['Easy', 'Medium', 'Hard'] as const).filter(k => k !== difficulty)

    // 计算剩余可分配的百分比
    const remaining = 100 - clampedValue

    // 获取当前其他两个的总和
    const currentOthersTotal = others.reduce((sum, k) => sum + difficultyRatio[k], 0)

    // 创建新的比例对象
    const newRatio = { ...difficultyRatio, [difficulty]: clampedValue }

    if (currentOthersTotal > 0) {
      // 按比例分配剩余部分
      others.forEach(k => {
        newRatio[k] = Math.round((difficultyRatio[k] / currentOthersTotal) * remaining)
      })

      // 修正舍入误差
      const total = Object.values(newRatio).reduce((a, b) => a + b, 0)
      if (total !== 100) {
        newRatio[others[0]] += 100 - total
      }
    } else {
      // 如果其他两个都是 0，平均分配
      others.forEach((k, i) => {
        newRatio[k] = Math.floor(remaining / others.length)
        if (i === 0) {
          newRatio[k] += remaining % others.length
        }
      })
    }

    // 确保没有负数
    Object.keys(newRatio).forEach(k => {
      const key = k as keyof DifficultyRatio
      if (newRatio[key] < 0) newRatio[key] = 0
    })

    set({ difficultyRatio: newRatio })
  },

  // ---------------------------------------------------------------------------
  // 生成结果管理
  // ---------------------------------------------------------------------------
  setGeneratedQuestions: (questions) => set({
    generatedQuestions: questions,
    error: null
  }),

  replaceQuestion: (oldId, newId, newQuestion) => set((state) => ({
    generatedQuestions: state.generatedQuestions.map(gq =>
      gq.id === oldId
        ? {
            ...gq,
            id: newId,
            question: newQuestion,
            difficulty: newQuestion.difficulty || 'Medium'
          }
        : gq
    )
  })),

  reorderQuestions: (fromIndex, toIndex) => set((state) => {
    const questions = [...state.generatedQuestions]
    const [removed] = questions.splice(fromIndex, 1)
    questions.splice(toIndex, 0, removed)
    return { generatedQuestions: questions }
  }),

  setIsGenerating: (val) => set({ isGenerating: val }),

  setError: (error) => set({ error }),

  // ---------------------------------------------------------------------------
  // 重置
  // ---------------------------------------------------------------------------
  reset: () => set(initialState),
}))

// =============================================================================
// Shallow Selectors - 性能优化选择器
// =============================================================================
// 使用 shallow 比较，只有当选中的状态真正改变时才触发重渲染

/**
 * 选择器: 仅获取 TopicMixer 需要的状态和 actions
 */
export const useTopicMixerStore = () => useGeneratorStore(
  useShallow((state) => ({
    topicWeights: state.topicWeights,
    setTopicWeight: state.setTopicWeight,
    setSubtopicWeight: state.setSubtopicWeight,
    toggleTopicExpanded: state.toggleTopicExpanded,
    resetTopicWeights: state.resetTopicWeights,
    normalizeTopicWeights: state.normalizeTopicWeights,
    normalizeSubtopicWeights: state.normalizeSubtopicWeights,
  }))
)

/**
 * 选择器: 仅获取 DifficultyEqualizer 需要的状态和 actions
 */
export const useDifficultyStore = () => useGeneratorStore(
  useShallow((state) => ({
    difficultyRatio: state.difficultyRatio,
    setDifficultyRatio: state.setDifficultyRatio,
  }))
)

/**
 * 选择器: 仅获取生成结果相关的状态
 */
export const useGeneratedResultsStore = () => useGeneratorStore(
  useShallow((state) => ({
    generatedQuestions: state.generatedQuestions,
    isGenerating: state.isGenerating,
    error: state.error,
  }))
)

/**
 * 选择器: 仅获取基础设置相关的状态和 actions
 */
export const useExamSetupStore = () => useGeneratorStore(
  useShallow((state) => ({
    subjectCode: state.subjectCode,
    paper: state.paper,
    totalQuestions: state.totalQuestions,
    setSubjectCode: state.setSubjectCode,
    setPaper: state.setPaper,
    setTotalQuestions: state.setTotalQuestions,
    initializeTopics: state.initializeTopics,
  }))
)
