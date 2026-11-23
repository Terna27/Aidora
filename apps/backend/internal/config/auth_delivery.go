package config

import (
	"errors"
	"fmt"
	"net/mail"
	"os"
	"strconv"
	"strings"
)

var ErrInvalidAuthDeliveryConfig = errors.New(
	"invalid authentication delivery configuration",
)

type AuthDeliveryConfig struct {
	EmailEnabled bool
	SMSEnabled   bool

	SMTPHost      string
	SMTPPort      int
	SMTPUsername  string
	SMTPPassword  string
	SMTPFromEmail string
	SMTPFromName  string

	AfricaTalkingUsername string
	AfricaTalkingAPIKey   string
	AfricaTalkingSenderID string
}

func LoadAuthDeliveryConfig() (AuthDeliveryConfig, error) {
	emailEnabled, err := requiredDeliveryFlag("AUTH_EMAIL_ENABLED")
	if err != nil {
		return AuthDeliveryConfig{}, err
	}

	smsEnabled, err := requiredDeliveryFlag("AUTH_SMS_ENABLED")
	if err != nil {
		return AuthDeliveryConfig{}, err
	}

	if !emailEnabled && !smsEnabled {
		return AuthDeliveryConfig{}, fmt.Errorf(
			"%w: at least one delivery channel must be enabled",
			ErrInvalidAuthDeliveryConfig,
		)
	}

	cfg := AuthDeliveryConfig{
		EmailEnabled: emailEnabled,
		SMSEnabled:   smsEnabled,
	}

	if emailEnabled {
		cfg.SMTPHost = strings.TrimSpace(os.Getenv("SMTP_HOST"))
		cfg.SMTPUsername = strings.TrimSpace(os.Getenv("SMTP_USERNAME"))
		cfg.SMTPPassword = os.Getenv("SMTP_PASSWORD")
		cfg.SMTPFromEmail = strings.TrimSpace(os.Getenv("SMTP_FROM_EMAIL"))
		cfg.SMTPFromName = strings.TrimSpace(os.Getenv("SMTP_FROM_NAME"))

		portValue := strings.TrimSpace(os.Getenv("SMTP_PORT"))
		if portValue == "" {
			portValue = "587"
		}

		port, err := strconv.Atoi(portValue)
		if err != nil || port < 1 || port > 65535 {
			return AuthDeliveryConfig{}, fmt.Errorf(
				"%w: SMTP_PORT must be between 1 and 65535",
				ErrInvalidAuthDeliveryConfig,
			)
		}
		cfg.SMTPPort = port

		if cfg.SMTPHost == "" ||
			cfg.SMTPUsername == "" ||
			cfg.SMTPPassword == "" {
			return AuthDeliveryConfig{}, fmt.Errorf(
				"%w: SMTP_HOST, SMTP_USERNAME and SMTP_PASSWORD are required",
				ErrInvalidAuthDeliveryConfig,
			)
		}

		if cfg.SMTPFromEmail == "" {
			return AuthDeliveryConfig{}, fmt.Errorf(
				"%w: SMTP_FROM_EMAIL is required",
				ErrInvalidAuthDeliveryConfig,
			)
		}

		address, err := mail.ParseAddress(cfg.SMTPFromEmail)
		if err != nil || address.Address != cfg.SMTPFromEmail {
			return AuthDeliveryConfig{}, fmt.Errorf(
				"%w: SMTP_FROM_EMAIL must be a valid email address",
				ErrInvalidAuthDeliveryConfig,
			)
		}
	}

	if smsEnabled {
		cfg.AfricaTalkingUsername = strings.TrimSpace(
			os.Getenv("AFRICASTALKING_USERNAME"),
		)
		cfg.AfricaTalkingAPIKey = strings.TrimSpace(
			os.Getenv("AFRICASTALKING_API_KEY"),
		)
		cfg.AfricaTalkingSenderID = strings.TrimSpace(
			os.Getenv("AFRICASTALKING_SENDER_ID"),
		)

		if cfg.AfricaTalkingUsername == "" ||
			cfg.AfricaTalkingAPIKey == "" {
			return AuthDeliveryConfig{}, fmt.Errorf(
				"%w: AFRICASTALKING_USERNAME and AFRICASTALKING_API_KEY are required",
				ErrInvalidAuthDeliveryConfig,
			)
		}
	}

	return cfg, nil
}

func requiredDeliveryFlag(name string) (bool, error) {
	switch strings.TrimSpace(os.Getenv(name)) {
	case "true":
		return true, nil
	case "false":
		return false, nil
	default:
		return false, fmt.Errorf(
			"%w: %s must be explicitly set to true or false",
			ErrInvalidAuthDeliveryConfig,
			name,
		)
	}
}
