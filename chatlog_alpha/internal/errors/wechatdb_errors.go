package errors

import (
	"net/http"
)

var (
	ErrTalkerEmpty     = New(nil, http.StatusBadRequest, "talker empty").WithStack()
	ErrKeyEmpty        = New(nil, http.StatusBadRequest, "key empty").WithStack()
	ErrMediaNotFound   = New(nil, http.StatusNotFound, "media not found").WithStack()
	ErrMessageNotFound = New(nil, http.StatusNotFound, "message not found").WithStack()
	ErrKeyLengthMust32 = New(nil, http.StatusBadRequest, "key length must be 32 bytes").WithStack()
)

func QueryFailed(query string, cause error) *Error {
	return Newf(cause, http.StatusInternalServerError, "query failed: %s", query).WithStack()
}

func MediaTypeUnsupported(_type string) *Error {
	return Newf(nil, http.StatusBadRequest, "unsupported media type: %s", _type).WithStack()
}

func ChatRoomNotFound(key string) *Error {
	return Newf(nil, http.StatusNotFound, "chat room not found: %s", key).WithStack()
}

func ContactNotFound(key string) *Error {
	return Newf(nil, http.StatusNotFound, "contact not found: %s", key).WithStack()
}

func InitCacheFailed(cause error) *Error {
	return New(cause, http.StatusInternalServerError, "init cache failed").WithStack()
}
