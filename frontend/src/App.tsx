import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import GalleryPage from './pages/GalleryPage'
import AdminUploadPage from './pages/AdminUploadPage'
import StudioPage from './pages/StudioPage'
import GeneratorPage from './pages/GeneratorPage'
import PaperFloatingCart from './components/PaperFloatingCart'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/admin/upload" element={<AdminUploadPage />} />
        <Route path="/studio" element={<StudioPage />} />
        <Route path="/generator" element={<GeneratorPage />} />
      </Routes>
      {/* 悬浮试卷篮 - 全局可用 */}
      <PaperFloatingCart />
    </BrowserRouter>
  )
}

function HomePage() {
  return (
    <div className="min-h-screen bg-pixel-bg">
      {/* 像素风导航栏 - 游戏 HUD 风格 */}
      <nav className="pixel-navbar">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-gamepad text-2xl"></i>
              <span className="font-pixel text-3xl tracking-widest mt-1">HAOEXAM.exe</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/gallery"
                className="font-pixel text-xl bg-pixel-dark text-white px-4 py-1 border-2 border-pixel-dark hover:bg-pixel-primary transition-colors"
              >
                [ ENTER ]
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* 主内容区域 */}
      <main className="pt-24 pb-16 px-4">
        {/* 欢迎区块 - 终端风格 */}
        <div className="max-w-4xl mx-auto">
          <div className="pixel-card shadow-pixel-lg">
            <div className="p-8 text-center">
              <h1 className="font-pixel text-5xl md:text-7xl mb-4 text-pixel-dark">
                READY PLAYER ONE?
              </h1>
              <p className="text-lg font-bold mb-8 uppercase tracking-widest bg-pixel-yellow inline-block px-3 py-1 border-2 border-pixel-dark">
                A-Level / AP Math Database v2.0
              </p>

              {/* 终端风格搜索框 */}
              <div className="max-w-2xl mx-auto bg-pixel-dark p-2 shadow-pixel text-left">
                <div className="bg-pixel-dark text-green-400 font-mono text-xl p-2 flex items-center">
                  <span className="mr-2">user@haoexam:~$</span>
                  <input
                    type="text"
                    className="pixel-input-terminal flex-1"
                    placeholder="INPUT SEARCH KEYWORD..."
                  />
                  <span className="w-3 h-6 bg-green-400 cursor-blink block"></span>
                </div>
              </div>
              <p className="mt-4 text-xs font-bold text-pixel-gray-500 uppercase">
                <i className="fa-solid fa-arrow-up mr-1"></i> Press Enter to Search
              </p>
            </div>
          </div>
        </div>

        {/* 功能卡片区域 */}
        <div className="max-w-7xl mx-auto mt-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              title="MISSION: BANK"
              description="浏览所有真题数据，寻找解题线索。"
              icon="fa-book"
              href="/gallery"
              color="pixel-primary"
              playerType="All"
            />
            <FeatureCard
              title="STUDIO_MODE"
              description="手动创建或编辑单个题目数据。"
              icon="fa-wrench"
              href="/studio"
              color="pixel-yellow"
              playerType="Editor"
            />
            <FeatureCard
              title="BATCH_IMPORT"
              description="支持 ZIP 包批量上传题目。"
              icon="fa-box-archive"
              href="/admin/upload"
              color="pixel-green"
              playerType="Admin"
            />
            <FeatureCard
              title="AUTO_GENERATE"
              description="智能组卷：按知识点+难度比例生成试卷。"
              icon="fa-wand-magic-sparkles"
              href="/generator"
              color="pixel-pink"
              playerType="Teacher"
            />
          </div>
        </div>
      </main>

      {/* 底部状态栏 - 游戏 HUD 风格 */}
      <footer className="pixel-statusbar">
        <span>STATUS: ONLINE</span>
        <span>VERSION: 2.0</span>
        <span>CREDITS: 2025</span>
      </footer>
    </div>
  )
}

interface FeatureCardProps {
  title: string
  description: string
  icon: string
  href: string
  color: string
  playerType: string
  disabled?: boolean
}

function FeatureCard({ title, description, icon, href, color, playerType, disabled }: FeatureCardProps) {
  const colorClasses: Record<string, { header: string; tag: string }> = {
    'pixel-primary': { header: 'bg-pixel-primary', tag: 'bg-blue-100' },
    'pixel-yellow': { header: 'bg-pixel-yellow', tag: 'bg-yellow-100' },
    'pixel-green': { header: 'bg-pixel-green', tag: 'bg-green-100' },
    'pixel-pink': { header: 'bg-pixel-pink', tag: 'bg-pink-100' },
  }

  const styles = colorClasses[color] || colorClasses['pixel-primary']

  const cardContent = (
    <div
      className={`pixel-card cursor-pointer transition-transform duration-200 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-2'
      }`}
    >
      {/* 卡片头部 - 图标区域 */}
      <div className={`${styles.header} border-b-4 border-pixel-dark p-4 text-center`}>
        <i className={`fa-solid ${icon} text-4xl text-white drop-shadow-[2px_2px_0_rgba(0,0,0,1)]`}></i>
      </div>

      {/* 卡片主体 */}
      <div className="p-6 text-center">
        <h3 className="font-pixel text-2xl mb-2">{title}</h3>
        <p className="text-sm font-bold mb-4 min-h-[40px]">{description}</p>
        <span className={`inline-block border-2 border-pixel-dark px-3 py-1 text-xs font-bold uppercase ${styles.tag}`}>
          Player: {playerType}
        </span>
        {disabled && (
          <span className="block mt-2 text-xs text-pixel-gray-500 uppercase">[ DEV IN PROGRESS ]</span>
        )}
      </div>
    </div>
  )

  if (disabled) {
    return cardContent
  }

  return <Link to={href}>{cardContent}</Link>
}

export default App
