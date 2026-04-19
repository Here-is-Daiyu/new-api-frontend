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

  const TOKEN_STATUS_OPTIONS = [
    { value: '1', label: '启用' },
    { value: '2', label: '禁用' },
    { value: '3', label: '过期' },
    { value: '4', label: '耗尽' }
  ]

  const customSelectInstances = new Map()
  let customSelectGlobalEventsBound = false
  let logModelAwesomplete = null

  const LOG_PREFETCH_REMAINING_ROWS = 100
  const LOG_PAGE_SIZE = 200
  const QUOTA_DISPLAY_DIVISOR = 500000
  const LOG_AUTO_REFRESH_INTERVAL = 2000
  const LOG_AUTO_REFRESH_MAX_ITEMS = 1000
  const LOG_MODEL_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6']

  let logAutoRefreshTimer = null
  let logScrollRAFPending = false

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
    alertFadeTimer: null,
    token: {
      page: 1,
      pageSize: 10,
      total: 0,
      keyword: '',
      items: [],
      visibleKeyIds: new Set(),
      fullKeyCache: new Map()
    },
    model: {
      items: [],
      total: 0,
      isLoading: false,
      loaded: false,
      selectedApiKey: '',
      apiKeys: [],
      apiKeysLoaded: false,
      apiKeysPromise: null
    },
    log: {
      page: 1,
      pageSize: LOG_PAGE_SIZE,
      total: 0,
      items: [],
      hasMore: true,
      isLoading: false,
      isRefreshing: false,
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
        tpm: 0,
        modelBreakdown: []
      },
      loaded: false,
      initPromise: null,
      tokenOptions: [],
      tokenKeyByName: {},
      modelSuggestions: [],
      groupOptions: [],
      groupHint: '',
      autoRefreshEnabled: false
    }
  }

  const dom = {}

  document.addEventListener('DOMContentLoaded', () => {
    init().catch((err) => {
      showAlert('初始化失败：' + (err.message || '未知错误'), 'error')
      console.error(err)
    })
  })

  async function init() {
    cacheDom()
    bindEvents()
    initTheme()
    syncTokenQuotaInputState()
    renderTokenPageSizeOptions()
    renderTokenStatusOptions()
    renderModelList()
    renderLogTypeOptions()
    renderLogTokenOptions()
    initLogModelAutocomplete()
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
    dom.openConsoleLogBtn = document.getElementById('openConsoleLogBtn')
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
    dom.modelKeySelect = document.getElementById('modelKeySelect')
    dom.refreshModelBtn = document.getElementById('refreshModelBtn')
    dom.modelListContainer = document.getElementById('modelListContainer')
    dom.modelTotalBadge = document.getElementById('modelTotalBadge')

    dom.logPanel = document.getElementById('logPanel')
    dom.refreshLogBtn = document.getElementById('refreshLogBtn')
    dom.logFilterForm = document.getElementById('logFilterForm')
    dom.logTypeSelect = document.getElementById('logTypeSelect')
    dom.logTokenNameInput = document.getElementById('logTokenNameInput')
    dom.logModelInput = document.getElementById('logModelInput')
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
    dom.modelCostBar = document.getElementById('modelCostBar')
    dom.modelCostTooltip = document.getElementById('modelCostTooltip')
    dom.logCacheTooltip = document.getElementById('logCacheTooltip')

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
    dom.tokenModelSuggestBtn = document.getElementById('tokenModelSuggestBtn')
    dom.tokenModelSuggestDropdown = document.getElementById('tokenModelSuggestDropdown')
    dom.tokenAllowIpsInput = document.getElementById('tokenAllowIpsInput')
    dom.tokenGroupSelect = document.getElementById('tokenGroupSelect')
    dom.tokenCrossGroupRetryInput = document.getElementById('tokenCrossGroupRetryInput')
    dom.saveTokenBtn = document.getElementById('saveTokenBtn')

    initCustomSelect(dom.tokenPageSizeSelect)
    initCustomSelect(dom.tokenStatusSelect)
    initCustomSelect(dom.logTypeSelect)
    initCustomSelect(dom.logTokenNameInput)
    initCustomSelect(dom.logGroupSelect)
    initCustomSelect(dom.tokenGroupSelect)
    initCustomSelect(dom.modelKeySelect)
    renderModelKeyOptions()
  }

  function bindEvents() {
    dom.themeToggleBtn.addEventListener('click', toggleTheme)
    dom.saveBaseUrlBtn.addEventListener('click', handleSaveBaseURL)

    dom.loginForm.addEventListener('submit', handleLogin)
    dom.refreshSelfBtn.addEventListener('click', handleRefreshSelf)
    dom.openConsoleLogBtn.addEventListener('click', handleOpenConsoleLog)
    dom.logoutBtn.addEventListener('click', handleLogout)

    dom.tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab))
    })

    dom.createTokenBtn.addEventListener('click', openCreateTokenModal)
    dom.refreshTokenBtn.addEventListener('click', () => {
      void runWithButtonLoading(dom.refreshTokenBtn, () => loadTokens(true, { silent: true })).catch(() => {})
    })
    dom.tokenFilterForm.addEventListener('submit', handleTokenFilter)
    dom.tokenFilterResetBtn.addEventListener('click', handleTokenFilterReset)
    dom.tokenPrevBtn.addEventListener('click', handleTokenPrev)
    dom.tokenNextBtn.addEventListener('click', handleTokenNext)
    dom.tokenTableBody.addEventListener('click', handleTokenTableAction)

    dom.closeTokenModalBtn.addEventListener('click', closeTokenModal)
    dom.tokenForm.addEventListener('submit', handleSaveToken)
    dom.tokenUnlimitedInput.addEventListener('change', syncTokenQuotaInputState)
    bindDatetimeAutoComplete(dom.tokenExpireInput)

    dom.refreshModelBtn.addEventListener('click', () => {
      void runWithButtonLoading(dom.refreshModelBtn, async () => {
        await loadModelKeyOptions()
        await refreshModels(true, { silent: true })
      }).catch(() => {})
    })
    dom.modelListContainer.addEventListener('click', (event) => {
      const tag = event.target.closest('.model-tag[data-model-name]')
      if (!tag) {
        return
      }

      const modelName = tag.dataset.modelName
      if (!modelName) {
        return
      }

      void copyText(modelName)
        .then(() => {
          showAlert(`已复制模型名: ${modelName}`, 'success')
        })
        .catch(() => {
          showAlert('复制失败', 'error')
        })
    })
    dom.tokenModelSuggestBtn.addEventListener('click', handleTokenModelSuggest)
    setCustomSelectOnChange(dom.tokenStatusSelect, () => {
      syncSelectTitle(dom.tokenStatusSelect)
    })
    setCustomSelectOnChange(dom.tokenPageSizeSelect, () => {
      syncSelectTitle(dom.tokenPageSizeSelect)
    })
    setCustomSelectOnChange(dom.modelKeySelect, (value) => {
      syncSelectTitle(dom.modelKeySelect)
      state.model.selectedApiKey = String(value || '').trim()
      void runWithButtonLoading(dom.refreshModelBtn, () => refreshModels(true)).catch(() => {})
    })

    dom.refreshLogBtn.addEventListener('click', () => {
      void runWithButtonLoading(dom.refreshLogBtn, async () => {
        await Promise.allSettled([refreshLogModelSuggestions(false), refreshLogGroupOptions(false)])
        await loadLogs(true, { silent: true })
      }).catch(() => {})
    })
    dom.logFilterForm.addEventListener('submit', handleLogFilter)
    dom.logFilterResetBtn.addEventListener('click', handleLogFilterReset)
    setCustomSelectOnChange(dom.logTokenNameInput, () => {
      handleLogTokenChange()
    })
    setCustomSelectOnChange(dom.logGroupSelect, () => {
      syncSelectTitle(dom.logGroupSelect)
    })
    dom.logTableWrap.addEventListener('scroll', () => {
      if (logScrollRAFPending) {
        return
      }

      logScrollRAFPending = true
      requestAnimationFrame(() => {
        logScrollRAFPending = false
        handleLogTableScroll()
      })
    })
    dom.logTableBody.addEventListener('mouseenter', (e) => {
      const row = e.target.closest('.log-row[data-cache-pct]')
      if (row) {
        showLogCacheTooltip(row, e)
      }
    }, true)
    dom.logTableBody.addEventListener('mouseleave', (e) => {
      const row = e.target.closest('.log-row[data-cache-pct]')
      if (row) {
        hideLogCacheTooltip()
      }
    }, true)
    dom.logTableBody.addEventListener('mousemove', (e) => {
      const row = e.target.closest('.log-row[data-cache-pct]')
      if (row) {
        showLogCacheTooltip(row, e)
      } else {
        hideLogCacheTooltip()
      }
    })
    dom.logLoadState.addEventListener('click', handleLogLoadStateClick)
    bindDatetimeAutoComplete(dom.logStartInput)
    bindDatetimeAutoComplete(dom.logEndInput)

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
      showAlert(err.message || 'BaseURL 无效', 'error')
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
    } catch {
      showLoggedOutState()
      return
    }

    showLoggedInState()
    void preloadAllPanels()
  }

  async function preloadAllPanels() {
    if (!state.user) {
      return
    }

    try {
      // 令牌管理页优先（首屏展示）
      await loadTokens()
    } catch {
      // ignore
    }

    try {
      // 其余面板并行加载
      await Promise.allSettled([
        refreshModels(false, { silent: true }),
        ensureLogPanelInitialized(false)
      ])
    } catch {
      // ignore
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

    state.token.visibleKeyIds.clear()
    state.token.fullKeyCache.clear()

    state.model.items = []
    state.model.total = 0
    state.model.isLoading = false
    state.model.loaded = false
    state.model.selectedApiKey = ''
    state.model.apiKeys = []
    state.model.apiKeysLoaded = false
    state.model.apiKeysPromise = null

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
    if (dom.logModelInput) dom.logModelInput.value = ''
    dom.logRequestIdInput.value = ''
    dom.logStartInput.value = ''
    dom.logEndInput.value = ''
    setCustomSelectValue(dom.logGroupSelect, '', { silent: true })

    renderTokenPageSizeOptions()
    renderModelKeyOptions()
    renderModelList()
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
    const quota = formatQuotaDisplayValue(state.user.quota)
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
        showAlert('该账号开启了 2FA，请先在官方面板完成 2FA 登录', 'warning')
        return
      }

      const loginUserId = toNonNegativeInt(data?.id, 0)
      if (loginUserId > 0) {
        setApiUserId(loginUserId)
      }

      await fetchSelf(false)
      dom.passwordInput.value = ''
      showLoggedInState()
      void preloadAllPanels()
      showAlert('登录成功', 'success')
    } catch (err) {
      showAlert('登录失败：' + (err.message || '未知错误'), 'error')
    } finally {
      setButtonLoading(dom.loginBtn, false)
    }
  }

  async function handleRefreshSelf() {
    try {
      await runWithButtonLoading(dom.refreshSelfBtn, async () => {
        await fetchSelf(false)
        showAlert('会话已刷新', 'success')
      })
    } catch (err) {
      showAlert('会话刷新失败：' + (err.message || '未知错误'), 'error')
      showLoggedOutState()
    }
  }

  function handleOpenConsoleLog() {
    try {
      const activeBaseURL = getActiveBaseURL()
      const targetURL = buildUpstreamURL(activeBaseURL, '/console/log')
      window.open(targetURL, '_blank', 'noopener')
    } catch (err) {
      showAlert('打开控制台日志失败：' + (err.message || '请先检查 BaseURL 配置'), 'error')
    }
  }

  async function handleLogout() {
    try {
      setButtonLoading(dom.logoutBtn, true, '退出中...')
      await apiRequest('/api/user/logout')
      state.user = null
      clearApiUserId()
      stopLogAutoRefresh()
      showLoggedOutState()
      showAlert('已退出登录', 'info')
    } catch (err) {
      showAlert('退出失败：' + (err.message || '未知错误'), 'error')
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
      const isActive = btn.dataset.panel === panelId
      btn.classList.toggle('active', isActive)
    })

    dom.tabPanels.forEach((panel) => {
      const isActive = panel.id === panelId
      panel.classList.toggle('hidden', !isActive)
      panel.classList.toggle('show', isActive)
    })

    if (panelId === 'modelPanel' && state.user) {
      void (async () => {
        const shouldReloadModelKeys = !state.model.apiKeysLoaded
        if (shouldReloadModelKeys) {
          await loadModelKeyOptions(true)
        }
        if (!state.model.loaded || shouldReloadModelKeys) {
          await refreshModels(true)
        }
      })().catch(() => {})
    }

    if (panelId === 'logPanel' && state.user) {
      if (!state.log.loaded) {
        void ensureLogPanelInitialized(true).catch(() => {})
      } else {
        startLogAutoRefresh()
      }
    } else {
      stopLogAutoRefresh()
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

  async function loadTokens(showError, options = {}) {
    const silent = Boolean(options.silent)

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
        return loadTokens(showError, options)
      }

      renderTokenTable()
      updateTokenPager()
      // 后台静默预加载所有 token 完整 key
      preloadTokenFullKeys()
    } catch (err) {
      if (!silent) {
        state.token.total = 0
        if (dom.tokenTotalBadge) {
          dom.tokenTotalBadge.textContent = '0'
        }
        state.token.items = []
        renderTokenTable()
        updateTokenPager()
      }

      if (showError) {
        showAlert('加载 Token 失败：' + (err.message || '未知错误'), 'error')
      }
      throw err
    }
  }

  async function preloadTokenFullKeys() {
    const tokens = state.token.items
    if (!tokens.length) return

    for (const token of tokens) {
      const id = toNonNegativeInt(token.id, 0)
      if (!id || state.token.fullKeyCache.has(id)) continue
      try {
        const key = await fetchTokenFullKey(id)
        if (key) state.token.fullKeyCache.set(id, key)
      } catch {
        // 静默忽略，429 会在 apiRequest 层自动重试
      }
    }
  }

  function renderTokenTable() {
    if (!state.token.items.length) {
      dom.tokenTableBody.innerHTML = '<tr class="table-placeholder-row"><td colspan="7" class="text-center">暂无数据</td></tr>'
      return
    }

    dom.tokenTableBody.innerHTML = state.token.items
      .map((token) => {
        const id = toNonNegativeInt(token.id, 0)
        const fullKey = normalizeTokenKey(token.key)
        const isKeyVisible = state.token.visibleKeyIds.has(id)
        const keyContent = formatTokenKeyDisplay(fullKey, isKeyVisible, id)
        const nameText = escapeHtml(String(token.name || '-'))
        const toggleKeyTitle = isKeyVisible ? '隐藏完整 Key' : '查看完整 Key'
        const toggleKeyIcon = getTokenKeyToggleIcon(isKeyVisible)
        const statusLabel = TOKEN_STATUS_TEXT[token.status] || '未知'

        let statusClass = 'badge'
        if (token.status === 1) statusClass = 'badge badge-success'
        else if (token.status === 2) statusClass = 'badge badge-danger'
        else if (token.status === 3) statusClass = 'badge badge-warning'

        const statusText = `<span class="${statusClass}">${statusLabel}</span>`

        const quotaText = token.unlimited_quota
          ? '<span class="badge-count">无限</span>'
          : `<span class="token-quota-value">${toNonNegativeInt(token.remain_quota, 0)}</span>`

        const expiredText = formatExpiredTime(token.expired_time)
        const toggleStatusText = token.status === 1 ? '禁用' : '启用'

        return `
          <tr class="token-row" data-token-id="${id}">
            <td class="token-cell token-cell-id token-id-cell" data-mobile-label="ID"><code class="mono text-sub token-id-pill">#${id}</code></td>
            <td class="token-cell token-cell-name"><div class="token-primary-text">${nameText}</div></td>
            <td class="token-cell token-cell-key token-key-cell">
              <span class="token-key-wrap">
                ${keyContent}
                ${fullKey
                  ? `<span class="token-key-actions">
                      <button class="btn-ghost-primary btn-toggle-key" type="button" data-action="toggle-key" data-id="${id}" title="${toggleKeyTitle}" aria-label="${toggleKeyTitle}" aria-pressed="${isKeyVisible ? 'true' : 'false'}"><span class="sr-only">${toggleKeyTitle}</span><span aria-hidden="true">${toggleKeyIcon}</span></button>
                      <button class="btn-ghost-primary mobile-inline-action token-key-copy-btn" type="button" data-action="copy" data-id="${id}" title="复制 Key">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                      </button>
                    </span>`
                  : ''}
              </span>
            </td>
            <td class="token-cell token-cell-status">${statusText}</td>
            <td class="token-cell token-cell-quota token-secondary-cell" data-mobile-label="额度">${quotaText}</td>
            <td class="token-cell token-cell-expired token-secondary-cell text-sub" data-mobile-label="过期时间">${escapeHtml(expiredText)}</td>
            <td class="token-cell token-cell-actions token-actions-cell">
              <div class="inline-actions">
                <button class="btn-ghost-primary desktop-inline-action" type="button" data-action="copy" data-id="${id}" title="复制 Key">
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </button>
                <button class="btn-ghost-primary" type="button" data-action="edit" data-id="${id}" title="编辑">
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="btn-ghost-primary" type="button" data-action="toggle" data-id="${id}" title="${toggleStatusText}">
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

    if (action === 'toggle-key') {
      toggleTokenKeyVisibility(tokenId)
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

    try {
      const fullKey = await fetchTokenFullKey(tokenId)
      if (!fullKey) {
        showAlert('该 Token 没有可复制的 Key', 'warning')
        return
      }
      await copyText(fullKey)
      showAlert('Key 已复制到剪贴板', 'success')
    } catch (err) {
      showAlert('复制失败：' + (err.message || '未知错误'), 'error')
    }
  }

  function getTokenById(tokenId) {
    return state.token.items.find((item) => toNonNegativeInt(item.id, 0) === tokenId) || null
  }

  async function fetchTokenFullKey(tokenId) {
    const data = await apiRequest(`/api/token/${tokenId}/key`, { method: 'POST' })
    return normalizeTokenKey(data?.key)
  }

  function openCreateTokenModal() {
    dom.tokenModalTitle.textContent = '新建 Token'
    dom.tokenForm.reset()
    dom.tokenIdInput.value = ''
    setCustomSelectValue(dom.tokenStatusSelect, '1', { silent: true })
    dom.tokenQuotaInput.value = '0'
    dom.tokenExpireInput.value = ''
    setCustomSelectValue(dom.tokenGroupSelect, '', { silent: true })
    dom.tokenModelLimitsInput.value = ''
    dom.tokenAllowIpsInput.value = ''
    dom.tokenModelLimitEnabledInput.checked = false
    dom.tokenUnlimitedInput.checked = false
    dom.tokenCrossGroupRetryInput.checked = false
    closeTokenModelSuggestDropdown()
    syncTokenQuotaInputState()
    loadTokenGroupOptions()
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
    setCustomSelectValue(dom.tokenStatusSelect, String(toNonNegativeInt(token.status, 1) || 1), {
      silent: true
    })
    dom.tokenQuotaInput.value = String(toNonNegativeInt(token.remain_quota, 0))
    dom.tokenExpireInput.value = unixToDatetimeText(token.expired_time)
    dom.tokenUnlimitedInput.checked = Boolean(token.unlimited_quota)
    dom.tokenModelLimitEnabledInput.checked = Boolean(token.model_limits_enabled)
    dom.tokenModelLimitsInput.value = token.model_limits || ''
    dom.tokenAllowIpsInput.value = token.allow_ips || ''
    setCustomSelectValue(dom.tokenGroupSelect, token.group || '', { silent: true })
    dom.tokenCrossGroupRetryInput.checked = Boolean(token.cross_group_retry)
    closeTokenModelSuggestDropdown()
    syncTokenQuotaInputState()
    loadTokenGroupOptions()
    dom.tokenModal.classList.remove('hidden')
  }

  function closeTokenModal() {
    dom.tokenModal.classList.add('hidden')
    closeTokenModelSuggestDropdown()
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
      state.model.apiKeysLoaded = false
      await loadTokens(true)
    } catch (err) {
      showAlert('保存 Token 失败：' + (err.message || '未知错误'), 'error')
    } finally {
      setButtonLoading(dom.saveTokenBtn, false)
    }
  }

  function collectTokenPayloadFromForm() {
    const id = toNonNegativeInt(dom.tokenIdInput.value, 0)
    const name = dom.tokenNameInput.value.trim()
    const status = toPositiveInt(getCustomSelectValue(dom.tokenStatusSelect), 1)
    const unlimitedQuota = dom.tokenUnlimitedInput.checked
    const quotaInput = dom.tokenQuotaInput.value.trim()
    const remainQuota = quotaInput === '' ? 0 : Number.parseInt(quotaInput, 10)
    const expireRaw = dom.tokenExpireInput.value.trim()
    const modelLimitsEnabled = dom.tokenModelLimitEnabledInput.checked
    const modelLimits = dom.tokenModelLimitsInput.value.trim()
    const allowIps = dom.tokenAllowIpsInput.value.trim()
    const group = getCustomSelectValue(dom.tokenGroupSelect).trim()
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
      state.model.apiKeysLoaded = false
      await loadTokens(true)
    } catch (err) {
      showAlert('状态切换失败：' + (err.message || '未知错误'), 'error')
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
      state.model.apiKeysLoaded = false
      await loadTokens(true)
    } catch (err) {
      showAlert('删除 Token 失败：' + (err.message || '未知错误'), 'error')
    } finally {
      setButtonLoading(button, false)
    }
  }

  async function refreshModels(showError, options = {}) {
    await loadModels(showError, options)
    state.model.loaded = true
  }

  function getDefaultModelKeyOptions() {
    return [{ value: '', label: '全部（账号可用）', title: '全部（账号可用）' }]
  }

  function renderModelKeyOptions() {
    if (!dom.modelKeySelect) {
      return
    }

    const options = state.model.apiKeys.length ? state.model.apiKeys : getDefaultModelKeyOptions()
    const hasSelectedValue = options.some((item) => item.value === state.model.selectedApiKey)

    if (!hasSelectedValue) {
      state.model.selectedApiKey = ''
    }

    setCustomSelectOptions(dom.modelKeySelect, options)
    setCustomSelectValue(dom.modelKeySelect, state.model.selectedApiKey, { silent: true })
    syncSelectTitle(dom.modelKeySelect)
  }

  async function loadModelKeyOptions(showError = true) {
    if (!dom.modelKeySelect) {
      return
    }

    if (state.model.apiKeysLoaded) {
      renderModelKeyOptions()
      return
    }

    if (!state.model.apiKeysPromise) {
      state.model.apiKeysPromise = (async () => {
        try {
          const tokens = await fetchAllTokenItems()
          const enabledTokens = tokens.filter((token) => token && toNonNegativeInt(token.status, 0) === 1)
          const options = getDefaultModelKeyOptions()
          const seen = new Set(options.map((item) => item.value))

          const results = await Promise.allSettled(
            enabledTokens.map(async (token) => {
              const tokenId = toNonNegativeInt(token.id, 0)
              if (!tokenId) {
                return null
              }

              const key = await fetchTokenFullKey(tokenId)
              if (!key) {
                return null
              }

              const name = String(token.name || '').trim()
              const displayName = name || `Token #${tokenId}`
              return {
                value: String(tokenId),
                key,
                label: displayName,
                title: displayName
              }
            })
          )

          results.forEach((result) => {
            if (result.status !== 'fulfilled' || !result.value || seen.has(result.value.value)) {
              return
            }
            seen.add(result.value.value)
            options.push(result.value)
          })

          state.model.apiKeys = options
          state.model.apiKeysLoaded = true
          renderModelKeyOptions()
        } catch (err) {
          state.model.apiKeys = getDefaultModelKeyOptions()
          state.model.apiKeysLoaded = false
          renderModelKeyOptions()
          throw err
        } finally {
          state.model.apiKeysPromise = null
        }
      })()
    }

    try {
      return await state.model.apiKeysPromise
    } catch (err) {
      if (showError) {
        showAlert('加载 Token 列表失败：' + (err.message || '未知错误'), 'error')
      }
      throw err
    }
  }

  async function loadModels(showError, options = {}) {
    if (state.model.isLoading) {
      return
    }

    const silent = Boolean(options.silent) && state.model.items.length > 0
    state.model.isLoading = true
    if (!silent) {
      renderModelList({ loading: true })
    }

    try {
      const selectedApiKey = String(state.model.selectedApiKey || '').trim()
      const selectedKeyOption = state.model.apiKeys.find((item) => item.value === selectedApiKey) || null
      const bearerKey = String(selectedKeyOption?.key || '').trim()
      let models = []

      if (selectedApiKey) {
        if (!bearerKey) {
          throw new Error('所选 Token Key 已失效，请重新选择')
        }

        const data = await apiRequest('/v1/models', {
          headers: {
            Authorization: `Bearer ${bearerKey}`
          }
        })

        const rawModels = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
            ? data.data
            : []

        models = rawModels
          .map((item) => ({
            id: String(item?.id || '').trim(),
            object: String(item?.object || '').trim(),
            owned_by: String(item?.owned_by || '').trim(),
            supported_endpoint_types: Array.isArray(item?.supported_endpoint_types)
              ? item.supported_endpoint_types.map((entry) => String(entry || '').trim()).filter(Boolean)
              : []
          }))
          .filter((item) => item.id)
      } else {
        const data = await apiRequest('/api/user/models')
        models = Array.isArray(data)
          ? data
              .map((item) => String(item || '').trim())
              .filter(Boolean)
              .map((item) => ({
                id: item,
                object: '',
                owned_by: '',
                supported_endpoint_types: []
              }))
          : []
      }

      state.model.items = models
      state.model.total = models.length
      dom.modelTotalBadge.textContent = String(state.model.total)
      renderModelList()
    } catch (err) {
      if (!silent) {
        state.model.items = []
        state.model.total = 0
        dom.modelTotalBadge.textContent = '0'
        renderModelList()
      }

      if (showError) {
        showAlert('加载模型失败：' + (err.message || '未知错误'), 'error')
      }
      throw err
    } finally {
      state.model.isLoading = false
    }
  }

  function renderModelList(options = {}) {
    const container = dom.modelListContainer
    if (!container) {
      return
    }

    if (dom.modelTotalBadge) {
      dom.modelTotalBadge.textContent = String(state.model.total)
    }

    if (options.loading) {
      container.innerHTML = '<div class="model-list-empty">模型加载中...</div>'
      return
    }

    if (!state.model.items.length) {
      container.innerHTML = '<div class="model-list-empty">暂无模型数据</div>'
      return
    }

    container.innerHTML = state.model.items
      .map((item) => {
        const name = typeof item === 'string' ? item : String(item?.id || '').trim()
        const ownedBy = typeof item === 'object' && item ? String(item.owned_by || '').trim() : ''
        const ownerHtml = ownedBy ? `<span class="model-tag-owner">${escapeHtml(ownedBy)}</span>` : ''
        return `<div class="model-tag" data-model-name="${escapeHtml(name)}"><code>${escapeHtml(name)}</code>${ownerHtml}</div>`
      })
      .join('')
  }

  async function fetchUserModels() {
    try {
      const data = await apiRequest('/api/user/models')
      return Array.isArray(data)
        ? data.map((m) => String(m || '').trim()).filter(Boolean)
        : []
    } catch {
      return []
    }
  }

  async function loadTokenGroupOptions() {
    try {
      const data = await apiRequest('/api/user/self/groups')
      const options = [{ value: '', label: '留空（使用默认分组）', title: '留空（使用默认分组）' }]

      if (data && typeof data === 'object' && !Array.isArray(data)) {
        Object.entries(data).forEach(([name, info]) => {
          const desc = String(info?.desc || '').trim()
          const ratio = info?.ratio
          const ratioText = ratio !== undefined && ratio !== null ? String(ratio) : ''
          let label = name
          if (desc || ratioText) {
            const parts = []
            if (desc) parts.push(desc)
            if (ratioText) parts.push(`倍率 ${ratioText}`)
            label = `${name} — ${parts.join('，')}`
          }
          options.push({
            value: name,
            label: truncateMiddle(label, 50, 30, 16),
            title: label
          })
        })
      }

      setCustomSelectOptions(dom.tokenGroupSelect, options)

      const currentValue = getCustomSelectValue(dom.tokenGroupSelect)
      setCustomSelectValue(dom.tokenGroupSelect, currentValue, { silent: true })
    } catch {
      const fallbackOptions = [{ value: '', label: '留空（使用默认分组）', title: '留空（使用默认分组）' }]
      setCustomSelectOptions(dom.tokenGroupSelect, fallbackOptions)
    }
  }

  function handleTokenModelSuggest() {
    const dropdown = dom.tokenModelSuggestDropdown
    if (!dropdown) {
      return
    }

    if (!dropdown.classList.contains('hidden')) {
      closeTokenModelSuggestDropdown()
      return
    }

    dropdown.innerHTML = '<div class="model-suggest-loading">加载可用模型中...</div>'
    dropdown.classList.remove('hidden')

    fetchUserModels().then((models) => {
      if (!models.length) {
        dropdown.innerHTML = '<div class="model-suggest-loading">暂无可用模型</div>'
        return
      }

      renderTokenModelSuggestDropdown(models)
    })
  }

  function renderTokenModelSuggestDropdown(models) {
    const dropdown = dom.tokenModelSuggestDropdown
    if (!dropdown) {
      return
    }

    const currentModels = parseModelLimitsText(dom.tokenModelLimitsInput.value)
    const currentSet = new Set(currentModels)

    dropdown.innerHTML = models
      .map((name) => {
        const isSelected = currentSet.has(name)
        return `<button type="button" class="model-suggest-item${isSelected ? ' selected' : ''}" data-model="${escapeHtml(name)}">${escapeHtml(name)}</button>`
      })
      .join('')

    dropdown.addEventListener('click', handleModelSuggestItemClick)
  }

  function handleModelSuggestItemClick(event) {
    const item = event.target.closest('.model-suggest-item')
    if (!item) {
      return
    }

    const modelName = item.dataset.model
    if (!modelName) {
      return
    }

    const currentModels = parseModelLimitsText(dom.tokenModelLimitsInput.value)
    const index = currentModels.indexOf(modelName)

    if (index >= 0) {
      currentModels.splice(index, 1)
      item.classList.remove('selected')
    } else {
      currentModels.push(modelName)
      item.classList.add('selected')
    }

    dom.tokenModelLimitsInput.value = currentModels.join(',')
  }

  function parseModelLimitsText(text) {
    return String(text || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  function closeTokenModelSuggestDropdown() {
    if (dom.tokenModelSuggestDropdown) {
      dom.tokenModelSuggestDropdown.classList.add('hidden')
      dom.tokenModelSuggestDropdown.innerHTML = ''
    }
  }

  function handleLogFilter(event) {
    event.preventDefault()
    collectLogFiltersFromForm()
    void loadLogs(true, { resetScroll: true, filtersCollected: true })
  }

  function handleLogFilterReset() {
    setCustomSelectValue(dom.logTypeSelect, '0', { silent: true })
    setCustomSelectValue(dom.logTokenNameInput, '', { silent: true })
    if (dom.logModelInput) dom.logModelInput.value = ''
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
    startLogAutoRefresh()
  }

  async function ensureLogTokenOptions(showError) {
    if (state.log.tokenOptions.length) {
      renderLogTokenOptions()
      return
    }

    try {
      const tokens = await fetchAllTokenItems()
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
        showAlert('加载日志 Token 下拉失败：' + (err.message || '未知错误'), 'error')
      }
      throw err
    }
  }

  async function fetchAllTokenItems() {
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

  function renderTokenStatusOptions() {
    if (!dom.tokenStatusSelect) {
      return
    }

    const currentValue = getCustomSelectValue(dom.tokenStatusSelect).trim() || '1'
    const options = TOKEN_STATUS_OPTIONS.map((item) => ({
      value: item.value,
      label: item.label,
      title: item.label
    }))

    setCustomSelectOptions(dom.tokenStatusSelect, options)

    const exists = options.some((item) => item.value === currentValue)
    setCustomSelectValue(dom.tokenStatusSelect, exists ? currentValue : '1', { silent: true })
    syncSelectTitle(dom.tokenStatusSelect)
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
      const models = await fetchUserModels()
      state.log.modelSuggestions = models
      renderLogModelSuggestions()
    } catch (err) {
      state.log.modelSuggestions = []
      renderLogModelSuggestions()

      if (showError) {
        showAlert('加载日志模型建议失败：' + (err.message || '未知错误'), 'warning')
      }
    }
  }

  function initLogModelAutocomplete() {
    if (!dom.logModelInput || typeof Awesomplete === 'undefined') {
      return
    }

    logModelAwesomplete = new Awesomplete(dom.logModelInput, {
      minChars: 0,
      maxItems: 20,
      autoFirst: false,
      tabSelect: true,
      filter: Awesomplete.FILTER_CONTAINS,
      sort: false,
      list: state.log.modelSuggestions || []
    })

    dom.logModelInput.addEventListener('focus', () => {
      if (logModelAwesomplete && state.log.modelSuggestions.length) {
        logModelAwesomplete.evaluate()
      }
    })

    // capture phase：在 Awesomplete 的 blur→close() 之前拿到高亮项
    dom.logModelInput.addEventListener('blur', () => {
      if (!logModelAwesomplete) return
      const selected = logModelAwesomplete.ul.querySelector('li[aria-selected="true"]')
      if (selected) {
        const val = selected.textContent.trim()
        // close() 会在 bubble phase 清理状态，用 microtask 在之后写值
        queueMicrotask(() => { dom.logModelInput.value = val })
      }
    }, true)
  }

  function renderLogModelSuggestions() {
    if (!logModelAwesomplete) {
      return
    }

    logModelAwesomplete.list = state.log.modelSuggestions || []
  }

  async function refreshLogGroupOptions(showError) {
    const currentValue = getCustomSelectValue(dom.logGroupSelect).trim()

    try {
      const groups = await fetchLogGroupOptionsFromBaseURL()
      state.log.groupOptions = groups
      state.log.groupHint = groups.length
        ? ''
        : '当前 BaseURL 暂未返回可选分组，已保留"全部分组"筛选。'
      renderLogGroupOptions(currentValue)
    } catch (err) {
      state.log.groupOptions = []
      state.log.groupHint = '当前 BaseURL 未能获取分组列表，日志仍可正常筛选。'
      renderLogGroupOptions(currentValue)

      if (showError) {
        showAlert('加载日志分组下拉失败：' + (err.message || '未知错误'), 'warning')
      }
    }
  }

  async function fetchLogGroupOptionsFromBaseURL() {
    const data = await apiRequest('/api/user/self/groups')
    return extractGroupNamesFromPayload(data)
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
    if (!state.user || state.log.isLoading || state.log.isRefreshing || !state.log.hasMore) {
      return
    }

    const remainingPx =
      dom.logTableWrap.scrollHeight - dom.logTableWrap.scrollTop - dom.logTableWrap.clientHeight

    const rowCount = state.log.items.length
    const avgRowHeight = rowCount > 0 ? dom.logTableBody.scrollHeight / rowCount : 40
    const safeRowHeight = avgRowHeight > 0 ? avgRowHeight : 40
    const remainingRows = remainingPx / safeRowHeight

    if (remainingRows <= LOG_PREFETCH_REMAINING_ROWS) {
      void loadMoreLogs(false)
    }
  }

  function handleLogLoadStateClick() {
    if (state.log.isLoading || state.log.isRefreshing || !state.log.hasMore) {
      return
    }
    void loadMoreLogs(true)
  }

  function collectLogFiltersFromForm() {
    state.log.pageSize = LOG_PAGE_SIZE
    state.log.filters.type = getCustomSelectValue(dom.logTypeSelect)
    state.log.filters.modelName = dom.logModelInput ? dom.logModelInput.value.trim() : ''
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
    if (!options.filtersCollected) {
      collectLogFiltersFromForm()
    }

    const hasExistingData = state.log.items.length > 0
    const requestVersion = state.log.requestVersion + 1

    state.log.requestVersion = requestVersion
    state.log.page = 1
    state.log.hasMore = true
    state.log.isLoading = false
    state.log.isRefreshing = hasExistingData
    state.log.lastError = ''
    updateLogLoadState()

    if (!hasExistingData) {
      if (options.resetScroll) {
        resetLogScrollPosition()
      }
      state.log.total = 0
      state.log.items = []
      renderLogTable()
      await Promise.all([loadLogStat({ requestVersion }), loadMoreLogs(showError, requestVersion)])
      return
    }

    let shouldAutoLoadNextPage = false

    try {
      const [pageData] = await Promise.all([
        requestLogPage(1),
        loadLogStat({ preserveOnError: true, requestVersion })
      ])

      if (requestVersion !== state.log.requestVersion) {
        return
      }

      const total = toNonNegativeInt(pageData?.total, 0)
      const pageItems = Array.isArray(pageData?.items) ? pageData.items : []

      state.log.total = total
      state.log.items = pageItems
      state.log.hasMore = pageItems.length > 0 && state.log.items.length < state.log.total
      state.log.page = state.log.hasMore ? 2 : 1

      if (options.resetScroll) {
        resetLogScrollPosition()
      }
      renderLogTable()

      shouldAutoLoadNextPage =
        state.log.hasMore &&
        isLogPanelVisible() &&
        dom.logTableWrap.clientHeight > 0 &&
        dom.logTableWrap.scrollHeight <= dom.logTableWrap.clientHeight + 8
    } catch (err) {
      if (requestVersion !== state.log.requestVersion) {
        return
      }

      const errorMessage = err.message || '未知错误'
      if (showError) {
        showAlert('加载日志失败：' + errorMessage, 'error')
      }
      throw err
    } finally {
      if (requestVersion !== state.log.requestVersion) {
        return
      }

      state.log.isRefreshing = false
      updateLogLoadState()

      if (shouldAutoLoadNextPage) {
        window.setTimeout(() => {
          void loadMoreLogs(false, requestVersion)
        }, 0)
      }
    }
  }

  function startLogAutoRefresh() {
    stopLogAutoRefresh()
    if (!state.user) {
      return
    }

    state.log.autoRefreshEnabled = true
    logAutoRefreshTimer = window.setInterval(() => {
      if (!isLogPanelVisible() || state.log.isLoading || state.log.isRefreshing || !state.log.hasMore) {
        if (!state.log.hasMore) {
          stopLogAutoRefresh()
        }
        return
      }

      if (state.log.items.length >= LOG_AUTO_REFRESH_MAX_ITEMS) {
        stopLogAutoRefresh()
        return
      }

      void loadMoreLogs(false)
    }, LOG_AUTO_REFRESH_INTERVAL)
  }

  function stopLogAutoRefresh() {
    state.log.autoRefreshEnabled = false
    if (logAutoRefreshTimer) {
      window.clearInterval(logAutoRefreshTimer)
      logAutoRefreshTimer = null
    }
  }

  async function requestLogPage(page) {
    const query = buildLogQuery(true)
    query.p = page
    return apiRequest('/api/log/self', { query })
  }

  async function loadMoreLogs(showError, requestVersion = state.log.requestVersion) {
    if (requestVersion !== state.log.requestVersion) {
      return
    }

    if (state.log.isLoading || state.log.isRefreshing || !state.log.hasMore) {
      return
    }

    state.log.isLoading = true
    state.log.lastError = ''
    updateLogLoadState()

    let shouldAutoLoadNextPage = false
    const currentPage = state.log.page

    try {
      const pageData = await requestLogPage(currentPage)

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
        showAlert('加载日志失败：' + state.log.lastError, 'error')
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

  async function loadLogStat(options = {}) {
    const preserveOnError = Boolean(options.preserveOnError)
    const requestVersion = options.requestVersion ?? state.log.requestVersion

    try {
      const query = buildLogQuery(false)
      const data = await apiRequest('/api/log/self/stat', { query })
      state.log.stat.quota = toNonNegativeInt(data?.quota, 0)
      state.log.stat.rpm = toNonNegativeInt(data?.rpm, 0)
      state.log.stat.tpm = toNonNegativeInt(data?.tpm, 0)
    } catch (err) {
      if (!preserveOnError) {
        state.log.stat.quota = 0
        state.log.stat.rpm = 0
        state.log.stat.tpm = 0
      }
      console.warn('日志统计加载失败', err)
    }

    renderLogStat()
    await loadModelCostBreakdown(requestVersion)
  }

  function buildModelCostBreakdownQuery(filters = state.log.filters) {
    const now = Math.floor(Date.now() / 1000)
    let startTimestamp = datetimeLocalToUnix(filters?.startTime)
    let endTimestamp = datetimeLocalToUnix(filters?.endTime)

    if (!startTimestamp && !endTimestamp) {
      endTimestamp = now
      startTimestamp = now - 86400
    } else {
      if (!endTimestamp) {
        endTimestamp = now
      }
      if (!startTimestamp) {
        startTimestamp = Math.max(0, endTimestamp - 86400)
      }
    }

    if (startTimestamp > endTimestamp) {
      const nextStart = endTimestamp
      endTimestamp = startTimestamp
      startTimestamp = nextStart
    }

    return {
      start_timestamp: startTimestamp,
      end_timestamp: endTimestamp,
      default_time: 'day'
    }
  }

  async function loadModelCostBreakdown(requestVersion = state.log.requestVersion) {
    const query = buildModelCostBreakdownQuery({ ...state.log.filters })

    try {
      const data = await apiRequest('/api/data/self', { query })
      if (requestVersion !== state.log.requestVersion) {
        return state.log.stat.modelBreakdown
      }

      const items = Array.isArray(data) ? data : []
      const quotaByModel = new Map()

      items.forEach((item) => {
        const model = String(item?.model_name || '').trim() || '未知模型'
        const quota = toFiniteNumber(item?.quota)
        if (quota === null || quota <= 0) {
          return
        }
        quotaByModel.set(model, (quotaByModel.get(model) || 0) + quota)
      })

      const entries = Array.from(quotaByModel.entries()).sort((a, b) => b[1] - a[1])
      const totalQuota = entries.reduce((sum, [, quota]) => sum + quota, 0)
      const breakdown = totalQuota > 0
        ? entries.map(([model, quota]) => ({
          model,
          quota,
          percentage: (quota / totalQuota) * 100
        }))
        : []

      state.log.stat.modelBreakdown = breakdown
      renderModelCostBar(breakdown)
      return breakdown
    } catch (err) {
      if (requestVersion !== state.log.requestVersion) {
        return state.log.stat.modelBreakdown
      }

      console.warn('模型消耗比例加载失败', err)
      state.log.stat.modelBreakdown = []
      renderModelCostBar([])
      return []
    }
  }

  function renderLogStat() {
    dom.statQuota.textContent = formatQuotaDisplayValue(state.log.stat.quota)
    dom.statRpm.textContent = String(state.log.stat.rpm)
    dom.statTpm.textContent = String(state.log.stat.tpm)
  }

  function renderModelCostBar(breakdown) {
    if (!dom.modelCostBar) {
      return
    }

    hideCostBarTooltip()

    const safeBreakdown = Array.isArray(breakdown) ? breakdown : []
    const totalQuota = safeBreakdown.reduce((sum, item) => sum + (toFiniteNumber(item?.quota) || 0), 0)

    if (!totalQuota || !safeBreakdown.length) {
      dom.modelCostBar.innerHTML = '<div class="cost-bar-empty">暂无数据</div>'
      return
    }

    const segments = safeBreakdown.map((item, idx) => {
      const percentageValue = toFiniteNumber(item?.percentage) || ((item.quota / totalQuota) * 100)
      const percentage = percentageValue.toFixed(1)
      const color = LOG_MODEL_COLORS[idx % LOG_MODEL_COLORS.length]
      return `<div class="cost-segment" style="width: ${percentage}%; background-color: ${color};" data-model="${escapeHtml(item.model)}" data-quota="${item.quota}" data-percentage="${percentage}"></div>`
    })

    dom.modelCostBar.innerHTML = `<div class="cost-bar-container">${segments.join('')}</div>`

    const segments_el = dom.modelCostBar.querySelectorAll('.cost-segment')
    segments_el.forEach((seg) => {
      seg.addEventListener('mouseenter', (e) => {
        showCostBarTooltip(e.currentTarget || e.target)
      })
      seg.addEventListener('mouseleave', () => {
        hideCostBarTooltip()
      })
    })
  }

  function showCostBarTooltip(element) {
    if (!dom.modelCostTooltip) {
      return
    }

    const model = element.dataset.model || '-'
    const percentage = element.dataset.percentage || '0'
    const quota = toNonNegativeInt(element.dataset.quota, 0)

    dom.modelCostTooltip.innerHTML = `<strong>${escapeHtml(model)}</strong><br/>占比: ${percentage}%<br/>消耗: ${formatQuotaDisplayValue(quota)}`
    dom.modelCostTooltip.classList.remove('hidden')

    const rect = element.getBoundingClientRect()
    dom.modelCostTooltip.style.left = (rect.left + rect.width / 2) + 'px'
    dom.modelCostTooltip.style.top = (rect.top - 45) + 'px'
  }

  function hideCostBarTooltip() {
    if (dom.modelCostTooltip) {
      dom.modelCostTooltip.classList.add('hidden')
    }
  }

  function showLogCacheTooltip(row, e) {
    if (!dom.logCacheTooltip) return

    const pct = row.dataset.cachePct
    if (!pct) return

    dom.logCacheTooltip.textContent = '缓存命中 ' + pct + '%'
    dom.logCacheTooltip.classList.remove('hidden')

    const x = e.clientX
    const y = e.clientY
    dom.logCacheTooltip.style.left = x + 'px'
    dom.logCacheTooltip.style.top = (y - 36) + 'px'
  }

  function hideLogCacheTooltip() {
    if (dom.logCacheTooltip) {
      dom.logCacheTooltip.classList.add('hidden')
    }
  }

  function formatQuotaDisplayValue(value) {
    const quota = toFiniteNumber(value)
    if (quota === null || quota < 0) {
      return '-'
    }

    return (quota / QUOTA_DISPLAY_DIVISOR).toFixed(2)
  }

  function renderLogTable(options = {}) {
    const append = Boolean(options.append)
    const appendItems = Array.isArray(options.items) ? options.items : []

    if (!append) {
      if (!state.log.items.length) {
        dom.logTableBody.innerHTML = '<tr class="table-placeholder-row"><td colspan="11" class="text-center">暂无数据</td></tr>'
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
    const createdAt = formatTimestamp(item.created_at)
    const type = item.type
    const typeText = LOG_TYPE_TEXT[type] || '未知'
    const typeColor = LOG_TYPE_COLORS[type]
    const badgeClass = typeColor ? `badge badge-${typeColor}` : 'badge'
    const cacheReadPct = calcCacheReadPercent(item)
    const cacheAlpha = (cacheReadPct / 100) * 0.2
    const cacheRowStyle = cacheAlpha > 0 ? ` style="--cache-alpha: ${cacheAlpha.toFixed(3)}"` : ''
    const cacheRowData = cacheReadPct > 0 ? ` data-cache-pct="${cacheReadPct.toFixed(1)}"` : ''

    const modelName = escapeHtml(String(item.model_name || '-'))
    const tokenName = escapeHtml(String(item.token_name || '-'))
    const channelId = toNonNegativeInt(item.channel, 0)
    const otherData = parseLogOther(item.other)
    const channelName = String(item.channel_name || otherData?.channel_name || '').trim()
    const channelDisplay = channelName || (channelId ? String(channelId) : '-')
    const channelTitle = channelName && channelId ? `${channelName} (#${channelId})` : (channelName || (channelId ? `#${channelId}` : ''))
    const promptTokens = toNonNegativeInt(item.prompt_tokens, 0)
    const completionTokens = toNonNegativeInt(item.completion_tokens, 0)

    // 总耗时 = use_time（秒），直接显示原始值
    const useTimeSecondsRaw = toFiniteNumber(item.use_time)
    const useTimeSeconds = useTimeSecondsRaw !== null && useTimeSecondsRaw >= 0 ? useTimeSecondsRaw : 0
    const useTimeText = `${useTimeSeconds}s`

    // 首字时间 = other.frt（毫秒）
    const firstTokenMs = extractFirstTokenMs(item)
    const firstTokenTimeText = formatFirstTokenTimeFromMs(firstTokenMs)

    // 输出速率 = completion_tokens / use_time（总耗时）
    let outputRateText = '-'
    if (completionTokens > 0 && useTimeSeconds >= 2) {
      outputRateText = `${(completionTokens / useTimeSeconds).toFixed(1)} t/s`
    }

    // 详情
    const content = String(item.content || '')
    const contentFull = escapeHtml(content)
    const isErrorLog = type === 5
    const detailCellClasses = ['log-cell', 'log-cell-detail']

    let detailHTML = '<span class="text-sub">-</span>'
    if (content) {
      detailCellClasses.push('has-content')
      if (isErrorLog) {
        detailCellClasses.push('is-error')
        detailHTML = `<span class="mobile-inline-label">错误详情</span><div title="${contentFull}" class="log-content-error">${escapeHtml(
          truncateText(content, 100)
        )}</div>`
      } else {
        detailHTML = `<span title="${contentFull}" class="text-sub log-content-short">${escapeHtml(
          truncateText(content, 40)
        )}</span>`
      }
    }

    return `
      <tr class="log-row${isErrorLog ? ' log-row-error' : ''}"${cacheRowStyle}${cacheRowData}>
        <td class="log-cell log-cell-time"><div class="text-sub log-time-text">${escapeHtml(createdAt)}</div></td>
        <td class="log-cell log-cell-type"><span class="${badgeClass}">${escapeHtml(typeText)}</span></td>
        <td class="log-cell log-cell-model"><span class="mobile-inline-label">模型</span><code class="mono log-main-text">${modelName}</code></td>
        <td class="log-cell log-cell-token"><span class="mobile-inline-label">Token</span><code class="mono log-main-text">${tokenName}</code></td>
        <td class="log-cell log-cell-channel"${channelTitle ? ` title="${escapeHtml(channelTitle)}"` : ''}><span class="mobile-inline-label">渠道</span><span class="text-sub">${escapeHtml(channelDisplay)}</span></td>
        <td class="log-cell log-cell-prompt"><span class="mobile-inline-label">输入</span><strong class="log-metric-value">${promptTokens}</strong></td>
        <td class="log-cell log-cell-completion"><span class="mobile-inline-label">输出</span><strong class="log-metric-value">${completionTokens}</strong></td>
        <td class="log-cell log-cell-duration"><span class="mobile-inline-label">耗时</span><strong class="log-metric-value">${escapeHtml(useTimeText)}</strong></td>
        <td class="log-cell log-cell-first-token text-sub"><span class="mobile-inline-label">首字</span>${escapeHtml(firstTokenTimeText)}</td>
        <td class="log-cell log-cell-rate text-sub"><span class="mobile-inline-label">速率</span>${escapeHtml(String(outputRateText))}</td>
        <td class="${detailCellClasses.join(' ')}">${detailHTML}</td>
      </tr>
    `
  }

  function formatFirstTokenTimeFromMs(ms) {
    if (ms === null) {
      return '-'
    }

    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(2)}s`
    }

    return `${ms}ms`
  }

  function calcAdjustedUseTimeSeconds(useTimeSeconds, firstTokenMs) {
    const safeUseTime = Number.isFinite(useTimeSeconds) && useTimeSeconds >= 0 ? useTimeSeconds : 0

    if (!Number.isFinite(firstTokenMs) || firstTokenMs < 0) {
      return safeUseTime
    }

    const adjusted = safeUseTime - firstTokenMs / 1000
    return adjusted > 0 ? adjusted : 0
  }

  function formatDurationSeconds(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return '-'
    }

    return `${seconds.toFixed(2)}s`
  }

  function formatOutputRate(completionTokens, useTimeSeconds) {
    const tokens = Number(completionTokens)
    if (!Number.isFinite(tokens) || tokens < 0) {
      return '-'
    }

    if (!Number.isFinite(useTimeSeconds) || useTimeSeconds <= 0) {
      return '-'
    }

    return `${(tokens / useTimeSeconds).toFixed(2)} token/s`
  }

  function calcCacheReadPercent(item) {
    const other = parseLogOther(item?.other)
    const cacheTokens = toFiniteNumber(other?.cache_tokens)
    if (cacheTokens === null || cacheTokens <= 0) {
      return 0
    }

    const promptTokens = toFiniteNumber(item?.prompt_tokens)
    const promptTokenCount = promptTokens !== null && promptTokens > 0 ? promptTokens : 0

    // Claude 的 prompt_tokens 不包含缓存读入量，其他模型则已包含
    const totalPromptTokens = other?.usage_semantic === 'anthropic'
      ? promptTokenCount + cacheTokens
      : promptTokenCount

    if (totalPromptTokens <= 0) {
      return 0
    }

    const cacheReadPct = (cacheTokens / totalPromptTokens) * 100
    if (!Number.isFinite(cacheReadPct)) {
      return 0
    }

    return Math.min(100, Math.max(0, cacheReadPct))
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
    if (state.log.isRefreshing) {
      dom.logLoadState.classList.remove('error')
      dom.logLoadState.textContent = '正在刷新日志...'
      return
    }

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
    const maxRetries = 4

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

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const res = await fetch(url, requestInit)

      // 429 指数退避重试
      if (res.status === 429 && attempt < maxRetries) {
        const retryAfter = parseInt(res.headers.get('Retry-After'), 10)
        const baseDelay = (retryAfter > 0 ? retryAfter : 1) * 1000
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500
        await new Promise((r) => setTimeout(r, delay))
        continue
      }

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

  function buildUpstreamURL(baseURL, path) {
    const url = new URL(normalizeBaseURL(baseURL))
    url.pathname = joinURLPath(url.pathname, path)
    url.search = ''
    url.hash = ''
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

  function joinURLPath(basePath, requestPath) {
    const normalizedBasePath = String(basePath || '').replace(/\/+$/, '')
    const normalizedRequestPath = String(requestPath || '').startsWith('/') ? String(requestPath || '') : `/${String(requestPath || '')}`

    if (!normalizedBasePath || normalizedBasePath === '/') {
      return normalizedRequestPath || '/'
    }

    return `${normalizedBasePath}${normalizedRequestPath || '/'}`
  }

  function showAlert(message, type = 'info', autoHideMs) {
    if (!message) {
      dom.alertBox.classList.add('hidden')
      return
    }

    if (state.alertTimer) {
      clearTimeout(state.alertTimer)
      state.alertTimer = null
    }
    if (state.alertFadeTimer) {
      clearTimeout(state.alertFadeTimer)
      state.alertFadeTimer = null
    }

    if (autoHideMs === undefined) {
      autoHideMs = type === 'error' ? 6000 : 4000
    }

    dom.alertBox.textContent = message
    dom.alertBox.className = `alert-toast ${type}`

    if (autoHideMs > 0) {
      const fadeOutDuration = 400
      state.alertTimer = window.setTimeout(() => {
        dom.alertBox.classList.add('alert-toast-fade-out')
        state.alertFadeTimer = window.setTimeout(() => {
          dom.alertBox.classList.add('hidden')
          dom.alertBox.classList.remove('alert-toast-fade-out')
        }, fadeOutDuration)
      }, autoHideMs)
    }
  }

  function runWithButtonLoading(button, task, loadingOptions) {
    if (!button || button.disabled) {
      return Promise.resolve()
    }

    setButtonLoading(button, true, loadingOptions)
    return Promise.resolve()
      .then(() => task())
      .finally(() => {
        setButtonLoading(button, false, loadingOptions)
      })
  }

  function setButtonLoading(button, loading, loadingOptions) {
    if (!button) {
      return
    }

    const options =
      typeof loadingOptions === 'string'
        ? { text: loadingOptions }
        : loadingOptions && typeof loadingOptions === 'object'
          ? loadingOptions
          : {}
    const loadingText = options.text || ''
    const loadingWrap = button.closest('.button-loading-wrap')
    const loadingSpinner = loadingWrap?.querySelector('.button-loading-spinner') || null
    const useInlineSpinner = Boolean(loadingWrap && loadingSpinner)

    if (loading) {
      if (button.dataset.originalDisabled === undefined) {
        button.dataset.originalDisabled = button.disabled ? 'true' : 'false'
      }
      if (!useInlineSpinner && button.dataset.originalHtml === undefined) {
        button.dataset.originalHtml = button.innerHTML
      }
      button.disabled = true
      button.setAttribute('aria-busy', 'true')
      if (useInlineSpinner) {
        loadingWrap.classList.add('is-loading')
        return
      }
      if (loadingText) {
        button.textContent = loadingText
      }
      return
    }

    button.disabled = button.dataset.originalDisabled === 'true'
    button.removeAttribute('aria-busy')
    delete button.dataset.originalDisabled

    if (useInlineSpinner) {
      loadingWrap.classList.remove('is-loading')
      return
    }

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

  function formatTokenKeyDisplay(fullKey, isVisible, tokenId) {
    if (!fullKey) {
      return '<span class="token-key token-key-placeholder text-sub">-</span>'
    }

    if (!isVisible) {
      // 默认显示接口返回的脱敏 key
      return `<code class="mono token-key text-sub">${escapeHtml(fullKey)}</code>`
    }

    // 可见状态：优先使用缓存的完整 key
    const cached = state.token.fullKeyCache.get(tokenId)
    if (cached) {
      return `<code class="mono token-key">${escapeHtml(cached)}</code>`
    }

    // 还没拿到完整 key，显示加载中
    return '<span class="token-key text-sub">加载中…</span>'
  }

  function getTokenKeyToggleIcon(isVisible) {
    if (isVisible) {
      return '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C5 20 1 12 1 12a21.8 21.8 0 0 1 5.06-5.94"></path><path d="M9.9 4.24A10.7 10.7 0 0 1 12 4c7 0 11 8 11 8a21.79 21.79 0 0 1-3.22 4.31"></path><path d="M14.12 14.12A3 3 0 0 1 9.88 9.88"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>'
    }

    return '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>'
  }

  async function toggleTokenKeyVisibility(tokenId) {
    if (state.token.visibleKeyIds.has(tokenId)) {
      state.token.visibleKeyIds.delete(tokenId)
      renderTokenTable()
      return
    }

    state.token.visibleKeyIds.add(tokenId)

    // 缓存中已有完整 key，直接渲染
    if (state.token.fullKeyCache.has(tokenId)) {
      renderTokenTable()
      return
    }

    // 预加载未命中，按需获取
    renderTokenTable()
    try {
      const fullKey = await fetchTokenFullKey(tokenId)
      if (fullKey) {
        state.token.fullKeyCache.set(tokenId, fullKey)
      } else {
        state.token.visibleKeyIds.delete(tokenId)
        showAlert('无法获取完整 Key', 'warning')
      }
    } catch (err) {
      state.token.visibleKeyIds.delete(tokenId)
      showAlert('获取 Key 失败：' + (err.message || '未知错误'), 'error')
    }
    renderTokenTable()
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

  function bindDatetimeAutoComplete(input) {
    if (!input) {
      return
    }

    input.addEventListener('input', () => {
      const nextValue = autoCompleteDatetimeInputText(input.value)
      if (nextValue !== input.value) {
        input.value = nextValue
      }
    })

    input.addEventListener('blur', () => {
      input.value = normalizeDatetimeInputText(input.value)
    })
  }

  function autoCompleteDatetimeInputText(value) {
    const raw = String(value || '').trim()
    if (!raw) {
      return ''
    }

    const compact = raw.replaceAll('/', '-').replaceAll('T', ' ').replace(/\s+/g, ' ')
    if (!/^\d+$/.test(compact)) {
      return compact
    }

    if (isLikelyUnixTimestampText(compact)) {
      return compact
    }

    return formatCompactDatetimeForInput(compact)
  }

  function normalizeDatetimeInputText(value) {
    const autoCompleted = autoCompleteDatetimeInputText(value)
    if (!autoCompleted) {
      return ''
    }

    const unix = datetimeLocalToUnix(autoCompleted)
    if (!unix) {
      return autoCompleted
    }

    return formatTimestamp(unix)
  }

  function isLikelyUnixTimestampText(text) {
    if (!/^\d{10}$/.test(text) && !/^\d{13}$/.test(text)) {
      return false
    }

    const yearPrefix = Number.parseInt(text.slice(0, 4), 10)
    return !Number.isFinite(yearPrefix) || yearPrefix < 1900 || yearPrefix > 2100
  }

  function formatCompactDatetimeForInput(digitsText) {
    const digits = String(digitsText || '').replace(/\D/g, '').slice(0, 14)
    if (!digits) {
      return ''
    }

    let formatted = digits.slice(0, Math.min(4, digits.length))

    if (digits.length > 4) {
      formatted += `-${digits.slice(4, Math.min(6, digits.length))}`
    }
    if (digits.length > 6) {
      formatted += `-${digits.slice(6, Math.min(8, digits.length))}`
    }
    if (digits.length > 8) {
      formatted += ` ${digits.slice(8, Math.min(10, digits.length))}`
    }
    if (digits.length > 10) {
      formatted += `:${digits.slice(10, Math.min(12, digits.length))}`
    }
    if (digits.length > 12) {
      formatted += `:${digits.slice(12, Math.min(14, digits.length))}`
    }

    return formatted
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

  function unixToDatetimeText(seconds) {
    const ts = Number(seconds)
    if (!Number.isFinite(ts) || ts <= 0 || ts === -1) {
      return ''
    }

    const date = new Date(ts * 1000)
    if (Number.isNaN(date.getTime())) {
      return ''
    }

    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(
      date.getHours()
    )}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
  }

  function datetimeLocalToUnix(value) {
    const text = autoCompleteDatetimeInputText(value)
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

    const normalized = text.replaceAll('/', '-').replace(/\s+/g, ' ')
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
