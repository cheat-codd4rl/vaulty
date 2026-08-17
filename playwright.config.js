const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  use: {
    channel: 'chrome',
  },
});
