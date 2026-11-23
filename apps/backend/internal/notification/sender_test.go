package notification

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/Terna27/Aidora/apps/backend/internal/config"
)

func testConfig() config.AuthDeliveryConfig {
	return config.AuthDeliveryConfig{
		EmailEnabled: true,
		SMSEnabled:   true,

		SMTPHost:      "smtp.example.test",
		SMTPPort:      587,
		SMTPUsername:  "aidora",
		SMTPPassword:  "secret",
		SMTPFromEmail: "no-reply@example.test",
		SMTPFromName:  "AIDORA",

		AfricaTalkingUsername: "sandbox",
		AfricaTalkingAPIKey:   "test-key",
		AfricaTalkingSenderID: "AIDORA",
	}
}

func TestSendVerificationCodeRejectsUnknownChannel(t *testing.T) {
	sender := NewSender(testConfig())
	err := sender.SendVerificationCode(context.Background(), "push", "123", "verify_phone", "123456")
	if err == nil || !strings.Contains(err.Error(), "unsupported notification channel") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestMessageContent(t *testing.T) {
	subject, body := messageContent("password_reset", "123456")
	if subject == "" || !strings.Contains(body, "reset your AIDORA password") ||
		!strings.Contains(body, "123456") || !strings.Contains(body, "10 minutes") {
		t.Fatalf("unexpected password-reset message: %q / %q", subject, body)
	}
}

func TestSendSMS(t *testing.T) {
	var gotForm url.Values
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s, want POST", r.Method)
		}
		if r.Header.Get("apiKey") != "test-key" {
			t.Errorf("missing API key header")
		}
		if r.Header.Get("Content-Type") != "application/x-www-form-urlencoded" {
			t.Errorf("unexpected content type")
		}
		body, _ := io.ReadAll(r.Body)
		gotForm, _ = url.ParseQuery(string(body))
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"SMSMessageData":{"Recipients":[{"statusCode":100,"status":"Success"}]}}`)
	}))
	defer server.Close()

	sender := NewSenderWithHTTPClient(testConfig(), server.Client())
	sender.endpoint = server.URL
	if err := sender.SendVerificationCode(context.Background(), "phone", "+2348012345678", "verify_phone", "123456"); err != nil {
		t.Fatalf("SendVerificationCode() error = %v", err)
	}
	if gotForm.Get("username") != "sandbox" || gotForm.Get("to") != "+2348012345678" ||
		gotForm.Get("from") != "AIDORA" || !strings.Contains(gotForm.Get("message"), "123456") {
		t.Fatalf("unexpected SMS form: %#v", gotForm)
	}
}

func TestSendSMSRejectsProviderRecipientFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"SMSMessageData":{"Recipients":[{"statusCode":102,"status":"Insufficient Balance"}]}}`)
	}))
	defer server.Close()

	sender := NewSenderWithHTTPClient(testConfig(), server.Client())
	sender.endpoint = server.URL
	err := sender.SendVerificationCode(context.Background(), "phone", "+2348012345678", "verify_phone", "123456")
	if err == nil || !strings.Contains(err.Error(), "status 102") {
		t.Fatalf("expected recipient rejection, got %v", err)
	}
}

func TestSendSMSRejectsNonSuccessHTTPStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "rejected", http.StatusUnauthorized)
	}))
	defer server.Close()

	sender := NewSenderWithHTTPClient(testConfig(), server.Client())
	sender.endpoint = server.URL
	err := sender.SendVerificationCode(context.Background(), "phone", "+2348012345678", "verify_phone", "123456")
	if err == nil || !strings.Contains(err.Error(), "HTTP status 401") {
		t.Fatalf("expected HTTP status error, got %v", err)
	}
}

func TestSendSMSDisabled(t *testing.T) {
	cfg := testConfig()
	cfg.SMSEnabled = false

	if cfg.SMSEnabled {
		t.Fatal("SMS must be disabled for this test")
	}

	sender := NewSender(cfg)

	err := sender.SendVerificationCode(
		context.Background(),
		"phone",
		"+2348012345678",
		"verify_phone",
		"123456",
	)

	if err == nil {
		t.Fatal("expected SMS delivery to be rejected")
	}

	if !strings.Contains(err.Error(), "SMS delivery is disabled") {
		t.Fatalf("unexpected error: %v", err)
	}
}
