package http

import (
	"context"
	"sync"

	"github.com/sjzar/chatlog/internal/chatlog/ocr"
	"github.com/sjzar/chatlog/internal/wechat/imageupgrade"
)

// ocrState owns the OCR runtime, local model service, and backfill lifecycle as
// one independently synchronized subsystem.
type ocrState struct {
	runtimeMu     sync.RWMutex
	runtime       *imageOCRRuntime
	reconfigureMu sync.Mutex
	localService  *ocr.LocalServiceManager

	imageUpgradeMu      sync.RWMutex
	imageUpgrade        imageReceiveUpgrader
	imageUpgradeFactory func() imageReceiveUpgrader

	backfillMu     sync.RWMutex
	backfill       imageOCRBackfillStatus
	backfillCancel context.CancelFunc
	backfillDone   chan struct{}
}

func newOCRState() *ocrState {
	return &ocrState{imageUpgradeFactory: func() imageReceiveUpgrader {
		return imageupgrade.NewManager()
	}}
}
