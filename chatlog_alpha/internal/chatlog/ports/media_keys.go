package ports

type MediaKeys interface {
	Configure(dataDir, imageKey string)
	UpdateImageKey(dataDir, imageKey string) bool
	RefreshXOR(dataDir string) (byte, error)
}

type MediaDecoder interface {
	Decode(data []byte) ([]byte, string, error)
}

// MediaCodec is the complete media capability exposed by the infrastructure
// adapter. Consumers request narrower views where possible.
type MediaCodec interface {
	MediaKeys
	MediaDecoder
}
