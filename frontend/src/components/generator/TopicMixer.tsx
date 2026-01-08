/**
 * TopicMixer - 知识点混合器组件
 *
 * 手风琴结构，支持 Topic 和 Subtopic 两级权重调节
 * 使用 shallow 选择器优化性能
 */
import { useState, useRef, useEffect } from 'react'
import { useTopicMixerStore } from '../../store/generatorStore'

export default function TopicMixer() {
  const {
    topicWeights,
    setTopicWeight,
    setSubtopicWeight,
    toggleTopicExpanded,
    resetTopicWeights,
    normalizeTopicWeights,
    normalizeSubtopicWeights,
  } = useTopicMixerStore()

  // 编辑状态: { type: 'topic' | 'subtopic', topic: string, subtopic?: string }
  const [editing, setEditing] = useState<{
    type: 'topic' | 'subtopic'
    topic: string
    subtopic?: string
  } | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // 当开始编辑时，聚焦输入框
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  // 开始编辑 Topic 权重
  const startEditTopic = (topic: string, currentWeight: number) => {
    setEditing({ type: 'topic', topic })
    setEditValue(currentWeight.toString())
  }

  // 开始编辑 Subtopic 权重
  const startEditSubtopic = (topic: string, subtopic: string, currentWeight: number) => {
    setEditing({ type: 'subtopic', topic, subtopic })
    setEditValue(currentWeight.toString())
  }

  // 提交编辑
  const commitEdit = () => {
    if (!editing) return

    const value = Math.max(0, Math.min(100, parseInt(editValue) || 0))

    if (editing.type === 'topic') {
      setTopicWeight(editing.topic, value)
    } else if (editing.subtopic) {
      setSubtopicWeight(editing.topic, editing.subtopic, value)
    }

    setEditing(null)
    setEditValue('')
  }

  // 取消编辑
  const cancelEdit = () => {
    setEditing(null)
    setEditValue('')
  }

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitEdit()
    } else if (e.key === 'Escape') {
      cancelEdit()
    }
  }

  // 计算总权重
  const totalWeight = topicWeights.reduce((sum, tw) => sum + tw.weight, 0)

  if (topicWeights.length === 0) {
    return (
      <div className="pixel-card">
        {/* Header */}
        <div className="bg-pixel-purple border-b-4 border-pixel-dark px-4 py-2">
          <h2 className="font-pixel text-xl text-white flex items-center gap-2">
            <i className="fa-solid fa-layer-group"></i>
            TOPIC MIXER
          </h2>
        </div>

        {/* Empty State */}
        <div className="p-8 text-center">
          <i className="fa-solid fa-arrow-up text-4xl text-pixel-gray-300 mb-3 block animate-bounce"></i>
          <p className="font-pixel text-pixel-gray-400 text-sm">
            SELECT SUBJECT & PAPER FIRST
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="pixel-card">
      {/* Header */}
      <div className="bg-pixel-purple border-b-4 border-pixel-dark px-4 py-2 flex items-center justify-between">
        <h2 className="font-pixel text-xl text-white flex items-center gap-2">
          <i className="fa-solid fa-layer-group"></i>
          TOPIC MIXER
        </h2>
        <div className="flex items-center gap-2">
          {/* Reset Button */}
          <button
            onClick={resetTopicWeights}
            className="px-2 py-1 bg-pixel-gray-100 border-2 border-pixel-dark font-pixel text-[10px] text-pixel-dark hover:bg-pixel-gray-200 transition-colors"
            title="均匀分配所有权重"
          >
            <i className="fa-solid fa-rotate-left mr-1"></i>
            RESET
          </button>
          {/* Normalize Button - only show when not 100% */}
          {totalWeight !== 100 && totalWeight > 0 && (
            <button
              onClick={normalizeTopicWeights}
              className="px-2 py-1 bg-pixel-yellow border-2 border-pixel-dark font-pixel text-[10px] text-pixel-dark hover:bg-yellow-400 transition-colors animate-pulse"
              title="归一化到 100%"
            >
              <i className="fa-solid fa-scale-balanced mr-1"></i>
              FIX
            </button>
          )}
          {/* Total Badge */}
          <span
            className={`font-pixel text-sm px-2 py-1 border-2 border-pixel-dark ${
              totalWeight === 100
                ? 'bg-pixel-green text-white'
                : 'bg-pixel-yellow text-pixel-dark'
            }`}
          >
            {totalWeight}%
          </span>
        </div>
      </div>

      {/* Topic List */}
      <div className="divide-y-4 divide-pixel-gray-200 max-h-[400px] overflow-y-auto">
        {topicWeights.map((topic) => (
          <div key={topic.topic} className="bg-pixel-white">
            {/* Topic Row - Level 1 */}
            <div
              className="flex items-center gap-3 p-3 hover:bg-pixel-gray-50 cursor-pointer transition-colors"
              onClick={() => toggleTopicExpanded(topic.topic)}
            >
              {/* Expand/Collapse Button */}
              <button
                className="w-8 h-8 border-2 border-pixel-dark flex items-center justify-center bg-pixel-gray-100 hover:bg-pixel-gray-200 transition-colors flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleTopicExpanded(topic.topic)
                }}
              >
                <i
                  className={`fa-solid ${
                    topic.expanded ? 'fa-chevron-down' : 'fa-chevron-right'
                  } text-sm`}
                ></i>
              </button>

              {/* Topic Name */}
              <div className="flex-1 font-pixel text-sm text-pixel-dark truncate min-w-0">
                {topic.topic}
              </div>

              {/* Weight Slider */}
              <div
                className="flex items-center gap-2 flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={topic.weight}
                  onChange={(e) => setTopicWeight(topic.topic, parseInt(e.target.value))}
                  className="w-24 pixel-slider"
                />
                {/* Editable Weight Badge */}
                {editing?.type === 'topic' && editing.topic === topic.topic ? (
                  <input
                    ref={inputRef}
                    type="number"
                    min={0}
                    max={100}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={handleKeyDown}
                    className="w-14 h-7 bg-white border-2 border-pixel-primary font-pixel text-xs text-center outline-none"
                  />
                ) : (
                  <button
                    onClick={() => startEditTopic(topic.topic, topic.weight)}
                    className="w-14 h-7 bg-pixel-primary border-2 border-pixel-dark flex items-center justify-center hover:bg-indigo-600 transition-colors cursor-text"
                    title="点击编辑"
                  >
                    <span className="font-pixel text-xs text-white">{topic.weight}%</span>
                  </button>
                )}
              </div>
            </div>

            {/* Subtopic Rows - Level 2 */}
            {topic.expanded && topic.subtopics.length > 0 && (
              <div className="bg-pixel-gray-50 border-t-2 border-pixel-gray-200">
                {/* Subtopic Total Header */}
                {(() => {
                  const subtopicTotal = topic.subtopics.reduce((sum, sw) => sum + sw.weight, 0)
                  return (
                    <div className="flex items-center justify-end gap-2 px-4 py-1 bg-pixel-gray-100 border-b border-pixel-gray-200">
                      <span className="font-pixel text-[9px] text-pixel-gray-500">SUBTOPIC TOTAL:</span>
                      {subtopicTotal !== 100 && subtopicTotal > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            normalizeSubtopicWeights(topic.topic)
                          }}
                          className="px-1.5 py-0.5 bg-pixel-yellow border border-pixel-dark font-pixel text-[8px] text-pixel-dark hover:bg-yellow-400 transition-colors"
                          title="归一化 Subtopic 权重到 100%"
                        >
                          <i className="fa-solid fa-scale-balanced mr-0.5"></i>
                          FIX
                        </button>
                      )}
                      <span
                        className={`font-pixel text-[10px] px-1.5 py-0.5 border border-pixel-dark ${
                          subtopicTotal === 100
                            ? 'bg-pixel-green text-white'
                            : 'bg-pixel-yellow text-pixel-dark'
                        }`}
                      >
                        {subtopicTotal}%
                      </span>
                    </div>
                  )
                })()}
                {topic.subtopics.map((subtopic, idx) => (
                  <div
                    key={subtopic.subtopic}
                    className={`flex items-center gap-3 px-4 py-2 pl-14 hover:bg-pixel-gray-100 transition-colors ${
                      idx < topic.subtopics.length - 1 ? 'border-b border-pixel-gray-200' : ''
                    }`}
                  >
                    {/* Subtopic Indicator */}
                    <div className="w-2 h-2 bg-pixel-secondary flex-shrink-0"></div>

                    {/* Subtopic Name */}
                    <div className="flex-1 font-pixel text-xs text-pixel-gray-600 truncate min-w-0">
                      {subtopic.subtopic}
                    </div>

                    {/* Subtopic Weight Slider */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={subtopic.weight}
                        onChange={(e) =>
                          setSubtopicWeight(topic.topic, subtopic.subtopic, parseInt(e.target.value))
                        }
                        className="w-20 pixel-slider pixel-slider-secondary"
                      />
                      {/* Editable Subtopic Weight Badge */}
                      {editing?.type === 'subtopic' &&
                       editing.topic === topic.topic &&
                       editing.subtopic === subtopic.subtopic ? (
                        <input
                          ref={inputRef}
                          type="number"
                          min={0}
                          max={100}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={handleKeyDown}
                          className="w-12 h-6 bg-white border-2 border-pixel-secondary font-pixel text-[10px] text-center outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => startEditSubtopic(topic.topic, subtopic.subtopic, subtopic.weight)}
                          className="w-12 h-6 bg-pixel-secondary border-2 border-pixel-dark flex items-center justify-center hover:bg-blue-600 transition-colors cursor-text"
                          title="点击编辑"
                        >
                          <span className="font-pixel text-[10px] text-white">{subtopic.weight}%</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Helper Text */}
      <div className="px-4 py-2 bg-pixel-gray-100 border-t-2 border-pixel-gray-200">
        <p className="font-pixel text-[10px] text-pixel-gray-400 text-center">
          DRAG SLIDER OR CLICK % TO EDIT | ENTER TO CONFIRM
        </p>
      </div>
    </div>
  )
}
