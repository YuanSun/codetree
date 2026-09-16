package ports

import "time"

// ControlPlane is the application-facing contract used by the Web console.
// Transport code depends on this interface rather than the application
// runtime, configuration store, or platform adapters.
type ControlPlane interface {
	ControlSnapshot() ControlSnapshot
	ControlAccounts() []ControlAccount
	ControlUpdate(ControlConfigPatch) (ControlSnapshot, error)
	ControlSelect(ControlAccountSelector) (ControlSnapshot, error)
	ControlStartAction(ControlAction) (ControlJob, error)
	ControlJob(id string) (ControlJob, bool)
	ControlLockAccount(account string) (release func(), err error)
}

type ControlSnapshot struct {
	Account          string `json:"account"`
	PID              int    `json:"pid"`
	Status           string `json:"status"`
	ExePath          string `json:"exe_path"`
	Platform         string `json:"platform"`
	Version          int    `json:"version"`
	FullVersion      string `json:"full_version"`
	DataDir          string `json:"data_dir"`
	WorkDir          string `json:"work_dir"`
	DataKeyPresent   bool   `json:"data_key_present"`
	ImageKeyPresent  bool   `json:"image_key_present"`
	HTTPAddr         string `json:"http_addr"`
	HTTPRunning      bool   `json:"http_running"`
	DatabaseReady    bool   `json:"database_ready"`
	DatabaseError    string `json:"database_error,omitempty"`
	LogRetentionDays int    `json:"log_retention_days"`
	RestartRequired  bool   `json:"restart_required"`
}

type ControlAccount struct {
	Source      string `json:"source"`
	Account     string `json:"account"`
	PID         uint32 `json:"pid,omitempty"`
	DataDir     string `json:"data_dir,omitempty"`
	WorkDir     string `json:"work_dir,omitempty"`
	Status      string `json:"status,omitempty"`
	Platform    string `json:"platform,omitempty"`
	Version     int    `json:"version,omitempty"`
	FullVersion string `json:"full_version,omitempty"`
	Current     bool   `json:"current"`
}

// ControlConfigPatch uses pointers so an omitted field is distinct from an
// explicit empty value. Empty secrets clear the corresponding stored key.
type ControlConfigPatch struct {
	HTTPAddr         *string `json:"http_addr,omitempty"`
	WorkDir          *string `json:"work_dir,omitempty"`
	DataDir          *string `json:"data_dir,omitempty"`
	DataKey          *string `json:"data_key,omitempty"`
	ImageKey         *string `json:"image_key,omitempty"`
	LogRetentionDays *int    `json:"log_retention_days,omitempty"`
}

type ControlAccountSelector struct {
	PID     int    `json:"pid,omitempty"`
	Account string `json:"account,omitempty"`
}

type ControlAction string

const (
	ControlActionImageKey    ControlAction = "image-key"
	ControlActionDatabaseKey ControlAction = "database-key"
)

type ControlJobStatus string

const (
	ControlJobQueued    ControlJobStatus = "queued"
	ControlJobRunning   ControlJobStatus = "running"
	ControlJobSucceeded ControlJobStatus = "succeeded"
	ControlJobFailed    ControlJobStatus = "failed"
)

type ControlJob struct {
	ID         string           `json:"id"`
	Action     ControlAction    `json:"action"`
	Status     ControlJobStatus `json:"status"`
	Message    string           `json:"message"`
	Error      string           `json:"error,omitempty"`
	CreatedAt  time.Time        `json:"created_at"`
	StartedAt  *time.Time       `json:"started_at,omitempty"`
	FinishedAt *time.Time       `json:"finished_at,omitempty"`
}
