<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { onMounted, onUnmounted } from 'vue'

const { Layout } = DefaultTheme

const PRESS_THRESHOLD = 300
const PRESS_DURATION = 1500
const STORAGE_KEY = 'zviewer-bg-enabled'

let pressTimer: ReturnType<typeof setTimeout> | null = null
let rafId: number | null = null
let pressStartTime = 0
let isLongPress = false
let shouldBlockClick = false
let loadingElement: HTMLElement | null = null
let observer: MutationObserver | null = null
let bindRetryTimer: ReturnType<typeof setTimeout> | null = null

function loadBgState() {
  const enabled = localStorage.getItem(STORAGE_KEY) === 'true'
  document.documentElement.setAttribute('data-bg', enabled ? 'true' : 'false')
}

function toggleBg() {
  const current = document.documentElement.getAttribute('data-bg') === 'true'
  const next = !current
  document.documentElement.setAttribute('data-bg', next ? 'true' : 'false')
  localStorage.setItem(STORAGE_KEY, next ? 'true' : 'false')
}

function createLoadingElement(): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'bg-press-loading'
  wrapper.innerHTML = `
    <svg viewBox="0 0 36 36" class="bg-press-svg">
      <circle class="bg-press-track" cx="18" cy="18" r="16" />
      <circle class="bg-press-progress" cx="18" cy="18" r="16" />
    </svg>
  `
  return wrapper
}

function startPress(e: Event) {
  isLongPress = false
  pressStartTime = Date.now()

  // 在事件处理函数同步执行期间保存按钮引用
  // event.currentTarget 在事件冒泡完成后会被重置为 null
  const button = e.currentTarget as HTMLElement
  if (!button) return

  // 绑定本次交互的结束处理器
  const onPressEnd = (ev: Event) => endPressWithButton(ev, button)
  button.addEventListener('mouseup', onPressEnd, { capture: true, once: true })
  button.addEventListener('mouseleave', onPressEnd, { capture: true, once: true })
  button.addEventListener('touchend', onPressEnd, { capture: true, once: true })
  button.addEventListener('touchcancel', onPressEnd, { capture: true, once: true })

  pressTimer = setTimeout(() => {
    isLongPress = true

    loadingElement = createLoadingElement()
    button.appendChild(loadingElement)

    const progressCircle = loadingElement.querySelector('.bg-press-progress') as SVGCircleElement
    const circumference = 2 * Math.PI * 16
    progressCircle.style.strokeDasharray = `${circumference}`
    progressCircle.style.strokeDashoffset = `${circumference}`

    function updateProgress() {
      const elapsed = Date.now() - pressStartTime - PRESS_THRESHOLD
      const remaining = PRESS_DURATION - PRESS_THRESHOLD
      const progress = Math.min(elapsed / remaining, 1)

      progressCircle.style.strokeDashoffset = `${circumference * (1 - progress)}`

      if (elapsed >= remaining) {
        removeLoading()
        toggleBg()
        shouldBlockClick = true
        isLongPress = false
        setTimeout(() => { shouldBlockClick = false }, 200)
        return
      }

      rafId = requestAnimationFrame(updateProgress)
    }

    rafId = requestAnimationFrame(updateProgress)
  }, PRESS_THRESHOLD)
}

function endPressWithButton(e: Event, button: HTMLElement) {
  endPress(e)

  // 只有在长按被触发后才阻止 click 事件切换主题
  if (shouldBlockClick) {
    const block = (ev: Event) => {
      ev.stopPropagation()
      ev.preventDefault()
    }
    button.addEventListener('click', block, { capture: true, once: true })
  }
}

function removeLoading() {
  if (loadingElement) {
    loadingElement.remove()
    loadingElement = null
  }
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

function endPress(e: Event) {
  if (pressTimer) {
    clearTimeout(pressTimer)
    pressTimer = null
  }
  removeLoading()

  if (isLongPress || shouldBlockClick) {
    shouldBlockClick = true
    isLongPress = false
    if (e.type === 'touchend' || e.type === 'touchcancel') {
      e.preventDefault()
    }
    setTimeout(() => { shouldBlockClick = false }, 200)
  }
}

function bindButton() {
  const button = document.querySelector('.VPNavBarAppearance .VPSwitch') as HTMLElement
  if (!button || button.dataset.longPressBound) return

  button.dataset.longPressBound = 'true'
  button.style.position = 'relative'

  button.addEventListener('mousedown', startPress)
  button.addEventListener('touchstart', startPress, { passive: true })

  // 在父容器上捕获阶段阻止 click，防止长按后误触发主题切换
  const container = document.querySelector('.VPNavBarAppearance')
  if (container) {
    container.addEventListener('click', (e) => {
      if (shouldBlockClick) {
        e.stopPropagation()
        e.preventDefault()
        shouldBlockClick = false
      }
    }, true)
  }
}

onMounted(() => {
  loadBgState()

  const tryBind = () => {
    bindButton()
    const button = document.querySelector('.VPNavBarAppearance .VPSwitch')
    if (!button || !button.dataset.longPressBound) {
      bindRetryTimer = setTimeout(tryBind, 200)
    }
  }
  setTimeout(tryBind, 100)

  observer = new MutationObserver(() => {
    const button = document.querySelector('.VPNavBarAppearance .VPSwitch')
    if (button && !button.dataset.longPressBound) {
      bindButton()
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
})

onUnmounted(() => {
  if (observer) {
    observer.disconnect()
    observer = null
  }
  if (bindRetryTimer) {
    clearTimeout(bindRetryTimer)
    bindRetryTimer = null
  }
  if (pressTimer) {
    clearTimeout(pressTimer)
    pressTimer = null
  }
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  removeLoading()
})
</script>

<template>
  <Layout />
</template>
