// 默认使用 Playwright 安装的 Chromium，也支持维护者指定已安装的 Chrome。
module.exports = {
  headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
};
