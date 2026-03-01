/**
 * Generate philosophy illustration images for the Thinking Smart plugin page.
 *
 * Uses the CLIproxy API (localhost:8317) with gemini-3-pro-image model
 * to generate editorial-style illustrations for each Design Philosophy card.
 *
 * Usage:
 *   CLIPROXY_API_KEY=<key> npx tsx scripts/generate-philosophy-images.ts
 *
 * Or set CLIPROXY_API_KEY in the root .env file.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from project root
config({ path: join(__dirname, "../../.env") });

const CLIPROXY_BASE_URL = "https://yinli.one/v1";
const MODEL = "gemini-3-pro-image-preview";
const OUTPUT_DIR = join(__dirname, "../public/images/philosophies");

// Ensure output directory exists
mkdirSync(OUTPUT_DIR, { recursive: true });

// ── Style preamble shared across all prompts ──────────────────────────
// This ensures visual consistency across the illustrations.
//
// CONFIGURATION: Edit these preambles to change the overall visual style.
// - STYLE_PREAMBLE: Used for single hero images (parallelism, plan-audit)
// - COMPARISON_STYLE_PREAMBLE: Used for comparison pair images (raw/thinking-smart)
//
const STYLE_PREAMBLE = `You are generating a single clean icon-style illustration. Think of an app icon or a simple infographic symbol.

STRICT STYLE REQUIREMENTS — follow these exactly:
- Extremely simple, clean, and minimal — like a well-designed app icon or a single symbol
- Maximum 2-3 distinct visual elements in the entire image
- Use ONLY these colors: deep charcoal (#2C2416) for outlines/shapes, one accent color per image (either #C4704B terracotta OR #7D9B84 sage green, not both), and white (#FFFFFF) background
- Thick, confident line work — no thin or sketchy lines
- No gradients, no shadows, no texture, no noise
- No text, no labels, no words, no letters, no numbers
- No human faces or realistic figures
- Aspect ratio: landscape, roughly 16:10
- Pure white background with at least 30% whitespace around the subject
- The illustration should be immediately recognizable as a concept at thumbnail size
- Think: Apple's SF Symbols, or Notion's page icons — that level of simplicity
`;

const COMPARISON_STYLE_PREAMBLE = `You are generating a single clean icon-style illustration. Think of an app icon or a simple infographic symbol.

STRICT STYLE REQUIREMENTS — follow these exactly:
- Extremely simple, clean, and minimal — like a well-designed app icon or a single symbol
- Maximum 2-3 distinct visual elements in the entire image
- Use ONLY these colors: deep charcoal (#2C2416) for outlines/shapes, one accent color per image (either #C4704B terracotta OR #7D9B84 sage green, not both), and white (#FFFFFF) background
- Thick, confident line work — no thin or sketchy lines
- No gradients, no shadows, no texture, no noise
- No text, no labels, no words, no letters, no numbers
- No human faces or realistic figures
- Aspect ratio: roughly 4:3 (compact)
- Pure white background with at least 30% whitespace around the subject
- The illustration should be immediately recognizable as a concept at thumbnail size
- Think: Apple's SF Symbols, or Notion's page icons — that level of simplicity
`;

// ── Per-philosophy prompts ─────────────────────────────────────────────

interface PhilosophyPrompt {
  id: string;
  filename: string;
  prompt: string;
}

// ── Per-philosophy prompts ─────────────────────────────────────────────
//
// CONFIGURATION: Edit individual prompts below to change what each image depicts.
// Each prompt is concatenated with its style preamble.
//
// To regenerate all:  npx tsx scripts/generate-philosophy-images.ts --force
// To regenerate one:  rm public/images/philosophies/<filename> && npx tsx scripts/generate-philosophy-images.ts
//

const philosophyPrompts: PhilosophyPrompt[] = [
  // ── Comparison pairs (Raw + Thinking Smart) ──────────────────────────────────
  //
  // "Raw" images use charcoal (#2C2416) only — no accent color — to feel limited.
  // "Thinking Smart" images use sage green (#7D9B84) accent — to feel expanded.
  //
  {
    id: "ground-truth-first-raw",
    filename: "ground-truth-first-raw.jpg",
    prompt: `${COMPARISON_STYLE_PREAMBLE}
Draw a single terminal window or code editor icon — a rounded rectangle with two small circles in the top-left corner (like a macOS window) and three horizontal lines inside representing code. This represents a local codebase. Drawn with thick charcoal (#2C2416) outlines only, no fill color. The window sits alone, centered, with generous whitespace. Nothing else in the image. Conveys: working only from local code, no external information.`,
  },
  {
    id: "ground-truth-first-thinking-smart",
    filename: "ground-truth-first-thinking-smart.jpg",
    prompt: `${COMPARISON_STYLE_PREAMBLE}
Draw the same terminal/code editor window icon (rounded rectangle with two dots in top-left, horizontal lines for code) in charcoal (#2C2416) on the left side. To its right, draw a small globe icon (simple circle with two curved latitude/longitude lines) in sage green (#7D9B84). Connect them with a double-headed arrow in sage green. White background. Conveys: the codebase is now connected to web search — local code plus verified web knowledge working together.`,
  },
  {
    id: "clear-plan-raw",
    filename: "clear-plan-raw.jpg",
    prompt: `${COMPARISON_STYLE_PREAMBLE}
Draw a document icon (rectangle with folded corner) filled with many tightly packed horizontal lines of varying lengths, representing a wall of dense text. The lines are close together, creating a heavy, text-heavy appearance. All in charcoal (#2C2416), no accent color. White background. Conveys: a plan that is all text — dense, hard to review, creates reading pressure.`,
  },
  {
    id: "clear-plan-thinking-smart",
    filename: "clear-plan-thinking-smart.jpg",
    prompt: `${COMPARISON_STYLE_PREAMBLE}
Draw a document icon (rectangle with folded corner) that contains a small flowchart diagram inside it — three small boxes connected by arrows in a top-down flow. The document outline is charcoal (#2C2416). The flowchart boxes and arrows inside are sage green (#7D9B84). White background. Conveys: a plan that uses diagrams instead of walls of text — graphical, easy to review at a glance, reduces review pressure.`,
  },
  {
    id: "error-recovery-raw",
    filename: "error-recovery-raw.jpg",
    prompt: `${COMPARISON_STYLE_PREAMBLE}
Draw a simple diagram: on the left, a small circle (start point). A solid horizontal arrow points right toward a large X mark (representing a tool failure). After the X, a dashed arrow continues rightward but curves downward, ending with a question mark. All in charcoal (#2C2416), no accent color. White background. Conveys: after a tool fails, the agent guesses and drifts away from the goal — no plan to fall back on.`,
  },
  {
    id: "error-recovery-thinking-smart",
    filename: "error-recovery-thinking-smart.jpg",
    prompt: `${COMPARISON_STYLE_PREAMBLE}
Draw a simple diagram: on the left, a small circle (start point). A solid horizontal arrow points right toward a large X mark (representing a tool failure) in charcoal (#2C2416). After the X, instead of drifting, a curved arrow loops back upward to a small document icon (the plan file) drawn in sage green (#7D9B84), then a new solid arrow continues rightward from the document to a filled circle (the goal) in sage green. White background. Conveys: after a tool fails, the agent consults the plan file and recovers back on course to the goal.`,
  },
  // ── Single illustrations (no comparison) ──────────────────────────────
  {
    id: "parallelism",
    filename: "parallelism.jpg",
    prompt: `${STYLE_PREAMBLE}
Draw a diagram showing task parallelism: On the left, a single filled circle (the orchestrator). From it, three arrows fan out to the right, each pointing to a separate small rectangle (representing three independent subagent tasks running simultaneously). Each rectangle has a small gear or cog icon inside it. From each rectangle, arrows converge to a single filled circle on the far right (the merged result). The orchestrator and result circles are terracotta (#C4704B). The three task rectangles and their gears are charcoal (#2C2416). The arrows are charcoal. White background. Conveys: one orchestrator spawns multiple parallel tasks that run simultaneously and merge results.`,
  },
  {
    id: "plan-audit",
    filename: "plan-audit.jpg",
    prompt: `${STYLE_PREAMBLE}
Draw a complete document icon (rectangle with folded corner, fully visible with clear top and bottom edges) on the left side. Inside the document, draw four horizontal lines representing plan items. To the right of the document, draw four status indicators aligned with each line: the first three are filled circles in terracotta (#C4704B) representing "Done", the fourth is a half-filled circle (left half filled, right half empty) in terracotta representing "Partial". Thin dotted lines in charcoal (#2C2416) connect each document line to its status indicator. The document outline is charcoal. White background, generous whitespace. Conveys: each item in the plan file is systematically checked and given an evidence-based status — Done or Partial.`,
  },
];

// ── API call ───────────────────────────────────────────────────────────

async function generateImage(prompt: string): Promise<Buffer> {
  const apiKey = process.env.CLIPROXY_API_KEY;
  if (!apiKey) {
    throw new Error(
      "CLIPROXY_API_KEY not set. Add it to .env or pass as environment variable."
    );
  }

  const response = await fetch(`${CLIPROXY_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API request failed (${response.status}): ${text}`);
  }

  const data = await response.json();

  // Try extracting image from message.images array first
  const images = data?.choices?.[0]?.message?.images;
  if (images && images.length > 0) {
    const dataUri = images[0].image_url.url;
    const base64Data = dataUri.split(",", 2)[1];
    if (base64Data) {
      return Buffer.from(base64Data, "base64");
    }
  }

  // Fallback: extract base64 image from markdown in content field
  // e.g. ![image](data:image/jpeg;base64,/9j/4AAQ...)
  const textContent = data?.choices?.[0]?.message?.content;
  if (textContent) {
    const match = textContent.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
    if (match && match[1]) {
      return Buffer.from(match[1], "base64");
    }
    throw new Error(`No image data found in response content: ${textContent.slice(0, 200)}`);
  }

  throw new Error("No images in response");
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  console.log("🎨 Generating philosophy illustrations for Thinking Smart plugin page\n");
  console.log(`   Model: ${MODEL}`);
  console.log(`   Output: ${OUTPUT_DIR}\n`);

  const apiKey = process.env.CLIPROXY_API_KEY;
  if (!apiKey || apiKey === "your-cliproxy-api-key-here") {
    console.error("❌ CLIPROXY_API_KEY not set or still placeholder.");
    console.error("   Please set your CLIproxy API key in .env:");
    console.error("   CLIPROXY_API_KEY=your-actual-key\n");
    process.exit(1);
  }

  let successCount = 0;
  let failCount = 0;

  for (const phil of philosophyPrompts) {
    const outputPath = join(OUTPUT_DIR, phil.filename);

    // Skip if image already exists (use --force to regenerate)
    if (existsSync(outputPath) && !process.argv.includes("--force")) {
      console.log(`  ⏭  ${phil.id}: already exists (use --force to regenerate)`);
      successCount++;
      continue;
    }

    console.log(`  ⟳  ${phil.id}: generating...`);

    try {
      const imageBuffer = await generateImage(phil.prompt);
      writeFileSync(outputPath, imageBuffer);
      const sizeKB = Math.round(imageBuffer.length / 1024);
      console.log(`  ✓  ${phil.id}: saved (${sizeKB} KB)`);
      successCount++;
    } catch (error) {
      console.error(`  ✗  ${phil.id}: failed —`, (error as Error).message);
      failCount++;
    }

    // Small delay between requests to be respectful to the API
    if (phil !== philosophyPrompts[philosophyPrompts.length - 1]) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log(`\n✨ Done! ${successCount} succeeded, ${failCount} failed.`);

  if (failCount > 0) {
    process.exit(1);
  }
}

main();
