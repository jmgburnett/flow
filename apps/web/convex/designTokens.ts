import { v } from "convex/values";
import { internalAction, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

const FIGMA_API_KEY = process.env.FIGMA_API_KEY;

// ─── Queries ───

// Get the latest synced tokens
export const getTokens = query({
	args: {},
	handler: async (ctx) => {
		const tokens = await ctx.db
			.query("design_tokens")
			.order("desc")
			.first();
		return tokens;
	},
});

// ─── Internal mutations ───

export const storeTokens = internalMutation({
	args: {
		fileKey: v.string(),
		syncedAt: v.number(),
		colors: v.any(),
		typography: v.any(),
		spacing: v.any(),
		materials: v.any(),
		cssVariables: v.string(), // The full generated CSS
		tokenCount: v.number(),
	},
	handler: async (ctx, args) => {
		// Keep only the latest 5 syncs
		const old = await ctx.db.query("design_tokens").order("desc").collect();
		for (const o of old.slice(4)) {
			await ctx.db.delete(o._id);
		}

		return await ctx.db.insert("design_tokens", args);
	},
});

// ─── Figma sync action ───

function rgbaToHex(r: number, g: number, b: number): string {
	return `#${Math.round(r * 255).toString(16).padStart(2, "0")}${Math.round(g * 255).toString(16).padStart(2, "0")}${Math.round(b * 255).toString(16).padStart(2, "0")}`;
}

function rgbaToCSS(r: number, g: number, b: number, a: number): string {
	if (a >= 0.99) return rgbaToHex(r, g, b);
	return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a.toFixed(2)})`;
}

interface ExtractedColor {
	name: string;
	hex: string;
	rgba: string;
	opacity: number;
}

function extractColors(node: any, path: string = "", results: ExtractedColor[] = []): ExtractedColor[] {
	const name = node.name || "";
	const currentPath = path ? `${path}/${name}` : name;

	for (const fill of (node.fills || [])) {
		if (fill.type === "SOLID" && fill.visible !== false) {
			const { r, g, b } = fill.color || {};
			const a = fill.opacity ?? fill.color?.a ?? 1;
			if (r !== undefined && name && !name.match(/^(Frame|Rectangle|BG|Group|Vector|Ellipse|Line|\d)/i)) {
				results.push({ name: currentPath, hex: rgbaToHex(r, g, b), rgba: rgbaToCSS(r, g, b, a), opacity: Math.round(a * 100) / 100 });
			}
		}
	}
	for (const child of (node.children || [])) extractColors(child, currentPath, results);
	return results;
}

function extractTypography(node: any, results: any[] = []): any[] {
	if (node.type === "TEXT" && node.style?.fontSize) {
		results.push({
			fontFamily: node.style.fontFamily || "",
			fontWeight: node.style.fontWeight || 400,
			fontSize: node.style.fontSize,
			lineHeight: node.style.lineHeightPx || node.style.fontSize * 1.5,
			letterSpacing: node.style.letterSpacing || 0,
		});
	}
	for (const child of (node.children || [])) extractTypography(child, results);
	return results;
}

function extractMaterials(node: any, results: any[] = []): any[] {
	const shadows: string[] = [];
	let blur = 0;
	for (const eff of (node.effects || [])) {
		if (eff.visible === false) continue;
		if (eff.type === "DROP_SHADOW" || eff.type === "INNER_SHADOW") {
			const c = eff.color || {};
			const prefix = eff.type === "INNER_SHADOW" ? "inset " : "";
			shadows.push(`${prefix}${eff.offset?.x || 0}px ${eff.offset?.y || 0}px ${eff.radius || 0}px ${eff.spread || 0}px rgba(${Math.round((c.r||0)*255)}, ${Math.round((c.g||0)*255)}, ${Math.round((c.b||0)*255)}, ${(c.a||0).toFixed(2)})`);
		} else if (eff.type === "BACKGROUND_BLUR") {
			blur = eff.radius || 0;
		}
	}
	if (shadows.length > 0 || blur > 0) {
		results.push({ name: node.name || "", shadows, blur: blur || undefined });
	}
	for (const child of (node.children || [])) extractMaterials(child, results);
	return results;
}

function extractSpacing(node: any, results: number[] = []): number[] {
	if (node.type === "TEXT" && node.characters) {
		const n = parseFloat(node.characters.trim().replace("px", ""));
		if (!isNaN(n) && n >= 0 && n <= 200) results.push(n);
	}
	for (const child of (node.children || [])) extractSpacing(child, results);
	return results;
}

// Build CSS from extracted tokens
function buildCSS(colors: ExtractedColor[], typography: any[], materials: any[], spacing: number[]): string {
	const timestamp = new Date().toISOString();

	// Deduplicate colors
	const deduped = new Map<string, { varName: string; value: string }>();
	for (const c of colors) {
		const parts = c.name.split("/").filter(Boolean);
		const meaningful = parts
			.filter((p: string) => !p.match(/^(Color|Colors|Swatch|Style|Component|Instance|Frame|\d)/i))
			.slice(-2).join("-");
		if (!meaningful || meaningful.length < 2) continue;
		const varName = meaningful.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-");
		if (!varName || varName.length < 2) continue;
		if ((c.hex === "#ffffff" || c.hex === "#000000") && !varName.match(/page|card|surface|bg/)) continue;
		if (!deduped.has(varName)) deduped.set(varName, { varName, value: c.rgba });
	}

	// Unique type styles
	const seenTypo = new Set<string>();
	const uniqueTypo = typography.filter((t: any) => {
		const key = `${t.fontSize}_${t.fontWeight}`;
		if (seenTypo.has(key)) return false;
		seenTypo.add(key);
		return true;
	});

	const fontFamilies = [...new Set(uniqueTypo.map((t: any) => t.fontFamily).filter(Boolean))];
	const fontSizes = [...new Set(uniqueTypo.map((t: any) => t.fontSize))].sort((a: number, b: number) => b - a);
	const spacingScale = [...new Set(spacing)].sort((a, b) => a - b);

	let css = `/* Cypress Design Tokens — Auto-synced from Figma\n   Generated: ${timestamp} */\n\n:root {\n`;
	css += `  --figma-synced-at: "${timestamp}";\n`;

	// Colors grouped by prefix
	const grouped: Record<string, Array<{ varName: string; value: string }>> = {};
	for (const [_, token] of deduped) {
		const prefix = token.varName.split("-")[0] || "other";
		if (!grouped[prefix]) grouped[prefix] = [];
		grouped[prefix].push(token);
	}
	for (const [prefix, tokens] of Object.entries(grouped).sort()) {
		css += `\n  /* ${prefix} */\n`;
		for (const t of tokens) css += `  --cypress-${t.varName}: ${t.value};\n`;
	}

	// Typography
	css += `\n  /* typography */\n`;
	for (const f of fontFamilies) {
		css += `  --cypress-font-${f.toLowerCase().replace(/\s+/g, "-")}: "${f}", sans-serif;\n`;
	}
	const sizeNames = ["4xl", "3xl", "2xl", "xl", "lg", "base", "sm", "xs", "2xs"];
	for (let i = 0; i < fontSizes.length && i < sizeNames.length; i++) {
		css += `  --cypress-text-${sizeNames[i]}: ${fontSizes[i]}px;\n`;
	}

	// Spacing
	css += `\n  /* spacing */\n`;
	for (const s of spacingScale) css += `  --cypress-space-${s}: ${s}px;\n`;

	// Shadows
	css += `\n  /* elevation */\n`;
	for (const m of materials.filter((m: any) => m.shadows?.length > 0)) {
		const vn = m.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
		if (vn) {
			css += `  --cypress-shadow-${vn}: ${m.shadows.join(", ")};\n`;
			if (m.blur) css += `  --cypress-blur-${vn}: ${m.blur}px;\n`;
		}
	}

	css += `}\n`;
	return css;
}

// Main sync action — called by Convex cron
export const syncFromFigma = internalAction({
	args: { fileKey: v.string() },
	handler: async (ctx, args): Promise<void> => {
		if (!FIGMA_API_KEY) {
			console.error("FIGMA_API_KEY not configured");
			return;
		}

		const PAGES = {
			color: "23317:4067",
			typography: "2701:21012",
			spacing: "3212:21096",
			materials: "22984:97281",
		};

		console.log("🎨 Syncing Cypress tokens from Figma...");

		// Fetch pages sequentially to stay within memory limits
		const fetchPage = async (nodeId: string, depth: number = 5) => {
			const resp = await fetch(
				`https://api.figma.com/v1/files/${args.fileKey}/nodes?ids=${nodeId}&depth=${depth}`,
				{ headers: { "X-Figma-Token": FIGMA_API_KEY! } },
			);
			if (!resp.ok) throw new Error(`Figma API: ${resp.status}`);
			const data = await resp.json();
			return data;
		};

		// Fetch sequentially to reduce memory pressure
		const colorData = await fetchPage(PAGES.color, 5);
		const typoData = await fetchPage(PAGES.typography, 5);
		const spacingData = await fetchPage(PAGES.spacing, 5);
		const materialsData = await fetchPage(PAGES.materials, 5);

		// Extract tokens
		const colors: ExtractedColor[] = [];
		for (const [_, nd] of Object.entries<any>(colorData.nodes || {})) extractColors(nd.document, "", colors);

		const typography: any[] = [];
		for (const [_, nd] of Object.entries<any>(typoData.nodes || {})) extractTypography(nd.document, typography);

		const spacingValues: number[] = [];
		for (const [_, nd] of Object.entries<any>(spacingData.nodes || {})) extractSpacing(nd.document, spacingValues);

		const materials: any[] = [];
		for (const [_, nd] of Object.entries<any>(materialsData.nodes || {})) extractMaterials(nd.document, materials);

		// Build CSS
		const cssVariables = buildCSS(colors, typography, materials, spacingValues);

		// Store in DB
		await ctx.runMutation(internal.designTokens.storeTokens, {
			fileKey: args.fileKey,
			syncedAt: Date.now(),
			colors: colors.slice(0, 200), // Keep first 200 for reference
			typography: [...new Set(typography.map((t: any) => JSON.stringify(t)))].map((s: string) => JSON.parse(s)).slice(0, 50),
			spacing: [...new Set(spacingValues)].sort((a, b) => a - b),
			materials: materials.slice(0, 30),
			cssVariables,
			tokenCount: colors.length,
		});

		console.log(`🎨 Synced ${colors.length} colors, ${typography.length} type styles, ${spacingValues.length} spacing values, ${materials.length} materials`);
	},
});
