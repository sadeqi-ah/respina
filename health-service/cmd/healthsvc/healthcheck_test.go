package main

import (
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"
)

// serve starts h on 127.0.0.1 and returns its port.
func serve(t *testing.T, h http.HandlerFunc) int {
	t.Helper()
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	_, port, _ := net.SplitHostPort(srv.Listener.Addr().String())
	p, _ := strconv.Atoi(port)
	return p
}

func TestHealthcheckExitCodes(t *testing.T) {
	tests := map[string]struct {
		status int
		want   int
	}{
		"healthy":        {http.StatusOK, 0},
		"db unavailable": {http.StatusServiceUnavailable, 1},
		"server error":   {http.StatusInternalServerError, 1},
		"not found":      {http.StatusNotFound, 1},
	}
	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			port := serve(t, func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/health" || r.Method != http.MethodGet {
					t.Errorf("probe sent %s %s", r.Method, r.URL.Path)
				}
				w.WriteHeader(tc.status)
			})
			if got := healthcheck(port); got != tc.want {
				t.Fatalf("healthcheck() = %d, want %d", got, tc.want)
			}
		})
	}
}

func TestHealthcheckNothingListening(t *testing.T) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := l.Addr().(*net.TCPAddr).Port
	l.Close() // port is now free: connection refused

	if got := healthcheck(port); got != 1 {
		t.Fatalf("healthcheck() = %d, want 1", got)
	}
}

func TestHealthcheckHangingServerTimesOut(t *testing.T) {
	release := make(chan struct{})
	port := serve(t, func(http.ResponseWriter, *http.Request) { <-release })
	defer close(release)

	start := time.Now()
	if got := healthcheck(port); got != 1 {
		t.Fatalf("healthcheck() = %d, want 1", got)
	}
	if elapsed := time.Since(start); elapsed > healthcheckTimeout+time.Second {
		t.Fatalf("probe took %s; timeout not applied", elapsed)
	}
}
