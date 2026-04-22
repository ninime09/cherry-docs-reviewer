# Cherry Docs Reviewer Helper (Browser Extension)

可选浏览器扩展，让 Cherry Docs Reviewer 能自动跟踪 Vercel 预览 iframe 里的导航。

## 为什么需要

浏览器的同源策略禁止 `cherry-docs-reviewer.vercel.app` 读取 `*.vercel.app` iframe 里的当前 URL。
没装扩展时：在 iframe 里点链接跳转后，顶部 URL 栏不会自动更新，切 Annotate 会打开错误的文件。
装了扩展后：iframe 里的导航**自动同步**到工具的 URL 栏，直接切 Annotate 就是当前页面的 MDX 文件。

## 安装（Chrome / Edge / Brave）

1. 下载或克隆仓库到本地
   ```bash
   git clone https://github.com/ninime09/cherry-docs-reviewer.git
   ```
2. 打开 Chrome → 地址栏输入 `chrome://extensions/` → 回车
3. 右上角打开 **"开发者模式"** 开关
4. 点左上角 **"加载已解压的扩展程序"**
5. 选择这个仓库里的 **`extension/`** 文件夹
6. 扩展列表应该出现 **"Cherry Docs Reviewer Helper"**

## 安装（Firefox）

1. 打开 `about:debugging#/runtime/this-firefox`
2. 点 **"临时载入附加组件"**
3. 选择 `extension/manifest.json`
4. 扩展会运行到浏览器关闭为止（Firefox 临时扩展限制）

## 验证是否生效

1. 打开 https://cherry-docs-reviewer.vercel.app
2. 打开一个审核 session → 切到 **Preview** 模式
3. 在 iframe 里点侧边栏任意链接跳转
4. 观察**顶部 URL 栏**：应该**自动**更新成新页面的路径

如果没自动更新：
- 检查扩展是否启用（灰色表示禁用）
- 重启扩展（关闭再开启）或刷新页面
- 打开 DevTools → Console，看有没有扩展相关的错误

## 权限说明

扩展只在 `*.vercel.app` 子域名下激活，读取 iframe 的当前 URL 并 postMessage 给父页面。

**不读取任何其他数据**。代码只有 [content.js](content.js) 一个文件（约 30 行），可以审计。

## 卸载

`chrome://extensions/` → 找到扩展 → 点 **"移除"**。卸载后回到手动粘贴 URL 的模式。
