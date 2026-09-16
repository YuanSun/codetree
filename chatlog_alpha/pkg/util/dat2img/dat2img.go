package dat2img

import (
	"bytes"
	"crypto/aes"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// Format defines the header and extension for different image types
type Format struct {
	Header []byte
	Ext    string
}

var (
	// Common image format definitions
	JPG     = Format{Header: []byte{0xFF, 0xD8, 0xFF}, Ext: "jpg"}
	PNG     = Format{Header: []byte{0x89, 0x50, 0x4E, 0x47}, Ext: "png"}
	GIF     = Format{Header: []byte{0x47, 0x49, 0x46, 0x38}, Ext: "gif"}
	TIFF    = Format{Header: []byte{0x49, 0x49, 0x2A, 0x00}, Ext: "tiff"}
	BMP     = Format{Header: []byte{0x42, 0x4D}, Ext: "bmp"}
	WXGF    = Format{Header: []byte{0x77, 0x78, 0x67, 0x66}, Ext: "wxgf"}
	Formats = []Format{JPG, PNG, GIF, TIFF, BMP, WXGF}

	// V4 Type 1: 0x07 0x08 0x56 0x31 0x08 0x07
	V4Format1 = Format{Header: []byte{0x07, 0x08, 0x56, 0x31, 0x08, 0x07}}
	// V4 Type 2: 0x07 0x08 0x56 0x32 0x08 0x07
	V4Format2 = Format{Header: []byte{0x07, 0x08, 0x56, 0x32, 0x08, 0x07}}

	JpgTail = []byte{0xFF, 0xD9}
)

const DefaultV4XORKey byte = 0x37

var v4Format1AESKey = []byte("cfcd208495d565ef")

// Decode converts one WeChat V4 DAT payload using caller-owned account keys.
// Keeping keys outside this package prevents one account from mutating another
// account's decoder state during a Web-console account switch.
func Decode(data, imageKey []byte, xorKey byte) ([]byte, string, error) {
	if len(data) < 6 {
		return nil, "", fmt.Errorf("data length is too short: %d", len(data))
	}

	if bytes.Equal(data[:6], V4Format1.Header) {
		return DecodeV4(data, v4Format1AESKey, xorKey)
	}
	if bytes.Equal(data[:6], V4Format2.Header) {
		return DecodeV4(data, imageKey, xorKey)
	}
	return nil, "", fmt.Errorf("unknown WeChat V4 image type: %x", data[:6])
}

// calculateXorKeyV4 calculates the XOR key for WeChat v4 dat files
func calculateXorKeyV4(data []byte) (byte, error) {
	if len(data) < 2 {
		return 0, fmt.Errorf("data too short to calculate XOR key")
	}
	fileTail := data[len(data)-2:]
	xorKeys := make([]byte, 2)
	for i := 0; i < 2; i++ {
		xorKeys[i] = fileTail[i] ^ JpgTail[i]
	}
	if xorKeys[0] == xorKeys[1] {
		return xorKeys[0], nil
	}
	return 0, fmt.Errorf("inconsistent XOR key: %x", xorKeys)
}

// ScanXORKey derives the account-scoped XOR key without mutating decoder state.
func ScanXORKey(dirPath string) (byte, error) {
	var scannedKey *byte
	err := filepath.Walk(dirPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		if !strings.HasSuffix(info.Name(), "_t.dat") {
			return nil
		}
		if info.Size() < 17 {
			return nil
		}

		file, err := os.Open(path)
		if err != nil {
			return nil
		}
		defer file.Close()

		header := make([]byte, 15)
		if _, err := io.ReadFull(file, header); err != nil {
			return nil
		}

		if !bytes.Equal(header[:6], V4Format1.Header) && !bytes.Equal(header[:6], V4Format2.Header) {
			return nil
		}

		xorEncryptLen := binary.LittleEndian.Uint32(header[10:14])
		fileDataLen := info.Size() - int64(len(header))
		if xorEncryptLen < 2 || int64(xorEncryptLen) > fileDataLen {
			return nil
		}

		if _, err := file.Seek(-2, io.SeekEnd); err != nil {
			return nil
		}
		tail := make([]byte, 2)
		if _, err := io.ReadFull(file, tail); err != nil {
			return nil
		}
		key, err := calculateXorKeyV4(tail)
		if err != nil {
			return nil
		}

		scannedKey = &key
		return filepath.SkipAll
	})

	if err != nil && err != filepath.SkipAll {
		return DefaultV4XORKey, fmt.Errorf("error scanning directory: %v", err)
	}
	if scannedKey != nil {
		return *scannedKey, nil
	}
	return DefaultV4XORKey, nil
}

// DecodeV4 processes a WeChat V4 DAT payload with explicit AES and XOR keys.
func DecodeV4(data, aesKey []byte, xorKey byte) ([]byte, string, error) {
	if len(data) < 15 {
		return nil, "", fmt.Errorf("data length is too short for WeChat v4 format")
	}
	if len(aesKey) != aes.BlockSize {
		return nil, "", fmt.Errorf("image AES key must be %d bytes", aes.BlockSize)
	}

	// 1. Parse Headers (Little Endian)
	// Offset 6-10: AES Encryption Length
	aesSize := binary.LittleEndian.Uint32(data[6:10])
	// Offset 10-14: XOR Encryption Length
	xorSize := binary.LittleEndian.Uint32(data[10:14])

	// Skip header (15 bytes)
	fileData := data[15:]

	alignedAESSize := aesSize + (aes.BlockSize - (aesSize % aes.BlockSize))
	if uint32(len(fileData)) < alignedAESSize {
		return nil, "", fmt.Errorf("file data too short for declared AES length")
	}
	aesPart := fileData[:alignedAESSize]
	remainingPart := fileData[alignedAESSize:]
	var unpaddedAESData []byte
	if len(aesPart) > 0 {
		decrypted, err := decryptAESECBStrict(aesPart, aesKey)
		if err != nil {
			return nil, "", fmt.Errorf("AES decryption failed: %w", err)
		}
		unpaddedAESData = decrypted
	}
	if uint32(len(remainingPart)) < xorSize {
		return nil, "", fmt.Errorf("file data too short for declared XOR length")
	}
	rawLength := uint32(len(remainingPart)) - xorSize
	rawMiddleData := remainingPart[:rawLength]
	xorTailData := remainingPart[rawLength:]
	decryptedXORData := make([]byte, len(xorTailData))
	for i := range xorTailData {
		decryptedXORData[i] = xorTailData[i] ^ xorKey
	}
	result := make([]byte, 0, len(unpaddedAESData)+len(rawMiddleData)+len(decryptedXORData))
	result = append(result, unpaddedAESData...)
	result = append(result, rawMiddleData...)
	result = append(result, decryptedXORData...)

	// Identify image type
	imgType := ""
	for _, format := range Formats {
		// Only check headers for image types, not V4 types
		if format.Ext == "wxgf" || format.Ext == "jpg" || format.Ext == "png" || format.Ext == "gif" || format.Ext == "tiff" || format.Ext == "bmp" {
			if len(result) >= len(format.Header) && bytes.Equal(result[:len(format.Header)], format.Header) {
				imgType = format.Ext
				break
			}
		}
	}

	if imgType == "wxgf" {
		return Wxam2pic(result)
	}

	if imgType == "" {
		if len(result) > 2 {
			return nil, "", fmt.Errorf("unknown image type after decryption: %x %x", result[0], result[1])
		}
		return nil, "", errors.New("unknown image type")
	}

	return result, imgType, nil
}

// decryptAESECBStrict decrypts data using AES in ECB mode and strictly removes PKCS7 padding
// This matches Dart's _strictRemovePadding logic
func decryptAESECBStrict(data, key []byte) ([]byte, error) {
	if len(data) == 0 {
		return []byte{}, nil
	}

	cipher, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	if len(data)%aes.BlockSize != 0 {
		return nil, fmt.Errorf("data length %d is not a multiple of block size", len(data))
	}

	decrypted := make([]byte, len(data))
	for bs, be := 0, aes.BlockSize; bs < len(data); bs, be = bs+aes.BlockSize, be+aes.BlockSize {
		cipher.Decrypt(decrypted[bs:be], data[bs:be])
	}

	// Strict PKCS7 Unpadding
	length := len(decrypted)
	if length == 0 {
		return nil, errors.New("decrypted data is empty")
	}

	paddingLen := int(decrypted[length-1])
	if paddingLen == 0 || paddingLen > aes.BlockSize || paddingLen > length {
		return nil, fmt.Errorf("invalid PKCS7 padding length: %d", paddingLen)
	}

	// Verify all padding bytes
	for i := length - paddingLen; i < length; i++ {
		if decrypted[i] != byte(paddingLen) {
			return nil, errors.New("invalid PKCS7 padding content")
		}
	}

	return decrypted[:length-paddingLen], nil
}
