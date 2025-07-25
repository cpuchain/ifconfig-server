import { defineConfig } from 'vitepress'
import pkgJson from '../../package.json';

// HTML title
export const TITLE = pkgJson.name;
export const REPO = pkgJson.repository?.url
    ? pkgJson.repository.url.replace('git+', '').replace('.git', '')
    : 'https://github.com/cpuchain';
export const HOMEPAGE = REPO || 'https://github.com/cpuchain';
export const NPMJS = `https://npmjs.com/package/${pkgJson.name}`;
export const LOGO = '/logo.png';
export const LICENSE = pkgJson.license || 'MIT';
export const COPYRIGHT = `Copyright © 2025 ${pkgJson.author || 'CPUchain'}`;

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "TypeScript Project",

  description: pkgJson.description,

  head: [
    ['link', { rel: 'icon', href: LOGO }],

    ['link', { rel: 'canonical', href: HOMEPAGE }],
    ['link', { rel: 'canonical', href: REPO }],
    ['link', { rel: 'canonical', href: NPMJS }],
    ['meta', { name: 'description', content: pkgJson.description }],
    ['meta', { name: 'keywords', content: (pkgJson.keywords || []).join(',') || pkgJson.name }],

    // og
    ['meta', { property: 'og:title', content: TITLE }],
    ['meta', { property: 'og:description', content: pkgJson.description }],
    ['meta', { property: 'og:image', content: LOGO }],
    ['meta', { property: 'og:url', content: HOMEPAGE }],

    // seo
    ['meta', { name: 'robots', content: 'index,follow' }],
    ['meta', { name: 'googlebot', content: 'index,follow' }],
  ],

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: LOGO,

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Github', link: REPO },
      {
        text: `v${pkgJson.version}`,
        items: [
          { text: 'Package', link: NPMJS },
          //{ text: 'Changelog', link: '${REPO}/blob/main/CHANGELOG.md' },
        ]
      },
      { text: 'Examples', link: '/markdown-examples' }
    ],

    sidebar: [
      {
        text: 'Examples',
        items: [
          { text: 'Markdown Examples', link: '/markdown-examples' },
          { text: 'Runtime API Examples', link: '/api-examples' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'homepage', link: HOMEPAGE },
      { icon: 'github', link: REPO },
    ],

    footer: {
      message: `
        Released under the
        <a href="https://opensource.org/licenses/${LICENSE}" target="_blank" class="footer-year">${LICENSE} License</a>.
      `,
      copyright: COPYRIGHT,
    },
  }
})
