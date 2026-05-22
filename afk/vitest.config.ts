import { defineConfig } from "vitest/config"

// Scope test discovery to our own sources only — the Effect source under
// effect-ref/ is a read-only pattern reference, not part of this project.
export default defineConfig({
  test: {
    include: ["{src,scripts}/**/*.test.ts"],
  },
})
