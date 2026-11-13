package api

import (
	"encoding/json"
	"net/http"
)

type Response struct {
	Success bool      `json:"success"`
	Data    any       `json:"data,omitempty"`
	Error   *APIError `json:"error,omitempty"`
}

type APIError struct {
	Code    string         `json:"code"`
	Message string         `json:"message"`
	Details map[string]any `json:"details,omitempty"`
}

func WriteSuccess(w http.ResponseWriter, status int, data any) error {
	return writeJSON(w, status, Response{
		Success: true,
		Data:    data,
	})
}

func WriteError(
	w http.ResponseWriter,
	status int,
	code string,
	message string,
	details map[string]any,
) error {
	return writeJSON(w, status, Response{
		Success: false,
		Error: &APIError{
			Code:    code,
			Message: message,
			Details: details,
		},
	})
}

func writeJSON(w http.ResponseWriter, status int, response Response) error {
	body, err := json.Marshal(response)
	if err != nil {
		return err
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	_, err = w.Write(append(body, '\n'))
	return err
}
