/**
 * Generator Store - 智能组卷状态管理
 *
 * 使用 Zustand 管理组卷页面的状态
 */
import { create } from 'zustand'
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

  // 难度比例 Actions (联动滑块)
  setDifficultyRatio: (difficulty: 'Easy' | 'Medium' | 'Hard', value: number) => void

  // 生成结果 Actions
  setGeneratedQuestions: (questions: GeneratedQuestion[]) => void
  replaceQuestion: (oldId: number, newId: number, newQuestion: Question) => void
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

  setIsGenerating: (val) => set({ isGenerating: val }),

  setError: (error) => set({ error }),

  // ---------------------------------------------------------------------------
  // 重置
  // ---------------------------------------------------------------------------
  reset: () => set(initialState),
}))
