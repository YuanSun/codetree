package chatlog

import (
	"errors"
	"fmt"

	"github.com/sjzar/chatlog/internal/chatlog"
	"github.com/sjzar/chatlog/pkg/process"
	"github.com/sjzar/chatlog/pkg/util"
	"github.com/sjzar/chatlog/pkg/version"

	"github.com/spf13/cobra"
)

func init() {
	cobra.MousetrapHelpText = ""

	rootCmd.PersistentFlags().BoolVar(&Debug, "debug", false, "debug")
	rootCmd.PersistentPreRun = initLog
	rootCmd.Version = version.Version
	rootCmd.SetVersionTemplate("{{.Version}}\n")
}

func Execute() error {
	defer closeLogFile()
	return rootCmd.Execute()
}

var rootCmd = &cobra.Command{
	Use:   "chatlog",
	Short: "chatlog",
	Long:  `chatlog`,
	Example: `chatlog api catalog
chatlog api call sessions --param limit=20
chatlog ops status`,
	SilenceUsage:  true,
	SilenceErrors: true,
	Args:          cobra.MinimumNArgs(0),
	CompletionOptions: cobra.CompletionOptions{
		HiddenDefaultCmd: true,
	},
	RunE: Root,
}

func Root(cmd *cobra.Command, args []string) error {
	instance, err := process.AcquireSingleInstance(util.AppRootDir())
	if err != nil {
		var running *process.AlreadyRunningError
		if errors.As(err, &running) {
			if running.Address == "" {
				return fmt.Errorf("running chatlog process has not published its Web address yet")
			}
			return chatlog.OpenWebConsole(running.Address)
		}
		return fmt.Errorf("acquire chatlog instance: %w", err)
	}
	defer instance.Close()

	application := chatlog.NewApplication()
	if err := application.Initialize(""); err != nil {
		return fmt.Errorf("initialize chatlog: %w", err)
	}
	if err := application.Run("", instance.SetAddress); err != nil {
		return fmt.Errorf("run chatlog: %w", err)
	}
	return nil
}
