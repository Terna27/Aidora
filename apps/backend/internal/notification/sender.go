// Package notification contains outbound notification delivery adapters.
package notification

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/mail"
	"net/smtp"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/Terna27/Aidora/apps/backend/internal/config"
)

const (
	africaTalkingEndpoint = "https://api.africastalking.com/version1/messaging"
	defaultHTTPTimeout    = 10 * time.Second
)

type Sender struct {
	config     config.AuthDeliveryConfig
	httpClient *http.Client
	endpoint   string
}

func NewSender(cfg config.AuthDeliveryConfig) *Sender {
	return NewSenderWithHTTPClient(cfg, &http.Client{Timeout: defaultHTTPTimeout})
}

// NewSenderWithHTTPClient allows tests to provide an isolated HTTP client.
func NewSenderWithHTTPClient(cfg config.AuthDeliveryConfig, client *http.Client) *Sender {
	if client == nil {
		client = &http.Client{Timeout: defaultHTTPTimeout}
	}
	return &Sender{config: cfg, httpClient: client, endpoint: africaTalkingEndpoint}
}

// SendVerificationCode implements auth.VerificationCodeSender without importing
// the auth package, avoiding a package dependency cycle.

func (s *Sender) SendVerificationCode(
	ctx context.Context,
	channel string,
	destination string,
	purpose string,
	code string,
) error {
	if s == nil {
		return errors.New("notification sender is nil")
	}

	switch strings.ToLower(strings.TrimSpace(channel)) {
	case "email":
		if !s.config.EmailEnabled {
			return errors.New("email delivery is disabled")
		}
		return s.sendEmail(ctx, destination, purpose, code)

	case "phone":
		if !s.config.SMSEnabled {
			return errors.New("SMS delivery is disabled")
		}
		return s.sendSMS(ctx, destination, purpose, code)

	default:
		return fmt.Errorf(
			"unsupported notification channel %q",
			channel,
		)
	}
}

func (s *Sender) sendEmail(ctx context.Context, destination, purpose, code string) error {
	recipient, err := mail.ParseAddress(destination)
	if err != nil || recipient.Address != destination {
		return errors.New("invalid email destination")
	}
	from, err := mail.ParseAddress(s.config.SMTPFromEmail)
	if err != nil {
		return errors.New("invalid configured SMTP sender address")
	}

	subject, body := messageContent(purpose, code)
	fromName := strings.TrimSpace(s.config.SMTPFromName)
	fromHeader := from.Address
	if fromName != "" {
		fromHeader = (&mail.Address{Name: fromName, Address: from.Address}).String()
	}

	var message bytes.Buffer
	fmt.Fprintf(&message, "From: %s\r\n", fromHeader)
	fmt.Fprintf(&message, "To: %s\r\n", recipient.String())
	fmt.Fprintf(&message, "Subject: %s\r\n", subject)
	message.WriteString("MIME-Version: 1.0\r\n")
	message.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	message.WriteString("Content-Transfer-Encoding: 8bit\r\n\r\n")
	message.WriteString(body)

	address := net.JoinHostPort(s.config.SMTPHost, strconv.Itoa(s.config.SMTPPort))
	dialer := net.Dialer{Timeout: defaultHTTPTimeout}
	conn, err := dialer.DialContext(ctx, "tcp", address)
	if err != nil {
		return fmt.Errorf("connect to SMTP server: %w", err)
	}
	defer conn.Close()

	if deadline, ok := ctx.Deadline(); ok {
		_ = conn.SetDeadline(deadline)
	} else {
		_ = conn.SetDeadline(time.Now().Add(defaultHTTPTimeout))
	}

	client, err := smtp.NewClient(conn, s.config.SMTPHost)
	if err != nil {
		return fmt.Errorf("initialize SMTP client: %w", err)
	}
	defer client.Close()

	if ok, _ := client.Extension("STARTTLS"); !ok {
		return errors.New("SMTP server does not support STARTTLS")
	}
	tlsConfig := &tls.Config{
		ServerName: s.config.SMTPHost,
		MinVersion: tls.VersionTLS12,
	}
	if err := client.StartTLS(tlsConfig); err != nil {
		return fmt.Errorf("establish SMTP TLS: %w", err)
	}

	auth := smtp.PlainAuth("", s.config.SMTPUsername, s.config.SMTPPassword, s.config.SMTPHost)
	if err := client.Auth(auth); err != nil {
		return errors.New("SMTP authentication failed")
	}
	if err := client.Mail(from.Address); err != nil {
		return fmt.Errorf("set SMTP sender: %w", err)
	}
	if err := client.Rcpt(recipient.Address); err != nil {
		return fmt.Errorf("set SMTP recipient: %w", err)
	}
	writer, err := client.Data()
	if err != nil {
		return fmt.Errorf("open SMTP message: %w", err)
	}
	if _, err := writer.Write(message.Bytes()); err != nil {
		_ = writer.Close()
		return fmt.Errorf("write SMTP message: %w", err)
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("submit SMTP message: %w", err)
	}
	if err := client.Quit(); err != nil {
		return fmt.Errorf("finish SMTP session: %w", err)
	}
	return nil
}

type africaTalkingResponse struct {
	SMSMessageData struct {
		Recipients []struct {
			StatusCode int    `json:"statusCode"`
			Status     string `json:"status"`
			MessageID  string `json:"messageId"`
		} `json:"Recipients"`
	} `json:"SMSMessageData"`
}

func (s *Sender) sendSMS(ctx context.Context, destination, purpose, code string) error {
	destination = strings.TrimSpace(destination)
	if destination == "" || strings.Contains(destination, "@") {
		return errors.New("invalid phone destination")
	}
	_, body := messageContent(purpose, code)
	form := url.Values{}
	form.Set("username", s.config.AfricaTalkingUsername)
	form.Set("to", destination)
	form.Set("message", body)
	if s.config.AfricaTalkingSenderID != "" {
		form.Set("from", s.config.AfricaTalkingSenderID)
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		s.endpoint,
		strings.NewReader(form.Encode()),
	)
	if err != nil {
		return fmt.Errorf("create SMS request: %w", err)
	}
	req.Header.Set("apiKey", s.config.AfricaTalkingAPIKey)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send SMS request: %w", err)
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return fmt.Errorf("read SMS provider response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("SMS provider returned HTTP status %d", resp.StatusCode)
	}

	var result africaTalkingResponse
	if err := json.Unmarshal(responseBody, &result); err != nil {
		return errors.New("SMS provider returned an invalid response")
	}
	recipients := result.SMSMessageData.Recipients
	if len(recipients) == 0 {
		return errors.New("SMS provider returned no recipient delivery result")
	}
	for _, recipient := range recipients {
		if recipient.StatusCode != 100 {
			return fmt.Errorf("SMS provider rejected recipient (status %d)", recipient.StatusCode)
		}
	}
	return nil
}

func messageContent(purpose, code string) (string, string) {
	var action string
	switch purpose {
	case "verify_email":
		action = "verify your email address"
	case "verify_phone":
		action = "verify your phone number"
	case "password_reset":
		action = "reset your AIDORA password"
	default:
		action = "complete your AIDORA security request"
	}
	subject := "Your AIDORA security code"
	body := fmt.Sprintf(
		"Your AIDORA code to %s is: %s\n\nThis code expires in 10 minutes. If you did not request this, you can ignore this message. Do not share this code with anyone.",
		action,
		code,
	)
	return subject, body
}
