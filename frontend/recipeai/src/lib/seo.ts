interface SeoConfig {
	title: string;
	description: string;
	canonicalPath: string;
	noindex?: boolean;
	structuredData?: Record<string, unknown>;
}

const SITE_NAME = "Dish Genie";
const DEFAULT_TITLE = "Dish Genie";
const DEFAULT_DESCRIPTION =
	"Dish Genie helps you generate recipes from the ingredients you already have, browse public recipes, and plan meals faster.";

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
			title: "Dish Genie | Smart recipe generation from ingredients you already have",
			description:
				"Dish Genie generates meal ideas from ingredients you already have, helps you browse public recipes, and keeps your cooking plan organized.",
			canonicalPath: "/",
			structuredData: {
				"@context": "https://schema.org",
				"@type": "WebSite",
				name: SITE_NAME,
				url: toAbsoluteUrl("/"),
				description:
					"Dish Genie generates meal ideas from ingredients you already have, helps you browse public recipes, and keeps your cooking plan organized.",
			},
		};
	}

	if (decodedPath === "/Recipes") {
		return {
			title: "Browse public recipes | Dish Genie",
			description:
				"Discover the latest public recipes on Dish Genie and open any recipe for ingredients, steps, and cooking time.",
			canonicalPath: "/Recipes",
		};
	}

	if (decodedPath.startsWith("/Recipe/") && decodedPath !== "/Recipe") {
		return {
			title: "Recipe details | Dish Genie",
			description:
				"Open a public recipe on Dish Genie to view its ingredients, steps, and cooking time.",
			canonicalPath: decodedPath,
		};
	}

	if (
		["/login", "/register", "/Recipe", "/admin", "/My Profile", "/My Preferences", "/ShoppingList"].includes(decodedPath)
	) {
		return {
			title: decodedPath === "/login"
				? "Log in | Dish Genie"
				: decodedPath === "/register"
					? "Create account | Dish Genie"
					: decodedPath === "/Recipe"
						? "Recipe generator | Dish Genie"
						: decodedPath === "/admin"
							? "Admin | Dish Genie"
							: decodedPath === "/ShoppingList"
								? "Shopping list | Dish Genie"
								: decodedPath === "/My Profile"
									? "My profile | Dish Genie"
									: "My preferences | Dish Genie",
			description: DEFAULT_DESCRIPTION,
			canonicalPath: decodedPath,
			noindex: true,
		};
	}

	return {
		title: "Dish Genie",
		description: DEFAULT_DESCRIPTION,
		canonicalPath: decodedPath,
		noindex: true,
	};
};
