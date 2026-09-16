package dat2img

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/google/uuid"
)

const (
	ENV_FFMPEG_PATH = "FFMPEG_PATH"
	MinRatio        = 0.6
)

var (
	FFmpegMode = false
	FFMpegPath = "ffmpeg"
)

func init() {
	ffmpegPath := os.Getenv(ENV_FFMPEG_PATH)
	if len(ffmpegPath) > 0 {
		FFmpegMode = true
		FFMpegPath = ffmpegPath
	}
	if isFFmpegAvailable() {
		FFmpegMode = true
	}
}

func Wxam2pic(data []byte) ([]byte, string, error) {

	if len(data) < 15 || !bytes.Equal(data[0:4], WXGF.Header) {
		return nil, "", fmt.Errorf("invalid wxgf")
	}

	partitions, err := findDataPartition(data)
	if err != nil {
		return nil, "", err
	}

	if partitions.LikeAnime() {
		// Alternating partitions contain the alpha mask and animation streams.
		animeFrames := make([][]byte, 0)
		maskFrames := make([][]byte, 0)
		for i, partition := range partitions.Partitions {
			if i%2 == 0 {
				maskFrames = append(maskFrames, data[partition.Offset:partition.Offset+partition.Size])
			} else {
				animeFrames = append(animeFrames, data[partition.Offset:partition.Offset+partition.Size])
			}
		}
		gifData, err := ConvertAnime2GIF(animeFrames, maskFrames)
		if err != nil {
			return nil, "", err
		}
		return gifData, "gif", nil
	}

	offset := partitions.Partitions[partitions.MaxIndex].Offset
	size := partitions.Partitions[partitions.MaxIndex].Size

	if FFmpegMode {
		jpgData, err := Convert2JPG(data[offset : offset+size])
		if err != nil {
			return nil, "", err
		}
		return jpgData, JPG.Ext, nil
	}
	if out, ext, ok := extractEmbeddedImage(data); ok {
		return out, ext, nil
	}
	return nil, "", fmt.Errorf("ffmpeg is not available, cannot convert this type of wxgf image")
}

func extractEmbeddedImage(data []byte) ([]byte, string, bool) {
	type sig struct {
		pat []byte
		ext string
	}
	sigs := []sig{
		{pat: []byte{0xFF, 0xD8, 0xFF}, ext: "jpg"},
		{pat: []byte{0x89, 0x50, 0x4E, 0x47}, ext: "png"},
		{pat: []byte{0x47, 0x49, 0x46, 0x38}, ext: "gif"},
		{pat: []byte{0x42, 0x4D}, ext: "bmp"},
	}
	for _, s := range sigs {
		if idx := bytes.Index(data, s.pat); idx >= 0 && idx < len(data) {
			return data[idx:], s.ext, true
		}
	}
	return nil, "", false
}

type Partitions struct {
	Partitions []Partition
	MaxRatio   float64
	MaxIndex   int
}

func (p *Partitions) LikeAnime() bool {
	return len(p.Partitions) > 1 && p.MaxRatio < MinRatio
}

type Partition struct {
	Offset int
	Size   int
	Ratio  float64
}

func findDataPartition(data []byte) (*Partitions, error) {

	headerLen := int(data[4])
	if headerLen >= len(data) {
		return nil, fmt.Errorf("invalid wxgf")
	}

	patterns := [][]byte{
		{0x00, 0x00, 0x00, 0x01},
		{0x00, 0x00, 0x01},
	}

	for _, pattern := range patterns {
		ret := &Partitions{
			Partitions: make([]Partition, 0),
		}
		offset := 0
		for {
			if headerLen+offset > len(data) {
				break
			}

			index := bytes.Index(data[headerLen+offset:], pattern)
			if index == -1 {
				break
			}

			absIndex := headerLen + offset + index

			if absIndex < 4 {
				offset += index + 1
				continue
			}

			length := int(data[absIndex-4])<<24 | int(data[absIndex-3])<<16 |
				int(data[absIndex-2])<<8 | int(data[absIndex-1])

			if length <= 0 || absIndex+length > len(data) {
				offset += index + 1
				continue
			}

			partition := Partition{
				Offset: absIndex,
				Size:   length,
				Ratio:  float64(length) / float64(len(data)),
			}
			ret.Partitions = append(ret.Partitions, partition)
			if partition.Ratio > ret.MaxRatio {
				ret.MaxRatio = partition.Ratio
				ret.MaxIndex = len(ret.Partitions) - 1
			}
			offset += index + length
		}

		if len(ret.Partitions) > 0 {
			return ret, nil
		}
	}

	return nil, fmt.Errorf("no partition found")
}

func Convert2JPG(data []byte) ([]byte, error) {
	cmd := exec.Command(FFMpegPath,
		"-i", "-",
		"-vframes", "1",
		"-c:v", "mjpeg",
		"-q:v", "4",
		"-f", "image2",
		"-")

	var stdout, stderr bytes.Buffer
	cmd.Stdin = bytes.NewReader(data)
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("ffmpeg failed: %w", err)
	}

	jpegData := stdout.Bytes()
	if len(jpegData) == 0 {
		return nil, fmt.Errorf("ffmpeg output is empty")
	}

	return jpegData, nil
}

func writeTempFile(data [][]byte) (string, error) {
	path := filepath.Join(os.TempDir(), fmt.Sprintf("anime-%s", uuid.New().String()))
	file, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return "", fmt.Errorf("failed to open anime temp file: %w", err)
	}
	defer file.Close()
	for _, frame := range data {
		_, err := file.Write(frame)
		if err != nil {
			return "", fmt.Errorf("failed to write anime frame to temp file: %w", err)
		}
	}
	return path, nil
}

// ConvertAnime2GIF gives ffmpeg two independent temporary input streams so it
// can merge animation and alpha-mask frames into a GIF.
func ConvertAnime2GIF(animeFrames [][]byte, maskFrames [][]byte) ([]byte, error) {
	animeFilePath, err := writeTempFile(animeFrames)
	if err != nil {
		return nil, fmt.Errorf("failed to write anime temp file: %w", err)
	}
	defer os.Remove(animeFilePath)

	maskFilePath, err := writeTempFile(maskFrames)
	if err != nil {
		return nil, fmt.Errorf("failed to write mask temp file: %w", err)
	}
	defer os.Remove(maskFilePath)

	cmd := exec.Command(FFMpegPath,
		"-i", animeFilePath,
		"-i", maskFilePath,
		"-filter_complex", "[0:v][1:v]alphamerge,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
		"-f", "gif",
		"-")

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("ffmpeg failed: %w", err)
	}

	gifData := stdout.Bytes()
	if len(gifData) == 0 {
		return nil, fmt.Errorf("ffmpeg output is empty")
	}

	return gifData, nil
}

func isFFmpegAvailable() bool {
	cmd := exec.Command(FFMpegPath, "-version")
	return cmd.Run() == nil
}
