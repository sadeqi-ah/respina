package httpapi

import (
	"bytes"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRequestIDIsEchoed(t *testing.T) {
	h := newTestHandler(nil)
	req := httptest.NewRequest("GET", "/nope", nil)
	req.Header.Set("X-Request-ID", "abc-123")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Header().Get("X-Request-ID") != "abc-123" {
		t.Fatalf("X-Request-ID = %q", rec.Header().Get("X-Request-ID"))
	}
	if !strings.Contains(rec.Body.String(), `"request_id":"abc-123"`) {
		t.Fatalf("body lacks request_id: %s", rec.Body.String())
	}
}

func TestUnsafeRequestIDIsReplaced(t *testing.T) {
	for _, bad := range []string{"", "has space", "new\nline", strings.Repeat("a", 129)} {
		req := httptest.NewRequest("GET", "/nope", nil)
		req.Header.Set("X-Request-ID", bad)
		rec := httptest.NewRecorder()
		newTestHandler(nil).ServeHTTP(rec, req)
		if got := rec.Header().Get("X-Request-ID"); got == bad || len(got) != 32 {
			t.Fatalf("request id %q not replaced (got %q)", bad, got)
		}
	}
}

func TestPanicBecomes500Envelope(t *testing.T) {
	var logs bytes.Buffer
	log := slog.New(slog.NewJSONHandler(&logs, nil))
	boom := http.HandlerFunc(func(http.ResponseWriter, *http.Request) { panic("secret internals") })

	rec := httptest.NewRecorder()
	chain(boom, log).ServeHTTP(rec, httptest.NewRequest("GET", "/", nil))

	if rec.Code != 500 || !strings.Contains(rec.Body.String(), `"code":"internal_error"`) {
		t.Fatalf("got %d %s", rec.Code, rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), "secret internals") {
		t.Fatal("panic value leaked to the client")
	}
	if !strings.Contains(logs.String(), "secret internals") {
		t.Fatal("panic was not logged")
	}
}

func TestAccessLogHasStatusAndRequestID(t *testing.T) {
	var logs bytes.Buffer
	h := chain(Routes(nil), slog.New(slog.NewJSONHandler(&logs, nil)))
	req := httptest.NewRequest("GET", "/nope", nil)
	req.Header.Set("X-Request-ID", "log-1")
	h.ServeHTTP(httptest.NewRecorder(), req)

	for _, want := range []string{`"status":404`, `"request_id":"log-1"`, `"path":"/nope"`} {
		if !strings.Contains(logs.String(), want) {
			t.Fatalf("log lacks %s: %s", want, logs.String())
		}
	}
}
