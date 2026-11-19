# Skill Index · GitHub 技能累计人气 Top500

中文技能索引：能力说明、仓库 Stars、7日增长、安装方法、搜索筛选、收藏、历史快照、Excel及CSV下载。

## 数据口径

在 The Skill Leaderboard 公开目录收录范围内按仓库累计 Stars 排序取前500；**不是 GitHub 官方全站榜、官方 Trending、历史峰值榜或历年每日榜合集**。网站分别展示成功整理时间和来源星标快照日期；Stars属于整个仓库。数据源为 https://www.skillleaderboard.com/api/catalog 。

中文说明依据公开摘要整理。新入榜条目若没有中文摘要，会明确保留来源原文。安装命令为通用模板，未经逐项试装；应先阅读仓库 README、SKILL.md、脚本和许可证。网站不会自动安装或执行技能。

## 自动更新与发布

GitHub Actions 计划每天 **北京时间09:00（UTC 01:00）** 在线采集、生成表格、保存每日快照并发布到 GitHub Pages；不需要个人电脑开机。任务可能排队延迟，来源快照也可能滞后。失败时保留上次成功榜单，发布错误状态，并让 Actions 显示失败；不能把页面刷新当作成功采集。

首次推送发布已有且明确标注日期的数据；手动运行 Actions 中的 **Update rankings and deploy Pages** 可立即尝试在线更新。历史快照从本站开始记录，不补造过去榜单。每日版本和下载文件会逐渐增加仓库体积。

仓库 Settings → Pages 的 Source 需设为 **GitHub Actions**。定时任务依赖仓库及 Actions 保持启用；公开仓库长期无活动时平台可能停用计划任务，可从 Actions 页面重新启用。仓库权限或分支保护发生改变后需核对自动写入权限。无需配置第三方密钥。

## 本地查看

```sh
python3 -m pip install -r requirements.txt
python3 -m http.server 8788 --directory site
```

浏览器打开 `http://localhost:8788/`。在线更新：`python3 update.py`。发布前检查：`python3 scripts/verify_site.py`。

## 文件范围与隐私

只有 `site/` 作为网站发布。`assets/` 包含公开能力说明和Excel样式模板；根目录脚本及工作流用于更新。不包含本机工作资料、账号令牌、本地运行日志或系统任务配置。

收藏只保存在访问者自己的浏览器，不上传到服务器。网站不加载第三方统计脚本，不提供安装执行服务。
