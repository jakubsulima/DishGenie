export interface SeoConfig {
	title: string;
	description: string;
	canonicalPath: string;
	noindex?: boolean;
	structuredData?: Record<string, unknown>;
}

const SITE_NAME = "Recipe AI";
const DEFAULT_TITLE = "Recipe AI";
const DEFAULT_DESCRIPTION =
	"Recipe AI helps you generate recipes from the ingredients you already have, browse public recipes, and plan meals faster.";

const getOrigin = () => window.location.origin.replace(/\/$/, "");

const safeDecodePath = (pathname: string) => {
	try {
		return decodeURIComponent(pathname);
	} catch {
		return pathname;
	}
};

const toAbsoluteUrl = (pathname: string) => {
	const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
	return new URL(normalizedPath, `${getOrigin()}/`).toString();
};

const ensureMetaTag = (
	selector: string,
	attributes: Record<string, string>,
) => {
	let element = document.head.querySelector<HTMLMetaElement>(selector);

	if (!element) {
		element = document.createElement("meta");
		document.head.appendChild(element);
	}

	for (const [attribute, value] of Object.entries(attributes)) {
		element.setAttribute(attribute, value);
	}

	return element;
};

const ensureLinkTag = (selector: string, attributes: Record<string, string>) => {
	let element = document.head.querySelector<HTMLLinkElement>(selector);

	if (!element) {
		element = document.createElement("link");
		document.head.appendChild(element);
	}

	for (const [attribute, value] of Object.entries(attributes)) {
		element.setAttribute(attribute, value);
	}

	return element;
};

const ensureJsonLdScript = (jsonLd: Record<string, unknown> | undefined) => {
	const existing = document.head.querySelector<HTMLScriptElement>(
		'script[data-seo="json-ld"]',
	);

	if (!jsonLd) {
		existing?.remove();
		return;
	}

	const script = existing ?? document.createElement("script");
	script.type = "application/ld+json";
	script.dataset.seo = "json-ld";
	script.textContent = JSON.stringify(jsonLd);

	if (!existing) {
		document.head.appendChild(script);
	}
};

export const applySeo = (config: SeoConfig) => {
	document.title = config.title || DEFAULT_TITLE;

	ensureMetaTag('meta[name="description"]', {
		name: "description",
		content: config.description || DEFAULT_DESCRIPTION,
	});

	ensureMetaTag('meta[name="robots"]', {
		name: "robots",
		content: config.noindex ? "noindex,nofollow" : "index,follow",
	});

	ensureMetaTag('meta[property="og:title"]', {
		property: "og:title",
		content: config.title || DEFAULT_TITLE,
	});

	ensureMetaTag('meta[property="og:description"]', {
		property: "og:description",
		content: config.description || DEFAULT_DESCRIPTION,
	});

	ensureMetaTag('meta[property="og:type"]', {
		property: "og:type",
		content: config.structuredData ? "website" : "article",
	});

	ensureMetaTag('meta[name="twitter:card"]', {
		name: "twitter:card",
		content: "summary_large_image",
	});

	ensureMetaTag('meta[name="twitter:title"]', {
		name: "twitter:title",
		content: config.title || DEFAULT_TITLE,
	});

	ensureMetaTag('meta[name="twitter:description"]', {
		name: "twitter:description",
		content: config.description || DEFAULT_DESCRIPTION,
	});

	ensureLinkTag('link[rel="canonical"]', {
		rel: "canonical",
		href: toAbsoluteUrl(config.canonicalPath),
	});

	ensureJsonLdScript(config.structuredData);
};

export const getSeoConfig = (pathname: string): SeoConfig => {
	const decodedPath = safeDecodePath(pathname).replace(/\/+$/, "") || "/";

	if (decodedPath === "/") {
		return {
			title: "Recipe AI | Smart recipe generation from ingredients you already have",
			description:
				"Recipe AI generates meal ideas from ingredients you already have, helps you browse public recipes, and keeps your cooking plan organized.",
			canonicalPath: "/",
			structuredData: {
				"@context": "https://schema.org",
				"@type": "WebSite",
				name: SITE_NAME,
				url: toAbsoluteUrl("/"),
				description:
					"Recipe AI generates meal ideas from ingredients you already have, helps you browse public recipes, and keeps your cooking plan organized.",
			},
		};
	}

	if (decodedPath === "/Recipes") {
		return {
			title: "Browse public recipes | Recipe AI",
			description:
				"Discover the latest public recipes on Recipe AI and open any recipe for ingredients, steps, and cooking time.",
			canonicalPath: "/Recipes",
		};
	}

	if (decodedPath.startsWith("/Recipe/") && decodedPath !== "/Recipe") {
		return {
			title: "Recipe details | Recipe AI",
			description:
				"Open a public recipe on Recipe AI to view its ingredients, steps, and cooking time.",
			canonicalPath: decodedPath,
		};
	}

	if (
		["/login", "/register", "/Recipe", "/admin", "/My Profile", "/My Preferences", "/ShoppingList"].includes(decodedPath)
	) {
		return {
			title: decodedPath === "/login"
				? "Log in | Recipe AI"
				: decodedPath === "/register"
					? "Create account | Recipe AI"
					: decodedPath === "/Recipe"
						? "Recipe generator | Recipe AI"
						: decodedPath === "/admin"
							? "Admin | Recipe AI"
							: decodedPath === "/ShoppingList"
								? "Shopping list | Recipe AI"
								: decodedPath === "/My Profile"
									? "My profile | Recipe AI"
									: "My preferences | Recipe AI",
			description: DEFAULT_DESCRIPTION,
			canonicalPath: decodedPath,
			noindex: true,
		};
	}

	return {
		title: "Recipe AI",
		description: DEFAULT_DESCRIPTION,
		canonicalPath: decodedPath,
		noindex: true,
	};
};
