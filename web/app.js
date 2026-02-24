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

  const LOG_TYPE_COLORS = {
    1: 'success',
    2: 'primary',
    3: 'warning',
    4: 'info',
    5: 'danger',
    6: 'warning'
  }

  const LOG_TYPE_FILTER_OPTIONS = [
    { value: '0', label: '全部类型' },
    { value: '2', label: '消费' },
    { value: '5', label: '错误' },
    { value: '1', label: '充值' },
    { value: '3', label: '管理' },
    { value: '4', label: '系统' },
    { value: '6', label: '退款' }
  ]

  const TOKEN_PAGE_SIZE_OPTIONS = [
    { value: '10', label: '10条/页' },
    { value: '20', label: '20条/页' },
    { value: '50', label: '50条/页' }
  ]

  const customSelectInstances = new Map()
  let customSelectGlobalEventsBound = false

  const LOG_PREFETCH_REMAINING_ROWS = 20
  const LOG_PAGE_SIZE = 50

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
    model: {
      items: [],
      total: 0,
      isLoading: false,
      loaded: false,
      selectedApiKey: '',
      apiKeys: [],
      manualSelection: false
    },
    log: {
      page: 1,
      pageSize: LOG_PAGE_SIZE,
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
      },
      loaded: false,
      initPromise: null,
      tokenOptions: [],
      tokenKeyByName: {},
      modelSuggestions: [],
      groupOptions: [],
      groupHint: ''
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
    renderTokenPageSizeOptions()
    renderModelApiKeyOptions()
    renderModelTable()
    renderLogTypeOptions()
    renderLogTokenOptions()
    renderLogModelSuggestions()
    renderLogGroupOptions()
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
    dom.dynamicFavicon = document.getElementById('dynamicFavicon')

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
    dom.tokenTotalBadge = document.getElementById('tokenTotalBadge')

    dom.modelPanel = document.getElementById('modelPanel')
    dom.refreshModelBtn = document.getElementById('refreshModelBtn')
    dom.modelFilterForm = document.getElementById('modelFilterForm')
    dom.modelApiKeySelect = document.getElementById('modelApiKeySelect')
    dom.modelTableBody = document.getElementById('modelTableBody')
    dom.modelTotalBadge = document.getElementById('modelTotalBadge')

    dom.logPanel = document.getElementById('logPanel')
    dom.refreshLogBtn = document.getElementById('refreshLogBtn')
    dom.logFilterForm = document.getElementById('logFilterForm')
    dom.logTypeSelect = document.getElementById('logTypeSelect')
    dom.logTokenNameInput = document.getElementById('logTokenNameInput')
    dom.logModelSelect = document.getElementById('logModelSelect')
    dom.logRequestIdInput = document.getElementById('logRequestIdInput')
    dom.logStartInput = document.getElementById('logStartInput')
    dom.logEndInput = document.getElementById('logEndInput')
    dom.logGroupSelect = document.getElementById('logGroupSelect')
    dom.logGroupHint = document.getElementById('logGroupHint')
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

    initCustomSelect(dom.tokenPageSizeSelect)
    initCustomSelect(dom.modelApiKeySelect)
    initCustomSelect(dom.logTypeSelect)
    initCustomSelect(dom.logTokenNameInput)
    initCustomSelect(dom.logModelSelect)
    initCustomSelect(dom.logGroupSelect)
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
    dom.refreshTokenBtn.addEventListener('click', () => {
      void loadTokens(true).catch(() => {})
    })
    dom.tokenFilterForm.addEventListener('submit', handleTokenFilter)
    dom.tokenFilterResetBtn.addEventListener('click', handleTokenFilterReset)
    dom.tokenPrevBtn.addEventListener('click', handleTokenPrev)
    dom.tokenNextBtn.addEventListener('click', handleTokenNext)
    dom.tokenTableBody.addEventListener('click', handleTokenTableAction)

    dom.closeTokenModalBtn.addEventListener('click', closeTokenModal)
    dom.tokenForm.addEventListener('submit', handleSaveToken)
    dom.tokenUnlimitedInput.addEventListener('change', syncTokenQuotaInputState)

    dom.refreshModelBtn.addEventListener('click', () => {
      void refreshModels(true).catch(() => {})
    })
    dom.modelFilterForm.addEventListener('submit', handleModelFilter)
    setCustomSelectOnChange(dom.modelApiKeySelect, () => {
      handleModelApiKeyChange()
    })
    setCustomSelectOnChange(dom.tokenPageSizeSelect, () => {
      syncSelectTitle(dom.tokenPageSizeSelect)
    })

    dom.refreshLogBtn.addEventListener('click', () => {
      void (async () => {
        await Promise.allSettled([refreshLogModelSuggestions(false), refreshLogGroupOptions(false)])
        await loadLogs(true)
      })().catch(() => {})
    })
    dom.logFilterForm.addEventListener('submit', handleLogFilter)
    dom.logFilterResetBtn.addEventListener('click', handleLogFilterReset)
    setCustomSelectOnChange(dom.logTokenNameInput, () => {
      handleLogTokenChange()
    })
    setCustomSelectOnChange(dom.logModelSelect, () => {
      syncSelectTitle(dom.logModelSelect)
    })
    setCustomSelectOnChange(dom.logGroupSelect, () => {
      syncSelectTitle(dom.logGroupSelect)
    })
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

    const sunIcon = dom.themeToggleBtn.querySelector('.icon-sun')
    const moonIcon = dom.themeToggleBtn.querySelector('.icon-moon')

    if (sunIcon && moonIcon) {
      if (theme === 'dark') {
        sunIcon.classList.remove('hidden')
        moonIcon.classList.add('hidden')
      } else {
        sunIcon.classList.add('hidden')
        moonIcon.classList.remove('hidden')
      }
    }
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
    updateFavicon()
  }

  function handleSaveBaseURL() {
    try {
      const inputValue = dom.baseUrlInput.value.trim()
      if (!inputValue) {
        if (state.defaultBaseURL) {
          state.baseURL = state.defaultBaseURL
          safeStorageRemove(STORAGE_KEYS.baseURL)
          dom.baseUrlInput.value = state.baseURL
          updateFavicon()
          showAlert('已恢复为默认 BaseURL', 'info')
          return
        }
        throw new Error('BaseURL 不能为空')
      }

      const normalized = normalizeBaseURL(inputValue)
      state.baseURL = normalized
      dom.baseUrlInput.value = normalized
      safeStorageSet(STORAGE_KEYS.baseURL, normalized)
      updateFavicon()
      if (state.user) {
        void Promise.allSettled([refreshLogModelSuggestions(false), refreshLogGroupOptions(false)]).catch(() => {})
      }
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
      await Promise.allSettled([loadTokens()])
      void prefetchLogPanel().catch(() => {})
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

    state.model.items = []
    state.model.total = 0
    state.model.isLoading = false
    state.model.loaded = false
    state.model.selectedApiKey = ''
    state.model.apiKeys = []
    state.model.manualSelection = false

    state.log.requestVersion += 1
    state.log.loaded = false
    state.log.initPromise = null
    state.log.page = 1
    state.log.total = 0
    state.log.items = []
    state.log.hasMore = true
    state.log.isLoading = false
    state.log.lastError = ''
    state.log.tokenOptions = []
    state.log.tokenKeyByName = {}
    state.log.modelSuggestions = []
    state.log.groupOptions = []
    state.log.groupHint = ''
    state.log.stat.quota = 0
    state.log.stat.rpm = 0
    state.log.stat.tpm = 0

    setCustomSelectValue(dom.logTypeSelect, '0', { silent: true })
    setCustomSelectValue(dom.logTokenNameInput, '', { silent: true })
    setCustomSelectValue(dom.logModelSelect, '', { silent: true })
    dom.logRequestIdInput.value = ''
    dom.logStartInput.value = ''
    dom.logEndInput.value = ''
    setCustomSelectValue(dom.logGroupSelect, '', { silent: true })

    renderTokenPageSizeOptions()
    renderModelApiKeyOptions()
    renderModelTable()
    renderLogTypeOptions()
    renderLogTokenOptions()
    renderLogModelSuggestions()
    renderLogGroupOptions()
    renderLogStat()
    renderLogTable()
    updateLogLoadState()

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
    dom.userInfoText.innerHTML = `
      <div class="user-name">${escapeHtml(state.user.username)}</div>
      <div class="user-badges">
        <span class="badge-role">${roleName}</span>
        <span class="badge-group">${escapeHtml(group)}</span>
        <span class="badge-quota">额度 ${quota}</span>
      </div>
    `
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
      await Promise.allSettled([loadTokens()])
      void prefetchLogPanel().catch(() => {})
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
      const isActive = panel.id === panelId
      panel.classList.toggle('hidden', !isActive)
      panel.classList.toggle('show', isActive)
    })

    if (panelId === 'modelPanel' && state.user && !state.model.loaded) {
      void refreshModels(true).catch(() => {})
    }

    if (panelId === 'logPanel' && state.user && !state.log.loaded) {
      void ensureLogPanelInitialized(true).catch(() => {})
    }
  }

  function handleTokenFilter(event) {
    event.preventDefault()
    state.token.keyword = dom.tokenKeywordInput.value.trim()
    state.token.pageSize = toPositiveInt(getCustomSelectValue(dom.tokenPageSizeSelect), 10)
    state.token.page = 1
    void loadTokens(true).catch(() => {})
  }

  function handleTokenFilterReset() {
    dom.tokenKeywordInput.value = ''
    setCustomSelectValue(dom.tokenPageSizeSelect, '10', { silent: true })
    state.token.keyword = ''
    state.token.pageSize = 10
    state.token.page = 1
    void loadTokens(true).catch(() => {})
  }

  function handleTokenPrev() {
    if (state.token.page <= 1) {
      return
    }
    state.token.page -= 1
    void loadTokens(true).catch(() => {})
  }

  function handleTokenNext() {
    const totalPage = calcTotalPage(state.token.total, state.token.pageSize)
    if (state.token.page >= totalPage) {
      return
    }
    state.token.page += 1
    void loadTokens(true).catch(() => {})
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
      if (dom.tokenTotalBadge) {
        dom.tokenTotalBadge.textContent = state.token.total
      }
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
      dom.tokenTableBody.innerHTML = '<tr><td colspan="7" class="text-center">暂无数据</td></tr>'
      return
    }

    dom.tokenTableBody.innerHTML = state.token.items
      .map((token) => {
        const id = toNonNegativeInt(token.id, 0)
        const keyText = escapeHtml(normalizeTokenKey(token.key))
        const nameText = escapeHtml(String(token.name || '-'))

                let statusClass = 'badge'
        if (token.status === 1) statusClass = 'badge badge-success'
        else if (token.status === 2) statusClass = 'badge badge-danger'
        else if (token.status === 3) statusClass = 'badge badge-warning'

        const statusText = `<span class="${statusClass}">${TOKEN_STATUS_TEXT[token.status] || '未知'}</span>`

        const quotaText = token.unlimited_quota
          ? '<span class="badge-count">无限</span>'
          : `${toNonNegativeInt(token.remain_quota, 0)}`

        const expiredText = formatExpiredTime(token.expired_time)
        const toggleText = token.status === 1 ? '禁用' : '启用'

        return `
          <tr>
            <td><code class="mono text-sub">#${id}</code></td>
            <td>${nameText}</td>
            <td><code class="mono token-key">${keyText}</code></td>
            <td>${statusText}</td>
            <td>${quotaText}</td>
            <td class="text-sub">${escapeHtml(expiredText)}</td>
            <td>
              <div class="inline-actions">
                <button class="btn-ghost-primary" type="button" data-action="copy" data-id="${id}" title="复制 Key">
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </button>
                <button class="btn-ghost-primary" type="button" data-action="edit" data-id="${id}" title="编辑">
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="btn-ghost-primary" type="button" data-action="toggle" data-id="${id}" title="${toggleText}">
                  ${token.status === 1
                    ? '<svg class="text-danger" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>'
                    : '<svg class="text-success" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'}
                </button>
                <button class="btn-ghost-primary text-danger" type="button" data-action="delete" data-id="${id}" title="删除">
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
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

    const key = normalizeTokenKey(token.key)
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
    // 状态从前端 select 获取，默认为 1（启用）
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

  function handleModelApiKeyChange() {
    state.model.manualSelection = true
    state.model.selectedApiKey = getCustomSelectValue(dom.modelApiKeySelect).trim()
    syncSelectTitle(dom.modelApiKeySelect)
  }

  function handleModelFilter(event) {
    event.preventDefault()
    handleModelApiKeyChange()
    void loadModels(true).catch(() => {})
  }

  async function refreshModels(showError) {
    await loadModelApiKeyOptions(showError)
    await loadModels(showError)
    state.model.loaded = true
  }

  async function loadModelApiKeyOptions(showError) {
    try {
      const tokens = await fetchModelApiKeyTokens()
      const options = []
      const seenKeys = new Set()

      tokens.forEach((token) => {
        const key = normalizeTokenKey(token.key)
        if (!key || seenKeys.has(key)) {
          return
        }

        seenKeys.add(key)

        const tokenId = toNonNegativeInt(token.id, 0)
        const tokenName = String(token.name || '').trim() || `Token #${tokenId || '-'}`
        const tokenStatus = Number.parseInt(token.status, 10)

        options.push({
          key,
          label: formatModelApiKeyLabel(tokenName, key),
          rawLabel: `${tokenName} (${key})`,
          isAvailable: tokenStatus === 1
        })
      })

      state.model.apiKeys = options

      const selectedExists = state.model.apiKeys.some((item) => item.key === state.model.selectedApiKey)
      const keepManualPublicSelection = state.model.manualSelection && state.model.selectedApiKey === ''
      const fallbackApiKey =
        state.model.apiKeys.find((item) => item.isAvailable)?.key || state.model.apiKeys[0]?.key || ''

      if (!selectedExists) {
        state.model.selectedApiKey = keepManualPublicSelection ? '' : fallbackApiKey
      }

      renderModelApiKeyOptions()
    } catch (err) {
      if (showError) {
        showAlert('加载 API Key 列表失败：' + (err.message || '未知错误'), 'error', 0)
      }
      throw err
    }
  }

  async function fetchModelApiKeyTokens() {
    const pageSize = 100
    const maxPages = 20
    const allItems = []
    let page = 1
    let total = 0

    while (page <= maxPages) {
      const pageData = await apiRequest('/api/token/', {
        query: {
          p: page,
          page_size: pageSize
        }
      })

      const items = Array.isArray(pageData?.items) ? pageData.items : []
      total = toNonNegativeInt(pageData?.total, total)

      if (!items.length) {
        break
      }

      allItems.push(...items)

      if (total > 0 && allItems.length >= total) {
        break
      }

      if (items.length < pageSize) {
        break
      }

      page += 1
    }

    return allItems
  }

  function renderModelApiKeyOptions() {
    if (!dom.modelApiKeySelect) {
      return
    }

    const options = [
      {
        value: '',
        label: '不使用 API Key（公开访问）',
        title: '不使用 API Key（公开访问）'
      },
      ...state.model.apiKeys.map((item) => ({
        value: item.key,
        label: item.label,
        title: item.rawLabel || item.label
      }))
    ]

    setCustomSelectOptions(dom.modelApiKeySelect, options)

    const selectedExists = state.model.apiKeys.some((item) => item.key === state.model.selectedApiKey)
    setCustomSelectValue(dom.modelApiKeySelect, selectedExists ? state.model.selectedApiKey : '', {
      silent: true
    })
    syncSelectTitle(dom.modelApiKeySelect)
  }

  async function loadModels(showError) {
    if (state.model.isLoading) {
      return
    }

    state.model.isLoading = true
    renderModelTable({ loading: true })

    try {
      const headers = {}
      if (state.model.selectedApiKey) {
        headers.Authorization = `Bearer ${state.model.selectedApiKey}`
      }

      const { items } = await requestModelList(headers)

      state.model.items = items
      state.model.total = items.length
      dom.modelTotalBadge.textContent = String(state.model.total)
      renderModelTable()
    } catch (err) {
      state.model.items = []
      state.model.total = 0
      dom.modelTotalBadge.textContent = '0'
      renderModelTable()

      if (showError) {
        showAlert('加载模型失败：' + (err.message || '未知错误'), 'error', 0)
      }
      throw err
    } finally {
      state.model.isLoading = false
    }
  }

  async function requestModelList(headers) {
    let v1Payload = null
    let fallbackToModels = false

    try {
      v1Payload = await apiRequest('/v1/models', { headers, rawResponse: true })
    } catch (err) {
      const message = String(err?.message || '')
      if (message.includes('响应解析失败')) {
        fallbackToModels = true
      } else {
        throw err
      }
    }

    if (!fallbackToModels) {
      const v1Items = extractModelItemsFromPayload(v1Payload)
      if (Array.isArray(v1Items)) {
        return { items: v1Items, path: '/v1/models' }
      }
      fallbackToModels = true
    }

    const fallbackPayload = await apiRequest('/models', { headers, rawResponse: true })
    const fallbackItems = extractModelItemsFromPayload(fallbackPayload)
    if (Array.isArray(fallbackItems)) {
      return { items: fallbackItems, path: '/models' }
    }

    throw new Error('/v1/models 解析失败，/models 解析也失败')
  }

  function extractModelItemsFromPayload(payload) {
    if (Array.isArray(payload)) {
      return payload
    }

    if (!payload || typeof payload !== 'object') {
      return null
    }

    if (Array.isArray(payload.data)) {
      return payload.data
    }

    if (payload.data && Array.isArray(payload.data.data)) {
      return payload.data.data
    }

    return null
  }

  function renderModelTable(options = {}) {
    if (!dom.modelTableBody) {
      return
    }

    if (dom.modelTotalBadge) {
      dom.modelTotalBadge.textContent = String(state.model.total)
    }

    if (options.loading) {
      dom.modelTableBody.innerHTML = '<tr><td colspan="4" class="text-center">模型加载中...</td></tr>'
      return
    }

    if (!state.model.items.length) {
      dom.modelTableBody.innerHTML = '<tr><td colspan="4" class="text-center">暂无模型数据</td></tr>'
      return
    }

    dom.modelTableBody.innerHTML = state.model.items
      .map((item, index) => {
        const modelID = escapeHtml(String(item?.id || '-'))
        const ownedBy = escapeHtml(String(item?.owned_by || '-'))
        const endpointTypes = Array.isArray(item?.supported_endpoint_types)
          ? item.supported_endpoint_types.map((v) => String(v || '').trim()).filter(Boolean)
          : []
        const endpointText = endpointTypes.length ? endpointTypes.join(', ') : '-'

        return `
          <tr>
            <td><code class="mono text-sub">${index + 1}</code></td>
            <td><code class="mono model-id">${modelID}</code></td>
            <td>${ownedBy}</td>
            <td>${escapeHtml(endpointText)}</td>
          </tr>
        `
      })
      .join('')
  }

  function handleLogFilter(event) {
    event.preventDefault()
    void loadLogs(true, { resetScroll: true })
  }

  function handleLogFilterReset() {
    setCustomSelectValue(dom.logTypeSelect, '0', { silent: true })
    setCustomSelectValue(dom.logTokenNameInput, '', { silent: true })
    setCustomSelectValue(dom.logModelSelect, '', { silent: true })
    dom.logRequestIdInput.value = ''
    dom.logStartInput.value = ''
    dom.logEndInput.value = ''
    setCustomSelectValue(dom.logGroupSelect, '', { silent: true })

    void refreshLogModelSuggestions(false).catch(() => {})
    void refreshLogGroupOptions(false).catch(() => {})
    void loadLogs(true, { resetScroll: true })
  }

  function handleLogTokenChange() {
    syncSelectTitle(dom.logTokenNameInput)
    void refreshLogModelSuggestions(false).catch(() => {})
  }

  function prefetchLogPanel() {
    if (!state.user) {
      return Promise.resolve()
    }
    return ensureLogPanelInitialized(false)
  }

  function ensureLogPanelInitialized(showError) {
    if (state.log.loaded) {
      return Promise.resolve()
    }

    if (state.log.initPromise) {
      return state.log.initPromise
    }

    state.log.initPromise = (async () => {
      await initializeLogPanel(showError)
      state.log.loaded = true
    })()
      .catch((err) => {
        state.log.loaded = false
        throw err
      })
      .finally(() => {
        state.log.initPromise = null
      })

    return state.log.initPromise
  }

  async function initializeLogPanel(showError) {
    try {
      await ensureLogTokenOptions(showError)
    } catch {
      // ignore token option errors, 日志仍可按当前条件查询
    }

    await Promise.allSettled([refreshLogModelSuggestions(false), refreshLogGroupOptions(false)])
    await loadLogs(showError, { resetScroll: true })
  }

  async function ensureLogTokenOptions(showError) {
    if (state.log.tokenOptions.length) {
      renderLogTokenOptions()
      return
    }

    try {
      const tokens = await fetchModelApiKeyTokens()
      const byName = new Map()

      tokens.forEach((token) => {
        const tokenName = String(token?.name || '').trim()
        if (!tokenName || byName.has(tokenName)) {
          return
        }
        byName.set(tokenName, normalizeTokenKey(token?.key))
      })

      state.log.tokenOptions = Array.from(byName.entries())
        .map(([name, key]) => ({ name, key }))
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))

      state.log.tokenKeyByName = Object.fromEntries(
        state.log.tokenOptions.map((item) => [item.name, item.key])
      )

      renderLogTokenOptions()
    } catch (err) {
      if (showError) {
        showAlert('加载日志 Token 下拉失败：' + (err.message || '未知错误'), 'error', 0)
      }
      throw err
    }
  }

  function renderTokenPageSizeOptions() {
    if (!dom.tokenPageSizeSelect) {
      return
    }

    const currentValue = getCustomSelectValue(dom.tokenPageSizeSelect).trim() || String(state.token.pageSize || 10)
    const options = TOKEN_PAGE_SIZE_OPTIONS.map((item) => ({
      value: item.value,
      label: item.label,
      title: item.label
    }))

    setCustomSelectOptions(dom.tokenPageSizeSelect, options)

    const exists = options.some((item) => item.value === currentValue)
    const fallback = String(state.token.pageSize || 10)
    setCustomSelectValue(dom.tokenPageSizeSelect, exists ? currentValue : fallback, { silent: true })
    syncSelectTitle(dom.tokenPageSizeSelect)
  }

  function renderLogTypeOptions() {
    if (!dom.logTypeSelect) {
      return
    }

    const currentValue = getCustomSelectValue(dom.logTypeSelect).trim() || '0'
    const options = LOG_TYPE_FILTER_OPTIONS.map((item) => ({
      value: item.value,
      label: item.label,
      title: item.label
    }))

    setCustomSelectOptions(dom.logTypeSelect, options)

    const exists = options.some((item) => item.value === currentValue)
    setCustomSelectValue(dom.logTypeSelect, exists ? currentValue : '0', { silent: true })
    syncSelectTitle(dom.logTypeSelect)
  }

  function renderLogTokenOptions() {
    if (!dom.logTokenNameInput) {
      return
    }

    const currentValue = getCustomSelectValue(dom.logTokenNameInput).trim()
    const options = [
      {
        value: '',
        label: '全部 Token',
        title: '全部 Token'
      },
      ...state.log.tokenOptions.map((item) => ({
        value: item.name,
        label: truncateMiddle(item.name, 28, 16, 8),
        title: item.name
      }))
    ]

    setCustomSelectOptions(dom.logTokenNameInput, options)

    const exists = state.log.tokenOptions.some((item) => item.name === currentValue)
    setCustomSelectValue(dom.logTokenNameInput, exists ? currentValue : '', { silent: true })
    syncSelectTitle(dom.logTokenNameInput)
  }

  async function refreshLogModelSuggestions(showError) {
    try {
      const selectedTokenName = getCustomSelectValue(dom.logTokenNameInput).trim()

      if (!selectedTokenName) {
        const data = await apiRequest('/api/internal/log/model-suggestions', { local: true })
        const modelIds = Array.isArray(data?.model_ids)
          ? data.model_ids.map((item) => String(item || '').trim()).filter(Boolean)
          : []

        state.log.modelSuggestions = modelIds
        renderLogModelSuggestions()
        return
      }

      const selectedTokenKey = state.log.tokenKeyByName[selectedTokenName] || ''
      const headers = {}

      if (selectedTokenKey) {
        headers.Authorization = `Bearer ${selectedTokenKey}`
      }

      const { items } = await requestModelList(headers)
      const modelIds = []
      const seen = new Set()

      items.forEach((item) => {
        const modelId = String(item?.id || '').trim()
        if (!modelId || seen.has(modelId)) {
          return
        }
        seen.add(modelId)
        modelIds.push(modelId)
      })

      state.log.modelSuggestions = modelIds
      renderLogModelSuggestions()
    } catch (err) {
      state.log.modelSuggestions = []
      renderLogModelSuggestions()

      if (showError) {
        showAlert('加载日志模型下拉失败：' + (err.message || '未知错误'), 'warning', 0)
      }
    }
  }

  function renderLogModelSuggestions() {
    if (!dom.logModelSelect) {
      return
    }

    const currentValue = getCustomSelectValue(dom.logModelSelect).trim()
    const options = [
      {
        value: '',
        label: '全部模型',
        title: '全部模型'
      },
      ...state.log.modelSuggestions.map((modelId) => ({
        value: modelId,
        label: truncateMiddle(modelId, 44, 24, 16),
        title: modelId
      }))
    ]

    setCustomSelectOptions(dom.logModelSelect, options)

    const exists = state.log.modelSuggestions.some((item) => item === currentValue)
    setCustomSelectValue(dom.logModelSelect, exists ? currentValue : '', { silent: true })
    syncSelectTitle(dom.logModelSelect)
  }

  async function refreshLogGroupOptions(showError) {
    const currentValue = getCustomSelectValue(dom.logGroupSelect).trim()

    try {
      const groups = await fetchLogGroupOptionsFromBaseURL()
      state.log.groupOptions = groups
      state.log.groupHint = groups.length
        ? ''
        : '当前 BaseURL 暂未返回可选分组，已保留“全部分组”筛选。'
      renderLogGroupOptions(currentValue)
    } catch (err) {
      state.log.groupOptions = []
      state.log.groupHint = '当前 BaseURL 未能获取分组列表，日志仍可正常筛选。'
      renderLogGroupOptions(currentValue)

      if (showError) {
        showAlert('加载日志分组下拉失败：' + (err.message || '未知错误'), 'warning', 0)
      }
    }
  }

  async function fetchLogGroupOptionsFromBaseURL() {
    const candidates = ['/api/user/self/groups', '/api/user/groups', '/api/group/']
    let hasSuccessResponse = false
    let lastError = null

    for (const path of candidates) {
      try {
        const data = await apiRequest(path)
        hasSuccessResponse = true

        const groups = extractGroupNamesFromPayload(data)
        if (groups.length) {
          return groups
        }
      } catch (err) {
        lastError = err
      }
    }

    if (hasSuccessResponse) {
      return []
    }

    if (lastError) {
      throw lastError
    }

    return []
  }

  function extractGroupNamesFromPayload(payload) {
    const names = []

    if (Array.isArray(payload)) {
      payload.forEach((item) => {
        const name = String(item || '').trim()
        if (name) {
          names.push(name)
        }
      })
    } else if (payload && typeof payload === 'object') {
      Object.keys(payload).forEach((key) => {
        const name = String(key || '').trim()
        if (name) {
          names.push(name)
        }
      })
    } else if (typeof payload === 'string') {
      const name = payload.trim()
      if (name) {
        names.push(name)
      }
    }

    const unique = Array.from(new Set(names))
    unique.sort((a, b) => a.localeCompare(b, 'zh-CN'))
    return unique
  }

  function renderLogGroupOptions(preferredValue = null) {
    if (!dom.logGroupSelect) {
      return
    }

    const currentValue =
      preferredValue === null ? getCustomSelectValue(dom.logGroupSelect).trim() : String(preferredValue || '').trim()

    const options = [
      {
        value: '',
        label: '全部分组',
        title: '全部分组'
      },
      ...state.log.groupOptions.map((groupName) => ({
        value: groupName,
        label: truncateMiddle(groupName, 34, 18, 12),
        title: groupName
      }))
    ]

    setCustomSelectOptions(dom.logGroupSelect, options)

    const exists = state.log.groupOptions.some((item) => item === currentValue)
    setCustomSelectValue(dom.logGroupSelect, exists ? currentValue : '', { silent: true })
    syncSelectTitle(dom.logGroupSelect)

    if (dom.logGroupHint) {
      const hintText = String(state.log.groupHint || '').trim()
      dom.logGroupHint.textContent = hintText
      dom.logGroupHint.classList.toggle('hidden', !hintText)
    }
  }

  function handleLogTableScroll() {
    if (!state.user || state.log.isLoading || !state.log.hasMore) {
      return
    }

    const remainingPx =
      dom.logTableWrap.scrollHeight - dom.logTableWrap.scrollTop - dom.logTableWrap.clientHeight

    const rowCount = dom.logTableBody.querySelectorAll('tr').length
    const avgRowHeight = rowCount > 0 ? dom.logTableBody.scrollHeight / rowCount : 40
    const safeRowHeight = avgRowHeight > 0 ? avgRowHeight : 40
    const remainingRows = remainingPx / safeRowHeight

    if (remainingRows <= LOG_PREFETCH_REMAINING_ROWS) {
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
    state.log.pageSize = LOG_PAGE_SIZE
    state.log.filters.type = getCustomSelectValue(dom.logTypeSelect)
    state.log.filters.modelName = getCustomSelectValue(dom.logModelSelect).trim()
    state.log.filters.tokenName = getCustomSelectValue(dom.logTokenNameInput).trim()
    state.log.filters.requestId = dom.logRequestIdInput.value.trim()
    state.log.filters.startTime = dom.logStartInput.value.trim()
    state.log.filters.endTime = dom.logEndInput.value.trim()
    state.log.filters.group = getCustomSelectValue(dom.logGroupSelect).trim()
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
        state.log.hasMore &&
        isLogPanelVisible() &&
        dom.logTableWrap.clientHeight > 0 &&
        dom.logTableWrap.scrollHeight <= dom.logTableWrap.clientHeight + 8
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
        dom.logTableBody.innerHTML = '<tr><td colspan="9" class="text-center">暂无数据</td></tr>'
        return
      }

      dom.logTableBody.innerHTML = state.log.items.map(buildLogRowHTML).join('')
      return
    }

    if (!appendItems.length) {
      return
    }

    const placeholderRow = dom.logTableBody.querySelector('td[colspan="9"]')
    if (placeholderRow) {
      dom.logTableBody.innerHTML = ''
    }

    dom.logTableBody.insertAdjacentHTML('beforeend', appendItems.map(buildLogRowHTML).join(''))
  }

  function buildLogRowHTML(item) {
    const createdAt = formatTimestamp(item.created_at)
    const type = item.type
    const typeText = LOG_TYPE_TEXT[type] || '未知'
    const typeColor = LOG_TYPE_COLORS[type]
    const badgeClass = typeColor ? `badge badge-${typeColor}` : 'badge'

    const modelName = escapeHtml(String(item.model_name || '-'))
    const tokenName = escapeHtml(String(item.token_name || '-'))
    const promptTokens = toNonNegativeInt(item.prompt_tokens, 0)
    const completionTokens = toNonNegativeInt(item.completion_tokens, 0)
    const useTime = toNonNegativeInt(item.use_time, 0)
    const firstTokenTimeText = formatFirstTokenTime(item)
    const content = String(item.content || '')
    const contentFull = escapeHtml(content)

    let detailHTML = '<span class="text-sub">-</span>'
    if (content) {
      if (type === 5) {
        detailHTML = `<div title="${contentFull}" class="log-content-error">${escapeHtml(
          truncateText(content, 100)
        )}</div>`
      } else {
        detailHTML = `<span title="${contentFull}" class="text-sub log-content-short">${escapeHtml(
          truncateText(content, 40)
        )}</span>`
      }
    }

    return `
      <tr>
        <td><div class="text-sub">${escapeHtml(createdAt)}</div></td>
        <td><span class="${badgeClass}">${escapeHtml(typeText)}</span></td>
        <td>${modelName}</td>
        <td><code class="mono">${tokenName}</code></td>
        <td>${promptTokens}</td>
        <td>${completionTokens}</td>
        <td class="text-sub">${useTime}s</td>
        <td class="text-sub">${escapeHtml(firstTokenTimeText)}</td>
        <td>${detailHTML}</td>
      </tr>
    `
  }

  function formatFirstTokenTime(logItem) {
    const ms = extractFirstTokenMs(logItem)
    if (ms === null) {
      return '-'
    }

    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(2)}s`
    }

    return `${ms}ms`
  }

  function extractFirstTokenMs(logItem) {
    const direct = toFiniteNumber(logItem?.frt)
    if (direct !== null && direct >= 0) {
      return Math.round(direct)
    }

    const other = parseLogOther(logItem?.other)
    const fromOther = toFiniteNumber(other?.frt)
    if (fromOther === null || fromOther < 0) {
      return null
    }

    return Math.round(fromOther)
  }

  function parseLogOther(rawOther) {
    if (!rawOther) {
      return null
    }

    if (typeof rawOther === 'object') {
      return rawOther
    }

    try {
      const parsed = JSON.parse(String(rawOther))
      if (parsed && typeof parsed === 'object') {
        return parsed
      }
    } catch {
      // ignore parse error
    }

    return null
  }

  function toFiniteNumber(value) {
    const num = Number(value)
    if (!Number.isFinite(num)) {
      return null
    }
    return num
  }

  function isLogPanelVisible() {
    if (!dom.logPanel) {
      return false
    }

    return dom.logPanel.classList.contains('show') && !dom.logPanel.classList.contains('hidden')
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
    const rawResponse = Boolean(options.rawResponse)
    const localRequest = Boolean(options.local)

    const baseURL = getActiveBaseURL()
    const url = localRequest ? buildLocalURL(path, query) : buildProxyURL(path, query)

    const headers = {
      'X-Base-URL': baseURL,
      ...(options.headers || {})
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

    if (payload === null) {
      if (rawResponse) {
        throw new Error('响应解析失败')
      }
      return null
    }

    if (payload && payload.success === false) {
      throw new Error(payload.message || '请求失败')
    }

    return rawResponse ? payload : payload?.data
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

  function buildLocalURL(path, query) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    const url = new URL(normalizedPath, window.location.origin)

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
        updateFavicon()
        return state.baseURL
      }
      throw new Error('请先配置 BaseURL')
    }

    const normalized = normalizeBaseURL(inputValue)
    state.baseURL = normalized
    dom.baseUrlInput.value = normalized
    safeStorageSet(STORAGE_KEYS.baseURL, normalized)
    updateFavicon()
    return normalized
  }

  function getActiveBaseURL() {
    return syncBaseURLFromInput()
  }

  function updateFavicon() {
    if (!dom.dynamicFavicon) {
      return
    }

    const activeBase = String(state.baseURL || '').trim()
    if (!activeBase) {
      dom.dynamicFavicon.href = '/favicon.png'
      return
    }

    try {
      const normalized = normalizeBaseURL(activeBase)
      const encodedBase = encodeURIComponent(normalized)
      dom.dynamicFavicon.href = `/favicon.png?base_url=${encodedBase}`
    } catch {
      dom.dynamicFavicon.href = '/favicon.png'
    }
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
    dom.alertBox.className = `alert-toast ${type}`

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
      if (button.dataset.originalHtml === undefined) {
        button.dataset.originalHtml = button.innerHTML
      }
      button.disabled = true
      if (loadingText) {
        button.textContent = loadingText
      }
      return
    }

    button.disabled = false
    if (button.dataset.originalHtml !== undefined) {
      button.innerHTML = button.dataset.originalHtml
      delete button.dataset.originalHtml
    }
  }

  function normalizeTokenKey(raw) {
    const key = String(raw || '').trim()
    if (!key) {
      return ''
    }

    if (/^sk-/i.test(key)) {
      return key
    }

    return `sk-${key}`
  }

  function formatModelApiKeyLabel(tokenName, key) {
    const safeName = truncateMiddle(String(tokenName || ''), 26, 14, 8)
    const safeKey = truncateMiddle(String(key || ''), 24, 8, 8)
    return `${safeName} (${safeKey})`
  }

  function syncSelectTitle(selectElement) {
    if (!selectElement) {
      return
    }

    const instance = customSelectInstances.get(selectElement)
    if (instance) {
      const selected = instance.options.find((item) => item.value === instance.value) || null
      selectElement.title = selected ? selected.title || selected.label : ''
      return
    }

    const selectedOption = selectElement.options?.[selectElement.selectedIndex]
    selectElement.title = selectedOption ? selectedOption.text : ''
  }

  function initCustomSelect(selectRoot) {
    if (!selectRoot || customSelectInstances.has(selectRoot)) {
      return
    }

    selectRoot.innerHTML = `
      <button type="button" class="custom-select-trigger" aria-haspopup="listbox" aria-expanded="false">
        <span class="custom-select-label">请选择</span>
        <span class="custom-select-caret" aria-hidden="true"></span>
      </button>
      <div class="custom-select-dropdown hidden" role="listbox"></div>
    `

    const trigger = selectRoot.querySelector('.custom-select-trigger')
    const label = selectRoot.querySelector('.custom-select-label')
    const dropdown = selectRoot.querySelector('.custom-select-dropdown')

    if (!trigger || !label || !dropdown) {
      return
    }

    const instance = {
      root: selectRoot,
      trigger,
      label,
      dropdown,
      value: '',
      options: [],
      onChange: null,
      isOpen: false
    }

    customSelectInstances.set(selectRoot, instance)
    bindCustomSelectGlobalEvents()

    trigger.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (instance.isOpen) {
        closeCustomSelect(selectRoot)
      } else {
        openCustomSelect(selectRoot)
      }
    })

    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault()
        openCustomSelect(selectRoot)
      }

      if (event.key === 'Escape') {
        closeCustomSelect(selectRoot)
      }
    })

    dropdown.addEventListener('click', (event) => {
      const optionBtn = event.target.closest('.custom-select-option')
      if (!optionBtn) {
        return
      }

      const optionIndex = Number.parseInt(optionBtn.dataset.optionIndex || '', 10)
      if (!Number.isFinite(optionIndex) || optionIndex < 0 || optionIndex >= instance.options.length) {
        return
      }

      const nextValue = instance.options[optionIndex].value
      setCustomSelectValue(selectRoot, nextValue)
      closeCustomSelect(selectRoot)
    })

    updateCustomSelectUI(selectRoot)
  }

  function bindCustomSelectGlobalEvents() {
    if (customSelectGlobalEventsBound) {
      return
    }

    customSelectGlobalEventsBound = true

    document.addEventListener('click', (event) => {
      customSelectInstances.forEach((_, root) => {
        if (!root.contains(event.target)) {
          closeCustomSelect(root)
        }
      })
    })

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeAllCustomSelect()
      }
    })

    window.addEventListener('resize', () => {
      closeAllCustomSelect()
    })
  }

  function setCustomSelectOnChange(selectRoot, handler) {
    const instance = customSelectInstances.get(selectRoot)
    if (!instance) {
      return
    }

    instance.onChange = typeof handler === 'function' ? handler : null
  }

  function setCustomSelectOptions(selectRoot, options) {
    const instance = customSelectInstances.get(selectRoot)
    if (!instance) {
      return
    }

    const normalizedOptions = Array.isArray(options)
      ? options.map((item) => ({
          value: String(item?.value ?? ''),
          label: String(item?.label ?? ''),
          title: String(item?.title ?? item?.label ?? '')
        }))
      : []

    instance.options = normalizedOptions
    instance.dropdown.innerHTML = ''

    if (!normalizedOptions.length) {
      instance.value = ''
      const empty = document.createElement('div')
      empty.className = 'custom-select-empty'
      empty.textContent = '暂无可选项'
      instance.dropdown.appendChild(empty)
      updateCustomSelectUI(selectRoot)
      return
    }

    normalizedOptions.forEach((item, index) => {
      const optionButton = document.createElement('button')
      optionButton.type = 'button'
      optionButton.className = 'custom-select-option'
      optionButton.dataset.optionIndex = String(index)
      optionButton.title = item.title
      optionButton.textContent = item.label
      instance.dropdown.appendChild(optionButton)
    })

    const exists = normalizedOptions.some((item) => item.value === instance.value)
    if (!exists) {
      instance.value = normalizedOptions[0].value
    }

    updateCustomSelectUI(selectRoot)
  }

  function setCustomSelectValue(selectRoot, value, options = {}) {
    const instance = customSelectInstances.get(selectRoot)
    if (!instance) {
      return
    }

    const silent = Boolean(options.silent)
    const normalizedValue = String(value ?? '')
    let nextValue = normalizedValue

    const exists = instance.options.some((item) => item.value === normalizedValue)
    if (!exists) {
      nextValue = instance.options[0]?.value || ''
    }

    const changed = instance.value !== nextValue
    instance.value = nextValue
    updateCustomSelectUI(selectRoot)

    if (changed && !silent && typeof instance.onChange === 'function') {
      instance.onChange(nextValue)
    }
  }

  function getCustomSelectValue(selectRoot) {
    if (!selectRoot) {
      return ''
    }

    const instance = customSelectInstances.get(selectRoot)
    if (instance) {
      return instance.value || ''
    }

    return String(selectRoot.value || '')
  }

  function openCustomSelect(selectRoot) {
    const instance = customSelectInstances.get(selectRoot)
    if (!instance || instance.isOpen || !instance.options.length) {
      return
    }

    closeAllCustomSelect(selectRoot)

    instance.isOpen = true
    instance.root.classList.add('open')
    instance.trigger.setAttribute('aria-expanded', 'true')
    instance.dropdown.classList.remove('hidden')
  }

  function closeCustomSelect(selectRoot) {
    const instance = customSelectInstances.get(selectRoot)
    if (!instance || !instance.isOpen) {
      return
    }

    instance.isOpen = false
    instance.root.classList.remove('open')
    instance.trigger.setAttribute('aria-expanded', 'false')
    instance.dropdown.classList.add('hidden')
  }

  function closeAllCustomSelect(exceptRoot = null) {
    customSelectInstances.forEach((_, root) => {
      if (root !== exceptRoot) {
        closeCustomSelect(root)
      }
    })
  }

  function updateCustomSelectUI(selectRoot) {
    const instance = customSelectInstances.get(selectRoot)
    if (!instance) {
      return
    }

    const selected = instance.options.find((item) => item.value === instance.value) || null
    const labelText = selected ? selected.label : '请选择'
    const titleText = selected ? selected.title || selected.label : ''

    instance.label.textContent = labelText
    instance.root.title = titleText
    instance.root.dataset.value = selected ? selected.value : ''

    const optionButtons = instance.dropdown.querySelectorAll('.custom-select-option')
    optionButtons.forEach((button) => {
      const optionIndex = Number.parseInt(button.dataset.optionIndex || '', 10)
      const option = Number.isFinite(optionIndex) ? instance.options[optionIndex] : null
      const active = Boolean(option && selected && option.value === selected.value)

      button.classList.toggle('active', active)
      if (active) {
        button.setAttribute('aria-selected', 'true')
      } else {
        button.removeAttribute('aria-selected')
      }
    })
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

    if (/^\d{10,13}$/.test(text)) {
      const num = Number(text)
      if (!Number.isFinite(num) || Number.isNaN(num) || num <= 0) {
        return 0
      }
      return text.length === 13 ? Math.floor(num / 1000) : Math.floor(num)
    }

    const normalized = text.replaceAll('/', '-').replace(/\s+/, ' ')
    const directMs = Date.parse(normalized)
    if (Number.isFinite(directMs) && !Number.isNaN(directMs) && directMs > 0) {
      return Math.floor(directMs / 1000)
    }

    const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/)
    if (!match) {
      return 0
    }

    const year = Number.parseInt(match[1], 10)
    const month = Number.parseInt(match[2], 10)
    const day = Number.parseInt(match[3], 10)
    const hour = Number.parseInt(match[4] || '0', 10)
    const minute = Number.parseInt(match[5] || '0', 10)
    const second = Number.parseInt(match[6] || '0', 10)

    const date = new Date(year, month - 1, day, hour, minute, second)
    if (Number.isNaN(date.getTime())) {
      return 0
    }

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day ||
      date.getHours() !== hour ||
      date.getMinutes() !== minute ||
      date.getSeconds() !== second
    ) {
      return 0
    }

    return Math.floor(date.getTime() / 1000)
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

  function truncateMiddle(text, maxLength = 24, headLength = 10, tailLength = 8) {
    const plain = String(text || '')
    const safeMax = Number.isFinite(maxLength) && maxLength > 4 ? Math.floor(maxLength) : 24

    if (plain.length <= safeMax) {
      return plain
    }

    const maxVisible = safeMax - 3
    let head = Number.isFinite(headLength) && headLength > 0 ? Math.floor(headLength) : Math.ceil(maxVisible / 2)
    let tail = Number.isFinite(tailLength) && tailLength > 0 ? Math.floor(tailLength) : Math.floor(maxVisible / 2)

    if (head + tail > maxVisible) {
      head = Math.ceil(maxVisible / 2)
      tail = Math.floor(maxVisible / 2)
    }

    return `${plain.slice(0, head)}...${plain.slice(-tail)}`
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
