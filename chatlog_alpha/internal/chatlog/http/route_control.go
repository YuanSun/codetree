package http

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/sjzar/chatlog/internal/chatlog/ports"
)

func (s *Service) initControlRoutes() {
	control := s.router.Group("/api/v1/control")
	control.GET("/status", s.accountRequestMiddleware(), s.handleControlStatus)
	control.GET("/accounts", s.accountRequestMiddleware(), s.handleControlAccounts)
	control.PATCH("/config", s.handleControlConfig)
	control.POST("/account", s.handleControlAccount)
	control.POST("/actions", s.handleControlActionStart)
	control.GET("/actions/:id", s.handleControlActionGet)
}

func (s *Service) requireControl(c *gin.Context) (ports.ControlPlane, bool) {
	if s.control == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Web 控制平面尚未初始化"})
		return nil, false
	}
	return s.control, true
}

func (s *Service) lockAccountMutation(c *gin.Context) (string, func(), bool) {
	control, ok := s.requireControl(c)
	if !ok {
		return "", nil, false
	}
	account := strings.TrimSpace(s.conf.GetAccount())
	release, err := control.ControlLockAccount(account)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return "", nil, false
	}
	return account, release, true
}

func (s *Service) handleControlStatus(c *gin.Context) {
	control, ok := s.requireControl(c)
	if !ok {
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": control.ControlSnapshot()})
}

func (s *Service) handleControlAccounts(c *gin.Context) {
	control, ok := s.requireControl(c)
	if !ok {
		return
	}
	c.JSON(http.StatusOK, gin.H{"accounts": control.ControlAccounts()})
}

func (s *Service) handleControlConfig(c *gin.Context) {
	control, ok := s.requireControl(c)
	if !ok {
		return
	}
	var patch ports.ControlConfigPatch
	if err := bindStrictJSON(c, &patch, false); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "配置请求格式错误: " + err.Error()})
		return
	}
	snapshot, err := control.ControlUpdate(patch)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": snapshot})
}

func (s *Service) handleControlAccount(c *gin.Context) {
	control, ok := s.requireControl(c)
	if !ok {
		return
	}
	var selector ports.ControlAccountSelector
	if err := bindStrictJSON(c, &selector, false); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "账号请求格式错误: " + err.Error()})
		return
	}
	snapshot, err := control.ControlSelect(selector)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": snapshot})
}

func (s *Service) handleControlActionStart(c *gin.Context) {
	control, ok := s.requireControl(c)
	if !ok {
		return
	}
	var request struct {
		Action ports.ControlAction `json:"action"`
	}
	if err := bindStrictJSON(c, &request, false); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "任务请求格式错误: " + err.Error()})
		return
	}
	job, err := control.ControlStartAction(request.Action)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusAccepted, gin.H{"job": job})
}

func (s *Service) handleControlActionGet(c *gin.Context) {
	control, ok := s.requireControl(c)
	if !ok {
		return
	}
	id := strings.TrimSpace(c.Param("id"))
	job, found := control.ControlJob(id)
	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "任务不存在"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"job": job})
}
