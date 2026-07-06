package commands

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"

	"github.com/thani-sh/provar/libs/domain"
)

// visualResult describes the outcome of comparing a fresh screenshot against
// its baseline. Used by run.go to surface visual regressions to the user
// without failing the run outright (visual diffs are info-only by default —
// failing them belongs in a future --strict-visual flag).
type visualResult int

const (
	visualFirstRun visualResult = iota // no baseline yet — saved as current only
	visualMatch                        // bytes identical to baseline
	visualDiff                         // bytes differ from baseline
)

// visualRecord is what renderEvent needs to act on the visual-comparison
// event: the per-file bucket the screenshot belongs to, the action ID, and the
// base64-encoded PNG bytes. The runner already emits these fields on the
// event — see libs/engine/runner.go.
type visualRecord struct {
	fileStem string // basename of the file without extension
	actionID string
	pngB64   string
}

// visualPath returns where the current-run screenshot for a (file, action)
// pair should be saved under the project root. Caller is responsible for
// creating the parent directory.
func visualPath(projectRoot, fileStem, actionID string) string {
	return filepath.Join(projectRoot, domain.VisualDir, fileStem, actionID+".png")
}

// baselinePath returns where the accepted baseline for a (file, action) pair
// lives under the project root. Missing baselines are not an error — the
// caller treats them as "first run, no comparison".
func baselinePath(projectRoot, fileStem, actionID string) string {
	return filepath.Join(projectRoot, domain.BaselinesDir, fileStem, actionID+".png")
}

// saveScreenshot decodes a base64 PNG and writes it to visualPath. Returns
// the absolute path of the saved file so the caller can print it.
func saveScreenshot(projectRoot, fileStem, actionID, pngB64 string) (string, error) {
	png, err := base64.StdEncoding.DecodeString(pngB64)
	if err != nil {
		return "", fmt.Errorf("decode screenshot for %s/%s: %w", fileStem, actionID, err)
	}
	dst := visualPath(projectRoot, fileStem, actionID)
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return "", fmt.Errorf("create visual dir for %s: %w", fileStem, err)
	}
	if err := os.WriteFile(dst, png, 0o644); err != nil {
		return "", fmt.Errorf("write screenshot to %s: %w", dst, err)
	}
	return dst, nil
}

// compareToBaseline hashes the just-saved screenshot and compares against
// the baseline hash. Returns visualMatch if identical, visualDiff if they
// differ, visualFirstRun if no baseline exists yet.
func compareToBaseline(projectRoot, fileStem, actionID string, png []byte) visualResult {
	baseline := baselinePath(projectRoot, fileStem, actionID)
	bh, err := os.ReadFile(baseline)
	if err != nil {
		return visualFirstRun
	}
	h1 := sha256.Sum256(png)
	h2 := sha256.Sum256(bh)
	if h1 == h2 {
		return visualMatch
	}
	return visualDiff
}

// formatVisualHash returns the short hex form of sha256(png) for human-readable
// diff messages. Pure helper so renderEvent stays free of crypto details.
func formatVisualHash(png []byte) string {
	sum := sha256.Sum256(png)
	return hex.EncodeToString(sum[:])[:12]
}
