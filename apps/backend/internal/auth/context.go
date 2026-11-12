package auth

import (
	"context"
	"strings"
)

type principalContextKey struct{}

func WithPrincipal(ctx context.Context, principal Principal) context.Context {
	return context.WithValue(ctx, principalContextKey{}, principal)
}

func PrincipalFromContext(ctx context.Context) (Principal, bool) {
	principal, ok := ctx.Value(principalContextKey{}).(Principal)
	if !ok || strings.TrimSpace(principal.UserID) == "" {
		return Principal{}, false
	}

	return principal, true
}
