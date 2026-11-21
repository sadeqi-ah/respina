package httpapi

import (
	"errors"
	"testing"
)

func TestParseServiceID(t *testing.T) {
	tests := []struct {
		raw     string
		want    int64
		wantErr bool
	}{
		{raw: "125", want: 125},
		{raw: "1", want: 1},
		{raw: "9223372036854775807", want: 9223372036854775807}, // max int64
		{raw: "", wantErr: true},                                // present but empty
		{raw: "0", wantErr: true},
		{raw: "-1", wantErr: true},
		{raw: "-5", wantErr: true},
		{raw: "abc", wantErr: true},
		{raw: "1.5", wantErr: true},
		{raw: " 125", wantErr: true},
		{raw: "125 ", wantErr: true},
		{raw: "+125", wantErr: true},
		{raw: "0x7d", wantErr: true},
		{raw: "1_000", wantErr: true},
		{raw: "0125", wantErr: true}, // one canonical spelling per id
		{raw: "00", wantErr: true},
		{raw: "١٢٥", wantErr: true},  // non-ASCII digits (Arabic-Indic)
		{raw: "0125", wantErr: true}, // leading zero: one canonical spelling per id
		{raw: "00", wantErr: true},
		{raw: "9223372036854775808", wantErr: true},  // max int64 + 1
		{raw: "99999999999999999999", wantErr: true}, // overflow from the contract
	}
	for _, tc := range tests {
		t.Run(tc.raw, func(t *testing.T) {
			got, err := parseServiceID(tc.raw)
			if tc.wantErr {
				if !errors.Is(err, errInvalidServiceID) {
					t.Fatalf("parseServiceID(%q) error = %v, want errInvalidServiceID", tc.raw, err)
				}
				return
			}
			if err != nil || got != tc.want {
				t.Fatalf("parseServiceID(%q) = %d, %v; want %d", tc.raw, got, err, tc.want)
			}
		})
	}
}
