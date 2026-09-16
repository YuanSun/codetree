package appver

type Info struct {
	FilePath    string
	Version     int
	FullVersion string
}

func New(filePath string) (*Info, error) {
	i := &Info{
		FilePath: filePath,
	}

	err := i.initialize()
	if err != nil {
		return nil, err
	}

	return i, nil
}
