/**
 * 打包资源准备 — 组装 desktop/resources/（electron-builder extraResources 的来源）
 *
 * 1. frontend/           ← nuxt generate 产物（.output/public，含 index.html）
 * 2. workspace-template/ ← backend/workspace（skills + prompts，首启动拷入 userData）
 * 3. bin-<os>/           ← ffmpeg/ffprobe 按平台分目录（electron-builder ${os} 宏各取所需，
 *                          避免 mac 包带 exe、win 包带 mac 二进制白白 +144MB）
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DESKTOP = path.resolve(__dirname, '..')
const REPO = path.resolve(DESKTOP, '..')
const RES = path.join(DESKTOP, 'resources')

fs.rmSync(RES, { recursive: true, force: true })
fs.mkdirSync(RES, { recursive: true })

// 1. 前端静态产物
const frontendSrc = path.join(REPO, 'frontend', '.output', 'public')
if (!fs.existsSync(path.join(frontendSrc, 'index.html'))) {
  console.error('缺少前端产物：请先在 frontend/ 执行 npm run generate')
  process.exit(1)
}
fs.cpSync(frontendSrc, path.join(RES, 'frontend'), { recursive: true })
console.log('resources/frontend ✓')

// 2. workspace 模板（skills 技能 + prompts 提示词）
const workspaceSrc = path.join(REPO, 'backend', 'workspace')
fs.cpSync(workspaceSrc, path.join(RES, 'workspace-template'), { recursive: true })
console.log('resources/workspace-template ✓')

// 3. ffmpeg 二进制。目录名必须与 electron-builder 的 ${os} 值一致：
//    darwin / win32。优先使用 desktop 依赖，包壳存在但二进制缺失时回退 backend 依赖。
const req = createRequire(import.meta.url)
const backendReq = createRequire(path.join(REPO, 'backend', 'package.json'))
const binDarwin = path.join(RES, 'bin-darwin')
const binWin32 = path.join(RES, 'bin-win32')

function resolveBinary(moduleName) {
  for (const resolver of [req, backendReq]) {
    try {
      const mod = resolver(moduleName)
      const candidate = moduleName === 'ffprobe-static' ? mod?.path : mod
      if (candidate && fs.existsSync(candidate)) return candidate
    } catch { /* 尝试下一个依赖根 */ }
  }
  return null
}

const currentFfmpeg = resolveBinary('ffmpeg-static')
const currentFfprobe = resolveBinary('ffprobe-static')
if (currentFfmpeg && currentFfprobe) {
  const targetDir = process.platform === 'win32' ? binWin32 : binDarwin
  const exe = process.platform === 'win32' ? '.exe' : ''
  fs.mkdirSync(targetDir, { recursive: true })
  fs.copyFileSync(currentFfmpeg, path.join(targetDir, `ffmpeg${exe}`))
  fs.copyFileSync(currentFfprobe, path.join(targetDir, `ffprobe${exe}`))
  if (!exe) {
    fs.chmodSync(path.join(targetDir, 'ffmpeg'), 0o755)
    fs.chmodSync(path.join(targetDir, 'ffprobe'), 0o755)
  }
  console.log(`resources/bin-${process.platform} ✓`)
}

// 3b. macOS/Linux 交叉打 Windows 包时可使用预先缓存的 Windows 二进制。
const winBinDir = path.join(DESKTOP, 'build', 'win-bin')
const ffmpegWin = path.join(winBinDir, 'ffmpeg.exe')
const ffprobeWinSrc = path.join(path.dirname(req.resolve('ffprobe-static/package.json')), 'bin', 'win32', 'x64', 'ffprobe.exe')
if (fs.existsSync(ffmpegWin) && fs.existsSync(ffprobeWinSrc)) {
  fs.mkdirSync(binWin32, { recursive: true })
  fs.copyFileSync(ffmpegWin, path.join(binWin32, 'ffmpeg.exe'))
  fs.copyFileSync(ffprobeWinSrc, path.join(binWin32, 'ffprobe.exe'))
  console.log('resources/bin-win32 ✓')
} else if (process.platform !== 'win32') {
  console.warn('提示: 缺少 build/win-bin/ffmpeg.exe，Windows 包将无法内置 ffmpeg。' +
    '获取: https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/ffmpeg-win32-x64')
}

const currentTargetDir = process.platform === 'win32' ? binWin32 : binDarwin
const currentExe = process.platform === 'win32' ? '.exe' : ''
if (!fs.existsSync(path.join(currentTargetDir, `ffmpeg${currentExe}`))
  || !fs.existsSync(path.join(currentTargetDir, `ffprobe${currentExe}`))) {
  console.error('ffmpeg-static/ffprobe-static 本机二进制缺失，请重新 npm install（或配置 FFMPEG_BINARIES_URL 镜像）')
  process.exit(1)
}
