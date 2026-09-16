package util

import (
	"strings"
)

func SplitInt64ToTwoInt32(input int64) (int64, int64) {
	return input & 0xFFFFFFFF, input >> 32
}

func Str2List(str string, sep string) []string {
	list := make([]string, 0)

	if str == "" {
		return list
	}

	listMap := make(map[string]bool)
	for _, elem := range strings.Split(str, sep) {
		elem = strings.TrimSpace(elem)
		if len(elem) == 0 {
			continue
		}
		if _, ok := listMap[elem]; ok {
			continue
		}
		listMap[elem] = true
		list = append(list, elem)
	}

	return list
}
