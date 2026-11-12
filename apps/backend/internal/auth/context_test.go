package auth

import (
	"context"
	"testing"
)

func TestWithPrincipalAndPrincipalFromContext(t *testing.T) {
	expected := Principal{
		UserID: "user-123",
	}

	ctx := WithPrincipal(context.Background(), expected)

	actual, ok := PrincipalFromContext(ctx)

	if !ok {
		t.Fatal("expected principal to be found")
	}

	if actual.UserID != expected.UserID {
		t.Errorf("expected UserID %q, got %q", expected.UserID, actual.UserID)
	}
}

func TestPrincipalFromContext(t *testing.T) {
	tests := []struct {
		name   string
		ctx    context.Context
		wantOK bool
	}{
		{
			name:   "missing principal",
			ctx:    context.Background(),
			wantOK: false,
		},
		{
			name: "empty user ID",
			ctx: WithPrincipal(context.Background(), Principal{
				UserID: "",
			}),
			wantOK: false,
		},
		{
			name: "whitespace user ID",
			ctx: WithPrincipal(context.Background(), Principal{
				UserID: "   ",
			}),
			wantOK: false,
		},
		{
			name: "valid principal",
			ctx: WithPrincipal(context.Background(), Principal{
				UserID: "user-123",
			}),
			wantOK: true,
		},
		{
			name: "incorrect stored type",
			ctx: context.WithValue(
				context.Background(),
				principalContextKey{},
				"not a principal",
			),
			wantOK: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, ok := PrincipalFromContext(tt.ctx)

			if ok != tt.wantOK {
				t.Errorf("expected ok=%v, got %v", tt.wantOK, ok)
			}
		})
	}
}
