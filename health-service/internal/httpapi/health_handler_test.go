package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"respina/health-service/internal/store"
)

// failingStore simulates an unreachable database.
type failingStore struct{}

func (failingStore) Status(context.Context, int64) (string, error) {
	return "", errors.New(`dial tcp 10.0.0.5:5432: connect: connection refused (user "health_ro")`)
}
func (failingStore) Ping(context.Context) error { return context.DeadlineExceeded }

func newTestHandler(st store.ServiceStore) http.Handler {
	return chain(Routes(st), slog.New(slog.NewTextHandler(io.Discard, nil)))
}

func do(t *testing.T, h http.Handler, method, target string) (*httptest.ResponseRecorder, map[string]any) {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(method, target, nil))
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("%s %s: body is not JSON: %q", method, target, rec.Body.String())
	}
	return rec, body
}

func errorCode(body map[string]any) string {
	e, _ := body["error"].(map[string]any)
	code, _ := e["code"].(string)
	return code
}

// One row per line of the contract table in plan §3.5.
func TestHealthContract(t *testing.T) {
	memory := store.NewMemory()
	tests := []struct {
		name       string
		store      store.ServiceStore
		method     string
		target     string
		wantStatus int
		wantBody   map[string]any // exact body for success rows
		wantCode   string         // error code for error rows
	}{
		{"ping ok", memory, "GET", "/health", 200, map[string]any{"status": "healthy"}, ""},
		{"ping db down", failingStore{}, "GET", "/health", 503, nil, "dependency_unavailable"},
		{"active service", memory, "GET", "/health?service_id=125", 200,
			map[string]any{"status": "healthy", "service_id": float64(125), "service_status": "active"}, ""},
		{"suspended service", memory, "GET", "/health?service_id=126", 200,
			map[string]any{"status": "healthy", "service_id": float64(126), "service_status": "suspended"}, ""},
		{"non-numeric id", memory, "GET", "/health?service_id=abc", 400, nil, "invalid_service_id"},
		{"zero id", memory, "GET", "/health?service_id=0", 400, nil, "invalid_service_id"},
		{"negative id", memory, "GET", "/health?service_id=-5", 400, nil, "invalid_service_id"},
		{"overflow id", memory, "GET", "/health?service_id=99999999999999999999", 400, nil, "invalid_service_id"},
		{"empty id", memory, "GET", "/health?service_id=", 400, nil, "invalid_service_id"},
		{"repeated id", memory, "GET", "/health?service_id=125&service_id=126", 400, nil, "invalid_service_id"},
		{"missing service", memory, "GET", "/health?service_id=999999", 404, nil, "not_found"},
		{"lookup db down", failingStore{}, "GET", "/health?service_id=125", 503, nil, "dependency_unavailable"},
		{"post", memory, "POST", "/health", 405, nil, "method_not_allowed"},
		{"delete", memory, "DELETE", "/health?service_id=125", 405, nil, "method_not_allowed"},
		{"unknown path", memory, "GET", "/nope", 404, nil, "not_found"},
		{"trailing slash", memory, "GET", "/health/", 404, nil, "not_found"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rec, body := do(t, newTestHandler(tc.store), tc.method, tc.target)

			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d; body %v", rec.Code, tc.wantStatus, body)
			}
			if ct := rec.Header().Get("Content-Type"); ct != "application/json; charset=utf-8" {
				t.Errorf("Content-Type = %q", ct)
			}
			if cc := rec.Header().Get("Cache-Control"); cc != "no-store" {
				t.Errorf("Cache-Control = %q", cc)
			}
			if tc.wantBody != nil {
				if got, _ := json.Marshal(body); string(got) != mustJSON(t, tc.wantBody) {
					t.Errorf("body = %s, want %s", got, mustJSON(t, tc.wantBody))
				}
				return
			}
			if code := errorCode(body); code != tc.wantCode {
				t.Errorf("error.code = %q, want %q", code, tc.wantCode)
			}
			e := body["error"].(map[string]any)
			if e["message"] == "" || e["request_id"] != rec.Header().Get("X-Request-ID") {
				t.Errorf("envelope incomplete: %v", e)
			}
		})
	}
}

func mustJSON(t *testing.T, v any) string {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

func TestMethodNotAllowedSetsAllowHeader(t *testing.T) {
	rec, _ := do(t, newTestHandler(store.NewMemory()), "POST", "/health")
	if got := rec.Header().Get("Allow"); got != "GET" {
		t.Fatalf("Allow = %q, want GET", got)
	}
}

func TestUnhealthyResponseHasStatusAndHidesDriverError(t *testing.T) {
	rec, body := do(t, newTestHandler(failingStore{}), "GET", "/health?service_id=125")
	if body["status"] != "unhealthy" {
		t.Fatalf("status = %v, want unhealthy", body["status"])
	}
	for _, leak := range []string{"10.0.0.5", "health_ro", "refused"} {
		if strings.Contains(rec.Body.String(), leak) {
			t.Fatalf("response leaks %q: %s", leak, rec.Body.String())
		}
	}
}
