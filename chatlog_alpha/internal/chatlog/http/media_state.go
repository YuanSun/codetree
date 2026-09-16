package http

import (
	"net/http"
	"sync"
	"time"
)

// mediaState owns media lookup caches, network clients, concurrency limits,
// validation results, and image-key refresh throttling.
type mediaState struct {
	md5PathCache boundedCache[string, string]

	snsMediaKeyCache boundedCache[string, string]
	snsHTTPClient    *http.Client
	snsHTTPClientMu  sync.Mutex
	snsMediaSlots    chan struct{}
	snsMediaSlotOnce sync.Once

	localMediaSlots    chan struct{}
	localMediaSlotOnce sync.Once

	decodedImageValidationCache boundedCache[string, decodedImageValidationEntry]

	imgKeyRefreshMu   sync.Mutex
	lastImgKeyRefresh time.Time
}

func newMediaState() *mediaState {
	return &mediaState{
		snsHTTPClient: newPublicHTTPClient(),
	}
}
