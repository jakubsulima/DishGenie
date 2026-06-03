import { blogPosts, getBlogPost } from "./blogPosts";

interface SeoConfig {
	title: string;
	description: string;
	canonicalPath: string;
	noindex?: boolean;
	ogType?: "website" | "article";
	structuredData?: Record<string, unknown>;
}

const SITE_NAME = "Dish Genie";
const DEFAULT_TITLE = "Dish Genie";
const DEFAULT_DESCRIPTION =
	"Dish Genie helps you decide what to cook from ingredients you already have, without meal planning, inventory setup, or endless recipe scrolling.";

const NOINDEX_ROUTE_TITLES: Record<string, string> = {
	"/login": "Log in | Dish Genie",
	"/register": "Create account | Dish Genie",
	"/Recipe": "Recipe generator | Dish Genie",
	"/admin": "Admin | Dish Genie",
	"/My Profile": "My profile | Dish Genie",
	"/My Preferences": "My preferences | Dish Genie",
	"/ShoppingList": "Shopping list | Dish Genie",
};

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
		content: config.ogType ?? "website",
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
			title: "Dish Genie | What can I cook with these ingredients?",
			description:
				"Type a few ingredients and Dish Genie gives you 3 realistic dinner ideas without inventory setup or an endless recipe feed.",
			canonicalPath: "/",
			structuredData: {
				"@context": "https://schema.org",
				"@type": "WebSite",
				name: SITE_NAME,
				url: toAbsoluteUrl("/"),
				description:
					"Dish Genie turns available ingredients into 3 realistic dinner ideas instead of another endless recipe feed.",
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

	if (decodedPath === "/privacy") {
		return {
			title: "Privacy Policy | Dish Genie",
			description:
				"Read the Dish Genie Privacy Policy to understand what information the app collects, how it is used, and how analytics choices work.",
			canonicalPath: "/privacy",
		};
	}

	if (decodedPath === "/terms") {
		return {
			title: "Terms of Service | Dish Genie",
			description:
				"Read the Dish Genie Terms of Service, including acceptable use, AI recipe output guidance, and service rules.",
			canonicalPath: "/terms",
		};
	}

	if (decodedPath === "/blog") {
		return {
			title: "Dish Genie Blog | Practical cooking and AI recipe tips",
			description:
				"Read practical Dish Genie guides on meal planning, fridge organization, AI recipe generation, and cooking from ingredients you already have.",
			canonicalPath: "/blog",
			structuredData: {
				"@context": "https://schema.org",
				"@type": "Blog",
				name: "Dish Genie Blog",
				url: toAbsoluteUrl("/blog"),
				description:
					"Practical guides on meal planning, fridge organization, and AI recipe generation.",
				blogPost: blogPosts.map((post) => ({
					"@type": "BlogPosting",
					headline: post.title,
					description: post.description,
					datePublished: post.publishedAt,
					url: toAbsoluteUrl(`/blog/${post.slug}`),
				})),
			},
		};
	}

	if (decodedPath.startsWith("/blog/")) {
		const slug = decodedPath.replace("/blog/", "");
		const post = getBlogPost(slug);

		if (post) {
			return {
				title: `${post.title} | Dish Genie Blog`,
				description: post.description,
				canonicalPath: `/blog/${post.slug}`,
				ogType: "article",
				structuredData: {
					"@context": "https://schema.org",
					"@type": "BlogPosting",
					headline: post.title,
					description: post.description,
					datePublished: post.publishedAt,
					author: {
						"@type": "Organization",
						name: SITE_NAME,
					},
					publisher: {
						"@type": "Organization",
						name: SITE_NAME,
					},
					mainEntityOfPage: toAbsoluteUrl(`/blog/${post.slug}`),
				},
			};
		}
	}

	const noindexTitle = NOINDEX_ROUTE_TITLES[decodedPath];
	if (noindexTitle) {
		return {
			title: noindexTitle,
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
