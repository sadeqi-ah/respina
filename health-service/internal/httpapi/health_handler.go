package httpapi

import (
	"errors"
	"log/slog"
	"net/http"

	"respina/health-service/internal/store"
)

type healthHandler struct {
	store store.ServiceStore
}

type healthResponse struct {
	Status        string `json:"status"`
	ServiceID     int64  `json:"service_id,omitempty"`
	ServiceStatus string `json:"service_status,omitempty"`
}

type unhealthyResponse struct {
	Status string    `json:"status"`
	Error  errorBody `json:"error"`
}

// ServeHTTP implements GET /health and GET /health?service_id=N (plan §3.5).
func (h *healthHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		writeError(w, http.StatusMethodNotAllowed, codeMethodNotAllowed, "Method not allowed.")
		return
	}

	values, present := r.URL.Query()["service_id"]
	if !present {
		h.ping(w, r)
		return
	}
	if len(values) != 1 {
		writeError(w, http.StatusBadRequest, codeInvalidServiceID, "Pass service_id exactly once.")
		return
	}
	id, err := parseServiceID(values[0])
	if err != nil {
		writeError(w, http.StatusBadRequest, codeInvalidServiceID, "service_id must be a positive integer.")
		return
	}
	h.lookup(w, r, id)
}

func (h *healthHandler) ping(w http.ResponseWriter, r *http.Request) {
	if err := h.store.Ping(r.Context()); err != nil {
		h.unavailable(w, err)
		return
	}
	writeJSON(w, http.StatusOK, healthResponse{Status: "healthy"})
}

func (h *healthHandler) lookup(w http.ResponseWriter, r *http.Request, id int64) {
	status, err := h.store.Status(r.Context(), id)
	switch {
	case errors.Is(err, store.ErrNotFound):
		writeError(w, http.StatusNotFound, codeNotFound, "Service not found.")
	case err != nil:
		h.unavailable(w, err)
	default:
		writeJSON(w, http.StatusOK, healthResponse{Status: "healthy", ServiceID: id, ServiceStatus: status})
	}
}

// unavailable logs the real cause and returns a generic 503: driver errors can contain hosts,
// user names or SQL, which callers must not see.
func (h *healthHandler) unavailable(w http.ResponseWriter, err error) {
	slog.Error("data source unavailable", "error", err, "request_id", w.Header().Get(requestIDHeader))
	writeJSON(w, http.StatusServiceUnavailable, unhealthyResponse{
		Status: "unhealthy",
		Error:  newError(w, codeDependencyUnavailable, "The database is unavailable."),
	})
}
