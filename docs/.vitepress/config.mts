import { defineConfig } from 'vitepress'

export default defineConfig({
  cleanUrls: true,
  lastUpdated: true,
  outDir: '../dist',

  head: [
    // 网站图标（favicon）
    ['link', { rel: 'icon', type: 'image/jpeg', href: '/favicon.jpg' }],
    ['link', { rel: 'apple-touch-icon', href: '/favicon.jpg' }],
    // 社交分享缩略图
    ['meta', { property: 'og:image', content: '/favicon.jpg' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    // 不蒜子访问统计
    ['script', { src: 'https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js', async: true, defer: true }],
    // 背景图状态预加载（防止页面闪烁）
    ['script', {}, `
      (function() {
        try {
          var enabled = localStorage.getItem('zviewer-bg-enabled') === 'true'
          document.documentElement.setAttribute('data-bg', enabled ? 'true' : 'false')
        } catch(e) {
          document.documentElement.setAttribute('data-bg', 'false')
        }
      })()
    `],
    // 自动语言检测：首次访问根路径时根据浏览器语言重定向到 /en/
    ['script', {}, `
      (function() {
        var lang = navigator.language || navigator.userLanguage || ''
        var path = window.location.pathname
        if (path === '/' || path === '' || path === '/index.html') {
          var redirected = sessionStorage.getItem('zviewer-lang-redirected')
          if (!redirected && lang && !lang.startsWith('zh')) {
            sessionStorage.setItem('zviewer-lang-redirected', 'true')
            window.location.replace('/en/')
          }
        }
      })()
    `],
  ],

  locales: {
    root: {
      lang: 'zh-CN',
      label: '中文',
      title: 'ZViewer 文档',
      description: '多人同步观影、追番与远程共享平台',

      themeConfig: {
        siteTitle: 'ZViewer 文档',
        logo: '/favicon.jpg',
        search: {
          provider: 'local',
          options: {
            translations: {
              button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
              modal: {
                noResultsText: '无法找到相关结果',
                resetButtonTitle: '清除查询条件',
                footer: {
                  selectText: '选择',
                  navigateText: '切换',
                  closeText: '关闭',
                },
              },
            },
          },
        },
        nav: [
          { text: '基础教程', link: '/basic/', activeMatch: '/basic/' },
          { text: '拓展教程', link: '/advanced/', activeMatch: '/advanced/' },
          { text: 'GitHub', link: 'https://github.com/Zero-wyc/ZViewer' },
        ],
        sidebar: {
          '/basic/': [
            {
              text: '基础教程',
              items: [
                { text: '快速上手', link: '/basic/' },
                { text: '安装与部署', link: '/basic/install' },
                { text: '功能说明', link: '/basic/features' },
                { text: 'ZViewerCLI 本地代理', link: '/basic/cli' },
                { text: '管理后台与权限', link: '/basic/admin' },
                { text: 'HTTPS 证书', link: '/basic/https' },
                { text: '网络连接与内网穿透', link: '/basic/network' },
                { text: '常见问题', link: '/basic/faq' },
              ],
            },
          ],
          '/advanced/': [
            {
              text: '拓展教程',
              items: [
                { text: '架构总览', link: '/advanced/' },
                { text: '房间同步逻辑', link: '/advanced/sync' },
                { text: '视频源与 API 获取逻辑', link: '/advanced/video-pipeline' },
                { text: '一起听音乐管线', link: '/advanced/music-pipeline' },
                { text: 'ZViewerCLI 代理协议', link: '/advanced/cli-protocol' },
                { text: '主题系统实现', link: '/advanced/theme-system' },
                { text: '鉴权与权限模型', link: '/advanced/auth' },
                { text: 'REST API 参考', link: '/advanced/api' },
                { text: '环境变量', link: '/advanced/env' },
                { text: '构建与更新机制', link: '/advanced/build-update' },
              ],
            },
          ],
        },
        outline: {
          level: [2, 3],
          label: '本页目录',
        },
        docFooter: {
          prev: '上一页',
          next: '下一页',
        },
        darkModeSwitchLabel: '外观',
        sidebarMenuLabel: '菜单',
        returnToTopLabel: '返回顶部',
        lastUpdatedText: '最后更新于',
        footer: {
          message: '本项目遵循 <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.en" target="_blank" rel="noopener noreferrer">CC BY-NC-SA</a> 许可。',
          copyright: 'Copyright © Zero-wyc / ZViewer Contributors',
        },
      },
    },

    en: {
      lang: 'en-US',
      label: 'English',
      title: 'ZViewer Documentation',
      description: 'Multi-user synchronized video watching, anime tracking & remote sharing platform',

      themeConfig: {
        siteTitle: 'ZViewer Docs',
        logo: '/favicon.jpg',
        search: {
          provider: 'local',
          options: {
            translations: {
              button: { buttonText: 'Search', buttonAriaLabel: 'Search documentation' },
              modal: {
                noResultsText: 'No results found',
                resetButtonTitle: 'Clear search',
                footer: {
                  selectText: 'Select',
                  navigateText: 'Navigate',
                  closeText: 'Close',
                },
              },
            },
          },
        },
        nav: [
          { text: 'Guide', link: '/en/guide/getting-started', activeMatch: '/en/guide/' },
          { text: 'Features', link: '/en/features/rooms', activeMatch: '/en/features/' },
          { text: 'Admin', link: '/en/admin/permissions', activeMatch: '/en/admin/' },
          { text: 'CLI Agent', link: '/en/cli/', activeMatch: '/en/cli/' },
          { text: 'Development', link: '/en/dev/setup', activeMatch: '/en/dev/' },
          { text: 'GitHub', link: 'https://github.com/Zero-wyc/ZViewer' },
        ],
        sidebar: {
          '/en/guide/': [
            {
              text: 'Guide',
              items: [
                { text: 'Getting Started', link: '/en/guide/getting-started' },
                { text: 'Deployment', link: '/en/guide/deployment' },
                { text: 'HTTPS & Certificates', link: '/en/guide/https' },
                { text: 'FAQ', link: '/en/guide/faq' },
              ],
            },
          ],
          '/en/features/': [
            {
              text: 'Features',
              items: [
                { text: 'Watch Rooms', link: '/en/features/rooms' },
                { text: 'Listen Together', link: '/en/features/music' },
                { text: 'Video Sources', link: '/en/features/video-sources' },
                { text: 'Real-time Interaction', link: '/en/features/interaction' },
                { text: 'Danmaku System', link: '/en/features/danmaku' },
                { text: 'Screen Share & Streaming', link: '/en/features/screenshare' },
              ],
            },
          ],
          '/en/admin/': [
            {
              text: 'Administration',
              items: [
                { text: 'Permission Model', link: '/en/admin/permissions' },
                { text: 'Admin Panel', link: '/en/admin/admin-panel' },
              ],
            },
          ],
          '/en/dev/': [
            {
              text: 'Development',
              items: [
                { text: 'Local Setup', link: '/en/dev/setup' },
                { text: 'Project Structure', link: '/en/dev/structure' },
                { text: 'Environment Variables', link: '/en/dev/env' },
                { text: 'API Reference', link: '/en/dev/api' },
              ],
            },
          ],
          '/en/cli/': [
            {
              text: 'CLI Agent',
              items: [
                { text: 'Overview & Quick Start', link: '/en/cli/' },
                { text: 'Usage Guide', link: '/en/cli/guide' },
              ],
            },
          ],
        },
        outline: {
          level: [2, 3],
          label: 'On this page',
        },
        docFooter: {
          prev: 'Previous',
          next: 'Next',
        },
        darkModeSwitchLabel: 'Appearance',
        sidebarMenuLabel: 'Menu',
        returnToTopLabel: 'Return to top',
        lastUpdatedText: 'Last updated',
        footer: {
          message: 'This project is licensed under <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.en" target="_blank" rel="noopener noreferrer">CC BY-NC-SA</a>.',
          copyright: 'Copyright © Zero-wyc / ZViewer Contributors',
        },
      },
    },
  },
})