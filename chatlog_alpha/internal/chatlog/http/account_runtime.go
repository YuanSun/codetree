package http

import (
	"sync"

	"github.com/rs/zerolog/log"
)

// SuspendAccountRuntime takes the account-request writer lease and detaches
// every account-scoped worker while leaving the listener and control plane
// alive. The caller must invoke the returned release function after the whole
// stop/swap/start transaction finishes.
func (s *Service) SuspendAccountRuntime() func() {
	if s == nil {
		return func() {}
	}
	release := s.LockAccountRequests()
	s.accountRuntimeActive.Store(false)
	s.stopOCRRuntime()
	s.detachEventMessageStream()
	s.clearRuntimeCaches()
	s.resetAccountEventStream("account_suspended")
	return release
}

// LockAccountRequests prevents account-scoped handlers from observing a
// partially published configuration or media-key update. It leaves background
// producers attached; callers must always invoke the returned release function.
func (s *Service) LockAccountRequests() func() {
	if s == nil {
		return func() {}
	}
	s.accountRequests.Lock()
	var releaseOnce sync.Once
	return func() { releaseOnce.Do(s.accountRequests.Unlock) }
}

// AccountRuntimeActive reports the state that a transition must restore when
// persistence fails before the database has been replaced.
func (s *Service) AccountRuntimeActive() bool {
	return s != nil && s.accountRuntimeActive.Load()
}

// ResumeAccountRuntime binds OCR and the message event bridge to the currently
// selected database runtime. It is invoked after every successful account
// start, including the initial asynchronous startup.
func (s *Service) ResumeAccountRuntime() error {
	if s == nil {
		return nil
	}
	s.clearRuntimeCaches()
	s.resetAccountEventStream("account_changed")
	if err := s.startOCRRuntime(); err != nil {
		log.Error().Err(err).Msg("OCR runtime unavailable; account database remains online")
	}
	s.attachEventMessageStream()
	s.accountRuntimeActive.Store(true)
	s.wakeEventStream()
	return nil
}

// PublishControlOnlyAccount completes an account transition whose database is
// not configured. It publishes the new selection generation while keeping
// account data producers inactive.
func (s *Service) PublishControlOnlyAccount() {
	if s == nil {
		return
	}
	s.accountRuntimeActive.Store(false)
	s.clearRuntimeCaches()
	s.configureOCRLocalService()
	s.resetAccountEventStream("account_changed")
	s.wakeEventStream()
}

func (s *Service) resetAccountEventStream(name string) {
	generation := s.accountGeneration.Add(1)
	payload := map[string]interface{}{"generation": generation}
	if s.control != nil {
		snapshot := s.control.ControlSnapshot()
		payload["account"] = snapshot.Account
		payload["pid"] = snapshot.PID
		payload["status"] = snapshot.Status
	}
	s.eventMu.Lock()
	hub := s.events
	s.eventMu.Unlock()
	if hub != nil {
		if err := hub.resetAndBroadcast(generation, name, payload); err != nil {
			log.Debug().Err(err).Msg("account event stream reset failed")
		}
	}
}

// InvalidateAccountCaches discards values derived from account paths or media
// keys without restarting the HTTP listener.
func (s *Service) InvalidateAccountCaches() {
	if s == nil {
		return
	}
	s.clearRuntimeCaches()
	s.configureOCRLocalService()
	log.Debug().Msg("account-scoped HTTP caches cleared")
}
