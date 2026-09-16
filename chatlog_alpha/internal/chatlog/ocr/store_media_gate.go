package ocr

import (
	"context"
	"errors"
	"time"
)

// MediaGateRecords returns unfinished records whose local image quality must be
// checked before an OCR request is allowed. Completed records are never
// reconsidered by this gate.
func (s *Store) MediaGateRecords(ctx context.Context, limit int) ([]Record, error) {
	if s == nil || s.db == nil {
		return nil, errors.New("OCR index is closed")
	}
	if limit <= 0 || limit > 1000 {
		limit = 1000
	}
	rows, err := s.db.QueryContext(ctx, recordSelect+`
		WHERE status IN ('waiting_media', 'pending', 'failed')
		ORDER BY CASE status WHEN 'waiting_media' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
		         updated_at ASC, id ASC
		LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	records := make([]Record, 0, limit)
	for rows.Next() {
		record, scanErr := scanRecord(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		records = append(records, *record)
	}
	return records, rows.Err()
}

// MarkWaitingMedia removes a thumbnail-only record from the OCR work queue.
// It remains durable so a later mid/big/HD file can promote it without losing
// the message cursor across restarts.
func (s *Store) MarkWaitingMedia(ctx context.Context, id int64, detail string) (bool, error) {
	if s == nil || s.db == nil {
		return false, errors.New("OCR index is closed")
	}
	result, err := s.db.ExecContext(ctx, `UPDATE image_ocr SET
		status = 'waiting_media', error = ?, next_attempt_at = 0, updated_at = ?
		WHERE id = ? AND status IN ('pending', 'failed')`, detail, time.Now().Unix(), id)
	if err != nil {
		return false, err
	}
	affected, _ := result.RowsAffected()
	return affected > 0, nil
}

// MarkMediaReady promotes only a media waiter. Existing failed OCR requests
// keep their retry schedule; the gate is concerned solely with file quality.
func (s *Store) MarkMediaReady(ctx context.Context, id int64) (bool, error) {
	if s == nil || s.db == nil {
		return false, errors.New("OCR index is closed")
	}
	result, err := s.db.ExecContext(ctx, `UPDATE image_ocr SET
		status = 'pending', error = '', next_attempt_at = 0, updated_at = ?
		WHERE id = ? AND status = 'waiting_media'`, time.Now().Unix(), id)
	if err != nil {
		return false, err
	}
	affected, _ := result.RowsAffected()
	return affected > 0, nil
}
