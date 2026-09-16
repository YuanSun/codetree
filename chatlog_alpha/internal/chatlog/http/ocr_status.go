package http

import (
	"context"
	"strings"
	"time"

	"github.com/sjzar/chatlog/internal/chatlog/conf"
	"github.com/sjzar/chatlog/internal/chatlog/ocr"
	"github.com/sjzar/chatlog/internal/wechat/imageupgrade"
)

type imageOCRScopeStatus struct {
	All       bool     `json:"all"`
	Contacts  []string `json:"contacts"`
	ChatRooms []string `json:"chatrooms"`
}

type imageOCRCurrentStatus struct {
	RecordID  int64  `json:"record_id,omitempty"`
	Talker    string `json:"talker,omitempty"`
	MediaKey  string `json:"media_key,omitempty"`
	StartedAt int64  `json:"started_at,omitempty"`
	Stage     string `json:"stage,omitempty"`
	Detail    string `json:"detail,omitempty"`
}

type imageOCRBackfillStatus struct {
	Enabled      bool     `json:"enabled"`
	Running      bool     `json:"running"`
	StartedAt    int64    `json:"started_at,omitempty"`
	FinishedAt   int64    `json:"finished_at,omitempty"`
	Limit        int      `json:"limit,omitempty"`
	ReceivedOnly bool     `json:"received_only"`
	RespectScope bool     `json:"respect_scope"`
	Talkers      []string `json:"talkers,omitempty"`
	Scanned      int      `json:"scanned"`
	Enqueued     int      `json:"enqueued"`
	Error        string   `json:"error,omitempty"`
}

type imageOCRStatus struct {
	Enabled            bool                     `json:"enabled"`
	Running            bool                     `json:"running"`
	RealtimeRunning    bool                     `json:"realtime_running"`
	WorkerRunning      bool                     `json:"worker_running"`
	Mode               string                   `json:"mode"`
	Provider           string                   `json:"provider"`
	Model              string                   `json:"model"`
	Endpoint           string                   `json:"endpoint"`
	APIKeyConfigured   bool                     `json:"api_key_configured"`
	ReceivedOnly       bool                     `json:"received_only"`
	Scope              imageOCRScopeStatus      `json:"scope"`
	BackfillOnStart    bool                     `json:"backfill_on_start"`
	Backfill           imageOCRBackfillStatus   `json:"backfill"`
	TriggerMode        string                   `json:"trigger_mode"`
	RequestTimeout     int                      `json:"request_timeout_sec"`
	StartedAt          int64                    `json:"started_at,omitempty"`
	LastScanAt         int64                    `json:"last_scan_at,omitempty"`
	LastScanDurationMS int64                    `json:"last_scan_duration_ms"`
	LastScanMessages   uint64                   `json:"last_scan_messages"`
	LastScanEnqueued   uint64                   `json:"last_scan_enqueued"`
	LastSuccessAt      int64                    `json:"last_success_at,omitempty"`
	LastErrorAt        int64                    `json:"last_error_at,omitempty"`
	LastError          string                   `json:"last_error,omitempty"`
	Scanned            uint64                   `json:"scanned"`
	Enqueued           uint64                   `json:"enqueued"`
	Processed          uint64                   `json:"processed"`
	Failed             uint64                   `json:"failed"`
	Current            imageOCRCurrentStatus    `json:"current"`
	Index              ocr.Stats                `json:"index"`
	Recent             []ocr.RecordSummary      `json:"recent"`
	LocalService       ocr.LocalServiceSnapshot `json:"local_service"`
	ReceiveUpgrade     imageupgrade.Status       `json:"receive_upgrade"`
}

func (s *Service) ocrStatus(ctx context.Context) imageOCRStatus {
	config := s.configuredOCR()
	mode := "local"
	if config.Provider == conf.OCRProviderMaaS {
		mode = "api"
	}
	status := imageOCRStatus{
		Enabled:          config.Enabled,
		Mode:             mode,
		Provider:         config.Provider,
		Model:            config.Model,
		Endpoint:         config.Endpoint,
		APIKeyConfigured: strings.TrimSpace(config.APIKey) != "",
		ReceivedOnly:     config.ReceivedOnly,
		Scope: imageOCRScopeStatus{
			All:       config.ScopeAll(),
			Contacts:  config.ListenContactsList(),
			ChatRooms: config.ListenChatRoomsList(),
		},
		BackfillOnStart: config.BackfillOnStart,
		Backfill:        s.currentOCRBackfillStatus(config),
		TriggerMode:     "database_event",
		RequestTimeout:  config.RequestTimeout,
		ReceiveUpgrade:  s.currentOCRImageReceiveUpgrade(),
	}
	if s.db.MessageChangeStats().Running {
		status.TriggerMode = "shared_message_change_stream"
	}
	if manager := s.currentOCRLocalService(); manager != nil {
		probeContext, cancel := context.WithTimeout(ctx, time.Second)
		status.LocalService = manager.Snapshot(probeContext)
		cancel()
	} else {
		status.LocalService = ocr.NewLocalServiceManager(config.Endpoint, ocr.LocalServiceOptions{
			AutoStart:   config.LocalAutoStartEnabled(),
			AutoRestart: config.LocalAutoRestartEnabled(),
		}).Snapshot(ctx)
	}
	runtime := s.currentOCRRuntime()
	if runtime == nil {
		return status
	}
	runtime.mu.RLock()
	status.RealtimeRunning = runtime.scannerRunning
	status.WorkerRunning = runtime.workerRunning
	status.Running = runtime.scannerRunning || runtime.workerRunning
	status.StartedAt = runtime.startedAt
	status.LastScanAt = runtime.lastScanAt
	status.LastScanDurationMS = runtime.lastScanDurationMS
	status.LastScanMessages = runtime.lastScanMessages
	status.LastScanEnqueued = runtime.lastScanEnqueued
	status.LastSuccessAt = runtime.lastSuccessAt
	status.LastErrorAt = runtime.lastErrorAt
	status.LastError = runtime.lastError
	status.Scanned = runtime.scanned
	status.Enqueued = runtime.enqueued
	status.Processed = runtime.processed
	status.Failed = runtime.failed
	status.Current = imageOCRCurrentStatus{
		RecordID:  runtime.currentRecordID,
		Talker:    runtime.currentTalker,
		MediaKey:  runtime.currentMediaKey,
		StartedAt: runtime.currentStartedAt,
		Stage:     runtime.currentStage,
		Detail:    runtime.currentDetail,
	}
	runtime.mu.RUnlock()
	if runtime.store != nil {
		indexStats, err := runtime.store.Stats(ctx)
		if err != nil {
			runtime.setError(err)
		} else {
			status.Index = indexStats
		}
		recent, err := runtime.store.Recent(ctx, 20)
		if err != nil {
			runtime.setError(err)
		} else {
			for index := range recent {
				if strings.TrimSpace(recent[index].Provider) == "" {
					recent[index].Provider = config.Provider
				}
				if strings.TrimSpace(recent[index].Model) == "" {
					recent[index].Model = config.Model
				}
			}
			status.Recent = recent
		}
	}
	return status
}
