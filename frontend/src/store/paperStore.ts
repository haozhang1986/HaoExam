import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PaperState {
  // 已选中的题目 ID 列表
  selectedQuestionIds: number[]

  // 切换题目选中状态（已选则移除，未选则添加）
  toggleQuestion: (id: number) => void

  // 检查题目是否已选中
  isSelected: (id: number) => boolean

  // 清空试卷篮
  clearAll: () => void

  // 移除指定题目
  removeQuestion: (id: number) => void

  // 批量添加题目
  addQuestions: (ids: number[]) => void
}

export const usePaperStore = create<PaperState>()(
  persist(
    (set, get) => ({
      selectedQuestionIds: [],

      toggleQuestion: (id: number) => {
        const { selectedQuestionIds } = get()
        if (selectedQuestionIds.includes(id)) {
          // 已存在则移除
          set({
            selectedQuestionIds: selectedQuestionIds.filter((qid) => qid !== id),
          })
        } else {
          // 不存在则添加
          set({
            selectedQuestionIds: [...selectedQuestionIds, id],
          })
        }
      },

      isSelected: (id: number) => {
        return get().selectedQuestionIds.includes(id)
      },

      clearAll: () => {
        set({ selectedQuestionIds: [] })
      },

      removeQuestion: (id: number) => {
        set({
          selectedQuestionIds: get().selectedQuestionIds.filter((qid) => qid !== id),
        })
      },

      addQuestions: (ids: number[]) => {
        const { selectedQuestionIds } = get()
        const newIds = ids.filter((id) => !selectedQuestionIds.includes(id))
        set({
          selectedQuestionIds: [...selectedQuestionIds, ...newIds],
        })
      },
    }),
    {
      name: 'haoexam-paper-storage', // localStorage 的 key 名称
    }
  )
)
