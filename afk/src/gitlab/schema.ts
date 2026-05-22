/**
 * gitlab/schema.ts — zod schemas for the GitLab JSON the pipeline consumes.
 *
 * `glab` output is an external, untrusted boundary: every shape that crosses
 * it is validated here rather than `as`-cast. The defaults absorb fields an
 * endpoint may omit, so one schema serves several call sites.
 */
import { z } from "zod";

/**
 * An issue from `glab issue list` / `glab issue view`. One schema covers the
 * queue read, the claim-time label check, and the staleness sweep.
 */
export const IssueSchema = z.object({
  iid: z.number(),
  title: z.string(),
  description: z.string().nullable().default(null),
  labels: z.array(z.string()).default([]),
  updated_at: z.string().default(""),
});

/** An issue as the orchestrator consumes it. */
export type GitLabIssue = z.infer<typeof IssueSchema>;

/** A merge request from `glab mr list` / `glab mr create --output json`. */
export const MergeRequestSchema = z.object({
  iid: z.number(),
  web_url: z.string().default(""),
  state: z.string().default(""),
});

/** A merge request as the orchestrator consumes it. */
export type GitLabMergeRequest = z.infer<typeof MergeRequestSchema>;
