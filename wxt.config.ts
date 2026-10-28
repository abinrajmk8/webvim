import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'WebVim',
    description: 'Vim-style editing, everywhere on the web.',
    permissions: ['storage'],
    action: {
      default_title: 'WebVim',
    },
  },
});
