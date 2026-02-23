APP_NAME := newapi-modern-dashboard
DIST_DIR := dist
LDFLAGS := -s -w

.PHONY: build clean linux windows macos release

build:
	go build -ldflags "$(LDFLAGS)" -o $(APP_NAME) .

clean:
	@if [ -d "$(DIST_DIR)" ]; then rm -rf "$(DIST_DIR)"; fi
	@if [ -f "$(APP_NAME)" ]; then rm -f "$(APP_NAME)"; fi
	@if [ -f "$(APP_NAME).exe" ]; then rm -f "$(APP_NAME).exe"; fi

linux:
	@mkdir -p $(DIST_DIR)
	GOOS=linux GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o $(DIST_DIR)/$(APP_NAME)-linux-amd64 .
	GOOS=linux GOARCH=arm64 go build -ldflags "$(LDFLAGS)" -o $(DIST_DIR)/$(APP_NAME)-linux-arm64 .

windows:
	@mkdir -p $(DIST_DIR)
	GOOS=windows GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o $(DIST_DIR)/$(APP_NAME)-windows-amd64.exe .
	GOOS=windows GOARCH=arm64 go build -ldflags "$(LDFLAGS)" -o $(DIST_DIR)/$(APP_NAME)-windows-arm64.exe .

macos:
	@mkdir -p $(DIST_DIR)
	GOOS=darwin GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o $(DIST_DIR)/$(APP_NAME)-darwin-amd64 .
	GOOS=darwin GOARCH=arm64 go build -ldflags "$(LDFLAGS)" -o $(DIST_DIR)/$(APP_NAME)-darwin-arm64 .

release: clean linux windows macos
