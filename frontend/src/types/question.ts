// 标签接口
export interface Tag {
  id: number
  category: string
  name: string
}

// 题目接口 - 对应后端 schemas.Question
export interface Question {
  id: number
  question_image_path: string
  answer_image_path: string
  curriculum: string        // 课程体系: A-Level, AP 等
  subject: string           // 科目
  year: number | null       // 年份
  month: string | null      // 月份
  season: string | null     // 季节: Jan, May, Oct 等
  question_number: string | null  // 题号
  difficulty: string | null // 难度等级
  paper_number: string | null     // 试卷编号
  question_type: string | null    // 题目类型
  topic: string | null      // 主题
  subtopic: string | null   // 子主题
  subtopic_details: string | null // 子主题详情
  tags: Tag[]               // 关联标签
  answer_text?: string | null  // 选择题文本答案: "A", "B", "C", "D"
}

// API 查询参数接口
export interface QuestionQueryParams {
  skip?: number
  limit?: number
  curriculum?: string
  subject?: string
  paper?: string                // Paper 筛选 (单选)
  topic?: string[]              // 主题 (多选)
  subtopic?: string[]           // 子主题 (多选)
  difficulty?: string
  tag_category?: string
  tag_name?: string
  id?: number
  question_type?: string
}

// 筛选选项接口 (用于下拉菜单)
export interface FilterOptions {
  curriculums: string[]
  subjects: string[]
  papers: string[]              // Paper 选项
  topics: string[]
  subtopics: string[]           // 子主题选项
  difficulties: string[]
}
