/**
 * DifficultyEqualizer - 难度均衡器组件
 *
 * 音响 EQ 风格的三联动滑块，控制 Easy/Medium/Hard 比例
 * 总和始终保持 100%
 * 使用 shallow 选择器优化性能
 */
import { useDifficultyStore } from '../../store/generatorStore'

const difficulties = [
  {
    key: 'Easy' as const,
    label: 'EASY',
    color: 'bg-pixel-green',
    borderColor: 'border-pixel-green',
    icon: 'fa-face-smile',
  },
  {
    key: 'Medium' as const,
    label: 'MEDIUM',
    color: 'bg-pixel-yellow',
    borderColor: 'border-pixel-yellow',
    icon: 'fa-face-meh',
  },
  {
    key: 'Hard' as const,
    label: 'HARD',
    color: 'bg-pixel-red',
    borderColor: 'border-pixel-red',
    icon: 'fa-face-tired',
  },
]

export default function DifficultyEqualizer() {
  const { difficultyRatio, setDifficultyRatio } = useDifficultyStore()

  return (
    <div className="pixel-card">
      {/* Header */}
      <div className="bg-pixel-secondary border-b-4 border-pixel-dark px-4 py-2">
        <h2 className="font-pixel text-xl text-white flex items-center gap-2">
          <i className="fa-solid fa-sliders"></i>
          DIFFICULTY MIX
        </h2>
      </div>

      {/* EQ Sliders */}
      <div className="p-6">
        <div className="flex justify-center items-end gap-8 md:gap-12">
          {difficulties.map(({ key, label, color, borderColor, icon }) => (
            <div key={key} className="flex flex-col items-center">
              {/* Value Display */}
              <div
                className={`w-16 h-10 ${color} border-4 border-pixel-dark flex items-center justify-center mb-3 shadow-pixel-sm`}
              >
                <span className="font-pixel text-lg text-white drop-shadow-[1px_1px_0_rgba(0,0,0,0.5)]">
                  {difficultyRatio[key]}%
                </span>
              </div>

              {/* Vertical Slider Track */}
              <div className="relative h-32 w-10 bg-pixel-gray-200 border-4 border-pixel-dark">
                {/* Filled Portion */}
                <div
                  className={`absolute bottom-0 left-0 right-0 ${color} transition-all duration-150`}
                  style={{ height: `${difficultyRatio[key]}%` }}
                />

                {/* Invisible Range Input (overlay) */}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={difficultyRatio[key]}
                  onChange={(e) => setDifficultyRatio(key, parseInt(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  style={{
                    writingMode: 'vertical-lr',
                    WebkitAppearance: 'slider-vertical',
                    direction: 'rtl',
                  }}
                />

                {/* Level Markers */}
                <div className="absolute left-full ml-1 h-full flex flex-col justify-between text-[8px] font-pixel text-pixel-gray-400">
                  <span>100</span>
                  <span>50</span>
                  <span>0</span>
                </div>
              </div>

              {/* Label & Icon */}
              <div className="mt-3 text-center">
                <i className={`fa-solid ${icon} text-2xl ${color.replace('bg-', 'text-')} mb-1 block`}></i>
                <span className="font-pixel text-xs text-pixel-dark">{label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Total Indicator */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-pixel-gray-100 border-2 border-pixel-gray-300">
            <span className="font-pixel text-sm text-pixel-gray-500">TOTAL:</span>
            <span
              className={`font-pixel text-sm ${
                difficultyRatio.Easy + difficultyRatio.Medium + difficultyRatio.Hard === 100
                  ? 'text-pixel-green'
                  : 'text-pixel-red'
              }`}
            >
              {difficultyRatio.Easy + difficultyRatio.Medium + difficultyRatio.Hard}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
