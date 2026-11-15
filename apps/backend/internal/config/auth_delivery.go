package config

import (
	"errors"
	"fmt"
	"net/mail"
	"os"
	"strconv"
	"strings"
)

var ErrInvalidAuthDeliveryConfig = errors.New("invalid authentication delivery configuration")

type AuthDeliveryConfig struct {
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
	cfg := AuthDeliveryConfig{
		SMTPHost:              strings.TrimSpace(os.Getenv("SMTP_HOST")),
		SMTPUsername:          strings.TrimSpace(os.Getenv("SMTP_USERNAME")),
		SMTPPassword:          os.Getenv("SMTP_PASSWORD"),
		SMTPFromEmail:         strings.TrimSpace(os.Getenv("SMTP_FROM_EMAIL")),
		SMTPFromName:          strings.TrimSpace(os.Getenv("SMTP_FROM_NAME")),
		AfricaTalkingUsername: strings.TrimSpace(os.Getenv("AFRICASTALKING_USERNAME")),
		AfricaTalkingAPIKey:   strings.TrimSpace(os.Getenv("AFRICASTALKING_API_KEY")),
		AfricaTalkingSenderID: strings.TrimSpace(os.Getenv("AFRICASTALKING_SENDER_ID")),
	}

	portValue := strings.TrimSpace(os.Getenv("SMTP_PORT"))
	if portValue == "" {
		portValue = "587"
	}
	port, err := strconv.Atoi(portValue)
	if err != nil || port < 1 || port > 65535 {
		return AuthDeliveryConfig{}, fmt.Errorf("%w: SMTP_PORT must be between 1 and 65535", ErrInvalidAuthDeliveryConfig)
	}
	cfg.SMTPPort = port

	if cfg.SMTPHost == "" || cfg.SMTPUsername == "" || cfg.SMTPPassword == "" {
		return AuthDeliveryConfig{}, fmt.Errorf("%w: SMTP_HOST, SMTP_USERNAME and SMTP_PASSWORD are required", ErrInvalidAuthDeliveryConfig)
	}
	if cfg.SMTPFromEmail == "" {
		return AuthDeliveryConfig{}, fmt.Errorf("%w: SMTP_FROM_EMAIL is required", ErrInvalidAuthDeliveryConfig)
	}
	if _, err := mail.ParseAddress(cfg.SMTPFromEmail); err != nil {
		return AuthDeliveryConfig{}, fmt.Errorf("%w: SMTP_FROM_EMAIL must be a valid email address", ErrInvalidAuthDeliveryConfig)
	}
	if cfg.AfricaTalkingUsername == "" || cfg.AfricaTalkingAPIKey == "" {
		return AuthDeliveryConfig{}, fmt.Errorf("%w: AFRICASTALKING_USERNAME and AFRICASTALKING_API_KEY are required", ErrInvalidAuthDeliveryConfig)
	}

	return cfg, nil
}
