package bindings

import (
	"os"
	"testing"

	"github.com/thani-sh/provar/libs/domain"
)

// TestDomainImportReachable is a smoke test that the libs/domain package
// is reachable from the bindings module via the replace directive in
// go.mod. Phase 1 of docs/plans/provar-app-refactor.md only required
// "the import resolves"; this test is the proof. It can be deleted
// once the bindings start calling domain functions in earnest.
func TestDomainImportReachable(t *testing.T) {
	if domain.ProviderOpenAI != "openai" {
		t.Errorf("domain.ProviderOpenAI = %q, want %q", domain.ProviderOpenAI, "openai")
	}
	if _, err := os.UserHomeDir(); err != nil {
		t.Skipf("home dir unavailable: %v", err)
	}
}
