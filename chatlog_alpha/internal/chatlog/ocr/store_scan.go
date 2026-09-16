package ocr

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

const recordSelect = `SELECT id, talker, talker_name, sender, sender_name, is_self,
	message_time, message_seq, db_local_id, message_id, media_key, media_path,
	content_hash, provider, model, description, ocr_text, markdown, layout_json,
	status, error, attempts, next_attempt_at, created_at, updated_at
	FROM image_ocr`

func recordSelectColumns(prefix string) string {
	p := ""
	if prefix != "" {
		p = prefix + "."
	}
	columns := []string{
		p + "id", p + "talker", p + "talker_name", p + "sender", p + "sender_name", p + "is_self",
		p + "message_time", p + "message_seq", p + "db_local_id", p + "message_id", p + "media_key",
		p + "media_path",
		p + "content_hash", p + "provider", p + "model", p + "description",
		p + "ocr_text", p + "markdown", p + "layout_json", p + "status", p + "error", p + "attempts",
		p + "next_attempt_at", p + "created_at", p + "updated_at",
	}
	return "SELECT " + strings.Join(columns, ", ")
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanRecord(row rowScanner) (*Record, error) {
	record := &Record{}
	var isSelf int
	var layout string
	err := row.Scan(
		&record.ID, &record.Talker, &record.TalkerName, &record.Sender,
		&record.SenderName, &isSelf, &record.MessageTime, &record.MessageSeq,
		&record.DBLocalID, &record.MessageID, &record.MediaKey, &record.MediaPath,
		&record.ContentHash, &record.Provider, &record.Model, &record.Description,
		&record.OCRText, &record.Markdown, &layout, &record.Status, &record.Error,
		&record.Attempts, &record.NextAttemptAt, &record.CreatedAt, &record.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	record.IsSelf = isSelf != 0
	if strings.TrimSpace(layout) != "" && json.Valid([]byte(layout)) {
		record.Layout = json.RawMessage(layout)
	}
	return record, nil
}

func scanRecordWithRank(row rowScanner) (*Record, error) {
	record := &Record{}
	var isSelf int
	var layout string
	err := row.Scan(
		&record.ID, &record.Talker, &record.TalkerName, &record.Sender,
		&record.SenderName, &isSelf, &record.MessageTime, &record.MessageSeq,
		&record.DBLocalID, &record.MessageID, &record.MediaKey, &record.MediaPath,
		&record.ContentHash, &record.Provider, &record.Model, &record.Description,
		&record.OCRText, &record.Markdown, &layout, &record.Status, &record.Error,
		&record.Attempts, &record.NextAttemptAt, &record.CreatedAt, &record.UpdatedAt,
		&record.Rank,
	)
	if err != nil {
		return nil, err
	}
	record.IsSelf = isSelf != 0
	if strings.TrimSpace(layout) != "" && json.Valid([]byte(layout)) {
		record.Layout = json.RawMessage(layout)
	}
	return record, nil
}

const enqueueImageSQL = `INSERT OR IGNORE INTO image_ocr (
		talker, talker_name, sender, sender_name, is_self, message_time, message_seq,
		db_local_id, message_id, media_key, media_path,
		status, created_at, updated_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

const advanceOCRCursorSQL = `INSERT INTO image_ocr_cursor(talker, message_time, db_local_id, updated_at)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(talker) DO UPDATE SET
			message_time = excluded.message_time,
			db_local_id = excluded.db_local_id,
			updated_at = excluded.updated_at
		WHERE excluded.message_time > image_ocr_cursor.message_time
		   OR (excluded.message_time = image_ocr_cursor.message_time
		       AND excluded.db_local_id > image_ocr_cursor.db_local_id)`

// ApplyScanBatch atomically enqueues the image references discovered in one
// message page and advances the talker cursor once. Keeping both operations in
// one transaction avoids two SQLite commits per image while preserving crash
// semantics: the cursor never moves past an image that was not durably queued.
func (s *Store) ApplyScanBatch(
	ctx context.Context,
	talker string,
	refs []ImageRef,
	messageTime, localID int64,
) (int64, error) {
	result, err := s.ApplyScanBatchClassified(ctx, talker, refs, nil, messageTime, localID)
	return result.Pending, err
}

// ScanBatchResult separates actual OCR work from records waiting for a usable
// local image. Thumbnail-only records are durable but never counted as pending
// OCR tasks.
type ScanBatchResult struct {
	Pending      int64
	WaitingMedia int64
}

// ApplyScanBatchClassified atomically stores both ready and thumbnail-only
// references and advances the source cursor. waitingRefs use waiting_media and
// are invisible to OCR workers until the media gate promotes them.
func (s *Store) ApplyScanBatchClassified(
	ctx context.Context,
	talker string,
	pendingRefs, waitingRefs []ImageRef,
	messageTime, localID int64,
) (ScanBatchResult, error) {
	if s == nil || s.db == nil {
		return ScanBatchResult{}, errors.New("OCR index is closed")
	}
	talker = strings.TrimSpace(talker)
	if talker == "" || messageTime <= 0 {
		return ScanBatchResult{}, errors.New("incomplete OCR scan cursor")
	}
	type classifiedRef struct {
		ref    ImageRef
		status string
	}
	normalized := make([]classifiedRef, 0, len(pendingRefs)+len(waitingRefs))
	appendRefs := func(refs []ImageRef, status string) error {
		for _, ref := range refs {
			ref = normalizeRef(ref)
			if ref.Talker == "" || ref.MessageTime <= 0 || (ref.MediaKey == "" && ref.MediaPath == "") {
				return errors.New("incomplete OCR image reference")
			}
			if !strings.EqualFold(ref.Talker, talker) {
				return fmt.Errorf("OCR scan reference talker mismatch: %s != %s", ref.Talker, talker)
			}
			normalized = append(normalized, classifiedRef{ref: ref, status: status})
		}
		return nil
	}
	if err := appendRefs(pendingRefs, StatusPending); err != nil {
		return ScanBatchResult{}, err
	}
	if err := appendRefs(waitingRefs, StatusWaitingMedia); err != nil {
		return ScanBatchResult{}, err
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return ScanBatchResult{}, fmt.Errorf("begin OCR scan batch: %w", err)
	}
	defer tx.Rollback()
	now := time.Now().Unix()
	var inserted ScanBatchResult
	for _, item := range normalized {
		ref := item.ref
		result, execErr := tx.ExecContext(ctx, enqueueImageSQL,
			ref.Talker, ref.TalkerName, ref.Sender, ref.SenderName, boolInt(ref.IsSelf),
			ref.MessageTime, ref.MessageSeq, ref.DBLocalID, ref.MessageID, ref.MediaKey,
			ref.MediaPath, item.status, now, now,
		)
		if execErr != nil {
			return ScanBatchResult{}, fmt.Errorf("enqueue OCR scan batch: %w", execErr)
		}
		affected, _ := result.RowsAffected()
		if item.status == StatusWaitingMedia {
			inserted.WaitingMedia += affected
		} else {
			inserted.Pending += affected
		}
		if affected == 0 && item.status == StatusPending {
			promoted, promoteErr := tx.ExecContext(ctx, `UPDATE image_ocr SET
				status = 'pending', error = '', next_attempt_at = 0, updated_at = ?
				WHERE talker = ? AND message_time = ? AND db_local_id = ?
				  AND media_key = ? AND media_path = ? AND status = 'waiting_media'`,
				now, ref.Talker, ref.MessageTime, ref.DBLocalID, ref.MediaKey, ref.MediaPath,
			)
			if promoteErr != nil {
				return ScanBatchResult{}, fmt.Errorf("promote OCR scan media waiter: %w", promoteErr)
			}
			promotedRows, _ := promoted.RowsAffected()
			inserted.Pending += promotedRows
		}
	}
	if _, err = tx.ExecContext(ctx, advanceOCRCursorSQL, talker, messageTime, localID, now); err != nil {
		return ScanBatchResult{}, fmt.Errorf("advance OCR scan cursor: %w", err)
	}
	if err = tx.Commit(); err != nil {
		return ScanBatchResult{}, fmt.Errorf("commit OCR scan batch: %w", err)
	}
	return inserted, nil
}
