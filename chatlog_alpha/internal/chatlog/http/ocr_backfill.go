package http

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/sjzar/chatlog/internal/chatlog/conf"
	"github.com/sjzar/chatlog/internal/chatlog/ocr"
	"github.com/sjzar/chatlog/internal/model"
)

func (s *Service) currentOCRBackfillStatus(config conf.OCRConfig) imageOCRBackfillStatus {
	s.ocrState.backfillMu.RLock()
	status := s.ocrState.backfill
	s.ocrState.backfillMu.RUnlock()
	status.Enabled = config.BackfillEnabled
	if status.StartedAt == 0 {
		status.ReceivedOnly = config.ReceivedOnly
		status.RespectScope = true
	}
	return status
}

func (s *Service) beginOCRBackfill(
	parent context.Context,
	limit int,
	receivedOnly bool,
	respectScope bool,
	talkers []string,
) (context.Context, error) {
	s.ocrState.backfillMu.Lock()
	defer s.ocrState.backfillMu.Unlock()
	if s.ocrState.backfill.Running {
		return nil, errors.New("OCR history backfill is already running")
	}
	ctx, cancel := context.WithCancel(parent)
	s.ocrState.backfillCancel = cancel
	s.ocrState.backfillDone = make(chan struct{})
	s.ocrState.backfill = imageOCRBackfillStatus{
		Enabled:      true,
		Running:      true,
		StartedAt:    time.Now().Unix(),
		Limit:        limit,
		ReceivedOnly: receivedOnly,
		RespectScope: respectScope,
		Talkers:      append([]string(nil), talkers...),
	}
	return ctx, nil
}

func (s *Service) updateOCRBackfillProgress(scanned, enqueued int) {
	s.ocrState.backfillMu.Lock()
	s.ocrState.backfill.Scanned = scanned
	s.ocrState.backfill.Enqueued = enqueued
	s.ocrState.backfillMu.Unlock()
}

func (s *Service) finishOCRBackfill(scanned, enqueued int, err error) {
	s.ocrState.backfillMu.Lock()
	s.ocrState.backfill.Running = false
	s.ocrState.backfill.FinishedAt = time.Now().Unix()
	s.ocrState.backfill.Scanned = scanned
	s.ocrState.backfill.Enqueued = enqueued
	if err != nil && !errors.Is(err, context.Canceled) {
		s.ocrState.backfill.Error = strings.TrimSpace(err.Error())
	} else if errors.Is(err, context.Canceled) {
		s.ocrState.backfill.Error = "已停止"
	}
	s.ocrState.backfillCancel = nil
	done := s.ocrState.backfillDone
	s.ocrState.backfillDone = nil
	s.ocrState.backfillMu.Unlock()
	if done != nil {
		close(done)
	}
}

func (s *Service) cancelOCRBackfill() bool {
	s.ocrState.backfillMu.RLock()
	cancel := s.ocrState.backfillCancel
	done := s.ocrState.backfillDone
	running := s.ocrState.backfill.Running
	s.ocrState.backfillMu.RUnlock()
	if cancel == nil || !running {
		return false
	}
	cancel()
	if done != nil {
		<-done
	}
	return true
}

func (s *Service) enqueueOCRBackfill(
	ctx context.Context,
	limit int,
	receivedOnly bool,
	respectScope bool,
	talkers []string,
) (scanned, enqueued int, err error) {
	runtime := s.currentOCRRuntime()
	if runtime == nil || runtime.store == nil {
		return 0, 0, errors.New("OCR index is not initialized")
	}
	if limit <= 0 {
		limit = 1000
	}
	if limit > 10_000 {
		limit = 10_000
	}
	sessions, err := s.db.GetSessions("", 0, 0)
	if err != nil {
		return 0, 0, err
	}
	explicitTalkers := make(map[string]struct{}, len(talkers))
	accepted := 0
	waitingMedia := 0
	for _, talker := range talkers {
		talker = strings.TrimSpace(talker)
		if talker != "" {
			explicitTalkers[strings.ToLower(talker)] = struct{}{}
		}
	}
	for _, session := range sessions.Items {
		if ctx.Err() != nil || accepted >= limit {
			break
		}
		talker := strings.TrimSpace(session.UserName)
		if talker == "" {
			continue
		}
		if len(explicitTalkers) > 0 {
			if _, ok := explicitTalkers[strings.ToLower(talker)]; !ok {
				continue
			}
		}
		if respectScope && !runtime.config.AllowsTalker(talker) {
			continue
		}
		messages, queryErr := s.db.GetMessages(time.Time{}, time.Time{}, talker, "", "", 0, 0)
		if queryErr != nil {
			runtime.setError(queryErr)
			continue
		}
		for _, message := range messages {
			if ctx.Err() != nil || accepted >= limit {
				break
			}
			scanned++
			s.updateOCRBackfillProgress(scanned, enqueued)
			if message == nil || message.Type != model.MessageTypeImage || (receivedOnly && message.IsSelf) {
				continue
			}
			ref, ok := imageOCRRef(message)
			if !ok {
				continue
			}
			status := ocr.StatusWaitingMedia
			if ready, _ := s.ocrImageReady(ref); ready {
				status = ocr.StatusPending
			}
			_, inserted, enqueueErr := runtime.store.EnqueueWithStatus(ctx, ref, status)
			if enqueueErr != nil {
				runtime.setError(enqueueErr)
				continue
			}
			if inserted {
				accepted++
				if status == ocr.StatusPending {
					enqueued++
				} else {
					waitingMedia++
				}
				s.updateOCRBackfillProgress(scanned, enqueued)
			}
		}
	}
	if enqueued > 0 {
		runtime.mu.Lock()
		runtime.enqueued += uint64(enqueued)
		runtime.mu.Unlock()
		runtime.wakeWorker()
	}
	if waitingMedia > 0 {
		runtime.wakeMediaGate()
	}
	return scanned, enqueued, ctx.Err()
}
