package chatlog

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/sjzar/chatlog/internal/chatlog/ports"
	"github.com/sjzar/chatlog/internal/chatlog/usecase"
)

const retainedControlJobs = 64

type controlJobState struct {
	job ports.ControlJob
}

func (a *Application) activeControlJob() string {
	a.jobsMu.RLock()
	defer a.jobsMu.RUnlock()
	return a.activeJob
}

func (a *Application) ControlStartAction(action ports.ControlAction) (ports.ControlJob, error) {
	if action != ports.ControlActionImageKey && action != ports.ControlActionDatabaseKey {
		return ports.ControlJob{}, fmt.Errorf("未知任务 %q", action)
	}
	a.jobsMu.Lock()
	if a.shuttingDown.Load() {
		a.jobsMu.Unlock()
		return ports.ControlJob{}, fmt.Errorf("application is shutting down")
	}
	if a.activeJob != "" {
		active := a.jobs[a.activeJob].job
		a.jobsMu.Unlock()
		return ports.ControlJob{}, fmt.Errorf("任务 %s 正在执行", active.Action)
	}
	job := ports.ControlJob{
		ID: uuid.NewString(), Action: action, Status: ports.ControlJobQueued,
		Message: "任务已加入队列", CreatedAt: time.Now(),
	}
	a.jobs[job.ID] = controlJobState{job: job}
	a.activeJob = job.ID
	a.trimJobsLocked()
	a.jobsMu.Unlock()

	a.operationMu.Lock()
	err := a.ensureLiveAccount()
	a.operationMu.Unlock()
	if err != nil {
		a.jobsMu.Lock()
		delete(a.jobs, job.ID)
		if a.activeJob == job.ID {
			a.activeJob = ""
		}
		a.jobsMu.Unlock()
		return ports.ControlJob{}, err
	}
	a.jobsMu.Lock()
	if a.shuttingDown.Load() {
		delete(a.jobs, job.ID)
		if a.activeJob == job.ID {
			a.activeJob = ""
		}
		a.jobsMu.Unlock()
		return ports.ControlJob{}, fmt.Errorf("application is shutting down")
	}
	a.workWG.Add(1)
	a.jobsMu.Unlock()

	go a.runControlJob(job.ID)
	return job, nil
}

func (a *Application) runControlJob(id string) {
	defer a.workWG.Done()
	a.operationMu.Lock()
	defer a.operationMu.Unlock()
	defer func() {
		a.jobsMu.Lock()
		if a.activeJob == id {
			a.activeJob = ""
		}
		a.jobsMu.Unlock()
	}()
	now := time.Now()
	a.updateControlJob(id, func(job *ports.ControlJob) {
		job.Status = ports.ControlJobRunning
		job.Message = "任务正在执行"
		job.StartedAt = &now
	})
	progress := func(message string) {
		message = strings.TrimSpace(message)
		if message == "" {
			return
		}
		a.updateControlJob(id, func(job *ports.ControlJob) { job.Message = message })
	}

	job, found := a.ControlJob(id)
	if !found {
		return
	}
	var err error
	switch job.Action {
	case ports.ControlActionImageKey:
		var captured usecase.CapturedKeys
		captured, err = a.keys.GetImageKey(a.lifecycleContext(), progress)
		if err == nil {
			err = a.commitImageKeyLocked(captured)
		}
	case ports.ControlActionDatabaseKey:
		var captured usecase.CapturedKeys
		captured, err = a.keys.CaptureDataKey(a.lifecycleContext(), progress)
		if err == nil {
			err = a.commitDataKeyLocked(captured)
		} else {
			_ = a.ensureLiveAccount()
		}
	}
	finished := time.Now()
	a.updateControlJob(id, func(job *ports.ControlJob) {
		job.FinishedAt = &finished
		if err != nil {
			job.Status = ports.ControlJobFailed
			job.Error = err.Error()
			job.Message = "任务执行失败"
		} else {
			job.Status = ports.ControlJobSucceeded
			job.Message = "任务已完成"
		}
	})
}

func (a *Application) updateControlJob(id string, update func(*ports.ControlJob)) {
	a.jobsMu.Lock()
	defer a.jobsMu.Unlock()
	state, ok := a.jobs[id]
	if !ok {
		return
	}
	update(&state.job)
	a.jobs[id] = state
}

func (a *Application) ControlJob(id string) (ports.ControlJob, bool) {
	a.jobsMu.RLock()
	defer a.jobsMu.RUnlock()
	state, ok := a.jobs[strings.TrimSpace(id)]
	return state.job, ok
}

func (a *Application) trimJobsLocked() {
	if len(a.jobs) <= retainedControlJobs {
		return
	}
	items := make([]ports.ControlJob, 0, len(a.jobs))
	for _, state := range a.jobs {
		items = append(items, state.job)
	}
	sort.Slice(items, func(i, j int) bool { return items[i].CreatedAt.Before(items[j].CreatedAt) })
	for len(a.jobs) > retainedControlJobs && len(items) > 0 {
		oldest := items[0]
		items = items[1:]
		if oldest.ID != a.activeJob {
			delete(a.jobs, oldest.ID)
		}
	}
}

func (a *Application) GetImageKeyWithStatus(onStatus func(string)) error {
	a.operationMu.Lock()
	defer a.operationMu.Unlock()
	if err := a.ensureLiveAccount(); err != nil {
		return err
	}
	captured, err := a.keys.GetImageKey(a.lifecycleContext(), onStatus)
	if err != nil {
		return err
	}
	return a.commitImageKeyLocked(captured)
}

func (a *Application) RestartAndGetDataKey(onStatus func(string)) error {
	a.operationMu.Lock()
	defer a.operationMu.Unlock()
	if err := a.ensureLiveAccount(); err != nil {
		return err
	}
	captured, err := a.keys.CaptureDataKey(a.lifecycleContext(), onStatus)
	if err != nil {
		_ = a.ensureLiveAccount()
		return err
	}
	return a.commitDataKeyLocked(captured)
}

func (a *Application) commitImageKeyLocked(captured usecase.CapturedKeys) error {
	releaseAccount := func() {}
	if a.http != nil {
		releaseAccount = a.http.LockAccountRequests()
	}
	defer releaseAccount()
	if err := a.store.CommitKeys(captured.Account, captured.DataDir, "", captured.ImageKey); err != nil {
		return err
	}
	a.refreshMediaKeys()
	if a.http != nil {
		a.http.InvalidateAccountCaches()
	}
	return nil
}

func (a *Application) commitDataKeyLocked(captured usecase.CapturedKeys) error {
	releaseAccount := func() {}
	runtimeSuspended := false
	runtimeWasActive := false
	if a.http != nil {
		runtimeWasActive = a.http.AccountRuntimeActive()
		releaseAccount = a.http.SuspendAccountRuntime()
		runtimeSuspended = true
	}
	defer releaseAccount()
	if err := a.store.CommitKeys(captured.Account, captured.DataDir, captured.DataKey, ""); err != nil {
		if runtimeSuspended {
			if resumeErr := a.restoreAccountRuntime(runtimeWasActive); resumeErr != nil {
				return errors.Join(err, fmt.Errorf("恢复账号运行时: %w", resumeErr))
			}
		}
		return err
	}
	return a.restartDatabaseAfterSuspendLocked()
}
