(() => {
  'use strict'

  const STORAGE_KEYS = {
    baseURL: 'newapi.base_url',
    theme: 'newapi.theme',
    apiUserId: 'newapi.api_user_id'
  }

  const TOKEN_STATUS_TEXT = {
    1: '启用',
    2: '禁用',
    3: '已过期',
    4: '已耗尽'
  }

  const LOG_TYPE_TEXT = {
    0: '未知',
    1: '充值',
    2: '消费',
    3: '管理',
    4: '系统',
    5: '错误',
    6: '退款'
  }

  const ROLE_TEXT = {
    0: '访客',
    1: '普通用户',
    10: '管理员',
    100: '超级管理员'
  }

  const state = {
    version: 'dev',
    defaultBaseURL: '',
    baseURL: '',
    apiUserId: '',
    user: null,
    alertTimer: null,
    token: {
      page: 1,
      pageSize: 10,
      total: 0,
      keyword: '',
      items: []
    },
    log: {
      page: 1,
      pageSize: 20,
      total: 0,
      items: [],
      hasMore: true,
      isLoading: false,
      requestVersion: 0,
      lastError: '',
      filters: {
        type: '0',
        modelName: '',
        tokenName: '',
        requestId: '',
        startTime: '',
        endTime: '',
        group: ''
      },
      stat: {
        quota: 0,
        rpm: 0,
        tpm: 0
      }
    }
  }

  const dom = {}

  document.addEventListener('DOMContentLoaded', () => {
    init().catch((err) => {
      showAlert('初始化失败：' + (err.message || '未知错误'), 'error', 0)
      console.error(err)
    })
  })

  async function init() {
    cacheDom()
    bindEvents()
    initTheme()
    syncTokenQuotaInputState()
    await loadServerConfig()
    initBaseURL()
    initApiUserId()
    await tryRestoreSession()
  }

  function cacheDom() {
    dom.html = document.documentElement
    dom.themeToggleBtn = document.getElementById('themeToggleBtn')
    dom.baseUrlInput = document.getElementById('baseUrlInput')
    dom.saveBaseUrlBtn = document.getElementById('saveBaseUrlBtn')
    dom.versionText = document.getElementById('versionText')

    dom.alertBox = document.getElementById('alertBox')

    dom.loginCard = document.getElementById('loginCard')
    dom.loginForm = document.getElementById('loginForm')
    dom.usernameInput = document.getElementById('usernameInput')
    dom.passwordInput = document.getElementById('passwordInput')
    dom.loginBtn = document.getElementById('loginBtn')

    dom.dashboard = document.getElementById('dashboard')
    dom.userInfoText = document.getElementById('userInfoText')
    dom.refreshSelfBtn = document.getElementById('refreshSelfBtn')
    dom.logoutBtn = document.getElementById('logoutBtn')

    dom.tabButtons = document.querySelectorAll('.tab-btn')
    dom.tabPanels = document.querySelectorAll('.tab-panel')

    dom.tokenPanel = document.getElementById('tokenPanel')
    dom.createTokenBtn = document.getElementById('createTokenBtn')
    dom.refreshTokenBtn = document.getElementById('refreshTokenBtn')
    dom.tokenFilterForm = document.getElementById('tokenFilterForm')
    dom.tokenKeywordInput = document.getElementById('tokenKeywordInput')
    dom.tokenPageSizeSelect = document.getElementById('tokenPageSizeSelect')
    dom.tokenFilterResetBtn = document.getElementById('tokenFilterResetBtn')
    dom.tokenTableBody = document.getElementById('tokenTableBody')
    dom.tokenPrevBtn = document.getElementById('tokenPrevBtn')
    dom.tokenNextBtn = document.getElementById('tokenNextBtn')
    dom.tokenPagerText = document.getElementById('tokenPagerText')

    dom.logPanel = document.getElementById('logPanel')
    dom.refreshLogBtn = document.getElementById('refreshLogBtn')
    dom.logFilterForm = document.getElementById('logFilterForm')
    dom.logTypeSelect = document.getElementById('logTypeSelect')
    dom.logModelInput = document.getElementById('logModelInput')
    dom.logTokenNameInput = document.getElementById('logTokenNameInput')
    dom.logRequestIdInput = document.getElementById('logRequestIdInput')
    dom.logStartInput = document.getElementById('logStartInput')
    dom.logEndInput = document.getElementById('logEndInput')
    dom.logGroupInput = document.getElementById('logGroupInput')
    dom.logPageSizeSelect = document.getElementById('logPageSizeSelect')
    dom.logFilterResetBtn = document.getElementById('logFilterResetBtn')
    dom.logTableWrap = document.getElementById('logTableWrap')
    dom.logTableBody = document.getElementById('logTableBody')
    dom.logLoadState = document.getElementById('logLoadState')
    dom.statQuota = document.getElementById('statQuota')
    dom.statRpm = document.getElementById('statRpm')
    dom.statTpm = document.getElementById('statTpm')

    dom.tokenModal = document.getElementById('tokenModal')
    dom.tokenModalTitle = document.getElementById('tokenModalTitle')
    dom.closeTokenModalBtn = document.getElementById('closeTokenModalBtn')
    dom.tokenForm = document.getElementById('tokenForm')
    dom.tokenIdInput = document.getElementById('tokenIdInput')
    dom.tokenNameInput = document.getElementById('tokenNameInput')
    dom.tokenStatusSelect = document.getElementById('tokenStatusSelect')
    dom.tokenQuotaInput = document.getElementById('tokenQuotaInput')
    dom.tokenExpireInput = document.getElementById('tokenExpireInput')
    dom.tokenUnlimitedInput = document.getElementById('tokenUnlimitedInput')
    dom.tokenModelLimitEnabledInput = document.getElementById('tokenModelLimitEnabledInput')
    dom.tokenModelLimitsInput = document.getElementById('tokenModelLimitsInput')
    dom.tokenAllowIpsInput = document.getElementById('tokenAllowIpsInput')
    dom.tokenGroupInput = document.getElementById('tokenGroupInput')
    dom.tokenCrossGroupRetryInput = document.getElementById('tokenCrossGroupRetryInput')
    dom.saveTokenBtn = document.getElementById('saveTokenBtn')
  }

  function bindEvents() {
    dom.themeToggleBtn.addEventListener('click', toggleTheme)
    dom.saveBaseUrlBtn.addEventListener('click', handleSaveBaseURL)

    dom.loginForm.addEventListener('submit', handleLogin)
    dom.refreshSelfBtn.addEventListener('click', handleRefreshSelf)
    dom.logoutBtn.addEventListener('click', handleLogout)

    dom.tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab))
    })

    dom.createTokenBtn.addEventListener('click', openCreateTokenModal)
    dom.refreshTokenBtn.addEventListener('click', () => loadTokens(true))
    dom.tokenFilterForm.addEventListener('submit', handleTokenFilter)
    dom.tokenFilterResetBtn.addEventListener('click', handleTokenFilterReset)
    dom.tokenPrevBtn.addEventListener('click', handleTokenPrev)
    dom.tokenNextBtn.addEventListener('click', handleTokenNext)
    dom.tokenTableBody.addEventListener('click', handleTokenTableAction)

    dom.closeTokenModalBtn.addEventListener('click', closeTokenModal)
    dom.tokenForm.addEventListener('submit', handleSaveToken)
    dom.tokenUnlimitedInput.addEventListener('change', syncTokenQuotaInputState)

    dom.refreshLogBtn.addEventListener('click', () => loadLogs(true))
    dom.logFilterForm.addEventListener('submit', handleLogFilter)
    dom.logFilterResetBtn.addEventListener('click', handleLogFilterReset)
    dom.logTableWrap.addEventListener('scroll', handleLogTableScroll)
    dom.logLoadState.addEventListener('click', handleLogLoadStateClick)

    dom.tokenModal.addEventListener('click', (event) => {
      if (event.target === dom.tokenModal) {
        closeTokenModal()
      }
    })

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !dom.tokenModal.classList.contains('hidden')) {
        closeTokenModal()
      }
    })
  }

  function initTheme() {
    const savedTheme = safeStorageGet(STORAGE_KEYS.theme)
    const nextTheme = savedTheme === 'light' ? 'light' : 'dark'
    applyTheme(nextTheme)
  }

  function toggleTheme() {
    const currentTheme = dom.html.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark'
    applyTheme(nextTheme)
  }

  function applyTheme(theme) {
    dom.html.setAttribute('data-theme', theme)
    safeStorageSet(STORAGE_KEYS.theme, theme)
    dom.themeToggleBtn.textContent = theme === 'dark' ? '切换亮色' : '切换暗色'
  }

  async function loadServerConfig() {
    try {
      const res = await fetch('/config', { credentials: 'include' })
      const payload = await safeParseJSON(res)
      if (!res.ok || payload?.success === false) {
        throw new Error(payload?.message || '读取服务配置失败')
      }
      state.defaultBaseURL = (payload?.data?.default_base_url || '').trim()
      state.version = payload?.data?.version || 'dev'
      dom.versionText.textContent = `版本：${state.version}`
    } catch (err) {
      dom.versionText.textContent = '版本：未知'
      console.warn(err)
    }
  }

  function initBaseURL() {
    const saved = (safeStorageGet(STORAGE_KEYS.baseURL) || '').trim()

    if (saved) {
      try {
        state.baseURL = normalizeBaseURL(saved)
      } catch {
        safeStorageRemove(STORAGE_KEYS.baseURL)
      }
    }

    if (!state.baseURL && state.defaultBaseURL) {
      state.baseURL = state.defaultBaseURL
    }

    dom.baseUrlInput.value = state.baseURL
  }

  function handleSaveBaseURL() {
    try {
      const inputValue = dom.baseUrlInput.value.trim()
      if (!inputValue) {
        if (state.defaultBaseURL) {
          state.baseURL = state.defaultBaseURL
          safeStorageRemove(STORAGE_KEYS.baseURL)
          dom.baseUrlInput.value = state.baseURL
          showAlert('已恢复为默认 BaseURL', 'info')
          return
        }
        throw new Error('BaseURL 不能为空')
      }

      const normalized = normalizeBaseURL(inputValue)
      state.baseURL = normalized
      dom.baseUrlInput.value = normalized
      safeStorageSet(STORAGE_KEYS.baseURL, normalized)
      showAlert('BaseURL 保存成功', 'success')
    } catch (err) {
      showAlert(err.message || 'BaseURL 无效', 'error', 0)
    }
  }

  async function tryRestoreSession() {
    if (!state.baseURL) {
      showLoggedOutState()
      showAlert('请先配置 BaseURL 再登录', 'warning')
      return
    }

    try {
      await fetchSelf(true)
      showLoggedInState()
      await Promise.allSettled([loadTokens(), loadLogs()])
    } catch {
      showLoggedOutState()
    }
  }

  function showLoggedInState() {
    dom.loginCard.classList.add('hidden')
    dom.dashboard.classList.remove('hidden')
    updateUserInfo()
  }

  function showLoggedOutState() {
    dom.loginCard.classList.remove('hidden')
    dom.dashboard.classList.add('hidden')
    closeTokenModal()
    updateUserInfo()
  }

  function updateUserInfo() {
    if (!state.user) {
      dom.userInfoText.textContent = '未登录'
      return
    }

    const roleName = ROLE_TEXT[state.user.role] || `角色${state.user.role}`
    const group = state.user.group || '-'
    const quota = typeof state.user.quota === 'number' ? state.user.quota : '-'
    dom.userInfoText.textContent = `用户：${state.user.username} | 角色：${roleName} | 分组：${group} | 额度：${quota}`
  }

  async function handleLogin(event) {
    event.preventDefault()

    const username = dom.usernameInput.value.trim()
    const password = dom.passwordInput.value

    if (!username || !password) {
      showAlert('请输入用户名/邮箱与密码', 'warning')
      return
    }

    try {
      syncBaseURLFromInput()
      setButtonLoading(dom.loginBtn, true, '登录中...')
      const data = await apiRequest('/api/user/login', {
        method: 'POST',
        body: { username, password }
      })

      if (data?.require_2fa) {
        showAlert('该账号开启了 2FA，请先在官方面板完成 2FA 登录', 'warning', 0)
        return
      }

      const loginUserId = toNonNegativeInt(data?.id, 0)
      if (loginUserId > 0) {
        setApiUserId(loginUserId)
      }

      await fetchSelf(false)
      dom.passwordInput.value = ''
      showLoggedInState()
      await Promise.allSettled([loadTokens(), loadLogs()])
      showAlert('登录成功', 'success')
    } catch (err) {
      showAlert('登录失败：' + (err.message || '未知错误'), 'error', 0)
    } finally {
      setButtonLoading(dom.loginBtn, false)
    }
  }

  async function handleRefreshSelf() {
    try {
      setButtonLoading(dom.refreshSelfBtn, true, '刷新中...')
      await fetchSelf(false)
      showAlert('会话已刷新', 'success')
    } catch (err) {
      showAlert('会话刷新失败：' + (err.message || '未知错误'), 'error', 0)
      showLoggedOutState()
    } finally {
      setButtonLoading(dom.refreshSelfBtn, false)
    }
  }

  async function handleLogout() {
    try {
      setButtonLoading(dom.logoutBtn, true, '退出中...')
      await apiRequest('/api/user/logout')
      state.user = null
      clearApiUserId()
      showLoggedOutState()
      showAlert('已退出登录', 'info')
    } catch (err) {
      showAlert('退出失败：' + (err.message || '未知错误'), 'error', 0)
    } finally {
      setButtonLoading(dom.logoutBtn, false)
    }
  }

  async function fetchSelf(silent) {
    try {
      const data = await apiRequest('/api/user/self')
      state.user = data || null
      setApiUserId(data?.id)
      updateUserInfo()
      return data
    } catch (err) {
      state.user = null
      const msg = String(err?.message || '')
      if (msg.includes('New-Api-User')) {
        clearApiUserId()
      }
      updateUserInfo()
      if (!silent) {
        throw err
      }
      throw err
    }
  }

  function switchTab(panelId) {
    dom.tabButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === panelId)
    })

    dom.tabPanels.forEach((panel) => {
      panel.classList.toggle('hidden', panel.id !== panelId)
    })
  }

  function handleTokenFilter(event) {
    event.preventDefault()
    state.token.keyword = dom.tokenKeywordInput.value.trim()
    state.token.pageSize = toPositiveInt(dom.tokenPageSizeSelect.value, 10)
    state.token.page = 1
    loadTokens(true)
  }

  function handleTokenFilterReset() {
    dom.tokenKeywordInput.value = ''
    dom.tokenPageSizeSelect.value = '10'
    state.token.keyword = ''
    state.token.pageSize = 10
    state.token.page = 1
    loadTokens(true)
  }

  function handleTokenPrev() {
    if (state.token.page <= 1) {
      return
    }
    state.token.page -= 1
    loadTokens(true)
  }

  function handleTokenNext() {
    const totalPage = calcTotalPage(state.token.total, state.token.pageSize)
    if (state.token.page >= totalPage) {
      return
    }
    state.token.page += 1
    loadTokens(true)
  }

  async function loadTokens(showError) {
    try {
      const query = {
        p: state.token.page,
        page_size: state.token.pageSize
      }

      let path = '/api/token/'
      if (state.token.keyword) {
        path = '/api/token/search'
        query.keyword = state.token.keyword
      }

      const pageData = await apiRequest(path, { query })
      state.token.total = toNonNegativeInt(pageData?.total, 0)
      state.token.items = Array.isArray(pageData?.items) ? pageData.items : []

      const maxPage = calcTotalPage(state.token.total, state.token.pageSize)
      if (state.token.page > maxPage) {
        state.token.page = maxPage
        return loadTokens(showError)
      }

      renderTokenTable()
      updateTokenPager()
    } catch (err) {
      state.token.items = []
      renderTokenTable()
      updateTokenPager()
      if (showError) {
        showAlert('加载 Token 失败：' + (err.message || '未知错误'), 'error', 0)
      }
      throw err
    }
  }

  function renderTokenTable() {
    if (!state.token.items.length) {
      dom.tokenTableBody.innerHTML = '<tr><td colspan="8" class="text-center">暂无数据</td></tr>'
      return
    }

    dom.tokenTableBody.innerHTML = state.token.items
      .map((token) => {
        const id = toNonNegativeInt(token.id, 0)
        const keyText = escapeHtml(String(token.key || ''))
        const nameText = escapeHtml(String(token.name || '-'))
        const statusText = TOKEN_STATUS_TEXT[token.status] || `状态${token.status}`
        const quotaText = token.unlimited_quota
          ? '∞（无限）'
          : `${toNonNegativeInt(token.remain_quota, 0)}（已用 ${toNonNegativeInt(token.used_quota, 0)}）`
        const expiredText = formatExpiredTime(token.expired_time)
        const createdText = formatTimestamp(token.created_time)
        const toggleText = token.status === 1 ? '禁用' : '启用'

        return `
          <tr>
            <td>${id}</td>
            <td>${nameText}</td>
            <td><code class="mono">${keyText}</code></td>
            <td>${escapeHtml(statusText)}</td>
            <td>${escapeHtml(quotaText)}</td>
            <td>${escapeHtml(expiredText)}</td>
            <td>${escapeHtml(createdText)}</td>
            <td>
              <div class="inline-actions">
                <button class="btn ghost" type="button" data-action="copy" data-id="${id}">复制</button>
                <button class="btn ghost" type="button" data-action="edit" data-id="${id}">编辑</button>
                <button class="btn ghost" type="button" data-action="toggle" data-id="${id}">${toggleText}</button>
                <button class="btn danger" type="button" data-action="delete" data-id="${id}">删除</button>
              </div>
            </td>
          </tr>
        `
      })
      .join('')
  }

  function updateTokenPager() {
    const totalPage = calcTotalPage(state.token.total, state.token.pageSize)
    dom.tokenPagerText.textContent = `第 ${state.token.page} / ${totalPage} 页，共 ${state.token.total} 条`
    dom.tokenPrevBtn.disabled = state.token.page <= 1
    dom.tokenNextBtn.disabled = state.token.page >= totalPage
  }

  async function handleTokenTableAction(event) {
    const button = event.target.closest('button[data-action]')
    if (!button) {
      return
    }

    const action = button.dataset.action
    const tokenId = toNonNegativeInt(button.dataset.id, 0)
    if (!tokenId) {
      return
    }

    if (action === 'copy') {
      await copyTokenKey(tokenId)
      return
    }

    if (action === 'edit') {
      openEditTokenModal(tokenId)
      return
    }

    if (action === 'toggle') {
      await toggleTokenStatus(tokenId, button)
      return
    }

    if (action === 'delete') {
      await deleteToken(tokenId, button)
    }
  }

  async function copyTokenKey(tokenId) {
    const token = getTokenById(tokenId)
    if (!token) {
      showAlert('未找到对应 Token', 'warning')
      return
    }

    const key = String(token.key || '').trim()
    if (!key) {
      showAlert('该 Token 没有可复制的 Key', 'warning')
      return
    }

    try {
      await copyText(key)
      showAlert('Key 已复制到剪贴板', 'success')
    } catch (err) {
      showAlert('复制失败：' + (err.message || '未知错误'), 'error', 0)
    }
  }

  function getTokenById(tokenId) {
    return state.token.items.find((item) => toNonNegativeInt(item.id, 0) === tokenId) || null
  }

  function openCreateTokenModal() {
    dom.tokenModalTitle.textContent = '新建 Token'
    dom.tokenForm.reset()
    dom.tokenIdInput.value = ''
    dom.tokenStatusSelect.value = '1'
    dom.tokenQuotaInput.value = '0'
    dom.tokenExpireInput.value = ''
    dom.tokenGroupInput.value = ''
    dom.tokenModelLimitsInput.value = ''
    dom.tokenAllowIpsInput.value = ''
    dom.tokenModelLimitEnabledInput.checked = false
    dom.tokenUnlimitedInput.checked = false
    dom.tokenCrossGroupRetryInput.checked = false
    syncTokenQuotaInputState()
    dom.tokenModal.classList.remove('hidden')
  }

  function openEditTokenModal(tokenId) {
    const token = getTokenById(tokenId)
    if (!token) {
      showAlert('未找到对应 Token', 'warning')
      return
    }

    dom.tokenModalTitle.textContent = `编辑 Token #${tokenId}`
    dom.tokenIdInput.value = String(tokenId)
    dom.tokenNameInput.value = token.name || ''
    dom.tokenStatusSelect.value = String(toNonNegativeInt(token.status, 1) || 1)
    dom.tokenQuotaInput.value = String(toNonNegativeInt(token.remain_quota, 0))
    dom.tokenExpireInput.value = unixToDatetimeLocal(token.expired_time)
    dom.tokenUnlimitedInput.checked = Boolean(token.unlimited_quota)
    dom.tokenModelLimitEnabledInput.checked = Boolean(token.model_limits_enabled)
    dom.tokenModelLimitsInput.value = token.model_limits || ''
    dom.tokenAllowIpsInput.value = token.allow_ips || ''
    dom.tokenGroupInput.value = token.group || ''
    dom.tokenCrossGroupRetryInput.checked = Boolean(token.cross_group_retry)
    syncTokenQuotaInputState()
    dom.tokenModal.classList.remove('hidden')
  }

  function closeTokenModal() {
    dom.tokenModal.classList.add('hidden')
  }

  function syncTokenQuotaInputState() {
    const disabled = dom.tokenUnlimitedInput.checked
    dom.tokenQuotaInput.disabled = disabled
  }

  async function handleSaveToken(event) {
    event.preventDefault()

    try {
      setButtonLoading(dom.saveTokenBtn, true, '保存中...')
      const payload = collectTokenPayloadFromForm()

      const isUpdate = Boolean(payload.id)
      if (isUpdate) {
        await apiRequest('/api/token/', {
          method: 'PUT',
          body: payload
        })
        showAlert('Token 更新成功', 'success')
      } else {
        delete payload.id
        await apiRequest('/api/token/', {
          method: 'POST',
          body: payload
        })
        showAlert('Token 创建成功', 'success')
      }

      closeTokenModal()
      await loadTokens(true)
    } catch (err) {
      showAlert('保存 Token 失败：' + (err.message || '未知错误'), 'error', 0)
    } finally {
      setButtonLoading(dom.saveTokenBtn, false)
    }
  }

  function collectTokenPayloadFromForm() {
    const id = toNonNegativeInt(dom.tokenIdInput.value, 0)
    const name = dom.tokenNameInput.value.trim()
    const status = toPositiveInt(dom.tokenStatusSelect.value, 1)
    const unlimitedQuota = dom.tokenUnlimitedInput.checked
    const quotaInput = dom.tokenQuotaInput.value.trim()
    const remainQuota = quotaInput === '' ? 0 : Number.parseInt(quotaInput, 10)
    const expireRaw = dom.tokenExpireInput.value.trim()
    const modelLimitsEnabled = dom.tokenModelLimitEnabledInput.checked
    const modelLimits = dom.tokenModelLimitsInput.value.trim()
    const allowIps = dom.tokenAllowIpsInput.value.trim()
    const group = dom.tokenGroupInput.value.trim()
    const crossGroupRetry = dom.tokenCrossGroupRetryInput.checked

    if (!name) {
      throw new Error('Token 名称不能为空')
    }

    if (!unlimitedQuota) {
      if (Number.isNaN(remainQuota)) {
        throw new Error('额度必须是整数')
      }
      if (remainQuota < 0) {
        throw new Error('额度不能小于 0')
      }
    }

    let expiredTime = -1
    if (expireRaw) {
      expiredTime = datetimeLocalToUnix(expireRaw)
      if (!expiredTime) {
        throw new Error('过期时间格式不正确')
      }
    }

    return {
      id,
      name,
      status,
      remain_quota: unlimitedQuota ? 0 : remainQuota,
      expired_time: expiredTime,
      unlimited_quota: unlimitedQuota,
      model_limits_enabled: modelLimitsEnabled,
      model_limits: modelLimits,
      allow_ips: allowIps,
      group,
      cross_group_retry: crossGroupRetry
    }
  }

  async function toggleTokenStatus(tokenId, button) {
    const token = getTokenById(tokenId)
    if (!token) {
      showAlert('未找到对应 Token', 'warning')
      return
    }

    const targetStatus = token.status === 1 ? 2 : 1

    try {
      setButtonLoading(button, true, '提交中...')
      await apiRequest('/api/token/', {
        method: 'PUT',
        query: { status_only: 'true' },
        body: {
          id: tokenId,
          status: targetStatus
        }
      })
      showAlert(`Token 已${targetStatus === 1 ? '启用' : '禁用'}`, 'success')
      await loadTokens(true)
    } catch (err) {
      showAlert('状态切换失败：' + (err.message || '未知错误'), 'error', 0)
    } finally {
      setButtonLoading(button, false)
    }
  }

  async function deleteToken(tokenId, button) {
    const confirmed = window.confirm(`确认删除 Token #${tokenId} 吗？该操作不可撤销。`)
    if (!confirmed) {
      return
    }

    try {
      setButtonLoading(button, true, '删除中...')
      await apiRequest(`/api/token/${tokenId}`, { method: 'DELETE' })
      showAlert('Token 删除成功', 'success')
      await loadTokens(true)
    } catch (err) {
      showAlert('删除 Token 失败：' + (err.message || '未知错误'), 'error', 0)
    } finally {
      setButtonLoading(button, false)
    }
  }

  function handleLogFilter(event) {
    event.preventDefault()
    void loadLogs(true, { resetScroll: true })
  }

  function handleLogFilterReset() {
    dom.logTypeSelect.value = '0'
    dom.logModelInput.value = ''
    dom.logTokenNameInput.value = ''
    dom.logRequestIdInput.value = ''
    dom.logStartInput.value = ''
    dom.logEndInput.value = ''
    dom.logGroupInput.value = ''
    dom.logPageSizeSelect.value = '20'

    void loadLogs(true, { resetScroll: true })
  }

  function handleLogTableScroll() {
    if (!state.user || state.log.isLoading || !state.log.hasMore) {
      return
    }

    const remaining = dom.logTableWrap.scrollHeight - dom.logTableWrap.scrollTop - dom.logTableWrap.clientHeight
    if (remaining <= 120) {
      void loadMoreLogs(false)
    }
  }

  function handleLogLoadStateClick() {
    if (state.log.isLoading || !state.log.hasMore) {
      return
    }
    void loadMoreLogs(true)
  }

  function collectLogFiltersFromForm() {
    state.log.pageSize = toPositiveInt(dom.logPageSizeSelect.value, 20)
    state.log.filters.type = dom.logTypeSelect.value
    state.log.filters.modelName = dom.logModelInput.value.trim()
    state.log.filters.tokenName = dom.logTokenNameInput.value.trim()
    state.log.filters.requestId = dom.logRequestIdInput.value.trim()
    state.log.filters.startTime = dom.logStartInput.value.trim()
    state.log.filters.endTime = dom.logEndInput.value.trim()
    state.log.filters.group = dom.logGroupInput.value.trim()
  }

  function buildLogQuery(withPagination) {
    const query = {}

    if (withPagination) {
      query.p = state.log.page
      query.page_size = state.log.pageSize
    }

    query.type = toNonNegativeInt(state.log.filters.type, 0)

    if (state.log.filters.modelName) {
      query.model_name = state.log.filters.modelName
    }
    if (state.log.filters.tokenName) {
      query.token_name = state.log.filters.tokenName
    }
    if (state.log.filters.requestId) {
      query.request_id = state.log.filters.requestId
    }
    if (state.log.filters.group) {
      query.group = state.log.filters.group
    }

    const startTimestamp = datetimeLocalToUnix(state.log.filters.startTime)
    const endTimestamp = datetimeLocalToUnix(state.log.filters.endTime)

    if (startTimestamp) {
      query.start_timestamp = startTimestamp
    }
    if (endTimestamp) {
      query.end_timestamp = endTimestamp
    }

    return query
  }

  async function loadLogs(showError, options = {}) {
    collectLogFiltersFromForm()

    if (options.resetScroll) {
      resetLogScrollPosition()
    }

    state.log.page = 1
    state.log.total = 0
    state.log.items = []
    state.log.hasMore = true
    state.log.isLoading = false
    state.log.lastError = ''
    state.log.requestVersion += 1

    renderLogTable()
    updateLogLoadState()

    await loadLogStat()
    await loadMoreLogs(showError, state.log.requestVersion)
  }

  async function loadMoreLogs(showError, requestVersion = state.log.requestVersion) {
    if (requestVersion !== state.log.requestVersion) {
      return
    }

    if (state.log.isLoading || !state.log.hasMore) {
      return
    }

    state.log.isLoading = true
    state.log.lastError = ''
    updateLogLoadState()

    let shouldAutoLoadNextPage = false
    const currentPage = state.log.page

    try {
      const query = buildLogQuery(true)
      query.p = currentPage
      const pageData = await apiRequest('/api/log/self', { query })

      if (requestVersion !== state.log.requestVersion) {
        return
      }

      const total = toNonNegativeInt(pageData?.total, 0)
      const pageItems = Array.isArray(pageData?.items) ? pageData.items : []

      state.log.total = total

      if (currentPage === 1) {
        state.log.items = []
      }

      if (pageItems.length > 0) {
        state.log.items = state.log.items.concat(pageItems)
      }

      if (state.log.items.length >= state.log.total || pageItems.length === 0) {
        state.log.hasMore = false
      } else {
        state.log.page = currentPage + 1
        state.log.hasMore = true
      }

      renderLogTable({ append: currentPage > 1, items: pageItems })

      shouldAutoLoadNextPage =
        state.log.hasMore && dom.logTableWrap.scrollHeight <= dom.logTableWrap.clientHeight + 8
    } catch (err) {
      if (requestVersion !== state.log.requestVersion) {
        return
      }

      state.log.lastError = err.message || '未知错误'
      if (showError) {
        showAlert('加载日志失败：' + state.log.lastError, 'error', 0)
      }
    } finally {
      if (requestVersion !== state.log.requestVersion) {
        return
      }

      state.log.isLoading = false
      updateLogLoadState()

      if (shouldAutoLoadNextPage) {
        window.setTimeout(() => {
          void loadMoreLogs(false, requestVersion)
        }, 0)
      }
    }
  }

  async function loadLogStat() {
    try {
      const query = buildLogQuery(false)
      const data = await apiRequest('/api/log/self/stat', { query })
      state.log.stat.quota = toNonNegativeInt(data?.quota, 0)
      state.log.stat.rpm = toNonNegativeInt(data?.rpm, 0)
      state.log.stat.tpm = toNonNegativeInt(data?.tpm, 0)
    } catch (err) {
      state.log.stat.quota = 0
      state.log.stat.rpm = 0
      state.log.stat.tpm = 0
      console.warn('日志统计加载失败', err)
    }

    renderLogStat()
  }

  function renderLogStat() {
    dom.statQuota.textContent = String(state.log.stat.quota)
    dom.statRpm.textContent = String(state.log.stat.rpm)
    dom.statTpm.textContent = String(state.log.stat.tpm)
  }

  function renderLogTable(options = {}) {
    const append = Boolean(options.append)
    const appendItems = Array.isArray(options.items) ? options.items : []

    if (!append) {
      if (!state.log.items.length) {
        dom.logTableBody.innerHTML = '<tr><td colspan="11" class="text-center">暂无数据</td></tr>'
        return
      }

      dom.logTableBody.innerHTML = state.log.items.map(buildLogRowHTML).join('')
      return
    }

    if (!appendItems.length) {
      return
    }

    const placeholderRow = dom.logTableBody.querySelector('td[colspan="11"]')
    if (placeholderRow) {
      dom.logTableBody.innerHTML = ''
    }

    dom.logTableBody.insertAdjacentHTML('beforeend', appendItems.map(buildLogRowHTML).join(''))
  }

  function buildLogRowHTML(item) {
    const id = toNonNegativeInt(item.id, 0)
    const createdAt = formatTimestamp(item.created_at)
    const typeText = LOG_TYPE_TEXT[item.type] || `类型${item.type}`
    const modelName = escapeHtml(String(item.model_name || '-'))
    const tokenName = escapeHtml(String(item.token_name || '-'))
    const quota = String(toNonNegativeInt(item.quota, 0))
    const promptTokens = String(toNonNegativeInt(item.prompt_tokens, 0))
    const completionTokens = String(toNonNegativeInt(item.completion_tokens, 0))
    const useTime = String(toNonNegativeInt(item.use_time, 0))
    const requestId = escapeHtml(String(item.request_id || '-'))
    const content = String(item.content || '')
    const contentShort = escapeHtml(truncateText(content, 60))
    const contentFull = escapeHtml(content)

    return `
      <tr>
        <td>${id}</td>
        <td>${escapeHtml(createdAt)}</td>
        <td>${escapeHtml(typeText)}</td>
        <td>${modelName}</td>
        <td>${tokenName}</td>
        <td>${escapeHtml(quota)}</td>
        <td>${escapeHtml(promptTokens)}</td>
        <td>${escapeHtml(completionTokens)}</td>
        <td>${escapeHtml(useTime)}</td>
        <td><code class="mono">${requestId}</code></td>
        <td title="${contentFull}">${contentShort}</td>
      </tr>
    `
  }

  function updateLogLoadState() {
    if (state.log.isLoading) {
      dom.logLoadState.classList.remove('error')
      dom.logLoadState.textContent = state.log.items.length ? '正在加载更多日志...' : '日志加载中...'
      return
    }

    if (state.log.lastError) {
      dom.logLoadState.classList.add('error')
      dom.logLoadState.textContent = `加载失败：${state.log.lastError}（点击重试）`
      return
    }

    dom.logLoadState.classList.remove('error')

    if (!state.log.items.length) {
      dom.logLoadState.textContent = '暂无日志'
      return
    }

    if (state.log.hasMore) {
      dom.logLoadState.textContent = `已加载 ${state.log.items.length} / ${state.log.total}，滚动到底部自动加载更多`
      return
    }

    dom.logLoadState.textContent = `已加载全部 ${state.log.items.length} 条日志`
  }

  function resetLogScrollPosition() {
    if (!dom.logTableWrap) {
      return
    }
    dom.logTableWrap.scrollTop = 0
  }

  async function apiRequest(path, options = {}) {
    const method = options.method || 'GET'
    const query = options.query || {}
    const body = options.body

    const baseURL = getActiveBaseURL()
    const url = buildProxyURL(path, query)

    const headers = {
      'X-Base-URL': baseURL
    }

    if (state.apiUserId) {
      headers['New-Api-User'] = state.apiUserId
    }

    const requestInit = {
      method,
      headers,
      credentials: 'include'
    }

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      requestInit.body = JSON.stringify(body)
    }

    const res = await fetch(url, requestInit)
    const payload = await safeParseJSON(res)

    if (!res.ok) {
      throw new Error(payload?.message || `HTTP ${res.status}`)
    }

    if (payload && payload.success === false) {
      throw new Error(payload.message || '请求失败')
    }

    return payload?.data
  }

  function buildProxyURL(path, query) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    const url = new URL(`/proxy${normalizedPath}`, window.location.origin)

    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return
      }
      url.searchParams.set(key, String(value))
    })

    return url.toString()
  }

  function syncBaseURLFromInput() {
    const inputValue = dom.baseUrlInput.value.trim()
    if (!inputValue) {
      if (state.baseURL) {
        return state.baseURL
      }
      if (state.defaultBaseURL) {
        state.baseURL = state.defaultBaseURL
        dom.baseUrlInput.value = state.baseURL
        return state.baseURL
      }
      throw new Error('请先配置 BaseURL')
    }

    const normalized = normalizeBaseURL(inputValue)
    state.baseURL = normalized
    dom.baseUrlInput.value = normalized
    safeStorageSet(STORAGE_KEYS.baseURL, normalized)
    return normalized
  }

  function getActiveBaseURL() {
    return syncBaseURLFromInput()
  }

  function initApiUserId() {
    const saved = safeStorageGet(STORAGE_KEYS.apiUserId)
    const parsed = toNonNegativeInt(saved, 0)
    state.apiUserId = parsed > 0 ? String(parsed) : ''
  }

  function setApiUserId(id) {
    const parsed = toNonNegativeInt(id, 0)
    if (parsed <= 0) {
      return
    }
    state.apiUserId = String(parsed)
    safeStorageSet(STORAGE_KEYS.apiUserId, state.apiUserId)
  }

  function clearApiUserId() {
    state.apiUserId = ''
    safeStorageRemove(STORAGE_KEYS.apiUserId)
  }

  function normalizeBaseURL(raw) {
    const value = String(raw || '').trim()
    if (!value) {
      throw new Error('BaseURL 不能为空')
    }

    let parsed
    try {
      parsed = new URL(value)
    } catch {
      throw new Error('BaseURL 格式错误')
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('BaseURL 仅支持 http/https')
    }

    if (!parsed.host) {
      throw new Error('BaseURL 缺少主机名')
    }

    if (parsed.username || parsed.password) {
      throw new Error('BaseURL 不允许包含用户名或密码')
    }

    parsed.search = ''
    parsed.hash = ''

    return parsed.toString().replace(/\/+$/, '')
  }

  function showAlert(message, type = 'info', autoHideMs = 4000) {
    if (!message) {
      dom.alertBox.classList.add('hidden')
      return
    }

    if (state.alertTimer) {
      clearTimeout(state.alertTimer)
      state.alertTimer = null
    }

    dom.alertBox.textContent = message
    dom.alertBox.className = `alert ${type}`

    if (autoHideMs > 0) {
      state.alertTimer = window.setTimeout(() => {
        dom.alertBox.classList.add('hidden')
      }, autoHideMs)
    }
  }

  function setButtonLoading(button, loading, loadingText) {
    if (!button) {
      return
    }

    if (loading) {
      if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent
      }
      button.disabled = true
      if (loadingText) {
        button.textContent = loadingText
      }
      return
    }

    button.disabled = false
    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText
      delete button.dataset.originalText
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
  }

  function formatTimestamp(seconds) {
    const ts = Number(seconds)
    if (!Number.isFinite(ts) || ts <= 0) {
      return '-'
    }

    const date = new Date(ts * 1000)
    if (Number.isNaN(date.getTime())) {
      return '-'
    }

    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(
      date.getHours()
    )}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
  }

  function formatExpiredTime(seconds) {
    const ts = Number(seconds)
    if (ts === -1) {
      return '永不过期'
    }
    return formatTimestamp(ts)
  }

  function unixToDatetimeLocal(seconds) {
    const ts = Number(seconds)
    if (!Number.isFinite(ts) || ts <= 0 || ts === -1) {
      return ''
    }

    const date = new Date(ts * 1000)
    if (Number.isNaN(date.getTime())) {
      return ''
    }

    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(
      date.getHours()
    )}:${pad2(date.getMinutes())}`
  }

  function datetimeLocalToUnix(value) {
    const text = String(value || '').trim()
    if (!text) {
      return 0
    }

    const ms = Date.parse(text)
    if (!Number.isFinite(ms) || Number.isNaN(ms) || ms <= 0) {
      return 0
    }

    return Math.floor(ms / 1000)
  }

  function calcTotalPage(total, pageSize) {
    const safePageSize = pageSize > 0 ? pageSize : 10
    const safeTotal = total > 0 ? total : 0
    const pages = Math.ceil(safeTotal / safePageSize)
    return pages > 0 ? pages : 1
  }

  function truncateText(text, maxLength) {
    const plain = String(text || '')
    if (plain.length <= maxLength) {
      return plain
    }
    return plain.slice(0, maxLength) + '...'
  }

  function toPositiveInt(value, fallback) {
    const n = Number.parseInt(value, 10)
    if (!Number.isFinite(n) || n <= 0) {
      return fallback
    }
    return n
  }

  function toNonNegativeInt(value, fallback) {
    const n = Number.parseInt(value, 10)
    if (!Number.isFinite(n) || n < 0) {
      return fallback
    }
    return n
  }

  function pad2(value) {
    return String(value).padStart(2, '0')
  }

  function safeStorageGet(key) {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  }

  function safeStorageSet(key, value) {
    try {
      window.localStorage.setItem(key, String(value))
    } catch {
      // ignore storage errors
    }
  }

  function safeStorageRemove(key) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // ignore storage errors
    }
  }

  async function safeParseJSON(response) {
    const text = await response.text()
    if (!text) {
      return null
    }
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', 'readonly')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()

    const success = document.execCommand('copy')
    document.body.removeChild(textarea)

    if (!success) {
      throw new Error('浏览器不支持自动复制')
    }
  }
})()
