/**
 * Syllabus 工具函数
 * 从 Syllabus JSON 文件中查询 Topics 和 Subtopics
 */
import type { Syllabus, SyllabusPaper, SyllabusTopic } from '../types/syllabus'

// 导入所有 Syllabus JSON 文件
import CIE_9709_MATH from '../data/CIE_9709_MATH.json'
import CIE_9701_CHEMISTRY from '../data/CIE_9701_CHEMISTRY.json'
import CIE_9702_PHYSICS from '../data/CIE_9702_PHYSICS.json'
import CIE_9708_ECONOMICS from '../data/CIE_9708_ECONOMICS.json'

// Syllabus 映射表：根据 subject_code 查找对应的 Syllabus
const syllabusMap: Record<string, Syllabus> = {
  '9709': CIE_9709_MATH as Syllabus,
  '9701': CIE_9701_CHEMISTRY as Syllabus,
  '9702': CIE_9702_PHYSICS as Syllabus,
  '9708': CIE_9708_ECONOMICS as Syllabus,
}

/**
 * 根据科目代码获取 Syllabus
 */
export function getSyllabus(subjectCode: string): Syllabus | null {
  return syllabusMap[subjectCode] || null
}

/**
 * 根据科目代码获取所有 Papers
 */
export function getPapers(subjectCode: string): SyllabusPaper[] {
  const syllabus = getSyllabus(subjectCode)
  return syllabus?.papers || []
}

/**
 * 根据科目代码和 Paper 代码获取所有 Topics
 */
export function getTopicsByPaper(subjectCode: string, paperCode: string): SyllabusTopic[] {
  const syllabus = getSyllabus(subjectCode)
  if (!syllabus) return []

  const paper = syllabus.papers.find(p => p.paper_code === paperCode)
  return paper?.topics || []
}

/**
 * 根据科目代码和 Paper 代码获取 Topic 名称列表
 */
export function getTopicNamesByPaper(subjectCode: string, paperCode: string): string[] {
  const topics = getTopicsByPaper(subjectCode, paperCode)
  return topics.map(t => t.name)
}

/**
 * 根据科目代码、Paper 代码和选中的 Topics 获取 Subtopic 名称列表
 * 这是核心函数：只返回选中 Topics 下定义的 Subtopics
 */
export function getSubtopicsByTopics(
  subjectCode: string,
  paperCode: string,
  selectedTopics: string[]
): string[] {
  if (selectedTopics.length === 0) return []

  const topics = getTopicsByPaper(subjectCode, paperCode)
  if (topics.length === 0) return []

  // 找到所有选中的 Topics
  const targetTopics = topics.filter(t => selectedTopics.includes(t.name))

  // 提取这些 Topics 下的所有 Subtopics
  const subtopics: string[] = []
  targetTopics.forEach(topic => {
    topic.subtopics.forEach(sub => {
      subtopics.push(sub.name)
    })
  })

  return subtopics.sort()
}

/**
 * 尝试从科目名称推断科目代码
 * 例如: "math" -> "9709", "physics" -> "9702"
 */
export function inferSubjectCode(subject: string): string | null {
  const subjectLower = subject.toLowerCase()

  if (subjectLower.includes('math')) return '9709'
  if (subjectLower.includes('physic')) return '9702'
  if (subjectLower.includes('chem')) return '9701'
  if (subjectLower.includes('econ')) return '9708'

  return null
}

/**
 * 获取所有可用的科目代码
 */
export function getAvailableSubjectCodes(): string[] {
  return Object.keys(syllabusMap)
}

/**
 * 根据科目代码获取所有 Paper 代码列表
 * 例如: "9709" -> ["P1", "P2", "P3", "M1", "S1", "S2"]
 */
export function getPaperCodes(subjectCode: string): string[] {
  const papers = getPapers(subjectCode)
  return papers.map(p => p.paper_code)
}

/**
 * 根据科目代码和 Paper 代码获取有效的题型列表
 * 例如: ("9709", "P1") -> ["Calculation", "Graph Sketching", ...]
 */
export function getQuestionTypesByPaper(subjectCode: string, paperCode: string): string[] {
  const syllabus = getSyllabus(subjectCode)
  if (!syllabus) return []

  const paper = syllabus.papers.find(p => p.paper_code === paperCode)
  return paper?.valid_question_types || []
}

/**
 * 科目代码到科目名称的映射
 */
export const subjectCodeToName: Record<string, string> = {
  '9709': 'Math',
  '9701': 'Chemistry',
  '9702': 'Physics',
  '9708': 'Economics',
}

/**
 * 科目名称到科目代码的映射
 */
export const subjectNameToCode: Record<string, string> = {
  'Math': '9709',
  'Mathematics': '9709',
  'Chemistry': '9701',
  'Physics': '9702',
  'Economics': '9708',
}
