package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"sort"
	"strings"
	"time"
)

var version = "dev"

var defaultBaseURL string

var upstreamHTTPClient = &http.Client{Timeout: 20 * time.Second}

//go:embed web/*
var webFS embed.FS

type staticAsset struct {
	fileName    string
	contentType string
	data        []byte
	version     string
	eTag        string
}

type staticSite struct {
	fileServer http.Handler
	indexHTML  []byte
	styleCSS   staticAsset
	appJS      staticAsset
}

type jsonResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type upstreamEnvelope struct {
	Success bool            `json:"success"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

type tokenItem struct {
	ID     int    `json:"id"`
	Name   string `json:"name"`
	Key    string `json:"key"`
	Status int    `json:"status"`
}

type tokenPageData struct {
	Total int         `json:"total"`
	Items []tokenItem `json:"items"`
}

func main() {
	addr := flag.String("addr", envOrDefault("ADDR", ":8099"), "HTTP 监听地址，例如 :8099")
	baseURL := flag.String("base-url", strings.TrimSpace(os.Getenv("BASE_URL")), "默认 New API BaseURL，可选")
	flag.Parse()

	if *baseURL != "" {
		u, err := validateBaseURL(*baseURL)
		if err != nil {
			log.Fatalf("默认 base-url 非法: %v", err)
		}
		defaultBaseURL = trimTrailingSlash(u.String())
	}

	staticFS, err := fs.Sub(webFS, "web")
	if err != nil {
		log.Fatalf("初始化静态资源失败: %v", err)
	}

	staticSiteHandler, err := newStaticSite(staticFS)
	if err != nil {
		log.Fatalf("初始化静态站点失败: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/config", handleConfig)
	mux.HandleFunc("/favicon.ico", handleFaviconPNG)
	mux.HandleFunc("/favicon.png", handleFaviconPNG)
	mux.HandleFunc("/api/internal/log/model-suggestions", handleLogModelSuggestions)
	mux.HandleFunc("/proxy", handleProxy)
	mux.HandleFunc("/proxy/", handleProxy)
	mux.Handle("/", staticSiteHandler)

	srv := &http.Server{
		Addr:              *addr,
		Handler:           withAccessLog(mux),
		ReadHeaderTimeout: 10 * time.Second,
	}

	log.Printf("newapi-modern-dashboard 启动成功, 监听地址: %s", *addr)
	if defaultBaseURL != "" {
		log.Printf("默认 BaseURL: %s", defaultBaseURL)
	}
	log.Printf("版本: %s", version)

	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("服务启动失败: %v", err)
	}
}

func handleHealthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, jsonResponse{Success: true, Message: "ok", Data: map[string]string{"status": "ok", "version": version}})
}

func handleConfig(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, jsonResponse{
		Success: true,
		Message: "",
		Data: map[string]string{
			"default_base_url": defaultBaseURL,
			"version":          version,
		},
	})
}

func newStaticSite(staticFS fs.FS) (*staticSite, error) {
	indexHTML, err := fs.ReadFile(staticFS, "index.html")
	if err != nil {
		return nil, err
	}

	styleCSS, err := loadStaticAsset(staticFS, "style.css", "text/css; charset=utf-8")
	if err != nil {
		return nil, err
	}

	appJS, err := loadStaticAsset(staticFS, "app.js", "application/javascript; charset=utf-8")
	if err != nil {
		return nil, err
	}

	replacer := strings.NewReplacer(
		"__STYLE_CSS_URL__", "/style.css?v="+styleCSS.version,
		"__APP_JS_URL__", "/app.js?v="+appJS.version,
	)

	return &staticSite{
		fileServer: http.FileServer(http.FS(staticFS)),
		indexHTML:  []byte(replacer.Replace(string(indexHTML))),
		styleCSS:   styleCSS,
		appJS:      appJS,
	}, nil
}

func loadStaticAsset(staticFS fs.FS, fileName, contentType string) (staticAsset, error) {
	data, err := fs.ReadFile(staticFS, fileName)
	if err != nil {
		return staticAsset{}, err
	}

	hash := sha256.Sum256(data)
	version := hex.EncodeToString(hash[:8])

	return staticAsset{
		fileName:    fileName,
		contentType: contentType,
		data:        data,
		version:     version,
		eTag:        `"` + version + `"`,
	}, nil
}

func (s *staticSite) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "/", "/index.html":
		s.serveIndex(w, r)
	case "/style.css":
		s.serveAsset(w, r, s.styleCSS)
	case "/app.js":
		s.serveAsset(w, r, s.appJS)
	default:
		s.fileServer.ServeHTTP(w, r)
	}
}

func (s *staticSite) serveIndex(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")
	w.WriteHeader(http.StatusOK)
	if r.Method == http.MethodHead {
		return
	}
	_, _ = w.Write(s.indexHTML)
}

func (s *staticSite) serveAsset(w http.ResponseWriter, r *http.Request, asset staticAsset) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", asset.contentType)
	w.Header().Set("ETag", asset.eTag)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	if strings.TrimSpace(r.URL.Query().Get("v")) == asset.version {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	} else {
		w.Header().Set("Cache-Control", "no-cache, max-age=0, must-revalidate")
	}

	if match := strings.TrimSpace(r.Header.Get("If-None-Match")); match != "" && match == asset.eTag {
		w.WriteHeader(http.StatusNotModified)
		return
	}

	http.ServeContent(w, r, asset.fileName, time.Time{}, bytes.NewReader(asset.data))
}

func handleFaviconPNG(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	if strings.TrimSpace(r.URL.Query().Get("base_url")) == "" &&
		strings.TrimSpace(r.Header.Get("X-Base-URL")) == "" &&
		strings.TrimSpace(defaultBaseURL) == "" {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	targetBase, err := resolveTargetBaseURL(r, true)
	if err != nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	targetURL := *targetBase
	targetURL.Path = joinURLPath(targetBase.Path, "/favicon.png")
	targetURL.RawQuery = ""

	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, targetURL.String(), nil)
	if err != nil {
		w.WriteHeader(http.StatusBadGateway)
		return
	}

	copyHeaderIfPresent(r.Header, req.Header, "User-Agent")
	req.Header.Set("Accept", "image/png,image/*;q=0.9,*/*;q=0.8")

	resp, err := upstreamHTTPClient.Do(req)
	if err != nil {
		w.WriteHeader(http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	copyResponseHeaderIfPresent(resp.Header, w.Header(), "Content-Type")
	copyResponseHeaderIfPresent(resp.Header, w.Header(), "Cache-Control")
	copyResponseHeaderIfPresent(resp.Header, w.Header(), "ETag")
	copyResponseHeaderIfPresent(resp.Header, w.Header(), "Last-Modified")
	copyResponseHeaderIfPresent(resp.Header, w.Header(), "Expires")

	w.WriteHeader(resp.StatusCode)
	if r.Method == http.MethodHead {
		return
	}
	_, _ = io.Copy(w, io.LimitReader(resp.Body, 4<<20))
}

func handleLogModelSuggestions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, jsonResponse{Success: false, Message: "仅支持 GET"})
		return
	}

	targetBase, err := resolveTargetBaseURL(r, false)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, jsonResponse{Success: false, Message: "BaseURL 非法: " + err.Error()})
		return
	}

	tokenKeys, err := fetchAllTokenKeysForModelAggregation(r.Context(), r, targetBase)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, jsonResponse{Success: false, Message: "获取 Token 列表失败: " + err.Error()})
		return
	}

	modelSet := make(map[string]struct{})
	modelIDs := make([]string, 0)
	failedTokenCount := 0

	if len(tokenKeys) == 0 {
		ids, err := fetchModelIDsByToken(r.Context(), r, targetBase, "")
		if err == nil {
			for _, id := range ids {
				if _, exists := modelSet[id]; exists {
					continue
				}
				modelSet[id] = struct{}{}
				modelIDs = append(modelIDs, id)
			}
		}
	} else {
		for _, key := range tokenKeys {
			ids, err := fetchModelIDsByToken(r.Context(), r, targetBase, key)
			if err != nil {
				failedTokenCount++
				continue
			}

			for _, id := range ids {
				if _, exists := modelSet[id]; exists {
					continue
				}
				modelSet[id] = struct{}{}
				modelIDs = append(modelIDs, id)
			}
		}
	}

	sort.Strings(modelIDs)

	writeJSON(w, http.StatusOK, jsonResponse{
		Success: true,
		Data: map[string]interface{}{
			"model_ids":          modelIDs,
			"token_count":        len(tokenKeys),
			"failed_token_count": failedTokenCount,
		},
	})
}

func fetchAllTokenKeysForModelAggregation(ctx context.Context, sourceReq *http.Request, targetBase *url.URL) ([]string, error) {
	const pageSize = 100
	const maxPages = 20

	keys := make([]string, 0)
	seen := make(map[string]struct{})
	total := 0
	fetchedItems := 0

	for page := 1; page <= maxPages; page++ {
		pageData, err := fetchTokenPage(ctx, sourceReq, targetBase, page, pageSize)
		if err != nil {
			return nil, err
		}

		if pageData.Total > total {
			total = pageData.Total
		}

		items := pageData.Items
		if len(items) == 0 {
			break
		}

		fetchedItems += len(items)

		for _, token := range items {
			key := normalizeTokenKey(token.Key)
			if key == "" {
				continue
			}
			if _, exists := seen[key]; exists {
				continue
			}
			seen[key] = struct{}{}
			keys = append(keys, key)
		}

		if total > 0 && fetchedItems >= total {
			break
		}
		if len(items) < pageSize {
			break
		}
	}

	return keys, nil
}

func fetchTokenPage(ctx context.Context, sourceReq *http.Request, targetBase *url.URL, page, pageSize int) (tokenPageData, error) {
	query := url.Values{}
	query.Set("p", fmt.Sprintf("%d", page))
	query.Set("page_size", fmt.Sprintf("%d", pageSize))

	req, err := buildUpstreamRequest(ctx, sourceReq, targetBase, http.MethodGet, "/api/token/", query)
	if err != nil {
		return tokenPageData{}, err
	}

	statusCode, body, err := performUpstreamRequest(req)
	if err != nil {
		return tokenPageData{}, err
	}
	if statusCode < 200 || statusCode >= 300 {
		return tokenPageData{}, errors.New(parseUpstreamErrorMessage(body, statusCode))
	}

	var envelope upstreamEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil {
		return tokenPageData{}, fmt.Errorf("解析 token 响应失败: %w", err)
	}
	if !envelope.Success {
		msg := strings.TrimSpace(envelope.Message)
		if msg == "" {
			msg = "token 查询失败"
		}
		return tokenPageData{}, errors.New(msg)
	}

	if len(envelope.Data) == 0 || string(envelope.Data) == "null" {
		return tokenPageData{}, nil
	}

	var pageData tokenPageData
	if err := json.Unmarshal(envelope.Data, &pageData); err != nil {
		return tokenPageData{}, fmt.Errorf("解析 token 数据失败: %w", err)
	}

	return pageData, nil
}

func fetchModelIDsByToken(ctx context.Context, sourceReq *http.Request, targetBase *url.URL, tokenKey string) ([]string, error) {
	ids, err := fetchModelIDsFromPath(ctx, sourceReq, targetBase, "/v1/models", tokenKey)
	if err == nil {
		return ids, nil
	}

	fallbackIDs, fallbackErr := fetchModelIDsFromPath(ctx, sourceReq, targetBase, "/models", tokenKey)
	if fallbackErr == nil {
		return fallbackIDs, nil
	}

	return nil, fmt.Errorf("%v; %v", err, fallbackErr)
}

func fetchModelIDsFromPath(ctx context.Context, sourceReq *http.Request, targetBase *url.URL, modelPath, tokenKey string) ([]string, error) {
	req, err := buildUpstreamRequest(ctx, sourceReq, targetBase, http.MethodGet, modelPath, nil)
	if err != nil {
		return nil, err
	}

	normalizedKey := normalizeTokenKey(tokenKey)
	if normalizedKey != "" {
		req.Header.Set("Authorization", "Bearer "+normalizedKey)
	}

	statusCode, body, err := performUpstreamRequest(req)
	if err != nil {
		return nil, err
	}
	if statusCode < 200 || statusCode >= 300 {
		return nil, errors.New(parseUpstreamErrorMessage(body, statusCode))
	}

	modelIDs, err := parseModelIDs(body)
	if err != nil {
		return nil, err
	}
	return modelIDs, nil
}

func parseModelIDs(body []byte) ([]string, error) {
	var payload interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("解析模型列表失败: %w", err)
	}

	items, ok := extractModelItems(payload)
	if !ok {
		return nil, errors.New("模型列表结构不受支持")
	}

	ids := make([]string, 0, len(items))
	seen := make(map[string]struct{})

	for _, item := range items {
		itemMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		modelID := strings.TrimSpace(anyToString(itemMap["id"]))
		if modelID == "" {
			continue
		}
		if _, exists := seen[modelID]; exists {
			continue
		}

		seen[modelID] = struct{}{}
		ids = append(ids, modelID)
	}

	return ids, nil
}

func extractModelItems(payload interface{}) ([]interface{}, bool) {
	switch typed := payload.(type) {
	case []interface{}:
		return typed, true
	case map[string]interface{}:
		if dataItems, ok := typed["data"].([]interface{}); ok {
			return dataItems, true
		}

		if dataObj, ok := typed["data"].(map[string]interface{}); ok {
			if nestedItems, ok := dataObj["data"].([]interface{}); ok {
				return nestedItems, true
			}
		}
	}

	return nil, false
}

func buildUpstreamRequest(ctx context.Context, sourceReq *http.Request, targetBase *url.URL, method, requestPath string, query url.Values) (*http.Request, error) {
	targetURL := *targetBase
	targetURL.Path = joinURLPath(targetBase.Path, requestPath)
	targetURL.RawQuery = ""
	targetURL.Fragment = ""
	if query != nil {
		targetURL.RawQuery = query.Encode()
	}

	req, err := http.NewRequestWithContext(ctx, method, targetURL.String(), nil)
	if err != nil {
		return nil, err
	}

	copyHeaderIfPresent(sourceReq.Header, req.Header, "Cookie")
	copyHeaderIfPresent(sourceReq.Header, req.Header, "New-Api-User")
	copyHeaderIfPresent(sourceReq.Header, req.Header, "User-Agent")
	req.Header.Set("Accept", "application/json")

	return req, nil
}

func performUpstreamRequest(req *http.Request) (int, []byte, error) {
	resp, err := upstreamHTTPClient.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return resp.StatusCode, nil, err
	}

	return resp.StatusCode, body, nil
}

func parseUpstreamErrorMessage(body []byte, statusCode int) string {
	if len(body) == 0 {
		return fmt.Sprintf("上游返回 HTTP %d", statusCode)
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err == nil {
		if msg := strings.TrimSpace(anyToString(payload["message"])); msg != "" {
			return msg
		}
		if errorMap, ok := payload["error"].(map[string]interface{}); ok {
			if msg := strings.TrimSpace(anyToString(errorMap["message"])); msg != "" {
				return msg
			}
		}
	}

	plain := strings.TrimSpace(string(body))
	if plain == "" {
		return fmt.Sprintf("上游返回 HTTP %d", statusCode)
	}
	if len(plain) > 300 {
		plain = plain[:300] + "..."
	}
	return plain
}

func anyToString(value interface{}) string {
	switch v := value.(type) {
	case string:
		return v
	case json.Number:
		return v.String()
	case float64:
		if v == float64(int64(v)) {
			return fmt.Sprintf("%d", int64(v))
		}
		return fmt.Sprintf("%v", v)
	case float32:
		if v == float32(int64(v)) {
			return fmt.Sprintf("%d", int64(v))
		}
		return fmt.Sprintf("%v", v)
	case int:
		return fmt.Sprintf("%d", v)
	case int64:
		return fmt.Sprintf("%d", v)
	case int32:
		return fmt.Sprintf("%d", v)
	case uint:
		return fmt.Sprintf("%d", v)
	case uint64:
		return fmt.Sprintf("%d", v)
	case uint32:
		return fmt.Sprintf("%d", v)
	default:
		if value == nil {
			return ""
		}
		return fmt.Sprintf("%v", value)
	}
}

func normalizeTokenKey(raw string) string {
	key := strings.TrimSpace(raw)
	if key == "" {
		return ""
	}
	if strings.HasPrefix(strings.ToLower(key), "sk-") {
		return key
	}
	return "sk-" + key
}

func resolveTargetBaseURL(r *http.Request, allowQueryBaseURL bool) (*url.URL, error) {
	baseURL := strings.TrimSpace(r.Header.Get("X-Base-URL"))
	if baseURL == "" && allowQueryBaseURL {
		baseURL = strings.TrimSpace(r.URL.Query().Get("base_url"))
	}
	if baseURL == "" {
		baseURL = defaultBaseURL
	}
	return validateBaseURL(baseURL)
}

func handleProxy(w http.ResponseWriter, r *http.Request) {
	targetBase, err := resolveTargetBaseURL(r, false)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, jsonResponse{Success: false, Message: "BaseURL 非法: " + err.Error()})
		return
	}

	proxyPath := strings.TrimPrefix(r.URL.Path, "/proxy")
	if proxyPath == "" {
		proxyPath = "/"
	}

	proxy := &httputil.ReverseProxy{
		Director: func(req *http.Request) {
			originalHost := req.Host

			req.URL.Scheme = targetBase.Scheme
			req.URL.Host = targetBase.Host
			req.URL.Path = joinURLPath(targetBase.Path, proxyPath)
			req.Host = targetBase.Host
			req.Header.Del("X-Base-URL")
			req.Header.Set("X-Forwarded-Host", originalHost)
			req.Header.Set("X-Forwarded-Proto", inferProto(r))
		},
		ErrorHandler: func(rw http.ResponseWriter, _ *http.Request, proxyErr error) {
			writeJSON(rw, http.StatusBadGateway, jsonResponse{Success: false, Message: "代理请求失败: " + proxyErr.Error()})
		},
		ModifyResponse: func(resp *http.Response) error {
			rewriteSetCookieDomain(resp)
			return nil
		},
	}

	proxy.ServeHTTP(w, r)
}

func copyHeaderIfPresent(src http.Header, dst http.Header, key string) {
	value := strings.TrimSpace(src.Get(key))
	if value == "" {
		return
	}
	dst.Set(key, value)
}

func copyResponseHeaderIfPresent(src http.Header, dst http.Header, key string) {
	value := strings.TrimSpace(src.Get(key))
	if value == "" {
		return
	}
	dst.Set(key, value)
}

func rewriteSetCookieDomain(resp *http.Response) {
	setCookies := resp.Header.Values("Set-Cookie")
	if len(setCookies) == 0 {
		return
	}

	resp.Header.Del("Set-Cookie")
	for _, cookie := range setCookies {
		resp.Header.Add("Set-Cookie", stripCookieDomain(cookie))
	}
}

func stripCookieDomain(cookie string) string {
	parts := strings.Split(cookie, ";")
	cleaned := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		lower := strings.ToLower(trimmed)
		if strings.HasPrefix(lower, "domain=") {
			continue
		}
		cleaned = append(cleaned, trimmed)
	}
	return strings.Join(cleaned, "; ")
}

func validateBaseURL(raw string) (*url.URL, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, errors.New("不能为空")
	}

	u, err := url.Parse(raw)
	if err != nil {
		return nil, errors.New("解析失败")
	}

	if u.Scheme != "http" && u.Scheme != "https" {
		return nil, errors.New("仅支持 http/https")
	}
	if u.Host == "" {
		return nil, errors.New("缺少主机名")
	}
	if u.User != nil {
		return nil, errors.New("不支持包含用户信息")
	}

	u.Fragment = ""
	return u, nil
}

func joinURLPath(basePath, requestPath string) string {
	basePath = trimTrailingSlash(basePath)
	if requestPath == "" {
		requestPath = "/"
	}
	if !strings.HasPrefix(requestPath, "/") {
		requestPath = "/" + requestPath
	}
	if basePath == "" {
		return requestPath
	}
	return basePath + requestPath
}

func trimTrailingSlash(s string) string {
	if s == "/" {
		return ""
	}
	return strings.TrimRight(s, "/")
}

func inferProto(r *http.Request) string {
	if r.TLS != nil {
		return "https"
	}
	if xfProto := strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")); xfProto != "" {
		return xfProto
	}
	return "http"
}

func writeJSON(w http.ResponseWriter, status int, payload jsonResponse) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func envOrDefault(key, fallback string) string {
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		return fallback
	}
	return val
}

type responseRecorder struct {
	http.ResponseWriter
	statusCode int
}

func (r *responseRecorder) WriteHeader(code int) {
	r.statusCode = code
	r.ResponseWriter.WriteHeader(code)
}

func withAccessLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rr := &responseRecorder{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(rr, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, rr.statusCode, time.Since(start))
	})
}
