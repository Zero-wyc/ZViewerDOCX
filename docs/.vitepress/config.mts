import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'ZViewer 文档',
  description: '多人同步观影、追番与远程共享平台',
  lang: 'zh-CN',
  cleanUrls: true,
  lastUpdated: true,
  outDir: '../dist',

  head: [
    // 网站图标（favicon）
    ['link', { rel: 'icon', type: 'image/jpeg', href: '/favicon.jpg' }],
    ['link', { rel: 'apple-touch-icon', href: '/favicon.jpg' }],
    // 社交分享缩略图：部署后请将 href 改为站点绝对 URL，例如 https://你的域名/favicon.jpg
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
  ],

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
      { text: '指南', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: '功能', link: '/features/rooms', activeMatch: '/features/' },
      { text: '管理', link: '/admin/permissions', activeMatch: '/admin/' },
      { text: '本地代理CLI', link: '/cli/', activeMatch: '/cli/' },
      { text: '开发', link: '/dev/setup', activeMatch: '/dev/' },
      { text: 'GitHub', link: 'https://github.com/Zero-wyc/ZViewer' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: '指南',
          items: [
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '部署方式', link: '/guide/deployment' },
            { text: 'HTTPS 与证书', link: '/guide/https' },
            { text: '常见问题', link: '/guide/faq' },
          ],
        },
      ],
      '/features/': [
        {
          text: '功能特性',
          items: [
            { text: '一起看房间', link: '/features/rooms' },
            { text: '视频源', link: '/features/video-sources' },
            { text: '实时互动', link: '/features/interaction' },
          { text: '弹幕系统', link: '/features/danmaku' },
            { text: '屏幕共享与推流', link: '/features/screenshare' },
            { text: '主题系统', link: '/features/themes' },
          ],
        },
      ],
      '/admin/': [
        {
          text: '管理',
          items: [
            { text: '权限模型', link: '/admin/permissions' },
            { text: '管理后台', link: '/admin/admin-panel' },
          ],
        },
      ],
      '/dev/': [
        {
          text: '开发',
          items: [
            { text: '本地开发', link: '/dev/setup' },
            { text: '项目结构', link: '/dev/structure' },
            { text: '环境变量', link: '/dev/env' },
            { text: 'API 参考', link: '/dev/api' },
          ],
        },
      ],
      '/cli/': [
        {
          text: 'CLI 本地代理',
          items: [
            { text: '概述与快速开始', link: '/cli/' },
            { text: '使用指南', link: '/cli/guide' },
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
      message: '本项目遵循 GPL-3.0 许可。',
      copyright: 'Copyright © Zero-wyc / ZViewer Contributors',
    },
  },
})
