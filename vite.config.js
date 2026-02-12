import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages 部署時，base 需設為 repo 名稱
  // 例如 repo 名為 bigbang-timeline，則 base: '/bigbang-timeline/'
  // 本地開發時為 '/'
  base: process.env.VITE_BASE || '/',
})
