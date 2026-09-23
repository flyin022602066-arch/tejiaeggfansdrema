/**
 * 应用内引导漫游（driver.js）— 轻量方案
 *
 * - 各页面定义步骤（selector + i18n 文案 key），经 startTour() 启动
 * - 「看过」标记按 tour id 存 localStorage（huobao:tours），首次自动弹、
 *   帮助按钮随时重看；跳过/完成都算看过
 * - 主题样式沿用设计 token（火焰橙 accent），见 app.vue 内 .driver-theme 覆写
 */
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

const SEEN_KEY = 'huobao:tours'
const SEEN_COOKIE = 'huobao_tours'

function readSeen(): string[] {
  // The desktop backend uses a dynamic localhost port. localStorage is
  // origin-scoped (and therefore port-scoped), so it was reset on every app
  // launch. Cookies are scoped to the host, not the port, and persist across
  // those restarts; keep localStorage as a fallback for normal browser use.
  try {
    const cookie = document.cookie
      .split('; ')
      .find(entry => entry.startsWith(`${SEEN_COOKIE}=`))
    if (cookie) {
      const parsed = JSON.parse(decodeURIComponent(cookie.slice(SEEN_COOKIE.length + 1)))
      if (Array.isArray(parsed)) return parsed.filter(item => typeof item === 'string')
    }
  } catch { /* fall through to localStorage */ }
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]') } catch { return [] }
}

export function tourSeen(id: string): boolean {
  return readSeen().includes(id)
}

export function markTourSeen(id: string) {
  const seen = readSeen()
  if (!seen.includes(id)) {
    seen.push(id)
    const value = JSON.stringify(seen)
    try { localStorage.setItem(SEEN_KEY, value) } catch { /* 静默 */ }
    try {
      document.cookie = `${SEEN_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`
    } catch { /* 静默 */ }
  }
}

export interface TourStep {
  element: string            // CSS selector；'#__nuxt' 等兜底表示居中弹窗（无高亮）
  titleKey: string           // i18n key
  descKey: string            // i18n key
  popoverSide?: 'top' | 'bottom' | 'left' | 'right'
  popoverAlign?: 'start' | 'center' | 'end'
}

/**
 * 启动一段引导。t 为 useI18n 的翻译函数。
 * 返回是否真正启动（元素缺失或步骤为空时静默跳过）。
 */
export function startTour(id: string, steps: TourStep[], t: (key: string) => string): boolean {
  const usable = steps.filter(s => s.element === '#__nuxt' || document.querySelector(s.element))
  if (!usable.length) return false

  const drv = driver({
    showProgress: true,
    allowClose: true,
    overlayClickBehavior: 'nextStep',
    popoverClass: 'huobao-tour-popover',
    progressText: '{{current}} / {{total}}',
    nextBtnText: t('tour.next'),
    prevBtnText: t('tour.prev'),
    doneBtnText: t('tour.done'),
    onDestroyed: () => markTourSeen(id),
    steps: usable.map(s => ({
      element: s.element,
      popover: {
        title: t(s.titleKey),
        description: t(s.descKey),
        side: s.popoverSide || 'bottom',
        align: s.popoverAlign || 'start',
      },
    })),
  })
  drv.drive()
  return true
}

/** 首次进入自动引导：看过或元素未就绪则跳过 */
export function autoTour(id: string, steps: TourStep[], t: (key: string) => string) {
  if (tourSeen(id)) return
  const usable = steps.some(s => s.element === '#__nuxt' || document.querySelector(s.element))
  if (!usable) return
  // Record before opening so closing the first popover (or navigating away)
  // cannot cause it to reappear on the next launch.
  markTourSeen(id)
  startTour(id, steps, t)
}
