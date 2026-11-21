package httpapi

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// Error codes shared with the other components (plan §3.4).
const (
	codeInvalidServiceID      = "invalid_service_id"
	codeNotFound              = "not_found"
	codeMethodNotAllowed      = "method_not_allowed"
	codeDependencyUnavailable = "dependency_unavailable"
	codeInternalError         = "internal_error"
)

type errorBody struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	RequestID string `json:"request_id"`
}

type errorEnvelope struct {
	Error errorBody `json:"error"`
}

// writeJSON writes v with the headers every response of this service carries.
func writeJSON(w http.ResponseWriter, status int, v any) {
	h := w.Header()
	h.Set("Content-Type", "application/json; charset=utf-8")
	h.Set("Cache-Control", "no-store")
	h.Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Warn("write response failed", "error", err)
	}
}

func newError(w http.ResponseWriter, code, message string) errorBody {
	// The request ID middleware has already set the response header.
	return errorBody{Code: code, Message: message, RequestID: w.Header().Get(requestIDHeader)}
}

// writeError writes the standard error envelope.
func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, errorEnvelope{Error: newError(w, code, message)})
}
