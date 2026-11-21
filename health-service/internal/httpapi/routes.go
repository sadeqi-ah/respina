package httpapi

import (
	"net/http"

	"respina/health-service/internal/store"
)

// Routes registers /health plus JSON fallbacks. /health is registered for every method so the
// handler can answer 405 in the error envelope (the stdlib mux would answer in plain text).
func Routes(st store.ServiceStore) http.Handler {
	mux := http.NewServeMux()
	mux.Handle("/health", &healthHandler{store: st})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotFound, codeNotFound, "Not found.")
	})
	return mux
}
