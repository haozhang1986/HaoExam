/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // 复古像素调色板
      colors: {
        // 基础色
        'pixel-bg': '#f5f5f0',       // 米色背景
        'pixel-dark': '#1a1a1a',     // 深黑色 (边框/文字)
        'pixel-white': '#ffffff',    // 纯白

        // 主色调
        'pixel-primary': '#4d9be6',   // 复古蓝
        'pixel-secondary': '#3d6fb4', // 深蓝

        // 强调色
        'pixel-red': '#e74c3c',       // 复古红
        'pixel-pink': '#ef6b8c',      // 粉色
        'pixel-yellow': '#f6d55c',    // 复古黄
        'pixel-green': '#8fd032',     // 复古绿
        'pixel-orange': '#e67e22',    // 橙色
        'pixel-purple': '#9b59b6',    // 紫色
        'pixel-cyan': '#1abc9c',      // 青色

        // 灰度
        'pixel-gray': {
          100: '#f0f0f0',
          200: '#e0e0e0',
          300: '#c0c0c0',
          400: '#a0a0a0',
          500: '#808080',
          600: '#606060',
          700: '#404040',
          800: '#303030',
          900: '#202020',
        },

        // 兼容旧的 primary 色彩
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#4d9be6', // 改为像素蓝
          600: '#3d6fb4',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        }
      },

      // 像素字体
      fontFamily: {
        'pixel': ['"VT323"', 'Zpix', 'monospace'],      // 像素标题字体
        'pixel-cn': ['Zpix', '"VT323"', 'monospace'],   // 像素中文字体
        'mono': ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },

      // 硬朗的像素阴影 (无模糊)
      boxShadow: {
        'pixel': '4px 4px 0px 0px #1a1a1a',
        'pixel-sm': '2px 2px 0px 0px #1a1a1a',
        'pixel-lg': '8px 8px 0px 0px #1a1a1a',
        'pixel-hover': '6px 6px 0px 0px #1a1a1a',
        'pixel-pressed': '2px 2px 0px 0px #1a1a1a',
        'pixel-blue': '4px 4px 0px 0px #4d9be6',
        'pixel-red': '4px 4px 0px 0px #e74c3c',
        'pixel-green': '4px 4px 0px 0px #8fd032',
        'pixel-yellow': '4px 4px 0px 0px #f6d55c',
        'none': 'none',
      },

      // 粗边框宽度
      borderWidth: {
        '3': '3px',
        '4': '4px',
        '6': '6px',
        '8': '8px',
      },

      // 像素风动画
      animation: {
        'blink': 'blink 1s step-end infinite',
        'pixel-bounce': 'pixel-bounce 0.5s ease-in-out infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'pixel-bounce': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },

      // 确保没有圆角的快速类
      borderRadius: {
        'none': '0px',
        'pixel': '0px',
      },

      // 像素风字体大小
      fontSize: {
        'pixel-xs': ['12px', { lineHeight: '1.2' }],
        'pixel-sm': ['16px', { lineHeight: '1.3' }],
        'pixel-base': ['20px', { lineHeight: '1.4' }],
        'pixel-lg': ['24px', { lineHeight: '1.4' }],
        'pixel-xl': ['32px', { lineHeight: '1.3' }],
        'pixel-2xl': ['40px', { lineHeight: '1.2' }],
        'pixel-3xl': ['48px', { lineHeight: '1.1' }],
        'pixel-4xl': ['64px', { lineHeight: '1' }],
      },
    },
  },
  plugins: [],
}
