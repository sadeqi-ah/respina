package httpapi

import (
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"regexp"
	"time"
)

const requestIDHeader = "X-Request-ID"

// Caller-supplied IDs are accepted only if short and harmless (no log injection), as in Django.
var validRequestID = regexp.MustCompile(`^[A-Za-z0-9._-]{1,128}$`)

// chain wraps h so that recover is outermost: recover → request ID → logging → h.
func chain(h http.Handler, log *slog.Logger) http.Handler {
	return recoverer(requestID(logging(h, log)), log)
}

func requestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get(requestIDHeader)
		if !validRequestID.MatchString(id) {
			id = newRequestID()
		}
		w.Header().Set(requestIDHeader, id)
		next.ServeHTTP(w, r)
	})
}

func newRequestID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b) // crypto/rand.Read never returns an error since Go 1.24
	return hex.EncodeToString(b)
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

func logging(next http.Handler, log *slog.Logger) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		log.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", rec.status,
			"duration_ms", time.Since(start).Milliseconds(),
			"request_id", w.Header().Get(requestIDHeader),
		)
	})
}

func recoverer(next http.Handler, log *slog.Logger) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				if v == http.ErrAbortHandler {
					panic(v) // client went away; let net/http handle it
				}
				log.Error("panic", "error", v, "request_id", w.Header().Get(requestIDHeader))
				writeError(w, http.StatusInternalServerError, codeInternalError, "An unexpected error occurred.")
			}
		}()
		next.ServeHTTP(w, r)
	})
}
