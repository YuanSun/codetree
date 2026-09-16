package http

import (
	"errors"
	"os"
	"path/filepath"
	"strings"

	"github.com/rs/zerolog/log"

	"github.com/sjzar/chatlog/internal/chatlog/conf"
	"github.com/sjzar/chatlog/internal/chatlog/ocr"
	"github.com/sjzar/chatlog/internal/wechat/imageupgrade"
)

type imageReceiveUpgrader interface {
	Start(imageupgrade.Options) error
	Stop()
	Snapshot() imageupgrade.Status
}

func (s *Service) startOCRImageReceiveUpgrade(config conf.OCRConfig) {
	if s == nil || s.ocrState == nil || !config.Enabled {
		return
	}
	s.ocrState.imageUpgradeMu.Lock()
	defer s.ocrState.imageUpgradeMu.Unlock()
	if s.ocrState.imageUpgrade != nil {
		return
	}
	factory := s.ocrState.imageUpgradeFactory
	if factory == nil {
		return
	}
	manager := factory()
	if manager == nil {
		return
	}
	talkers := append(config.ListenContactsList(), config.ListenChatRoomsList()...)
	options := imageupgrade.Options{
		PID:       s.conf.GetPID(),
		ScopeAll:  config.ScopeAll(),
		Talkers:   talkers,
		StatePath: filepath.Join(filepath.Dir(s.ocrIndexPath()), "image_receive_upgrades.json"),
	}
	s.ocrState.imageUpgrade = manager
	if err := manager.Start(options); err != nil {
		log.Warn().Err(err).Int("pid", options.PID).Msg("image receive auto-download hook unavailable")
	}
}

func (s *Service) stopOCRImageReceiveUpgrade() {
	if s == nil || s.ocrState == nil {
		return
	}
	s.ocrState.imageUpgradeMu.Lock()
	manager := s.ocrState.imageUpgrade
	s.ocrState.imageUpgrade = nil
	s.ocrState.imageUpgradeMu.Unlock()
	if manager != nil {
		manager.Stop()
	}
}

func (s *Service) currentOCRImageReceiveUpgrade() imageupgrade.Status {
	if s == nil || s.ocrState == nil {
		return imageupgrade.Status{}
	}
	s.ocrState.imageUpgradeMu.RLock()
	manager := s.ocrState.imageUpgrade
	s.ocrState.imageUpgradeMu.RUnlock()
	if manager == nil {
		return imageupgrade.Status{Supported: true}
	}
	return manager.Snapshot()
}

func (s *Service) wasOCRImageReceiveUpgraded(ref ocr.ImageRef) bool {
	status := s.currentOCRImageReceiveUpgrade()
	for index := len(status.RecentUpgrades) - 1; index >= 0; index-- {
		upgrade := status.RecentUpgrades[index]
		if strings.EqualFold(strings.TrimSpace(upgrade.Talker), strings.TrimSpace(ref.Talker)) &&
			upgrade.MessageTime == ref.MessageTime && upgrade.DBLocalID == ref.DBLocalID {
			return true
		}
	}
	return false
}

func publishUpgradedOCRImage(path string) string {
	path = filepath.Clean(strings.TrimSpace(path))
	if path == "" || path == "." {
		return ""
	}
	lower := strings.ToLower(path)
	var normal string
	for _, suffix := range []string{"_thumb.dat", ".thumb.dat", "_t.dat", ".t.dat"} {
		if strings.HasSuffix(lower, suffix) {
			normal = path[:len(path)-len(suffix)] + ".dat"
			break
		}
	}
	if normal == "" || normal == path {
		return ""
	}
	source, err := os.Stat(path)
	if err != nil || !source.Mode().IsRegular() || source.Size() == 0 {
		return ""
	}
	if target, err := os.Stat(normal); err == nil && target.Mode().IsRegular() && target.Size() > 0 {
		return normal
	}
	if err := os.Link(path, normal); err != nil && !errors.Is(err, os.ErrExist) {
		return ""
	}
	return normal
}
