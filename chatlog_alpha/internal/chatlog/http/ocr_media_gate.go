package http

import (
	"fmt"
	"path/filepath"
	"time"

	"github.com/sjzar/chatlog/internal/chatlog/ocr"
)

const ocrWaitingMediaDetail = "仅检测到缩略图，等待中图/原图落盘；未进入 OCR 识别队列"

func stopAndDrainTimer(timer *time.Timer) {
	if timer == nil || timer.Stop() {
		return
	}
	select {
	case <-timer.C:
	default:
	}
}

func (runtime *imageOCRRuntime) wakeMediaGate() {
	if runtime == nil || runtime.mediaWake == nil {
		return
	}
	select {
	case runtime.mediaWake <- struct{}{}:
	default:
	}
}

// classifyOCRRefs applies the strict quality boundary before records are made
// visible to OCR workers. Thumbnail-only records are persisted as media
// waiters, not pending OCR tasks.
func (s *Service) classifyOCRRefs(refs []ocr.ImageRef) (pending, waiting []ocr.ImageRef) {
	pending = make([]ocr.ImageRef, 0, len(refs))
	waiting = make([]ocr.ImageRef, 0, len(refs))
	for _, ref := range refs {
		if ready, _ := s.ocrImageReady(ref); ready {
			pending = append(pending, ref)
		} else {
			waiting = append(waiting, ref)
		}
	}
	return pending, waiting
}

// ocrImageReady checks only local paths and quality markers; it never reads or
// decodes image bytes and never submits an OCR request.
func (s *Service) ocrImageReady(ref ocr.ImageRef) (bool, string) {
	path := s.resolveOCRImagePath(ref)
	if isOCRThumbnailPath(path) && s.wasOCRImageReceiveUpgraded(ref) {
		if normalPath := publishUpgradedOCRImage(path); normalPath != "" {
			return true, normalPath
		}
	}
	if !ocrImagePathUsable(path) {
		return false, path
	}
	return true, path
}

// refreshOCRMediaGate demotes thumbnail-only unfinished rows and promotes only
// those waiters for which a usable local image now exists.
func (s *Service) refreshOCRMediaGate(runtime *imageOCRRuntime) (waiting, promoted int, err error) {
	if runtime == nil || runtime.store == nil || runtime.ctx == nil {
		return 0, 0, nil
	}
	records, err := runtime.store.MediaGateRecords(runtime.ctx, 1000)
	if err != nil {
		return 0, 0, fmt.Errorf("list OCR media gate: %w", err)
	}
	watchDirs := make(map[string]struct{})
	for i := range records {
		record := &records[i]
		ready, path := s.ocrImageReady(record.ImageRef)
		if ready {
			if record.Status == ocr.StatusWaitingMedia {
				changed, markErr := runtime.store.MarkMediaReady(runtime.ctx, record.ID)
				if markErr != nil {
					return waiting, promoted, markErr
				}
				if changed {
					promoted++
				}
			}
			continue
		}
		waiting++
		if dir := s.ocrMediaWatchDir(record.ImageRef, path); dir != "" {
			watchDirs[dir] = struct{}{}
		}
		if record.Status != ocr.StatusWaitingMedia {
			if _, markErr := runtime.store.MarkWaitingMedia(runtime.ctx, record.ID, ocrWaitingMediaDetail); markErr != nil {
				return waiting, promoted, markErr
			}
		}
	}
	if watchErr := s.syncOCRMediaWatchDirs(runtime, watchDirs); watchErr != nil {
		return waiting, promoted, watchErr
	}
	return waiting, promoted, nil
}

// runOCRMediaGate performs bounded local filesystem checks after media events.
func (s *Service) runOCRMediaGate(runtime *imageOCRRuntime) {
	defer runtime.wg.Done()
	for {
		select {
		case <-runtime.ctx.Done():
			return
		case <-runtime.mediaWake:
		}
		deadline := time.Now().Add(30 * time.Second)
		for {
			waiting, promoted, err := s.refreshOCRMediaGate(runtime)
			if err != nil {
				if runtime.ctx.Err() != nil {
					return
				}
				runtime.setError(err)
				break
			}
			if promoted > 0 {
				runtime.mu.Lock()
				runtime.enqueued += uint64(promoted)
				runtime.mu.Unlock()
				runtime.wakeWorker()
			}
			if waiting == 0 || time.Now().After(deadline) {
				break
			}
			delay := 250 * time.Millisecond
			if time.Until(deadline) < 25*time.Second {
				delay = time.Second
			}
			timer := time.NewTimer(delay)
			select {
			case <-runtime.ctx.Done():
				stopAndDrainTimer(timer)
				return
			case <-runtime.mediaWake:
				stopAndDrainTimer(timer)
				deadline = time.Now().Add(30 * time.Second)
			case <-timer.C:
			}
		}
	}
}

func (s *Service) ensureOCRRecordMediaReady(runtime *imageOCRRuntime, record *ocr.Record) bool {
	if runtime == nil || record == nil {
		return false
	}
	ready, path := s.ocrImageReady(record.ImageRef)
	if ready {
		return true
	}
	detail := ocrWaitingMediaDetail
	if path != "" {
		detail += "（" + filepath.Base(path) + "）"
	}
	if _, err := runtime.store.MarkWaitingMedia(runtime.ctx, record.ID, detail); err != nil {
		runtime.setError(err)
		return false
	}
	runtime.wakeMediaGate()
	return false
}
