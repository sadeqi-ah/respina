package main

import (
	"fmt"
	"net/http"
	"os"
	"time"
)

// healthcheckTimeout bounds the whole probe; Docker kills the probe at its own --timeout anyway.
const healthcheckTimeout = 2 * time.Second

// healthcheck probes the running server on 127.0.0.1:port and returns a process exit code:
// 0 = healthy, 1 = unhealthy. Distroless has no shell or curl, so the image's HEALTHCHECK runs
// `healthsvc -healthcheck` instead.
func healthcheck(port int) int {
	client := &http.Client{Timeout: healthcheckTimeout}
	url := fmt.Sprintf("http://127.0.0.1:%d/health", port)
	resp, err := client.Get(url)
	if err != nil { // refused, timeout, ...
		fmt.Fprintf(os.Stderr, "healthcheck: %v\n", err)
		return 1
	}
	defer resp.Body.Close()

	// Exactly 200: /health only ever answers 200 when healthy, so 404/3xx/5xx all mean something
	// is off (wrong route, redirect, db down).
	if resp.StatusCode != http.StatusOK {
		fmt.Fprintf(os.Stderr, "healthcheck: unexpected status %d\n", resp.StatusCode)
		return 1
	}
	return 0
}
