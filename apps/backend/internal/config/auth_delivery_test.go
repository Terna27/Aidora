package config

import (
	"errors"
	"testing"
)

func setValidDeliveryEnvironment(t *testing.T) {
	t.Helper()
	t.Setenv("SMTP_HOST", "smtp.example.test")
	t.Setenv("SMTP_PORT", "587")
	t.Setenv("SMTP_USERNAME", "aidora")
	t.Setenv("SMTP_PASSWORD", "test-password")
	t.Setenv("SMTP_FROM_EMAIL", "no-reply@example.test")
	t.Setenv("SMTP_FROM_NAME", "AIDORA")
	t.Setenv("AFRICASTALKING_USERNAME", "sandbox")
	t.Setenv("AFRICASTALKING_API_KEY", "test-api-key")
	t.Setenv("AFRICASTALKING_SENDER_ID", "AIDORA")
	t.Setenv("AUTH_EMAIL_ENABLED", "true")
	t.Setenv("AUTH_SMS_ENABLED", "true")
}

func TestLoadAuthDeliveryConfig(t *testing.T) {
	setValidDeliveryEnvironment(t)
	cfg, err := LoadAuthDeliveryConfig()
	if err != nil {
		t.Fatalf("LoadAuthDeliveryConfig() error = %v", err)
	}
	if cfg.SMTPPort != 587 || cfg.SMTPHost != "smtp.example.test" {
		t.Fatalf("unexpected SMTP configuration: %+v", cfg)
	}
	if cfg.AfricaTalkingUsername != "sandbox" || cfg.AfricaTalkingAPIKey != "test-api-key" {
		t.Fatal("Africa's Talking configuration was not loaded")
	}
}

func TestLoadAuthDeliveryConfigRejectsMissingRequiredValues(t *testing.T) {
	tests := []string{
		"SMTP_HOST", "SMTP_USERNAME", "SMTP_PASSWORD", "SMTP_FROM_EMAIL",
		"AFRICASTALKING_USERNAME", "AFRICASTALKING_API_KEY",
	}
	for _, variable := range tests {
		t.Run(variable, func(t *testing.T) {
			setValidDeliveryEnvironment(t)
			t.Setenv(variable, "")
			if _, err := LoadAuthDeliveryConfig(); !errors.Is(err, ErrInvalidAuthDeliveryConfig) {
				t.Fatalf("expected ErrInvalidAuthDeliveryConfig, got %v", err)
			}
		})
	}
}

func TestLoadAuthDeliveryConfigRejectsInvalidSMTPPort(t *testing.T) {
	for _, value := range []string{"zero", "0", "65536", "-1"} {
		t.Run(value, func(t *testing.T) {
			setValidDeliveryEnvironment(t)
			t.Setenv("SMTP_PORT", value)
			if _, err := LoadAuthDeliveryConfig(); !errors.Is(err, ErrInvalidAuthDeliveryConfig) {
				t.Fatalf("expected ErrInvalidAuthDeliveryConfig, got %v", err)
			}
		})
	}
}

func TestLoadAuthDeliveryConfigDefaultsSMTPPort(t *testing.T) {
	setValidDeliveryEnvironment(t)
	t.Setenv("SMTP_PORT", "")
	cfg, err := LoadAuthDeliveryConfig()
	if err != nil {
		t.Fatalf("LoadAuthDeliveryConfig() error = %v", err)
	}
	if cfg.SMTPPort != 587 {
		t.Fatalf("SMTPPort = %d, want 587", cfg.SMTPPort)
	}
}

func TestLoadAuthDeliveryConfigEmailOnly(t *testing.T) {
	setValidDeliveryEnvironment(t)

	t.Setenv("AUTH_SMS_ENABLED", "false")
	t.Setenv("AFRICASTALKING_USERNAME", "")
	t.Setenv("AFRICASTALKING_API_KEY", "")

	cfg, err := LoadAuthDeliveryConfig()
	if err != nil {
		t.Fatalf("email-only configuration failed: %v", err)
	}

	if !cfg.EmailEnabled || cfg.SMSEnabled {
		t.Fatal("expected email enabled and SMS disabled")
	}
}

func TestLoadAuthDeliveryConfigSMSOnly(t *testing.T) {
	setValidDeliveryEnvironment(t)

	t.Setenv("AUTH_EMAIL_ENABLED", "false")
	t.Setenv("SMTP_HOST", "")
	t.Setenv("SMTP_USERNAME", "")
	t.Setenv("SMTP_PASSWORD", "")
	t.Setenv("SMTP_FROM_EMAIL", "")

	cfg, err := LoadAuthDeliveryConfig()
	if err != nil {
		t.Fatalf("SMS-only configuration failed: %v", err)
	}

	if cfg.EmailEnabled || !cfg.SMSEnabled {
		t.Fatal("expected SMS enabled and email disabled")
	}
}

func TestLoadAuthDeliveryConfigRejectsBothDisabled(t *testing.T) {
	setValidDeliveryEnvironment(t)

	t.Setenv("AUTH_EMAIL_ENABLED", "false")
	t.Setenv("AUTH_SMS_ENABLED", "false")

	_, err := LoadAuthDeliveryConfig()
	if !errors.Is(err, ErrInvalidAuthDeliveryConfig) {
		t.Fatalf("expected invalid configuration, got %v", err)
	}
}

func TestLoadAuthDeliveryConfigRejectsMissingChannelFlags(t *testing.T) {
	for _, variable := range []string{
		"AUTH_EMAIL_ENABLED",
		"AUTH_SMS_ENABLED",
	} {
		t.Run(variable, func(t *testing.T) {
			setValidDeliveryEnvironment(t)
			t.Setenv(variable, "")

			_, err := LoadAuthDeliveryConfig()
			if !errors.Is(err, ErrInvalidAuthDeliveryConfig) {
				t.Fatalf("expected invalid configuration, got %v", err)
			}
		})
	}
}
