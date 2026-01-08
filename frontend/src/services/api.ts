import axios from 'axios'
import type { Question, QuestionQueryParams, FilterOptions } from '../types/question'

// 自定义参数序列化：FastAPI 需要 topic=a&topic=b 格式
function serializeParams(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    if (Array.isArray(value)) {
      // 数组参数：每个值都用相同的 key
      value.forEach(v => searchParams.append(key, String(v)))
    } else {
      searchParams.append(key, String(value))
    }
  })
  return searchParams.toString()
}

// 创建 axios 实例
const api = axios.create({
  baseURL: '/',  // 使用 Vite 代理，所以 baseURL 为 /
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  paramsSerializer: serializeParams,
})

// 获取题目列表
export async function fetchQuestions(params: QuestionQueryParams = {}): Promise<Question[]> {
  // 转换参数名：前端用 paper，后端用 paper_number
  const apiParams: Record<string, unknown> = { ...params }
  if (params.paper) {
    apiParams.paper_number = params.paper
    delete apiParams.paper
  }
  const response = await api.get<Question[]>('/questions/', { params: apiParams })
  return response.data
}

// 获取单个题目
export async function fetchQuestionById(id: number): Promise<Question> {
  const questions = await fetchQuestions({ id, limit: 1 })
  if (questions.length === 0) {
    throw new Error(`Question with id ${id} not found`)
  }
  return questions[0]
}

// 获取基础筛选选项
export async function fetchFilterOptions(): Promise<FilterOptions> {
  // 并行获取基础选项
  const [curriculums, subjects, difficulties] = await Promise.all([
    api.get('/metadata/distinct/curriculum').then(r => r.data as string[]),
    api.get('/metadata/distinct/subject').then(r => r.data as string[]),
    api.get('/metadata/distinct/difficulty').then(r => r.data as string[]),
  ])

  return {
    curriculums: curriculums.sort(),
    subjects: subjects.sort(),
    papers: [],       // 初始为空，根据科目级联加载
    topics: [],       // 初始为空，根据 paper 级联加载
    subtopics: [],    // 初始为空，根据 topic 级联加载
    difficulties: difficulties.sort(),
  }
}

// 获取 Papers (级联: curriculum + subject)
export async function fetchPapers(curriculum?: string, subject?: string): Promise<string[]> {
  const params = new URLSearchParams()
  if (curriculum) params.append('curriculum', curriculum)
  if (subject) params.append('subject', subject)
  const response = await api.get(`/metadata/distinct/paper?${params}`)
  return (response.data as string[]).sort()
}

// 获取 Topics (级联: curriculum + subject + paper)
export async function fetchTopics(curriculum?: string, subject?: string, paper?: string): Promise<string[]> {
  const params = new URLSearchParams()
  if (curriculum) params.append('curriculum', curriculum)
  if (subject) params.append('subject', subject)
  if (paper) params.append('paper_number', paper)  // 后端使用 paper_number 参数
  const response = await api.get(`/metadata/distinct/topic?${params}`)
  return (response.data as string[]).sort()
}

// 获取 Subtopics (级联: 根据已选 topics)
export async function fetchSubtopics(topics: string[]): Promise<string[]> {
  if (topics.length === 0) return []
  const params = new URLSearchParams()
  topics.forEach(t => params.append('topic', t))
  const response = await api.get(`/metadata/distinct/subtopic?${params}`)
  return (response.data as string[]).sort()
}

// 获取图片完整 URL
export function getImageUrl(imagePath: string): string {
  // 后端返回的路径可能是 "static/..." 或 "/static/..."
  // 确保路径以 / 开头，Vite 代理会转发到后端
  if (!imagePath) return ''
  return imagePath.startsWith('/') ? imagePath : '/' + imagePath
}

// PDF 生成相关接口
interface GeneratePdfResponse {
  status: string
  file_id: string
}

interface PrepareDownloadResponse {
  status: string
  url: string
}

/**
 * 生成 PDF 试卷
 * @param questionIds 题目 ID 列表
 * @param includeAnswers 是否包含答案
 * @param token 认证令牌
 * @returns 生成的文件 ID
 */
export async function generatePdf(
  questionIds: number[],
  includeAnswers: boolean = false,
  token?: string
): Promise<string> {
  const response = await api.post<GeneratePdfResponse>('/worksheet/generate', {
    question_ids: questionIds,
    include_answers: includeAnswers,
  }, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
  })
  return response.data.file_id
}

/**
 * 准备 PDF 下载链接
 * @param fileId 文件 ID
 * @param filename 自定义文件名
 * @returns 下载 URL
 */
export async function prepareDownload(
  fileId: string,
  filename: string = 'worksheet.pdf'
): Promise<string> {
  const response = await api.get<PrepareDownloadResponse>(
    `/worksheet/prepare-download/${fileId}`,
    { params: { name: filename } }
  )
  return response.data.url
}

/**
 * 触发 PDF 下载
 * @param questionIds 题目 ID 列表
 * @param includeAnswers 是否包含答案
 * @param token 认证令牌
 * @param filename 自定义文件名
 */
export async function downloadPdf(
  questionIds: number[],
  includeAnswers: boolean = false,
  token?: string,
  filename?: string
): Promise<void> {
  console.log('[PDF] Starting download process...', { questionIds, includeAnswers })

  // 1. 生成 PDF（需要认证）
  const fileId = await generatePdf(questionIds, includeAnswers, token)
  console.log('[PDF] Generated file ID:', fileId)

  // 2. 生成友好的文件名
  const today = new Date().toISOString().split('T')[0]
  const finalFilename = filename || `${today}_HaoExam_Worksheet.pdf`

  // 3. 准备下载链接
  const downloadUrl = await prepareDownload(fileId, finalFilename)
  console.log('[PDF] Download URL:', downloadUrl)

  // 4. 使用 <a> 标签触发下载（更可靠）
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = finalFilename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()

  // 延迟移除 link
  setTimeout(() => {
    document.body.removeChild(link)
  }, 1000)

  console.log('[PDF] Download triggered successfully')
}

// ============================================================================
// 认证相关接口
// ============================================================================
interface LoginResponse {
  access_token: string
  token_type: string
  role: string
}

/**
 * 用户登录
 */
export async function login(username: string, password: string): Promise<LoginResponse> {
  const formData = new URLSearchParams()
  formData.append('username', username)
  formData.append('password', password)

  const response = await api.post<LoginResponse>('/token', formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })
  return response.data
}

// ============================================================================
// ZIP 上传相关接口
// ============================================================================
export interface UploadError {
  question: string
  reason: string
}

export interface UploadResult {
  success: boolean
  processed_count: number
  skipped_count: number
  errors: UploadError[]
}

/**
 * 上传进度回调类型
 */
export type UploadProgressCallback = (progress: number) => void

/**
 * 上传 ZIP 文件
 * @param file ZIP 文件
 * @param token 认证令牌
 * @param onProgress 上传进度回调 (0-100)
 */
export async function uploadZip(
  file: File,
  token: string,
  onProgress?: UploadProgressCallback
): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('file', file)

  // 使用 api 实例，但覆盖 Content-Type 为 undefined
  // 让浏览器自动设置 multipart/form-data 和 boundary
  const response = await api.post<UploadResult>('/api/v1/ingest/zip', formData, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': undefined,  // 覆盖默认的 application/json
    },
    timeout: 120000,  // 120 秒超时，大文件上传可能较慢
    onUploadProgress: onProgress
      ? (progressEvent) => {
          const total = progressEvent.total || file.size
          const percent = Math.round((progressEvent.loaded * 100) / total)
          onProgress(percent)
        }
      : undefined,
  })
  return response.data
}


// ============================================================================
// Question Studio API - 题目工坊
// ============================================================================

/**
 * 上传单张图片
 */
export async function uploadImage(file: File, token: string): Promise<{ filename: string; path: string }> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await api.post('/api/upload/image', formData, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': undefined,
    },
    timeout: 30000,
  })
  return response.data
}

/**
 * 上传多张图片并拼接
 * 多张图片会垂直拼接（右对齐）成一张图片
 */
export async function uploadImages(files: File[], token: string): Promise<{ filename: string; path: string }> {
  const formData = new FormData()
  files.forEach(file => {
    formData.append('files', file)
  })

  const response = await api.post('/api/upload/images', formData, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': undefined,
    },
    timeout: 60000, // 多图上传可能需要更长时间
  })
  return response.data
}

/**
 * 根据 ID 获取单个题目
 */
export async function fetchQuestionByIdDirect(id: number): Promise<Question> {
  const response = await api.get<Question>(`/api/questions/${id}`)
  return response.data
}

/**
 * Studio 创建题目的请求参数
 */
export interface StudioQuestionPayload {
  question_image_path: string
  answer_image_path?: string       // 图片答案 (text模式时可为空)
  answer_text?: string             // 文本答案: "A", "B", "C", "D"
  curriculum?: string
  subject?: string
  subject_code?: string
  year?: number
  season?: string
  paper?: string
  question_number?: string
  difficulty?: string
  question_type?: string
  topic?: string
  subtopic?: string  // JSON array string
}

/**
 * 从 Studio 创建题目
 */
export async function createStudioQuestion(
  data: StudioQuestionPayload,
  token: string
): Promise<Question> {
  const formData = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      formData.append(key, String(value))
    }
  })

  const response = await api.post<Question>('/api/questions/studio', formData, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': undefined,
    },
  })
  return response.data
}

/**
 * 更新题目
 */
export async function updateQuestion(
  id: number,
  data: Partial<Question>,
  token: string
): Promise<Question> {
  const response = await api.put<Question>(`/questions/${id}`, data, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })
  return response.data
}


// ============================================================================
// Smart Generator API - 智能组卷
// ============================================================================

export interface SubtopicWeightPayload {
  subtopic: string
  weight: number
}

export interface TopicWeightPayload {
  topic: string
  weight: number
  subtopics: SubtopicWeightPayload[]
}

export interface DifficultyRatioPayload {
  Easy: number
  Medium: number
  Hard: number
}

export interface SmartGeneratorPayload {
  subject_code: string
  paper: string
  total_questions: number
  topic_weights: TopicWeightPayload[]
  difficulty_ratio: DifficultyRatioPayload
}

export interface UnfilledSlot {
  topic: string
  subtopic: string
  difficulty: string
}

export interface SmartGeneratorResponse {
  success: boolean
  question_ids: number[]
  slots_filled: number
  slots_requested: number
  fallback_used: number
  unfilled_slots: UnfilledSlot[]
  message: string
}

/**
 * 智能组卷 - 生成试卷 (需要 Teacher 或 Admin 权限)
 */
export async function generateSmartExam(
  payload: SmartGeneratorPayload,
  token: string
): Promise<SmartGeneratorResponse> {
  const response = await api.post<SmartGeneratorResponse>(
    '/api/generator/smart',
    payload,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  )
  return response.data
}

export interface RerollPayload {
  question_id: number
  subject_code: string
  paper: string
  topic: string
  subtopic: string
  exclude_ids: number[]
}

export interface RerollResponse {
  success: boolean
  new_question_id: number | null
  message: string
}

/**
 * 智能组卷 - 重新抽取单题 (需要 Teacher 或 Admin 权限)
 */
export async function rerollQuestion(
  payload: RerollPayload,
  token: string
): Promise<RerollResponse> {
  const response = await api.post<RerollResponse>(
    '/api/generator/reroll',
    payload,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  )
  return response.data
}

/**
 * 批量获取题目 (根据 ID 列表)
 */
export async function fetchQuestionsByIds(ids: number[]): Promise<Question[]> {
  if (ids.length === 0) return []

  // 分批获取，避免 URL 过长
  const chunkSize = 50
  const chunks: number[][] = []
  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize))
  }

  const results = await Promise.all(
    chunks.map(chunk =>
      api.get<Question[]>('/questions/', {
        params: { id: chunk }
      }).then(r => r.data)
    )
  )

  // 展平结果并按原始顺序排序
  const questionMap = new Map<number, Question>()
  results.flat().forEach(q => questionMap.set(q.id, q))

  return ids.map(id => questionMap.get(id)!).filter(Boolean)
}

export default api
