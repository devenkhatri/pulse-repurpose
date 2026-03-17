# Skill: Cron

## Purpose
Run all scheduled operations for Pulse Repurpose. Maintain system health, trigger repurposing
for new posts, update memory, surface gaps, and keep Heartbeat.md current.

## Schedule
Default: daily at 07:00 local time.
Configurable via CRON_SCHEDULE env var (cron expression).

## Pre-flight checklist
Before doing anything else:
1. Read Heartbeat.md — check last run timestamp. If last run was less than 1 hour ago, abort (duplicate run guard).
2. Verify all 4 n8n webhook URLs are reachable (fire OPTIONS or HEAD requests).
3. Log run start to today's daily memory file: memory/daily/[today].md

## Operations (run in this order)

### Operation 1 — Ingest new LinkedIn posts
1. Call GET_ALL_POSTS via Sheet webhook with filter: postedAt > lastCronRunTimestamp
2. For each new post found:
   a. Check if all platform statuses are "pending"
   b. If yes: execute Repurpose skill (Step 1-6) for this post
   c. Log to daily memory: "New post [postId] found and repurpose triggered"
3. Update Heartbeat.md: "New LinkedIn posts since last run: [N]"

### Operation 2 — Performance scraping
1. Trigger the existing n8n Apify scraper (call its webhook or the existing n8n workflow) to pull LinkedIn engagement data for posts from the last 48 hours
2. For each post with engagement data:
   a. Compare engagement (likes, comments, shares) against previous posts on same topic
   b. If a post is in the top 25% for engagement: flag it in MEMORY.md as "high performer"
   c. Append to learnings.md: "[date] Content performance: [postId] — [topic summary] performed [X]% above average on LinkedIn. Prioritize repurposing similar content."
3. Update USER.md "best performing topics" section with any new patterns

### Operation 3 — Learning system update
1. Call GET_ALL_POSTS with filter: status changes in last 24 hours (approved, edited, rejected)
2. For each post with recent status changes:
   a. Compare current variant text against the last AI-generated text (detect if user edited)
   b. If edited: extract the diff, infer the pattern, append to learnings.md
   c. If approved without edits: increment confidence on matching learnings.md entry
   d. If multiple posts show same edit pattern: promote to high-confidence learning
3. Trim learnings.md if over 2000 lines: summarize oldest low-confidence entries into a paragraph, replace them

### Operation 4 — Gap detection
1. For each platform, find the most recent published post date (GET_ALL_POSTS, filter status=published, sort by publishedAt desc)
2. Calculate days since last publish per platform
3. For any platform with gap > 3 days:
   a. Check if there are approved+unscheduled posts that could fill the gap
   b. If yes: generate a calendar fill suggestion and append to Heartbeat.md flags
   c. If no: append to Heartbeat.md flags — "No approved content ready for [platform] — consider repurposing a post"
4. Run topic pillar gap detection:
   a. Scan last 10 published posts per platform for topic pillar keywords
   b. If any pillar missing from last 10 posts: flag in Heartbeat.md

### Operation 5 — Calendar fill suggestions
1. Find all approved+unscheduled variants across all posts (GET_ALL_POSTS filter: status=approved, scheduledAt=null)
2. Find gaps in the next 7 days calendar (slots with no scheduled posts per platform)
3. For each gap:
   a. Match an approved unscheduled variant to the gap (prioritize high-performing content topics)
   b. Generate a suggested schedule time (optimal posting times per platform: Twitter 9am/3pm, Instagram 11am/7pm, Facebook 1pm, Threads 10am, Skool 8am)
   c. Write suggestion to MEMORY.md — not auto-scheduled, user must confirm
4. Surface suggestions in Heartbeat.md "Flags requiring attention" section

### Operation 6 — Daily memory snapshot
1. Compile the daily memory file for today (memory/daily/[date].md) with:
   - All operations performed and their outcomes
   - New posts found and processed
   - Learning updates made
   - Gaps and suggestions surfaced
   - Any errors or flags
2. Summarize MEMORY.md — move events older than 7 days into the corresponding daily file, keep MEMORY.md focused on the last 7 days

### Operation 7 — Heartbeat.md update (final)
Rewrite Heartbeat.md with fresh data from all operations above:
- Update "Last cron run" timestamp
- Update all content pipeline counts
- Update platform health section
- Update active learning signals (top 3 most recent high-confidence learnings)
- Update flags requiring attention
- Update memory pointers

### Operation 8 — Completion log
- Append final summary to today's daily memory file
- Log to MEMORY.md: "[timestamp] Cron run completed. Duration: [N]s. Posts processed: [N]. Learnings updated: [N]."

## Error handling
- If any single operation fails, log the error and continue to next operation. Never abort the full cron run for a single failure.
- If Sheet webhook is unreachable: skip Operations 1, 2, 3, 4, 5. Update Heartbeat.md with "Sheet webhook unreachable — data operations skipped."
- All errors are written to today's daily memory file and flagged in Heartbeat.md.

## Success criteria
A cron run is successful when:
- Heartbeat.md has been updated with current timestamp
- Daily memory file exists for today
- MEMORY.md is within rolling window (not over 500 lines)
- No critical flags are silently dropped
