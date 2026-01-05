# HaoExam - Smart Exam Question Bank System

# HaoExam - 智能题库管理系统

> **English** | [中文](#中文文档)

[![Version](https://img.shields.io/badge/version-2.1--beta-blue.svg)](https://github.com/yourusername/HaoExam)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg)](https://fastapi.tiangolo.com/)

---

## Overview

HaoExam is a modern, full-stack exam question bank management system designed for A-Level and AP exam preparation. It features a unique **pixel art NES-style UI**, intelligent exam generation, and comprehensive question management capabilities.

### Key Highlights

- **Smart Exam Generator** - AI-powered exam paper creation with topic/difficulty weighting
- **Multi-Select Filtering** - Advanced cascading filters for precise question discovery
- **ZIP Batch Import** - Bulk upload questions from ExamSlicer format packages
- **PDF Worksheet Generation** - Create printable exam papers with one click
- **Pixel Art Design** - Retro gaming aesthetic with modern functionality

---

## Features

### 1. Question Gallery (`/gallery`)

Browse and search the entire question bank with powerful filtering:

| Feature | Description |
|---------|-------------|
| **Multi-Select Filters** | Select multiple topics/subtopics simultaneously |
| **Cascading Logic** | Topic selection auto-filters available subtopics |
| **Infinite Scroll** | Smooth pagination with lazy loading |
| **Image Preview** | Lightbox view for question/answer images |
| **Paper Basket** | Add questions to cart for worksheet creation |

### 2. Smart Generator (`/generator`)

Intelligent exam paper generation with three-dimensional control:

```
┌─────────────────────────────────────────────────────────────┐
│  DIFFICULTY MIX          │  TOPIC MIXER                    │
│  ┌───┐ ┌───┐ ┌───┐      │  [+] Algebra        [40%]      │
│  │███│ │███│ │███│      │      ├─ Quadratics  [50%]      │
│  │███│ │███│ │   │      │      └─ Polynomials [50%]      │
│  │   │ │███│ │   │      │  [−] Calculus       [60%]      │
│  └───┘ └───┘ └───┘      │      └─ Integration [100%]     │
│  EASY  MED   HARD       │                                 │
│   30%  50%   20%        │  [RESET] [FIX] [100%]          │
└─────────────────────────────────────────────────────────────┘
```

- **Difficulty Equalizer**: Linked sliders maintaining 100% total (Easy/Medium/Hard)
- **Topic Mixer**: Hierarchical weight assignment with accordion UI
- **Click-to-Edit**: Direct input for precise percentage control
- **Reroll**: Replace individual questions while keeping constraints
- **Add All to Cart**: Quick integration with worksheet generation

### 3. Studio Mode (`/studio`)

Manual question creation and editing:

- Image paste/upload support
- Full metadata editing (topic, subtopic, difficulty, year, etc.)
- Rich answer section with step-by-step solutions

### 4. Admin Upload (`/admin/upload`)

Batch import functionality:

- ExamSlicer ZIP format support
- Automatic metadata extraction from `config.json`
- Progress tracking and error reporting
- Duplicate detection

### 5. PDF Worksheet Generation

Create printable exam papers:

- Custom paper title and instructions
- Question ordering control
- Professional layout with page breaks
- Separate answer key generation

---

## Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| **FastAPI** | Modern async Python web framework |
| **SQLAlchemy** | ORM with SQLite/PostgreSQL support |
| **Pydantic** | Data validation and serialization |
| **JWT** | Secure authentication |
| **ReportLab** | PDF generation |

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 18** | UI component library |
| **TypeScript** | Type-safe JavaScript |
| **Tailwind CSS** | Utility-first styling |
| **Zustand** | Lightweight state management |
| **Vite** | Fast build tool and dev server |
| **React Router** | Client-side routing |

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- Git

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/HaoExam.git
cd HaoExam

# 2. Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 3. Start backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 4. Frontend setup (new terminal)
cd frontend
npm install
npm run dev

# 5. Open browser
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000/docs
```

### Default Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin123 |
| Teacher | teacher1 | teacher123 |
| Student | student1 | student123 |

---

## Project Structure

```
HaoExam/
├── backend/                    # FastAPI Backend
│   ├── app/
│   │   ├── main.py            # API routes & endpoints
│   │   ├── models.py          # SQLAlchemy models
│   │   ├── schemas.py         # Pydantic schemas
│   │   ├── crud.py            # Database operations
│   │   ├── auth.py            # Authentication logic
│   │   ├── pdf_engine.py      # PDF generation
│   │   ├── zip_ingest.py      # ZIP import handler
│   │   └── services/
│   │       └── generator.py   # Smart exam generator
│   ├── syllabus/              # Subject curriculum JSON
│   ├── static/uploads/        # Uploaded images
│   └── sql_app.db             # SQLite database
│
├── frontend/                   # React Frontend
│   ├── src/
│   │   ├── pages/             # Route pages
│   │   │   ├── GalleryPage.tsx
│   │   │   ├── GeneratorPage.tsx
│   │   │   ├── StudioPage.tsx
│   │   │   └── AdminUploadPage.tsx
│   │   ├── components/        # Reusable components
│   │   │   ├── generator/     # Smart generator components
│   │   │   ├── QuestionCard.tsx
│   │   │   └── PaperFloatingCart.tsx
│   │   ├── store/             # Zustand stores
│   │   ├── services/          # API client
│   │   └── utils/             # Helper functions
│   └── public/                # Static assets
│
└── CHANGELOG.md               # Version history
```

---

## API Endpoints

### Questions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/questions/` | List questions with filters |
| POST | `/questions/` | Create new question |
| PUT | `/questions/{id}` | Update question |
| DELETE | `/questions/{id}` | Delete question |

### Smart Generator
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/generator/smart` | Generate exam paper |
| POST | `/api/generator/reroll` | Replace single question |

### Worksheet
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/worksheet/generate` | Create PDF worksheet |
| GET | `/worksheet/download/{id}` | Download generated PDF |

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | User login |
| POST | `/auth/register` | User registration |
| GET | `/auth/me` | Current user info |

---

## Supported Subjects

| Code | Subject | Papers |
|------|---------|--------|
| 9709 | Mathematics | P1, P2, P3, S1, M1 |
| 9701 | Chemistry | P1, P2, P3, P4, P5 |
| 9702 | Physics | P1, P2, P3, P4, P5 |
| 9708 | Economics | P1, P2, P3, P4 |

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| v2.1-beta | 2025-01-05 | Smart Exam Generator |
| v2.0-beta | 2024-12-17 | Multi-Select Filter System |
| v1.1-alpha | 2024-12-15 | PDF fixes, testing framework |
| v1.0-alpha | 2024-12-10 | Initial release |

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

# 中文文档

## 项目简介

HaoExam 是一个现代化的全栈考试题库管理系统，专为 A-Level 和 AP 考试备考设计。系统采用独特的**像素风 NES 游戏风格 UI**，具备智能组卷、综合题目管理等功能。

### 核心亮点

- **智能组卷系统** - 基于知识点/难度权重的智能试卷生成
- **多选筛选器** - 高级级联过滤，精准查找题目
- **ZIP 批量导入** - 支持 ExamSlicer 格式的批量上传
- **PDF 试卷生成** - 一键创建可打印的考试试卷
- **像素风设计** - 复古游戏美学与现代功能的完美结合

---

## 功能详解

### 1. 题库浏览 (`/gallery`)

强大的题目搜索和浏览功能：

| 功能 | 说明 |
|------|------|
| **多选筛选** | 同时选择多个知识点/子知识点 |
| **级联逻辑** | 选择知识点后自动筛选可用子知识点 |
| **无限滚动** | 流畅的懒加载分页 |
| **图片预览** | 灯箱模式查看题目/答案图片 |
| **试卷篮** | 将题目添加到购物车以生成试卷 |

### 2. 智能组卷 (`/generator`)

三维度控制的智能试卷生成：

```
┌─────────────────────────────────────────────────────────────┐
│  难度均衡器              │  知识点混合器                    │
│  ┌───┐ ┌───┐ ┌───┐      │  [+] 代数          [40%]        │
│  │███│ │███│ │███│      │      ├─ 二次方程   [50%]        │
│  │███│ │███│ │   │      │      └─ 多项式     [50%]        │
│  │   │ │███│ │   │      │  [−] 微积分        [60%]        │
│  └───┘ └───┘ └───┘      │      └─ 积分       [100%]       │
│  简单  中等   困难       │                                  │
│  30%   50%   20%        │  [重置] [修正] [100%]            │
└─────────────────────────────────────────────────────────────┘
```

- **难度均衡器**：联动滑块，自动保持总和 100%（简单/中等/困难）
- **知识点混合器**：手风琴式层级权重分配
- **点击编辑**：直接输入精确的百分比数值
- **重新抽取**：保持约束条件下替换单个题目
- **一键添加**：快速集成到试卷生成

### 3. 编辑工作台 (`/studio`)

手动创建和编辑题目：

- 支持图片粘贴/上传
- 完整的元数据编辑（知识点、难度、年份等）
- 丰富的答案区域，支持分步解答

### 4. 管理员上传 (`/admin/upload`)

批量导入功能：

- 支持 ExamSlicer ZIP 格式
- 自动从 `config.json` 提取元数据
- 进度跟踪和错误报告
- 重复检测

### 5. PDF 试卷生成

创建可打印的考试试卷：

- 自定义试卷标题和说明
- 题目顺序控制
- 专业排版，自动分页
- 独立答案生成

---

## 技术栈

### 后端
| 技术 | 用途 |
|------|------|
| **FastAPI** | 现代异步 Python Web 框架 |
| **SQLAlchemy** | ORM，支持 SQLite/PostgreSQL |
| **Pydantic** | 数据验证和序列化 |
| **JWT** | 安全身份认证 |
| **ReportLab** | PDF 生成 |

### 前端
| 技术 | 用途 |
|------|------|
| **React 18** | UI 组件库 |
| **TypeScript** | 类型安全的 JavaScript |
| **Tailwind CSS** | 原子化 CSS 样式 |
| **Zustand** | 轻量级状态管理 |
| **Vite** | 快速构建工具和开发服务器 |
| **React Router** | 客户端路由 |

---

## 快速开始

### 环境要求
- Python 3.10+
- Node.js 18+
- Git

### 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/yourusername/HaoExam.git
cd HaoExam

# 2. 后端设置
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 3. 启动后端服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 4. 前端设置（新终端）
cd frontend
npm install
npm run dev

# 5. 打开浏览器
# 前端: http://localhost:5173
# 后端 API 文档: http://localhost:8000/docs
```

### 默认账户

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123 |
| 教师 | teacher1 | teacher123 |
| 学生 | student1 | student123 |

---

## 支持的科目

| 代码 | 科目 | 试卷 |
|------|------|------|
| 9709 | 数学 | P1, P2, P3, S1, M1 |
| 9701 | 化学 | P1, P2, P3, P4, P5 |
| 9702 | 物理 | P1, P2, P3, P4, P5 |
| 9708 | 经济学 | P1, P2, P3, P4 |

---

## 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| v2.1-beta | 2025-01-05 | 智能组卷系统 |
| v2.0-beta | 2024-12-17 | 多选筛选系统 |
| v1.1-alpha | 2024-12-15 | PDF 修复、测试框架 |
| v1.0-alpha | 2024-12-10 | 初始版本 |

详细更新日志请参阅 [CHANGELOG.md](CHANGELOG.md)。

---

## 贡献指南

欢迎贡献代码！请：

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

---

## 许可证

MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

---

## 作者

Hao Zhang

---

*最后更新: 2025-01-05*

**准备好开始了吗？运行上面的快速开始命令吧！**
