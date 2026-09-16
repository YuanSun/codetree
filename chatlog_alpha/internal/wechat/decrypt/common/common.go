package common

import (
	"bytes"
	"fmt"
	"io"
	"os"

	"github.com/sjzar/chatlog/internal/errors"
)

const (
	KeySize      = 32
	SaltSize     = 16
	AESBlockSize = 16
	SQLiteHeader = "SQLite format 3\x00"
	IVSize       = 16
)

type DBFile struct {
	Path       string
	Salt       []byte
	TotalPages int64
	FirstPage  []byte
}

func OpenDBFile(dbPath string, pageSize int) (*DBFile, error) {
	fp, err := os.Open(dbPath)
	if err != nil {
		return nil, errors.OpenFileFailed(dbPath, err)
	}
	defer fp.Close()

	fileInfo, err := fp.Stat()
	if err != nil {
		return nil, errors.StatFileFailed(dbPath, err)
	}

	fileSize := fileInfo.Size()
	totalPages := fileSize / int64(pageSize)
	if fileSize%int64(pageSize) > 0 {
		totalPages++
	}

	buffer := make([]byte, pageSize)
	n, err := io.ReadFull(fp, buffer)
	if err != nil {
		return nil, errors.ReadFileFailed(dbPath, err)
	}
	if n != pageSize {
		return nil, errors.IncompleteRead(fmt.Errorf("read %d bytes, expected %d", n, pageSize))
	}

	if bytes.Equal(buffer[:len(SQLiteHeader)], []byte(SQLiteHeader)) {
		return nil, errors.ErrAlreadyDecrypted
	}

	return &DBFile{
		Path:       dbPath,
		Salt:       buffer[:SaltSize],
		FirstPage:  buffer,
		TotalPages: totalPages,
	}, nil
}

func XorBytes(a []byte, b byte) []byte {
	result := make([]byte, len(a))
	for i := range a {
		result[i] = a[i] ^ b
	}
	return result
}
