package version

import "runtime/debug"

var (
	Version = "(dev)"
)

func init() {
	if bi, ok := debug.ReadBuildInfo(); ok {
		if len(bi.Main.Version) > 0 {
			Version = bi.Main.Version
		}
	}
}
