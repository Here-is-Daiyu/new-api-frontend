package main

import (
	"embed"
	"encoding/json"
	"errors"
	"flag"
	"io/fs"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"
	"time"
)

var version = "dev"

var defaultBaseURL string

//go:embed web/*
var webFS embed.FS

type jsonResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
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

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/config", handleConfig)
	mux.HandleFunc("/proxy", handleProxy)
	mux.HandleFunc("/proxy/", handleProxy)
	mux.Handle("/", http.FileServer(http.FS(staticFS)))

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
	writeJSON(w, http.StatusOK, jsonResponse{Success: true, Message: "ok", Data: map[string]string{"status": "ok"}})
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

func handleProxy(w http.ResponseWriter, r *http.Request) {
	baseURL := strings.TrimSpace(r.Header.Get("X-Base-URL"))
	if baseURL == "" {
		baseURL = defaultBaseURL
	}

	targetBase, err := validateBaseURL(baseURL)
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
