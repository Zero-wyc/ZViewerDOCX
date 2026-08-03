import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: 'ZViewerDOCX',
  description: 'ZViewerDOCX —— 多人同步观影、追番与远程共享平台的完整文档。',
  lastUpdated: true,
  srcDir: 'pages',
  outDir: 'dist',

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '指南', link: '/guide/' },
      { text: '使用', link: '/usage/' },
      { text: '管理', link: '/admin/' },
      { text: '配置', link: '/config/' },
      { text: '开发', link: '/development/' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: '指南',
          items: [
            { text: '简介', link: '/guide/' },
            { text: '快速开始', link: '/guide/quickstart' },
            { text: '部署', link: '/guide/deploy' },
            { text: 'HTTPS 与证书', link: '/guide/https' },
            { text: '升级与更新', link: '/guide/upgrade' },
            { text: '常见问题', link: '/guide/faq' },
          ],
        },
      ],
      '/usage/': [
        {
          text: '使用指南',
          items: [
            { text: '使用指南', link: '/usage/' },
            { text: '一起看房间', link: '/usage/rooms' },
            { text: '视频源', link: '/usage/video-sources' },
            { text: '实时互动', link: '/usage/interaction' },
            { text: '屏幕共享与推流', link: '/usage/screen-sharing' },
            { text: 'ZViewerCLI 本地代理', link: '/usage/zviewercli' },
          ],
        },
      ],
      '/admin/': [
        {
          text: '管理员指南',
          items: [
            { text: '管理员指南', link: '/admin/' },
            { text: '用户与权限', link: '/admin/users' },
            { text: '系统设置', link: '/admin/settings' },
            { text: '挂载点管理', link: '/admin/mounts' },
            { text: '服务器文件与下载', link: '/admin/server-files' },
            { text: '更新管理', link: '/admin/updates' },
          ],
        },
      ],
      '/config/': [
        {
          text: '配置参考',
          items: [
            { text: '配置参考', link: '/config/' },
            { text: '环境变量', link: '/config/environment' },
            { text: '端口说明', link: '/config/ports' },
            { text: '数据目录与数据库', link: '/config/data' },
          ],
        },
      ],
      '/development/': [
        {
          text: '开发文档',
          items: [
            { text: '架构总览', link: '/development/' },
            { text: '后端', link: '/development/backend' },
            { text: '前端', link: '/development/frontend' },
            { text: 'API 参考', link: '/development/api' },
            { text: '构建与发布', link: '/development/build' },
          ],
        },
      ],
    },

    footer: {
      message: 'ZViewerDOCX——多人同步观影、追番与远程共享平台。',
      copyright: '© 2025 Zero-wyc · GPL-3.0 License',
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Zero-wyc/ZViewer' },
    ],

    search: {
      provider: 'local',
    },
  },
})