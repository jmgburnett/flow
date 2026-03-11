#!/usr/bin/env npx tsx
/**
 * Figma → Flow Design Token Sync
 * 
 * Pulls the latest Cypress design system tokens from Figma
 * and generates apps/web/app/tokens.css
 * 
 * Usage:
 *   npx tsx scripts/sync-figma-tokens.ts
 *   FIGMA_API_KEY=xxx npx tsx scripts/sync-figma-tokens.ts
 * 
 * Figma file: UA7g21UklfSbtc2fXvNOHS (🟡 Cypress: Foundations)
 */

import * as fs from "fs";
import * as path from "path";

const FIGMA_API_KEY = process.env.FIGMA_API_KEY;
if (!FIGMA_API_KEY) {
	console.error("❌ Set FIGMA_API_KEY environment variable");
	process.exit(1);
}
const FILE_KEY = "UA7g21UklfSbtc2fXvNOHS";

// Page node IDs in the Cypress Foundations file
const PAGES = {
	color: "23317:4067",
	typography: "2701:21012",
	spacing: "3212:21096",
	materials: "22984:97281",
	border: "23033:18768",
};

const OUTPUT_PATH = path.resolve(__dirname, "../apps/web/app/tokens.css");

// ─── Figma API helpers ───

async function fetchNodes(nodeId: string, depth: number = 10): Promise<any> {
	const url = `https://api.figma.com/v1/files/${FILE_KEY}/nodes?ids=${nodeId}&depth=${depth}`;
	const resp = await fetch(url, {
		headers: { "X-Figma-Token": FIGMA_API_KEY },
	});
	if (!resp.ok) throw new Error(`Figma API error: ${resp.status} ${await resp.text()}`);
	return resp.json();
}

function rgbaToHex(r: number, g: number, b: number): string {
	return `#${Math.round(r * 255).toString(16).padStart(2, "0")}${Math.round(g * 255).toString(16).padStart(2, "0")}${Math.round(b * 255).toString(16).padStart(2, "0")}`;
}

function rgbaToCSS(r: number, g: number, b: number, a: number): string {
	if (a >= 0.99) return rgbaToHex(r, g, b);
	return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a.toFixed(2)})`;
}

// ─── Extract colors ───

interface ColorToken {
	name: string;
	hex: string;
	rgba: string;
	opacity: number;
}

function extractColors(node: any, path: string = "", results: ColorToken[] = []): ColorToken[] {
	const name = node.name || "";
	const currentPath = path ? `${path}/${name}` : name;

	const fills = node.fills || [];
	for (const fill of fills) {
		if (fill.type === "SOLID" && fill.visible !== false) {
			const { r, g, b } = fill.color || {};
			const a = fill.opacity ?? fill.color?.a ?? 1;
			if (r !== undefined) {
				// Skip generic frame/shape names
				if (name && !name.match(/^(Frame|Rectangle|BG|Group|Vector|Ellipse|Line|\d)/)) {
					results.push({
						name: currentPath,
						hex: rgbaToHex(r, g, b),
						rgba: rgbaToCSS(r, g, b, a),
						opacity: Math.round(a * 100) / 100,
					});
				}
			}
		}
	}

	for (const child of (node.children || [])) {
		extractColors(child, currentPath, results);
	}
	return results;
}

// ─── Extract typography ───

interface TypoToken {
	name: string;
	fontFamily: string;
	fontWeight: number;
	fontSize: number;
	lineHeight: number;
	letterSpacing: number;
}

function extractTypography(node: any, results: TypoToken[] = []): TypoToken[] {
	if (node.type === "TEXT" && node.style) {
		const s = node.style;
		if (s.fontSize) {
			results.push({
				name: node.name || node.characters?.slice(0, 30) || "text",
				fontFamily: s.fontFamily || "",
				fontWeight: s.fontWeight || 400,
				fontSize: s.fontSize,
				lineHeight: s.lineHeightPx || s.fontSize * 1.5,
				letterSpacing: s.letterSpacing || 0,
			});
		}
	}
	for (const child of (node.children || [])) {
		extractTypography(child, results);
	}
	return results;
}

// ─── Extract shadows & materials ───

interface ShadowToken {
	name: string;
	type: string;
	shadows: string[];
	blur?: number;
}

function extractMaterials(node: any, results: ShadowToken[] = []): ShadowToken[] {
	const effects = node.effects || [];
	const shadows: string[] = [];
	let blurRadius = 0;

	for (const eff of effects) {
		if (!eff.visible && eff.visible !== undefined) continue;
		if (eff.type === "DROP_SHADOW" || eff.type === "INNER_SHADOW") {
			const c = eff.color || {};
			const r = Math.round((c.r || 0) * 255);
			const g = Math.round((c.g || 0) * 255);
			const b = Math.round((c.b || 0) * 255);
			const a = (c.a || 0).toFixed(2);
			const ox = eff.offset?.x || 0;
			const oy = eff.offset?.y || 0;
			const blur = eff.radius || 0;
			const spread = eff.spread || 0;
			const prefix = eff.type === "INNER_SHADOW" ? "inset " : "";
			shadows.push(`${prefix}${ox}px ${oy}px ${blur}px ${spread}px rgba(${r}, ${g}, ${b}, ${a})`);
		} else if (eff.type === "BACKGROUND_BLUR") {
			blurRadius = eff.radius || 0;
		}
	}

	if (shadows.length > 0 || blurRadius > 0) {
		results.push({
			name: node.name || "",
			type: blurRadius > 0 ? "glass" : "shadow",
			shadows,
			blur: blurRadius || undefined,
		});
	}

	for (const child of (node.children || [])) {
		extractMaterials(child, results);
	}
	return results;
}

// ─── Extract spacing ───

function extractSpacing(node: any, results: string[] = []): string[] {
	if (node.type === "TEXT" && node.characters) {
		const chars = node.characters.trim();
		if (/^\d+(\.\d+)?(px)?$/.test(chars)) {
			results.push(chars.replace("px", ""));
		}
	}
	for (const child of (node.children || [])) {
		extractSpacing(child, results);
	}
	return results;
}

// ─── Build CSS ───

function buildTokenCSS(
	colors: ColorToken[],
	typography: TypoToken[],
	materials: ShadowToken[],
	spacingValues: string[],
): string {
	const timestamp = new Date().toISOString();

	// Deduplicate colors: use CSS variable name as key, keep first occurrence
	const deduped = new Map<string, { varName: string; value: string }>();
	for (const c of colors) {
		// Build a clean variable name from the path
		const parts = c.name.split("/").filter(Boolean);
		// Use last 2 meaningful parts
		const meaningful = parts
			.filter((p) => !p.match(/^(Color|Colors|Swatch|Style|Component|Instance|Frame|\d)/i))
			.slice(-2)
			.join("-");
		if (!meaningful || meaningful.length < 2) continue;

		const varName = meaningful.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-");
		if (!varName || varName.length < 2) continue;

		// Skip pure white/black unless named specifically
		if ((c.hex === "#ffffff" || c.hex === "#000000") && !varName.match(/page|card|surface|bg/)) continue;

		if (!deduped.has(varName)) {
			deduped.set(varName, { varName, value: c.rgba });
		}
	}

	// Group by prefix
	const grouped: Record<string, Array<{ varName: string; value: string }>> = {};
	for (const [_, token] of deduped) {
		const prefix = token.varName.split("-")[0] || "other";
		if (!grouped[prefix]) grouped[prefix] = [];
		grouped[prefix].push(token);
	}

	// Unique font families
	const fontFamilies = [...new Set(typography.map((t) => t.fontFamily).filter(Boolean))];

	// Unique font sizes (sorted desc)
	const fontSizes = [...new Set(typography.map((t) => t.fontSize))].sort((a, b) => b - a);

	// Spacing scale (sorted)
	const spacing = [...new Set(spacingValues.map(Number).filter((n) => !isNaN(n)))].sort((a, b) => a - b);

	// Elevation levels from materials
	const elevations = materials.filter((m) => m.shadows.length > 0);

	let css = `/* ═══════════════════════════════════════════════════════════════
   Cypress Design Tokens — Auto-generated from Figma
   Source: figma.com/design/${FILE_KEY}
   Generated: ${timestamp}
   ⚠️  DO NOT EDIT — regenerate with: npx tsx scripts/sync-figma-tokens.ts
   ═══════════════════════════════════════════════════════════════ */

:root {
  /* ── Figma Sync Metadata ── */
  --figma-synced-at: "${timestamp}";

  /* ── Colors (${deduped.size} unique tokens) ── */
`;

	for (const [prefix, tokens] of Object.entries(grouped).sort()) {
		css += `\n  /* ${prefix} */\n`;
		for (const t of tokens) {
			css += `  --cypress-${t.varName}: ${t.value};\n`;
		}
	}

	// Typography
	css += `\n  /* ── Typography — Font Families ── */\n`;
	for (const f of fontFamilies) {
		const varName = f.toLowerCase().replace(/\s+/g, "-");
		css += `  --cypress-font-${varName}: "${f}", sans-serif;\n`;
	}

	css += `\n  /* ── Typography — Font Sizes ── */\n`;
	const sizeNames = ["4xl", "3xl", "2xl", "xl", "lg", "base", "sm", "xs", "2xs"];
	for (let i = 0; i < fontSizes.length && i < sizeNames.length; i++) {
		css += `  --cypress-text-${sizeNames[i]}: ${fontSizes[i]}px;\n`;
	}

	// Spacing
	css += `\n  /* ── Spacing Scale (${spacing.length} values) ── */\n`;
	for (const s of spacing) {
		css += `  --cypress-space-${s}: ${s}px;\n`;
	}

	// Shadows / Elevations
	css += `\n  /* ── Elevation / Shadows ── */\n`;
	for (const elev of elevations) {
		const varName = elev.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
		if (varName) {
			css += `  --cypress-shadow-${varName}: ${elev.shadows.join(", ")};\n`;
			if (elev.blur) {
				css += `  --cypress-blur-${varName}: ${elev.blur}px;\n`;
			}
		}
	}

	// Glass materials
	const glassMaterials = materials.filter((m) => m.blur && m.blur > 0);
	if (glassMaterials.length > 0) {
		css += `\n  /* ── Glass / Blur Materials ── */\n`;
		for (const g of glassMaterials) {
			const varName = g.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
			if (varName) {
				css += `  --cypress-blur-${varName}: ${g.blur}px;\n`;
			}
		}
	}

	css += `}\n`;

	return css;
}

// ─── Main ───

async function main() {
	console.log("🎨 Syncing Cypress design tokens from Figma...\n");

	// Fetch all pages in parallel
	console.log("  Fetching color page...");
	const [colorData, typoData, spacingData, materialsData] = await Promise.all([
		fetchNodes(PAGES.color),
		fetchNodes(PAGES.typography),
		fetchNodes(PAGES.spacing),
		fetchNodes(PAGES.materials),
	]);

	// Extract tokens
	console.log("  Extracting colors...");
	const colors: ColorToken[] = [];
	for (const [_, nodeData] of Object.entries<any>(colorData.nodes || {})) {
		extractColors(nodeData.document, "", colors);
	}
	console.log(`    Found ${colors.length} color references`);

	console.log("  Extracting typography...");
	const typography: TypoToken[] = [];
	for (const [_, nodeData] of Object.entries<any>(typoData.nodes || {})) {
		extractTypography(nodeData.document, typography);
	}
	// Deduplicate by size+weight
	const seenTypo = new Set<string>();
	const uniqueTypo = typography.filter((t) => {
		const key = `${t.fontSize}_${t.fontWeight}`;
		if (seenTypo.has(key)) return false;
		seenTypo.add(key);
		return true;
	});
	console.log(`    Found ${uniqueTypo.length} unique type styles`);

	console.log("  Extracting spacing...");
	const spacingValues: string[] = [];
	for (const [_, nodeData] of Object.entries<any>(spacingData.nodes || {})) {
		extractSpacing(nodeData.document, spacingValues);
	}
	console.log(`    Found ${spacingValues.length} spacing values`);

	console.log("  Extracting materials & shadows...");
	const materials: ShadowToken[] = [];
	for (const [_, nodeData] of Object.entries<any>(materialsData.nodes || {})) {
		extractMaterials(nodeData.document, materials);
	}
	console.log(`    Found ${materials.length} material definitions`);

	// Generate CSS
	console.log("\n  Generating tokens.css...");
	const css = buildTokenCSS(colors, uniqueTypo, materials, spacingValues);

	// Write output
	fs.writeFileSync(OUTPUT_PATH, css, "utf-8");
	console.log(`  ✅ Written to ${OUTPUT_PATH}`);
	console.log(`  ${css.split("\n").length} lines, ${css.length} bytes`);
	console.log("\n🎨 Done! Tokens synced from Figma.");
}

main().catch((err) => {
	console.error("❌ Sync failed:", err);
	process.exit(1);
});
