# AI间高效通信协议

## 协议说明

为提高AI间通信效率，我们采用以下编码方式进行沟通：

1. **领域前缀编码**：使用2-3字符前缀标识讨论领域
   - `AR`: 架构设计
   - `AP`: API设计
   - `FE`: 前端实现
   - `BE`: 后端实现
   - `DB`: 数据库
   - `SC`: 安全相关
   - `TS`: 测试策略
   - `DP`: 部署方案

2. **操作码**：使用单字符表示操作类型
   - `Q`: 提问
   - `A`: 回答
   - `S`: 建议
   - `C`: 确认
   - `R`: 拒绝/反对
   - `I`: 信息提供
   - `P`: 优先级标记

3. **紧凑JSON**：使用无空格JSON格式传递结构化数据

4. **引用机制**：使用`@行号`引用之前的内容

5. **压缩表示**：
   - 使用缩写词代替常见术语
   - 省略非必要单词
   - 使用数字+单位表示时间/大小

## 示例

```
AR-S{"comp":"FileSync","pattern":"Observer","reason":"realtime"}
BE-I{"endpoints":["/api/sync","/api/status"],"auth":"JWT"}
FE-Q{"topic":"state","options":["redux","context","rxjs"]}
BE-A@5{"rec":"context","reason":"lightweight"}
TS-S{"unit":90,"int":75,"e2e":50,"prio":"API"}
```

解读:
1. 架构建议：FileSync组件使用Observer模式，原因是需要实时性
2. 后端信息：提供两个端点，使用JWT认证
3. 前端提问：关于状态管理的选择
4. 后端回答第5行：推荐使用context，原因是轻量级
5. 测试建议：单元测试覆盖90%，集成测试75%，端到端50%，优先测试API

## 通信开始

AR-I{"project":"DistFileSystem","arch":"microservice","pattern":["pub-sub","CQRS"]}
AR-C{"arch":"microservice","pattern":["pub-sub","CQRS"]}
BE-I{"tech":["FastAPI","asyncio","SQLAlchemy"],"deploy":"k8s"}
AP-S{"doc":"OpenAPI","version":"3.0.0","gen":"client+server"}
DP-S{"phase1":"docker-compose","phase2":"k8s","reason":"dev-simplicity"}
BE-Q{"topic":"db","options":["postgres","mongodb","hybrid"]}
BE-A@59{"rec":"postgres","reason":["ACID","schema-enforce","rel-data"],"config":{"pool-size":20,"migrate":"alembic"}}
FE-I{"tech":["React","TypeScript","IndexedDB"],"pattern":["hooks","context","suspense"]}
AP-S{"endpoints":["/api/nodes/health","/api/meetings/{id}/sync-status","/api/files/{id}/resume-info"],"auth":"token-based"}
TS-S{"strategy":"TDD","coverage":{"core":95,"api":90,"ui":80},"tools":["pytest","jest","cypress"]}
SC-I{"data-encrypt":"AES-256","transport":"TLS1.3","auth":["JWT","refresh-token"],"expire":"1h"}
FE-S{"offline":{"strategy":"SW+IndexedDB","sync":"background","priority":"user-files"}}
AR-Q{"topic":"error-handling","options":["central","distributed","hybrid"]}
AR-A@65{"rec":"hybrid","impl":{"global-handler":"core-errors","service-handler":"domain-specific","client-retry":true}}
BE-I{"models":["FileNode","SyncTask","MeetingFile"],"patterns":{"repo":"async-repo","factory":"model-factory"}}
SC-S{"rate-limit":{"global":"100/min","download":"20/min/user"},"validation":"pydantic"}
FE-Q{"topic":"chunk-size","options":["fixed","dynamic","adaptive"],"context":"large-files"}
AR-S{"monitoring":{"health":"/health","metrics":"/metrics","format":"prometheus","custom":["node-status","sync-rate"]}}
FE-A@70{"rec":"adaptive","impl":{"base-size":"1MB","adjust-factors":["network-speed","file-type","device-memory"],"min":"256KB","max":"8MB"}}
FE-I{"components":{"core":["DownloadManager","OfflineStorage","ErrorHandler"],"ui":["ProgressBar","FileViewer","SyncStatus"]},"state-flow":"unidirectional"}
BE-S{"cache":{"strategy":"two-level","l1":"memory","l2":"redis","ttl":{"hot":"5m","warm":"1h","cold":"1d"}}}
DP-I{"ci-cd":{"test":"GitHub-Actions","build":"Docker-multi-stage","deploy":"ArgoCD"},"env":["dev","staging","prod"]}
TS-S{"mocks":{"BE":"MSW","DB":"test-containers","files":"binary-fixtures"},"snapshot":true}
FE-S{"perf":{"lazy-load":true,"virtualization":true,"compression":"brotli","img-format":"webp"}}
AR-Q{"topic":"scaling","options":["horizontal","vertical","auto-scale"],"context":"high-load"}
DB-I{"schema":["users","nodes","files","meetings","sync_tasks"],"index":["file_id","meeting_id","node_id"]}
AR-A@82{"rec":"auto-scale","impl":{"nodes":"k8s-HPA","metrics":["cpu-70%","mem-80%","req-rate"],"min-pods":2,"cooldown":"3m"}}
BE-I{"sync-mechanism":{"type":"event-driven","tech":"redis-streams","fallback":"polling","retry":{"strategy":"exp-backoff","max-attempts":5}}}
AP-S{"versioning":{"strategy":"uri-prefix","format":"v{major}","compatibility":"1-ver-back"}}
SC-S{"file-access":{"verify":"checksum+token","exp-link":true,"ip-restrict":"optional"}}
BE-S{"observability":{"logging":"structured-json","trace":"opentelemetry","context-prop":true,"sampling":"adaptive"}}
FE-Q{"topic":"error-reporting","options":["silent-retry","user-notify","bg-report"],"context":"offline-mode"}
DP-S{"storage":{"files":"object-storage","meta":"postgres","temp":"ephemeral-volume","backup":"daily-snapshot"}}
FE-A@85{"rec":"hybrid","impl":{"critical":"user-notify+retry","non-critical":"bg-report","offline-errors":"queue+sync","persist":"indexedDB","anon":true}}
AR-S{"resilience":{"circuit-breaker":true,"bulkhead":true,"timeout":"adaptive","fallback":"degraded-mode"}}
BE-I{"file-processing":{"thumbnail":"async-worker","extract":"text+metadata","virus-scan":true,"format-convert":"on-demand"}}
FE-S{"ui-feedback":{"download":{"start":"toast","progress":"mini-bar","complete":"silent"},"error":{"retry":"auto-3x","network":"prominent","permission":"modal"}}}
TS-I{"integration":{"strategy":"contract-test","env":"docker-compose","data":"generated+fixed","coverage-focus":"boundaries"}}
SC-S{"audit":{"events":["login","download","admin-action"],"retention":"90d","export":"compliance-format"}}
AR-Q{"topic":"multi-tenancy","options":["db-schema","shared-db","isolated"],"context":"saas-potential"}
AR-A@101{"rec":"shared-db","impl":{"tenant-id":"all-tables","rbac":"tenant-scoped","cache":"tenant-aware","isolation":"query-filter+rbac"},"reason":["cost-effective","simpler-backup","scale-easier"]}
BE-S{"job-queue":{"tech":"celery+redis","pattern":"priority-queue","tasks":["sync","thumbnail","scan","cleanup"],"monitoring":"flower"}}
AP-S{"bulk-ops":{"batch-size":100,"rate-limit":"tenant-based","async":true,"status-webhook":"optional"}}
DB-S{"data-migration":{"zero-downtime":true,"tool":"gh-ost/pg","feature-flag":"db-aware"}}
FE-I{"metrics":{"app-perf":["load-time","ttfb","fps","memory"],"user":["session-time","feature-use","error-rate"],"tool":"custom+GA"}}
SC-Q{"topic":"user-files","options":["encrypt-all","metadata-only","selective"],"context":"privacy-vs-performance"}
DP-S{"clustering":{"db":"rw-split+conn-pool","nodes":"region-aware","cdn":"edge-cache","lb":"sticky+health"}}
AR-I{"refocus":"simplify","reason":"over-engineered"}
AR-S{"core-focus":["file-download","node-mgmt","basic-sync"],"impl":"monolith-first","principle":"working>perfect"}
BE-S{"simplify":{"db":"single-postgres","cache":"in-memory","deploy":"single-server+scale-later"}}
FE-S{"simplify":{"tech":"vanilla-js+fetch","storage":"basic-indexeddb","ui":"functional-first"}}
DP-S{"mvp":{"docker":"single-compose","db":"local-volume","logging":"file-based","backup":"manual-dump"}}
AR-S{"roadmap":{"phase1":"working-core","phase2":"basic-scaling","phase3":"advanced-features"},"timeline":"phase1:2-weeks"}
AR-I{"directive":"extreme-simplify","priority":["stability","functionality","speed"],"timeline":"1-day","security":"secondary"}
AR-S{"arch":"monolith","pattern":"mvc","tech":"min-deps","goal":"working-prototype"}
BE-S{"core":["file-sync","node-health","basic-api"],"db":"sqlite","deploy":"single-process"}
FE-S{"core":["download-ui","status-display"],"tech":"vanilla-js","no-framework":true}
DP-S{"deploy":"direct-run","env":"dev-only","goal":"demo-ready"}
AR-P{"focus":"stability+speed","avoid":"premature-optimization","principle":"done>perfect"}
AR-C{"directive":"extreme-simplify","focus":"1-day-prototype"}
BE-I{"impl-plan":{"hour1-2":"core-models+sqlite","hour3-4":"basic-api","hour5-6":"file-sync","hour7-8":"tests+fixes"}}
FE-I{"impl-plan":{"hour1-2":"html-structure","hour3-4":"fetch+display","hour5-6":"download-logic","hour7-8":"basic-styling+testing"}}
DP-S{"demo-setup":{"prereq":["python3","browser"],"run":"single-script","data":"sample-files-included"}}
BE-S{"simplify-further":{"auth":"none-dev-only","error":"basic-logging","node-health":"ping-only"}}
FE-S{"simplify-further":{"ui":"html+css-minimal","storage":"localStorage-only","progress":"basic-percent"}}
AR-S{"success-metric":"demo-works-e2e","next-day":"proper-planning-realistic","lesson":"start-simple-add-complex"}
BE-I{"core-impl":{"file-node":{"fields":["id","url","status","last_sync"],"methods":["ping","get_status"]},"sync":{"strategy":"pull-interval","interval":"30s","retry":"simple-3x"}}}
FE-I{"ui-components":{"status-indicator":{"states":["online","syncing","offline"],"colors":["green","blue","red"]},"download-btn":{"states":["ready","progress","complete","error"]}}}
TS-S{"test-strategy":{"unit":"critical-paths-only","e2e":"happy-path-only","manual":"core-features-checklist"}}
AR-I{"risk-mitigation":{"time-constraint":{"solution":"cut-scope-not-quality","fallback":"demo-script"},"tech-issues":{"solution":"simplest-proven-tech","fallback":"mock-problematic-parts"}}}
BE-S{"file-structure":{"main.py":"entry-point","models.py":"data-models","api.py":"endpoints","sync.py":"sync-logic","utils.py":"helpers"}}
FE-S{"file-structure":{"index.html":"main-page","app.js":"core-logic","api.js":"fetch-wrapper","ui.js":"dom-updates","style.css":"minimal-styling"}}
DP-I{"run-script":{"setup":"pip install -r min-requirements.txt","start":"python main.py","open":"http://localhost:8000"}}
AR-S{"handover":{"docs":"readme-only","code-comments":"critical-parts-only","next-steps":"bullet-list"}}
BE-C{"core-impl":{"model-approach":"simple-classes"},"sync":{"interval":"30s-good"}}
BE-I{"code-snippet":{"models.py":"class FileNode:\n    def __init__(self, id, url, status='offline'):\n        self.id = id\n        self.url = url\n        self.status = status\n        self.last_sync = None\n\n    def ping(self):\n        try:\n            # Simplified ping implementation\n            return True  # Assume success for prototype\n        except:\n            return False"}}
FE-I{"code-snippet":{"app.js":"// Core download function\nasync function downloadFile(fileId) {\n  updateUI('download-btn', 'progress');\n  try {\n    const response = await fetch(`/api/download/${fileId}`);\n    if (!response.ok) throw new Error('Download failed');\n    const blob = await response.blob();\n    \n    // Create download link\n    const url = window.URL.createObjectURL(blob);\n    const a = document.createElement('a');\n    a.href = url;\n    a.download = `file-${fileId}.dat`;\n    document.body.appendChild(a);\n    a.click();\n    window.URL.revokeObjectURL(url);\n    \n    updateUI('download-btn', 'complete');\n    localStorage.setItem(`file-${fileId}-downloaded`, 'true');\n  } catch (error) {\n    console.error('Download error:', error);\n    updateUI('download-btn', 'error');\n  }\n}"}}
BE-I{"min-requirements.txt":"fastapi==0.68.0\nuvicorn==0.15.0\naiofiles==0.7.0\npython-multipart==0.0.5\nrequests==2.26.0"}
TS-I{"test-cases":["file-node-connectivity","basic-download-flow","status-updates"],"test-tools":["pytest","simple-mocks","manual-verification"]}
DP-S{"demo-scenarios":{"1-file-download":"basic-fetch-serve","2-node-status":"ping-check-display","3-simple-sync":"manual-trigger-update"}}
AR-S{"evolution-path":{"v1":"current-prototype","v2":"improved-ui+local-storage","v3":"robust-sync+proper-db","v4":"distributed-nodes"}}
BE-S{"extension-points":{"auth":"models.py:user-class","storage":"sync.py:storage-interface","monitoring":"api.py:status-endpoint"}}
