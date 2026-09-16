//go:build darwin

package chatlog

import (
	"fmt"
	"os/exec"
	"strings"
)

func openBrowser(address string) error {
	address = strings.TrimSpace(address)
	if address == "" {
		return fmt.Errorf("web console address is empty")
	}
	if !strings.HasPrefix(address, "http://") && !strings.HasPrefix(address, "https://") {
		address = "http://" + address
	}
	return exec.Command("/usr/bin/open", address).Start()
}

func OpenWebConsole(address string) error {
	return openBrowser(address)
}
