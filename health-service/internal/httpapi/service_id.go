package httpapi

import (
	"errors"
	"strconv"
)

// errInvalidServiceID is returned for any service_id that is not a positive int64.
var errInvalidServiceID = errors.New("service_id must be a positive integer")

// parseServiceID converts the raw service_id query value into a database id.
//
// Accepted: a plain base-10 positive integer that fits in int64 ("125").
// Rejected with errInvalidServiceID: "", "0", "-1", "abc", "1.5", " 125", "+125", "0125", overflow.
func parseServiceID(raw string) (int64, error) {
	if raw == "" {
		return 0, errInvalidServiceID
	}
	// Digits only: one rule that also rejects "+", "-", whitespace, ".", "_" and "0x" forms.
	for i := 0; i < len(raw); i++ {
		if raw[i] < '0' || raw[i] > '9' {
			return 0, errInvalidServiceID
		}
	}
	// One canonical spelling per id: "0125" is rejected rather than read as 125 (or octal).
	if len(raw) > 1 && raw[0] == '0' {
		return 0, errInvalidServiceID
	}
	// Digits-only means ParseInt can fail only on overflow; never leak its error.
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		return 0, errInvalidServiceID
	}
	return id, nil
}
