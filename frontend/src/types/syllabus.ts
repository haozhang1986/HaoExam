// Syllabus JSON 结构类型定义

export interface SyllabusDetail {
  name: string
  details: string[]
}

export interface SyllabusTopic {
  name: string
  subtopics: SyllabusDetail[]
}

export interface SyllabusPaper {
  paper_code: string
  paper_name: string
  valid_question_types: string[]
  topics: SyllabusTopic[]
}

export interface SyllabusMeta {
  curriculum: string
  subject: string
  syllabus_code: string
  year: string
}

export interface Syllabus {
  meta: SyllabusMeta
  papers: SyllabusPaper[]
}
